/**
 * dsh-ding
 *
 * 当 Agent 完成一轮对话（状态回到 idle，不再主动输出）时，播放提示音并通过
 * Windows 通知提醒用户。v0.4.0 起提供 Web 控制面：
 *
 *   - 运行时可调设置（提示音开关 / 音量 / 音效文件 / 气泡通知开关 / 标题）
 *     通过 `GET/POST /dsh-ding/settings` 读写，持久化到 profile 的
 *     `data/dsh-ding.json`；WebUI 上的铃铛按钮即调用这些接口。
 *   - `POST /dsh-ding/test` 立即试听当前提示音（不弹通知）。
 *   - `GET/POST /dsh-ding/sounds` 列出/上传自定义音效（存到 `data/sounds/`）。
 *
 * 事件：`agent/status`（running / idle），配合三重过滤判断"整轮完成"：
 * agent 在回复中途（等待后台任务/工具间隙）会短暂进入 maintenance 相位或
 * step 间隙的 idle（status 同样是 "idle"），必须排除：① 相位必须是 idle（非
 * maintenance）；② 会话日志里最新一轮必须已 turn/end（turn/start 号 <= turn/end 号）。
 * 行为：
 *   - 真 idle 时触发完成提醒（防抖 debounceMs + 全局节流 minIntervalMs）
 *   - running 记录开始时间（通知文本带耗时）并调度"运行中提醒"
 *   - 跳过子代理（origin === "subagent"），它们只是主代理回合中间过程
 *   - tools/pre-execute 旁听 ask_user_question → 用户提问提醒（立即，文本定制）
 *
 * 配置（cordis.patch.yml 的 config，作为运行时设置的默认值）：
 *   sound: true          播放提示音（默认 true）
 *   soundFile: 'C:\\codewhale\\ding.mp3'  提示音文件（mp3/wav 等；留空则用内置“叮咚”）
 *   volume: 1.0          提示音音量 0.0~1.0（默认 1.0 = 原始音量）
 *   balloon: true        显示 Windows 通知（默认 true）
 *   title: 'DSH 完成'    通知标题
 *   debounceMs: 800      防抖毫秒数
 *   minIntervalMs: 3000  两次通知的最小间隔
 *   notifySubagents: false  是否也通知子代理完成（默认 false）
 *   quietOnViewing: true 当前会话免打扰：当 WebUI 窗口在前台（可见且有焦点）
 *                        且完成的会话正是当前正在查看的会话时静默；
 *                        切走窗口、看别的会话、或没开对话页时照常提醒
 *                        （浏览器通过 POST /dsh-ding/presence 上报前台状态与当前会话）
 *   runningNotify: true  长任务运行中提醒：任务运行超过 runningFirstAfterMs
 *                        后首次提醒，之后每 runningIntervalMs 提醒一次
 *                        （只弹 Windows 通知，不响铃——完成前不打扰）
 *   runningFirstAfterMs: 180000  运行中提醒首次延迟毫秒数（默认 3 分钟）
 *   runningIntervalMs: 300000    运行中提醒后续间隔毫秒数（默认 5 分钟）
 *   questionNotify: true 用户提问提醒：Agent 通过 ask_user_question 向你提问
 *                        （等待回答）时立即提醒（文本区别于完成通知）
 *   questionTitle: 'DSH 提问'  提问提醒的通知标题
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { basename, extname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync, watch } from "node:fs";
import { readFile } from "node:fs/promises";
import { homedir } from "node:os";

const NOTIFY_SCRIPT = fileURLToPath(new URL("../notify.ps1", import.meta.url));

/** 允许上传/列出的音效扩展名（MCI 可播放的类型）。 */
const SOUND_EXTENSIONS = new Set([".mp3", ".wav", ".mid", ".wma", ".aac", ".m4a", ".ogg", ".flac"]);

/** 音效文件的 HTTP content-type 映射（浏览器试听用）。 */
const SOUND_MIME = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mid": "audio/midi",
  ".wma": "audio/x-ms-wma",
  ".aac": "audio/aac",
  ".m4a": "audio/mp4",
  ".ogg": "audio/ogg",
  ".flac": "audio/flac"
};

/**
 * 解析当前生效的音效文件：优先显式 soundFile，为空时按 notify.ps1 同款候选顺序
 * （服务器工作目录 / 插件目录上级 / 用户主目录）找 ding.mp3。
 * @param specified - 配置或运行时设置的 soundFile（可能为空 = 内置叮咚）。
 * @returns 存在的文件绝对路径，找不到返回 null。
 */
