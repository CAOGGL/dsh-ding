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
 * 事件：`agent/status`，payload `{ agent, status }`，status 为 "idle" | "running"。
 * 行为：
 *   - 只响应 idle（running -> idle 的转变即“本轮对话彻底结束”）
 *   - 跳过子代理（origin === "subagent"），它们结束只是主代理回合中间过程
 *   - 跳过 inbox 仍有待处理消息的空闲（马上会再次唤醒，不算结束）
 *   - debounceMs 防抖 + minIntervalMs 全局节流，避免连发/重复通知
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
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { basename, extname, join } from "node:path";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
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
function sessionTitleOf(agent) {
  const events = agent?.session?.events;
  if (!Array.isArray(events)) return void 0;
  const event = typeof events.findLast === "function"
    ? events.findLast((item) => item.type === "session/title")
    : [...events].reverse().find((item) => item.type === "session/title");
  return event?.data?.title;
}

/** 启动一个隐藏的 powershell 进程执行 notify.ps1（提示音 + 通知）。 */
function notify(ctx, agent, options, state) {
  if (state.sound === false && state.balloon === false) return; // 全部关闭，无事可做
  const titleText = sessionTitleOf(agent);
  const text = typeof titleText === "string" && titleText.length > 0
    ? `对话「${titleText}」已完成，可以查看回复了`
    : "对话已完成，可以查看回复了";
  const args = [
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", NOTIFY_SCRIPT,
    "-Title", state.title || options.title,
    "-Text", text
  ];
  if (state.sound !== false) {
    if (state.soundFile) args.push("-SoundFile", state.soundFile);
    args.push("-Volume", String(state.volume));
  } else {
    args.push("-NoSound");
  }
  if (state.balloon === false) args.push("-NoToast");
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
    notifySubagents: config.notifySubagents === true
  };

  // ---------------- 运行时设置（铃铛按钮读写） ----------------
  const dataDir = resolveDataDir(ctx);
  const settingsFile = join(dataDir, "dsh-ding.json");
  const soundsDir = join(dataDir, "sounds");

  /** 当前生效设置：config 为默认值，runtime 覆盖层（持久化 JSON）优先。 */
  const state = {
    sound: options.sound,
    balloon: options.balloon,
    title: options.title,
    soundFile: options.soundFile,
    volume: options.volume
  };

  try {
    if (existsSync(settingsFile)) {
      const saved = JSON.parse(readFileSync(settingsFile, "utf8"));
      if (saved && typeof saved === "object") {
        if (typeof saved.sound === "boolean") state.sound = saved.sound;
        if (typeof saved.balloon === "boolean") state.balloon = saved.balloon;
        if (typeof saved.title === "string" && saved.title.length > 0) state.title = saved.title;
        if (typeof saved.soundFile === "string") state.soundFile = saved.soundFile;
        if (Number.isFinite(Number(saved.volume))) state.volume = Math.max(0, Math.min(1, Number(saved.volume)));
      }
    }
  } catch (error) {
    ctx.logger.warn(`dsh-ding: 读取运行时设置失败（忽略）: ${String(error)}`);
  }

  function persistSettings() {
    try {
      mkdirSync(dataDir, { recursive: true });
      writeFileSync(settingsFile, JSON.stringify({
        sound: state.sound,
        balloon: state.balloon,
        title: state.title,
        soundFile: state.soundFile,
        volume: state.volume
      }, null, 2), "utf8");
    } catch (error) {
      ctx.logger.warn(`dsh-ding: 保存运行时设置失败: ${String(error)}`);
    }
  }

  function settingsSnapshot() {
    return {
      sound: state.sound,
      balloon: state.balloon,
      title: state.title,
      soundFile: state.soundFile,
      volume: state.volume
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
    persistSettings();
    return settingsSnapshot();
  }

  /** 音效清单：内置“叮咚” + data/sounds 下的音频文件。 */
  function listSounds() {
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
          try {
            if (req.method === "GET" && route === "settings") {
              return json(res, 200, { ok: true, value: settingsSnapshot() });
            }
            if (req.method === "POST" && route === "settings") {
              const patch = JSON.parse(await readBody(req) || "{}");
              return json(res, 200, { ok: true, value: applySettings(patch) });
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
  const pending = new Map();
  let lastFired = 0;

  ctx.on("agent/status", ({ agent, status }) => {
    if (status !== "idle") return;
    if (!options.notifySubagents && agent?.session?.header?.origin === "subagent") return;
    if (agent?.inbox?.hasPending) return; // 马上会再次唤醒，不算结束

    const existing = pending.get(agent.id);
    if (existing) clearTimeout(existing);
    pending.set(agent.id, setTimeout(() => {
      pending.delete(agent.id);
      const now = Date.now();
      if (now - lastFired < options.minIntervalMs) return;
      lastFired = now;
      try {
        notify(ctx, agent, options, state);
      } catch (error) {
        ctx.logger.warn(`dsh-ding: 通知失败: ${String(error)}`);
      }
    }, options.debounceMs));
  });

  ctx.on("agent/disposed", ({ agent }) => {
    const existing = pending.get(agent.id);
    if (existing) {
      clearTimeout(existing);
      pending.delete(agent.id);
    }
  });

  ctx.logger.info("dsh-ding: 已加载（对话完成时提示音 + Windows 通知；Web 铃铛控制可用）");
}
