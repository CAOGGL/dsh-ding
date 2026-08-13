/**
 * dsh-ding
 *
 * 当 Agent 完成一轮对话（状态回到 idle，不再主动输出）时，播放提示音并通过
 * Windows 通知提醒用户。
 *
 * 事件：`agent/status`，payload `{ agent, status }`，status 为 "idle" | "running"。
 * 行为：
 *   - 只响应 idle（running -> idle 的转变即“本轮对话彻底结束”）
 *   - 跳过子代理（origin === "subagent"），它们结束只是主代理回合中间过程
 *   - 跳过 inbox 仍有待处理消息的空闲（马上会再次唤醒，不算结束）
 *   - debounceMs 防抖 + minIntervalMs 全局节流，避免连发/重复通知
 *
 * 配置（cordis.patch.yml 的 config）：
 *   sound: true          播放提示音（默认 true）
 *   soundFile: 'C:\\codewhale\\ding.mp3'  提示音文件（mp3/wav 等；留空则用内置“叮咚”）
 *   balloon: true        显示 Windows 通知（默认 true）
 *   title: 'DSH 完成'    通知标题
 *   debounceMs: 800      防抖毫秒数
 *   minIntervalMs: 3000  两次通知的最小间隔
 *   notifySubagents: false  是否也通知子代理完成（默认 false）
 */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const NOTIFY_SCRIPT = fileURLToPath(new URL("../notify.ps1", import.meta.url));

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
function notify(ctx, agent, options) {
  const titleText = sessionTitleOf(agent);
  const text = typeof titleText === "string" && titleText.length > 0
    ? `对话「${titleText}」已完成，可以查看回复了`
    : "对话已完成，可以查看回复了";
  const args = [
    "-NoProfile", "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Hidden",
    "-File", NOTIFY_SCRIPT,
    "-Title", options.title,
    "-Text", text
  ];
  if (options.soundFile && options.sound !== false) args.push("-SoundFile", options.soundFile);
  if (options.sound === false) args.push("-NoSound");
  if (options.balloon === false) args.push("-NoToast");
  const child = spawn("powershell.exe", args, {
    windowsHide: true,
    stdio: "ignore"
  });
  child.on("error", (error) => {
    ctx.logger.warn(`dsh-ding: 无法启动通知进程: ${String(error)}`);
  });
  child.unref?.();
}

export default function dshNotifyDone(ctx, config = {}) {
  const options = {
    sound: config.sound !== false,
    balloon: config.balloon !== false,
    title: typeof config.title === "string" && config.title.length > 0 ? config.title : "DSH 完成",
    soundFile: typeof config.soundFile === "string" && config.soundFile.length > 0 ? config.soundFile : "",
    debounceMs: Math.max(0, Number(config.debounceMs) || 0) || 800,
    minIntervalMs: Math.max(0, Number(config.minIntervalMs) || 0) || 3000,
    notifySubagents: config.notifySubagents === true
  };

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
        notify(ctx, agent, options);
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

  ctx.logger.info("dsh-ding: 已加载（对话完成时将提示音 + Windows 通知）");
}