function resolveSoundFile(specified) {
  if (specified && existsSync(specified)) return specified;
  const candidates = [
    join(process.cwd(), "ding.mp3"),
    join(fileURLToPath(new URL("../ding.mp3", import.meta.url))),
    join(homedir(), "ding.mp3")
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/** 从会话日志里折叠出最新的标题（session/title 事件）。 */
function sessionTitleOf(session) {
  const events = session?.events;
  if (!Array.isArray(events)) return void 0;
  const event = typeof events.findLast === "function"
    ? events.findLast((item) => item.type === "session/title")
    : [...events].reverse().find((item) => item.type === "session/title");
  return event?.data?.title;
}

/** 把毫秒时长格式化（中文："X 分 Y 秒"；英文："3m 12s" / "5 minutes"）。 */
function formatElapsed(ms, zh = true) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  if (zh) {
    if (totalSeconds < 60) return `${totalSeconds} 秒`;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    if (minutes < 60) return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分钟`;
    const hours = Math.floor(minutes / 60);
    const restMinutes = minutes % 60;
    return restMinutes > 0 ? `${hours} 小时 ${restMinutes} 分` : `${hours} 小时`;
  }
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const restMinutes = minutes % 60;
  return restMinutes > 0 ? `${hours}h ${restMinutes}m` : `${hours}h`;
}

/** 对话前缀（按语言）：中文「标题」/ 英文 "title"。 */
function conversationPrefix(session, zh = true) {
  const titleText = sessionTitleOf(session);
  if (zh) {
    return typeof titleText === "string" && titleText.length > 0 ? `对话「${titleText}」` : "对话";
  }
  return typeof titleText === "string" && titleText.length > 0 ? `Conversation "${titleText}"` : "Conversation";
}

/** 当前界面语言是否中文（presence 上报，默认中文）。 */
function isZh(state) {
  return state?.locale !== "en";
}

/** 通知标题：用户自定义（≠默认值）时用自定义值；否则按语言给默认标题。
 * mode: 'done'（默认，完成/运行中之外的常规标题）| 'running'（运行中提醒）| 'question'（提问）。
 * 兼容旧调用：传 true 等价于 'question'。 */
function notifyTitleOf(state, options, zh, mode = "done") {
  const m = mode === true ? "question" : mode;
  const configured = m === "question" ? state.questionTitle : m === "running" ? state.runningTitle : state.title;
  const fallback = m === "question" ? options.questionTitle : m === "running" ? options.runningTitle : options.title;
  if (typeof configured === "string" && configured.length > 0 && configured !== fallback) {
    return configured; // 用户自定义过，尊重用户
  }
  if (zh) {
    if (m === "question") return "DSH 提问";
    if (m === "running") return "DSH 运行中";
    return "DSH 完成";
  }
  if (m === "question") return "DSH Question";
  if (m === "running") return "DSH Running";
  return "DSH Done";
}

/** WebUI 地址（通知点击跳转用）。
 * 优先用浏览器请求学到的地址（Host 头，端口自适应），
 * 兜底读 webServer 服务端口（监听完成后可用；插件激活可能早于监听）。 */
function baseUrlOf(ctx, state) {
  if (typeof state?.learnedBaseUrl === "string" && state.learnedBaseUrl.length > 0) return state.learnedBaseUrl;
  const port = ctx.get?.("webServer")?.port ?? ctx.webServer?.port;
  return typeof port === "number" && Number.isFinite(port) && port > 0 ? `http://127.0.0.1:${port}` : "";
}


function spawnNotifier(ctx, args) {
  const child = spawn("powershell.exe", args, {
    windowsHide: true,
    stdio: "ignore"
  });
  child.on("error", (error) => {
    ctx.logger.warn(`dsh-ding: 无法启动通知进程: ${String(error)}`);
  });
  child.unref?.();
}

/**
 * 定位本插件的持久化数据目录。
 * 优先用 cordis 配置树锚点（web profile 下即 profile 目录），
 * 兜底按 DSH_HOME 环境变量或 ~/.dsh 推算。
 */
function resolveDataDir(ctx) {
  if (typeof ctx.baseUrl === "string") {
    const anchored = join(ctx.baseUrl, "data");
    if (existsSync(join(ctx.baseUrl, "cordis.yml")) || existsSync(join(ctx.baseUrl, "package.json"))) return anchored;
  }
  const env = process.env.DSH_HOME;
  const home = typeof env === "string" && env.trim().length > 0 ? env : join(homedir(), ".dsh");
  return join(home, "profiles", "web", "data");
}

/** 简单 JSON 响应。 */
function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(payload)
  });
  res.end(payload);
}

/** 读取请求体（文本）。 */
async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export default function dshNotifyDone(ctx, config = {}) {
  const options = {
    sound: config.sound !== false,
    balloon: config.balloon !== false,
    title: typeof config.title === "string" && config.title.length > 0 ? config.title : "DSH 完成",
    soundFile: typeof config.soundFile === "string" && config.soundFile.length > 0 ? config.soundFile : "",
    volume: Number.isFinite(Number(config.volume)) ? Math.max(0, Math.min(1, Number(config.volume))) : 1,
    debounceMs: Math.max(0, Number(config.debounceMs) || 0) || 800,
    minIntervalMs: Math.max(0, Number(config.minIntervalMs) || 0) || 3000,
    notifySubagents: config.notifySubagents === true,
    quietOnViewing: config.quietOnViewing !== false,
    runningNotify: config.runningNotify !== false,
    runningFirstAfterMs: Math.max(0, Number(config.runningFirstAfterMs) || 0) || 180000,
    runningIntervalMs: Math.max(0, Number(config.runningIntervalMs) || 0) || 300000,
    questionNotify: config.questionNotify !== false,
    questionTitle: typeof config.questionTitle === "string" && config.questionTitle.length > 0 ? config.questionTitle : "DSH 提问",
    runningTitle: typeof config.runningTitle === "string" && config.runningTitle.length > 0 ? config.runningTitle : "DSH 运行中"
  };

  // ---------------- 通知函数组（定义在插件函数体内：引用本闭包的 runningTimers 等） ----------------

  /** 渲染自定义通知模板：{title}=会话标题 {prefix}=对话前缀 {elapsed}=耗时 {question}=问题文本。 */
  function renderTemplate(template, vars) {
    let out = template;
    out = out.split("{title}").join(vars.title ?? "");
    out = out.split("{prefix}").join(vars.prefix ?? "");
    out = out.split("{elapsed}").join(vars.elapsed ?? "");
    out = out.split("{question}").join(vars.question ?? "");
    return out;
  }

  /** 启动一个隐藏的 powershell 进程执行 notify.ps1（提示音 + 通知）。 */
  function notify(ctx, session, options, state) {
    if (state.sound === false && state.balloon === false) return; // 全部关闭，无事可做
    if (state.quietOnViewing && state.foreground && state.activeSession && session?.id === state.activeSession) {
      return; // 正在查看的会话完成了：用户正盯着它，不打扰
    }
    const zh = isZh(state);
    const elapsedMs = runningSince.get(session?.id);
    const hasElapsed = typeof elapsedMs === "number" && elapsedMs > 0 && Date.now() - elapsedMs >= 1000;
    const elapsedText = hasElapsed ? formatElapsed(Date.now() - elapsedMs, zh) : "";
    const prefix = conversationPrefix(session, zh);
    const template = typeof state.doneTemplate === "string" ? state.doneTemplate.trim() : "";
    const text = template.length > 0
      ? renderTemplate(template, { title: sessionTitleOf(session) ?? "", prefix, elapsed: elapsedText })
      : zh
        ? `${prefix}已完成${hasElapsed ? `，用时 ${elapsedText}` : ""}，可以查看回复了`
        : `${prefix} finished${hasElapsed ? ` (took ${elapsedText})` : ""} — check the reply`;
    const args = [
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-WindowStyle", "Hidden",
      "-File", NOTIFY_SCRIPT,
      "-Title", notifyTitleOf(state, options, zh),
      "-Text", text
    ];
    if (state.sound !== false) {
      if (state.soundFile) args.push("-SoundFile", state.soundFile);
      args.push("-Volume", String(state.volume));
    } else {
      args.push("-NoSound");
    }
    if (state.balloon === false) args.push("-NoToast");
    // 通知点击跳转：携带会话 id 与 WebUI 地址（notify.ps1 据此生成跳转链接）
    const baseUrl = baseUrlOf(ctx, state);
    if (baseUrl && session?.id) {
      args.push("-SessionId", session.id, "-BaseUrl", baseUrl);
    }
    spawnNotifier(ctx, args);
  }
  
  /** 试听提示音：只播放声音，不弹任何通知。静音时无事可做。 */
  function playTest(ctx, state) {
    if (state.sound === false) return; // 已静音，试听无意义
    const args = [
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-WindowStyle", "Hidden",
      "-File", NOTIFY_SCRIPT,
      "-SoundOnly"
    ];
    if (state.soundFile) args.push("-SoundFile", state.soundFile);
    args.push("-Volume", String(state.volume));
    spawnNotifier(ctx, args);
  }
  
  /**
   * 长任务"运行中"提醒：只弹 Windows 通知、不响铃（完成前不打扰用户）。
   * 触发时机由 scheduleRunning 控制（首次 runningFirstAfterMs，之后每 runningIntervalMs）。
   */
  function notifyRunning(ctx, session, options, state, elapsedMs) {
    const zh = isZh(state);
    const prefix = conversationPrefix(session, zh);
    const elapsedText = formatElapsed(elapsedMs, zh);
    const template = typeof state.runningTemplate === "string" ? state.runningTemplate.trim() : "";
    const text = template.length > 0
      ? renderTemplate(template, { title: sessionTitleOf(session) ?? "", prefix, elapsed: elapsedText })
      : zh
        ? `${prefix}已运行 ${elapsedText}，任务仍在进行中`
        : `${prefix} has been running for ${elapsedText}, still in progress`;
    const args = [
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-WindowStyle", "Hidden",
      "-File", NOTIFY_SCRIPT,
      "-Title", notifyTitleOf(state, options, zh, "running"),
      "-Text", text,
      "-NoSound" // 运行中提醒一律不响铃
    ];
    if (state.balloon === false) args.push("-NoToast");
    const baseUrl = baseUrlOf(ctx, state);
    if (baseUrl && session?.id) {
      args.push("-SessionId", session.id, "-BaseUrl", baseUrl);
    }
    spawnNotifier(ctx, args);
  }
  
  /**
   * "用户提问"提醒：Agent 调用 ask_user_question 等待你回答时立即提醒。
   * 文本区别于完成通知：对话「xxx」需要你回答一个问题：<问题内容>。
   */
  function notifyQuestion(ctx, agent, options, state, questionText) {
    if (state.questionNotify === false) return;
    if (state.sound === false && state.balloon === false) return; // 全部关闭，无事可做
    if (state.quietOnViewing && state.foreground && state.activeSession && agent?.id === state.activeSession) {
      return; // 正在查看这个会话：提问框已经显示在页面里，不打扰
    }
    const zh = isZh(state);
    const prefix = agent?.id ? conversationPrefix(agent.session ?? agent, zh) : (zh ? "对话" : "Conversation");
    const trimmed = typeof questionText === "string" ? questionText.trim() : "";
    const template = typeof state.questionTemplate === "string" ? state.questionTemplate.trim() : "";
    const text = template.length > 0
      ? renderTemplate(template, { title: agent?.session ? sessionTitleOf(agent.session) ?? "" : "", prefix, question: trimmed })
      : trimmed.length > 0
        ? (zh ? `${prefix}需要你回答一个问题：${trimmed}` : `${prefix} needs your answer: ${trimmed}`)
        : (zh ? `${prefix}需要你回答一个问题` : `${prefix} needs your answer`);
    const args = [
      "-NoProfile", "-ExecutionPolicy", "Bypass",
      "-WindowStyle", "Hidden",
      "-File", NOTIFY_SCRIPT,
      "-Title", notifyTitleOf(state, options, zh, "question"),
      "-Text", text
    ];
    if (state.sound !== false) {
      if (state.soundFile) args.push("-SoundFile", state.soundFile);
      args.push("-Volume", String(state.volume));
    } else {
      args.push("-NoSound");
    }
    if (state.balloon === false) args.push("-NoToast");
    const baseUrl = baseUrlOf(ctx, state);
    if (baseUrl && agent?.id) {
      args.push("-SessionId", agent.id, "-BaseUrl", baseUrl);
    }
    spawnNotifier(ctx, args);
  }
  
  /** 清除某会话的运行中提醒定时器（turn/end、会话销毁时调用）。 */
  function clearRunningTimers(sessionId) {
    const timers = runningTimers.get(sessionId);
    if (!timers) return;
    clearTimeout(timers.first);
    if (timers.interval) clearInterval(timers.interval);
    runningTimers.delete(sessionId);
  }
  
  /** 为某会话调度运行中提醒：首次延迟后提醒，之后按固定间隔重复。 */
  function scheduleRunning(ctx, sessionId, session, options, state) {
    clearRunningTimers(sessionId);
    if (!state.notifySubagents && session?.header?.origin === "subagent") return; // 子代理运行是主代理回合的一部分，不单独提醒
    const start = runningSince.get(sessionId);
    if (typeof start !== "number") return; // 没记录到开始时间（插件启动前已在跑），不调度
    const fire = () => {
      // 每次触发都读当前设置：开关/前台状态随时可能变化（运行中提醒跟随运行时的 runningNotify）
      if (state.runningNotify === false || state.balloon === false) return;
      if (state.quietOnViewing && state.foreground && state.activeSession && sessionId === state.activeSession) {
        return; // 正在查看的会话运行中：用户正盯着它，不打扰
      }
      const now = Date.now();
      if (now - lastFired < state.minIntervalMs) return; // 与完成提醒共用节流
      lastFired = now;
      try {
        notifyRunning(ctx, session, options, state, now - start);
      } catch (error) {
        ctx.logger.warn(`dsh-ding: 运行中提醒失败: ${String(error)}`);
      }
    };
    const timers = { first: null, interval: null };
    // 首次提醒用 setTimeout 链（后续间隔每次从 state 读取，支持运行时改间隔）
    const armNext = () => {
      timers.interval = setTimeout(() => {
        fire();
        armNext();
      }, Math.max(0, Number(state.runningIntervalMs) || 300000));
    };
    timers.first = setTimeout(() => {
      fire();
      armNext();
    }, Math.max(0, Number(state.runningFirstAfterMs) || 180000));
    runningTimers.set(sessionId, timers);
  }


  // ---------------- 运行时设置（铃铛按钮读写） ----------------
  const dataDir = resolveDataDir(ctx);
  const settingsFile = join(dataDir, "dsh-ding.json");
  const soundsDir = join(dataDir, "sounds");

  /** 当前生效设置：config 为默认值，runtime 覆盖层（持久化 JSON）优先。
   * 所有可配置项都进 state：高级设置面板可即时读写全部参数。 */
  const state = {
    sound: options.sound,
    balloon: options.balloon,
    title: options.title,
    soundFile: options.soundFile,
    volume: options.volume,
    quietOnViewing: options.quietOnViewing,
    runningNotify: options.runningNotify,
    runningFirstAfterMs: options.runningFirstAfterMs,
    runningIntervalMs: options.runningIntervalMs,
    questionNotify: options.questionNotify,
    questionTitle: options.questionTitle,
    runningTitle: options.runningTitle,
    notifySubagents: options.notifySubagents,
    debounceMs: options.debounceMs,
    minIntervalMs: options.minIntervalMs,
    doneTemplate: "",      // 自定义完成通知文本模板（空 = 默认）；支持 {title}/{prefix}/{elapsed}
    runningTemplate: "",   // 自定义运行中提醒文本模板（空 = 默认）；支持 {title}/{prefix}/{elapsed}
    questionTemplate: "",  // 自定义提问通知文本模板（空 = 默认）；支持 {title}/{prefix}/{question}
    foreground: false,     // 瞬时状态（不持久化）：WebUI 页面是否在前台，由客户端上报
    activeSession: null,   // 瞬时状态（不持久化）：客户端当前正在查看的会话 id，由客户端上报
    learnedBaseUrl: "",    // 瞬时状态（不持久化）：从浏览器请求 Host 头学到的 WebUI 地址
    locale: "zh"           // 瞬时状态（不持久化）：WebUI 当前语言（zh/en），决定通知文本语言
  };

  /** 把持久化设置合并进 state（只覆盖持久化字段，保留前台/会话/语言等瞬时字段）。
   * 启动加载与文件热重载共用。 */
  function applyPersisted(saved) {
    if (!saved || typeof saved !== "object") return;
    if (typeof saved.sound === "boolean") state.sound = saved.sound;
    if (typeof saved.balloon === "boolean") state.balloon = saved.balloon;
    if (typeof saved.title === "string" && saved.title.length > 0) state.title = saved.title;
    if (typeof saved.soundFile === "string") state.soundFile = saved.soundFile;
    if (Number.isFinite(Number(saved.volume))) state.volume = Math.max(0, Math.min(1, Number(saved.volume)));
    if (typeof saved.quietOnViewing === "boolean") state.quietOnViewing = saved.quietOnViewing;
    if (typeof saved.runningNotify === "boolean") state.runningNotify = saved.runningNotify;
    if (Number.isFinite(Number(saved.runningFirstAfterMs))) state.runningFirstAfterMs = Math.max(0, Number(saved.runningFirstAfterMs));
    if (Number.isFinite(Number(saved.runningIntervalMs))) state.runningIntervalMs = Math.max(0, Number(saved.runningIntervalMs));
    if (typeof saved.questionNotify === "boolean") state.questionNotify = saved.questionNotify;
    if (typeof saved.questionTitle === "string" && saved.questionTitle.length > 0) state.questionTitle = saved.questionTitle;
    if (typeof saved.runningTitle === "string" && saved.runningTitle.length > 0) state.runningTitle = saved.runningTitle;
    if (typeof saved.notifySubagents === "boolean") state.notifySubagents = saved.notifySubagents;
    if (Number.isFinite(Number(saved.debounceMs))) state.debounceMs = Math.max(0, Number(saved.debounceMs));
    if (Number.isFinite(Number(saved.minIntervalMs))) state.minIntervalMs = Math.max(0, Number(saved.minIntervalMs));
    if (typeof saved.doneTemplate === "string") state.doneTemplate = saved.doneTemplate;
    if (typeof saved.runningTemplate === "string") state.runningTemplate = saved.runningTemplate;
    if (typeof saved.questionTemplate === "string") state.questionTemplate = saved.questionTemplate;
  }

  try {
    if (existsSync(settingsFile)) {
      applyPersisted(JSON.parse(readFileSync(settingsFile, "utf8")));
    }
  } catch (error) {
    ctx.logger.warn(`dsh-ding: 读取运行时设置失败（忽略）: ${String(error)}`);
  }

  /** 文件热重载标志：自己持久化写文件时置位，避免触发无谓重载。 */
  let selfWrite = false;

  function persistSettings() {
    try {
      mkdirSync(dataDir, { recursive: true });
      selfWrite = true;
      writeFileSync(settingsFile, JSON.stringify({
        sound: state.sound,
        balloon: state.balloon,
        title: state.title,
        soundFile: state.soundFile,
        volume: state.volume,
        quietOnViewing: state.quietOnViewing,
        runningNotify: state.runningNotify,
        runningFirstAfterMs: state.runningFirstAfterMs,
        runningIntervalMs: state.runningIntervalMs,
        questionNotify: state.questionNotify,
        questionTitle: state.questionTitle,
        runningTitle: state.runningTitle,
        notifySubagents: state.notifySubagents,
        debounceMs: state.debounceMs,
        minIntervalMs: state.minIntervalMs,
        doneTemplate: state.doneTemplate,
        runningTemplate: state.runningTemplate,
        questionTemplate: state.questionTemplate
      }, null, 2), "utf8");
      // 写完后释放标志（watch 事件在事件循环中异步触发，此时已复位则重载也无害）
      setTimeout(() => { selfWrite = false; }, 600);
    } catch (error) {
      ctx.logger.warn(`dsh-ding: 保存运行时设置失败: ${String(error)}`);
    }
  }

  // ---------------- 设置文件热重载 ----------------
  // 直接编辑 data/dsh-ding.json 也能即时生效（300ms 防抖，避免编辑器多事件抖动）：
  // 仅重载持久化字段，保留前台/当前会话/语言等瞬时状态；解析失败或自身写入时跳过。
  let reloadTimer = null;
  try {
    const watcher = watch(settingsFile, () => {
      if (selfWrite) return;
      if (reloadTimer) clearTimeout(reloadTimer);
      reloadTimer = setTimeout(() => {
        try {
          if (existsSync(settingsFile)) {
            applyPersisted(JSON.parse(readFileSync(settingsFile, "utf8")));
            ctx.logger.info("dsh-ding: 设置文件已热重载");
          }
        } catch { /* 文件写入中或损坏，等待下一次事件 */ }
      }, 300);
    });
    watcher.unref?.();
  } catch (error) {
    ctx.logger.warn(`dsh-ding: 设置文件监听不可用（热重载关闭）: ${String(error)}`);
  }

  function settingsSnapshot() {
    return {
      sound: state.sound,
      balloon: state.balloon,
      title: state.title,
      soundFile: state.soundFile,
      volume: state.volume,
      quietOnViewing: state.quietOnViewing,
      runningNotify: state.runningNotify,
      runningFirstAfterMs: state.runningFirstAfterMs,
      runningIntervalMs: state.runningIntervalMs,
      questionNotify: state.questionNotify,
      questionTitle: state.questionTitle,
      runningTitle: state.runningTitle,
      notifySubagents: state.notifySubagents,
      debounceMs: state.debounceMs,
      minIntervalMs: state.minIntervalMs,
      doneTemplate: state.doneTemplate,
      runningTemplate: state.runningTemplate,
      questionTemplate: state.questionTemplate,
      // 各标题的配置默认值（客户端据此判断"未自定义"，切换语言时显示语言化默认标题）
      defaults: {
        title: options.title,
        runningTitle: options.runningTitle,
        questionTitle: options.questionTitle
      }
    };
  }

  /** 应用一次设置更新（只更新出现的字段），并持久化。 */
  function applySettings(patch) {
    if (typeof patch.sound === "boolean") state.sound = patch.sound;
    if (typeof patch.balloon === "boolean") state.balloon = patch.balloon;
    if (typeof patch.title === "string" && patch.title.length > 0) state.title = patch.title;
    if (typeof patch.soundFile === "string") state.soundFile = patch.soundFile;
    if (patch.volume !== void 0 && Number.isFinite(Number(patch.volume))) {
      state.volume = Math.max(0, Math.min(1, Number(patch.volume)));
    }
    if (typeof patch.quietOnViewing === "boolean") state.quietOnViewing = patch.quietOnViewing;
    if (typeof patch.runningNotify === "boolean") state.runningNotify = patch.runningNotify;
    if (patch.runningFirstAfterMs !== void 0 && Number.isFinite(Number(patch.runningFirstAfterMs))) {
      state.runningFirstAfterMs = Math.max(0, Number(patch.runningFirstAfterMs));
    }
    if (patch.runningIntervalMs !== void 0 && Number.isFinite(Number(patch.runningIntervalMs))) {
      state.runningIntervalMs = Math.max(0, Number(patch.runningIntervalMs));
    }
    if (typeof patch.questionNotify === "boolean") state.questionNotify = patch.questionNotify;
    if (typeof patch.questionTitle === "string" && patch.questionTitle.length > 0) state.questionTitle = patch.questionTitle;
    if (typeof patch.runningTitle === "string" && patch.runningTitle.length > 0) state.runningTitle = patch.runningTitle;
    if (typeof patch.notifySubagents === "boolean") state.notifySubagents = patch.notifySubagents;
    if (patch.debounceMs !== void 0 && Number.isFinite(Number(patch.debounceMs))) {
      state.debounceMs = Math.max(0, Number(patch.debounceMs));
    }
    if (patch.minIntervalMs !== void 0 && Number.isFinite(Number(patch.minIntervalMs))) {
      state.minIntervalMs = Math.max(0, Number(patch.minIntervalMs));
    }
    if (typeof patch.doneTemplate === "string") state.doneTemplate = patch.doneTemplate;
    if (typeof patch.runningTemplate === "string") state.runningTemplate = patch.runningTemplate;
    if (typeof patch.questionTemplate === "string") state.questionTemplate = patch.questionTemplate;
    persistSettings();
    return settingsSnapshot();
  }

  // ---------------- 前台状态（presence）超时复位 ----------------
  // 浏览器每 30s 心跳上报；超过 60s 无上报（浏览器关闭/断网/页面销毁）则复位为"不在前台"，
  // 避免残留 true 导致完成任务永远不提醒。
  let presenceTimer = null;
  function touchPresence() {
    if (presenceTimer) clearTimeout(presenceTimer);
    presenceTimer = setTimeout(() => { state.foreground = false; }, 60000);
  }

  /** 音效清单：内置“叮咚” + data/sounds 下的音频文件。 */  function listSounds() {
    const items = [{ id: "builtin", name: "内置叮咚", path: "" }];
    try {
      if (existsSync(soundsDir)) {
        for (const file of readdirSync(soundsDir)) {
          if (SOUND_EXTENSIONS.has(extname(file).toLowerCase())) {
            items.push({ id: file, name: file, path: join(soundsDir, file) });
          }
        }
      }
    } catch (error) {
      ctx.logger.warn(`dsh-ding: 扫描音效目录失败: ${String(error)}`);
    }
    return items;
  }

  // ---------------- Web 控制面（铃铛按钮的 API） ----------------
  try {
    if (typeof ctx.webServer?.register === "function") {
      ctx.webServer.register({
        kind: "prefix",
        path: "/dsh-ding",
        handler: async (req, res) => {
          const url = new URL(req.url ?? "/", "http://dsh-ding");
          const route = url.pathname.replace(/^\/dsh-ding\/?/, "");
          // 从请求 Host 头学习 WebUI 地址（通知点击跳转用，端口自适应）
          if (!state.learnedBaseUrl && typeof req.headers?.host === "string" && req.headers.host.length > 0) {
            state.learnedBaseUrl = `http://${req.headers.host}`;
          }
          try {
            if (req.method === "GET" && route === "settings") {
              return json(res, 200, { ok: true, value: settingsSnapshot() });
            }
            if (req.method === "POST" && route === "settings") {
              const patch = JSON.parse(await readBody(req) || "{}");
              return json(res, 200, { ok: true, value: applySettings(patch) });
            }
            if (req.method === "POST" && route === "presence") {
              // 浏览器上报前台状态/当前会话/界面语言（瞬时，不持久化）：
              // quietOnViewing 据此决定"正在查看的会话完成/运行中"是否静默；
              // locale 决定通知文本语言（中/英）
              const body = JSON.parse(await readBody(req) || "{}");
              if (typeof body.foreground === "boolean") state.foreground = body.foreground;
              if (typeof body.sessionId === "string" && body.sessionId.length > 0) {
                state.activeSession = body.sessionId;
              } else if ("sessionId" in body) {
                state.activeSession = null;
              }
              if (typeof body.locale === "string" && body.locale.length > 0) {
                state.locale = body.locale.toLowerCase().startsWith("zh") ? "zh" : "en";
              }
              touchPresence();
              return json(res, 200, { ok: true });
            }
            if (req.method === "POST" && route === "test") {
              let patch = {};
              try { patch = JSON.parse(await readBody(req) || "{}"); } catch { /* 忽略空/坏请求体 */ }
              applySettings(patch);
              playTest(ctx, state);
              return json(res, 200, { ok: true });
            }
            if (req.method === "GET" && route === "audio") {
              // 浏览器试听：把当前生效的音效文件（含内置叮咚的 ding.mp3 兜底）以流方式发给前端
              const audioPath = resolveSoundFile(state.soundFile);
              if (!audioPath) return json(res, 404, { ok: false, error: "no sound file" });
              const mime = SOUND_MIME[extname(audioPath).toLowerCase()] ?? "application/octet-stream";
              const body = await readFile(audioPath);
              res.writeHead(200, {
                "content-type": mime,
                "content-length": body.length,
                "cache-control": "no-store"
              });
              res.end(body);
              return;
            }
            if (req.method === "GET" && route === "sounds") {
              return json(res, 200, { ok: true, items: listSounds() });
            }
            if (req.method === "POST" && route === "sounds") {
              const body = JSON.parse(await readBody(req) || "{}");
              const name = typeof body.name === "string" ? body.name.trim() : "";
              const dataBase64 = typeof body.dataBase64 === "string" ? body.dataBase64 : "";
              if (!name || !dataBase64) return json(res, 400, { ok: false, error: "name 与 dataBase64 均不能为空" });
              const ext = extname(name).toLowerCase();
              if (!SOUND_EXTENSIONS.has(ext)) return json(res, 400, { ok: false, error: `不支持的文件类型 ${ext || "(无扩展名)"}` });
              const safeBase = basename(name, ext).replace(/[^\w\u4e00-\u9fa5-]+/g, "_").slice(0, 40) || "sound";
              const fileName = `sound-${Date.now()}-${safeBase}${ext}`;
              mkdirSync(soundsDir, { recursive: true });
              writeFileSync(join(soundsDir, fileName), Buffer.from(dataBase64, "base64"));
              return json(res, 200, { ok: true, items: listSounds(), soundFile: join(soundsDir, fileName) });
            }
            return json(res, 404, { ok: false, error: "not found" });
          } catch (error) {
            ctx.logger.warn(`dsh-ding: API 处理失败 (${req.method} ${url.pathname}): ${String(error)}`);
            return json(res, 500, { ok: false, error: String(error) });
          }
        }
      });
      ctx.logger.info(`dsh-ding: Web 控制面已挂载 /dsh-ding（设置文件: ${settingsFile}）`);
    } else {
      ctx.logger.info("dsh-ding: 当前环境无 webServer，控制面未挂载（通知功能正常）");
    }
  } catch (error) {
    ctx.logger.warn(`dsh-ding: 挂载 Web 控制面失败: ${String(error)}`);
  }

  // ---------------- 完成通知 ----------------
  // agent/status idle 的可靠判断：agent 在回复中途（等待后台任务等）会短暂进入
  // maintenance 相位（status 同样为 "idle"），必须排除；另外 turn 进行中也可能
  // 出现 step 间隙的 idle——用会话日志里最新 turn/start 与 turn/end 的编号判断
  // 最新一轮是否真正结束。三项都通过才是"整轮对话彻底完成"。
  const pending = new Map();
  const runningSince = new Map();  // agent.id -> 开始运行时间戳（计算耗时用）
  const runningTimers = new Map(); // agent.id -> { first, interval }（运行中提醒定时器）
  let lastFired = 0;

  /** 最新一轮是否已结束：events 中最新 turn/start 号 == 最新 turn/end 号。 */
  function isTurnComplete(session) {
    const events = session?.events;
    if (!Array.isArray(events)) return true; // 无日志可查时按完成处理
    let lastStart = -1;
    let lastEnd = -1;
    for (const item of events) {
      if (item.type === "turn/start") {
        const turn = item.data?.turn;
        if (typeof turn === "number") lastStart = turn;
      } else if (item.type === "turn/end") {
        const turn = item.data?.turn;
        if (typeof turn === "number") lastEnd = turn;
      }
    }
    return lastStart <= lastEnd;
  }

    ctx.on("agent/status", ({ agent, status }) => {
    try {
      if (status === "running") {
        if (!agent?.id) return;
        // 记录开始时间并调度"运行中提醒"（长任务）
        runningSince.set(agent.id, Date.now());
        scheduleRunning(ctx, agent.id, agent.session ?? agent, options, state);
        return;
      }
      if (status !== "idle") return;
      clearRunningTimers(agent?.id);
      // 相位过滤：maintenance（等待后台任务/提问）与其它非 idle 相位都不是"完成"
      if (agent?.phase?.kind !== "idle") { return; }
      if (agent?.phase?.kind === "maintenance") { return; }
      if (!state.notifySubagents && agent?.session?.header?.origin === "subagent") { return; }
      const turnDone = isTurnComplete(agent?.session);
      if (!turnDone) return; // 最新一轮还在进行中（step 间隙的假 idle）
      const existing = pending.get(agent.id);
      if (existing) clearTimeout(existing);
      pending.set(agent.id, setTimeout(() => {
        pending.delete(agent.id);
        const now = Date.now();
        if (now - lastFired < state.minIntervalMs) { return; }
        lastFired = now;
        try {
          notify(ctx, agent.session ?? agent, options, state);
        } catch (error) {
          ctx.logger.warn(`dsh-ding: 通知失败: ${String(error)}`);
        }
      }, state.debounceMs));
    } catch (error) {
      ctx.logger.warn(`dsh-ding: agent/status 处理失败: ${String(error)}`);
    }
  });

  ctx.on("agent/disposed", ({ agent }) => {
    if (!agent?.id) return;
    clearRunningTimers(agent.id);
    runningSince.delete(agent.id);
    const existing = pending.get(agent.id);
    if (existing) {
      clearTimeout(existing);
      pending.delete(agent.id);
    }
  });

  // ---------------- 用户提问提醒 ----------------
  // Agent 调用 ask_user_question 等待回答时立即提醒（不防抖；与完成提醒共用节流）。
  // tools/pre-execute 是 waterfall：监听器必须调用 next() 放行，否则会 veto 整条链（工具被阻塞）。
  ctx.on("tools/pre-execute", (exec, next) => {
    try {
      if (exec?.name === "ask_user_question" && state.questionNotify !== false) {
        const questions = exec.arguments?.questions;
        const first = Array.isArray(questions) ? questions[0] : null;
        const questionText = typeof first?.question === "string" ? first.question : "";
        const now = Date.now();
        if (now - lastFired >= state.minIntervalMs) {
          lastFired = now;
          notifyQuestion(ctx, exec.agent, options, state, questionText);
        }
      }
    } catch (error) {
      ctx.logger.warn(`dsh-ding: 提问提醒失败: ${String(error)}`);
    }
    return next();
  });

  ctx.logger.info("dsh-ding: 已加载（对话完成时提示音 + Windows 通知；Web 铃铛控制可用）");
}
