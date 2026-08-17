// dsh-ding — 浏览器端（client bundle）
//
// 对话页顶栏的铃铛（conversation.session.header.utilities 插槽）：
//   - 单击       ：快速开关提示音
//   - 悬停       ：铃铛正左侧滑出音量条（行内元素，宽度动画，同行元素自动左移；
//                  拖动松手自动试听）
//   - 右键       ：通知设置面板（淡入/滑入动画）：
//                     · 提示音开关 + 气泡通知开关（全关 = 无任何提示）
//                     · 选择音效（内置叮咚 / 已上传），并可上传新音效
// 全部设置通过宿主插件 HTTP API 读写（/dsh-ding/settings、/sounds、/test），
// 持久化在 profile 的 data/dsh-ding.json。
//
// 本文件是打包产物格式的浏览器 bundle：注册到 window.__ModuleLoader__，
// 工厂函数内通过 require() 解析平台种子模块（react 等），
// 与官方 dsh-client-* 包发布的 client.js 结构一致。
window.__ModuleLoader__.load({
	id: "dsh-ding",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });

		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");

		//#region 字典与样式
		/** 界面文案（跟随页面语言，zh 优先）。 */
		//#region 字典
		/** 字典命名空间：通过 ctx.locale 注册，文案随 WebUI 语言设置实时切换。 */
		const NS = "dsh-ding";
		const zh = {
			toggleOn: "提示音已开启（单击关闭，右键打开设置）",
			toggleOff: "提示音已关闭（单击开启）",
			volumeAria: "音量",
			menuHead: "通知设置",
			soundLabel: "提示音",
			balloonLabel: "气泡通知",
			muteHint: "已全部关闭：对话完成时将没有任何提示",
			quietOnViewingLabel: "当前会话免打扰",
			quietOnViewingHint: "正在查看的会话完成时不提醒",
			runningLabel: "运行中提醒",
			runningHint: "任务运行中定期提醒（仅通知）",
			questionLabel: "提问提醒",
			questionHint: "Agent 提问等待回答时提醒",
			soundTitle: "音效",
			builtin: "内置叮咚",
			upload: "上传新音效…",
			uploading: "上传中…",
			current: "当前",
			advanced: "高级设置",
			advWindow: "高级设置",
			advClose: "关闭",
			groupCustom: "自定义通知内容",
			doneTemplateLabel: "完成通知模板",
			questionTemplateLabel: "提问通知模板",
			templateHint: "留空使用默认文本",
			templateVars: "可用参数：{title} 会话标题、{prefix} 对话前缀、{elapsed} 耗时、{question} 问题文本、{tool} 工具名（审批模板）",
			advancedBack: "← 返回",
			advancedHead: "全部参数",
			groupNotify: "通知",
			groupTitles: "标题",
			groupTiming: "时机",
			groupSound: "声音",
			subagentsLabel: "子代理完成通知",
			subagentsHint: "子代理结束时不提醒（默认）",
			titleLabel: "完成通知标题",
			runningTitleLabel: "运行中通知标题",
			questionTitleLabel: "提问通知标题",
			titleDefault: "DSH 完成",
			runningTitleDefault: "DSH 运行中",
			questionTitleDefault: "DSH 提问",
			runningTemplateLabel: "运行中通知模板",
			approvalLabel: "工具审批提醒",
			approvalHint: "工具调用等待你批准时提醒",
			approvalTitleLabel: "审批通知标题",
			approvalTemplateLabel: "审批通知模板",
			approvalTitleDefault: "DSH 审批",
			debounceLabel: "防抖毫秒",
			debounceHint: "完成信号后的等待（默认 200）",
			minIntervalLabel: "最小间隔毫秒",
			minIntervalHint: "两次通知的最小间隔（默认 3000）",
			firstAfterLabel: "运行中首次提醒毫秒",
			firstAfterHint: "任务运行多久后首次提醒（默认 180000）",
			intervalLabel: "运行中提醒间隔毫秒",
			intervalHint: "后续提醒间隔（默认 300000）",
			volumeLabel: "音量百分比"
		};
		const en = {
			toggleOn: "Sound on (click to mute, right-click for settings)",
			toggleOff: "Sound muted (click to unmute)",
			volumeAria: "Volume",
			menuHead: "Notifications",
			soundLabel: "Sound",
			balloonLabel: "Toast",
			muteHint: "Everything off: no notification when a conversation finishes",
			quietOnViewingLabel: "Quiet on current",
			quietOnViewingHint: "Skip when the session you are viewing finishes",
			runningLabel: "While running",
			runningHint: "Remind periodically while a task runs (toast only)",
			questionLabel: "While asked",
			questionHint: "Remind when the agent asks you a question",
			soundTitle: "Sound effect",
			builtin: "Built-in ding",
			upload: "Upload new sound…",
			uploading: "Uploading…",
			current: "current",
			advanced: "Advanced settings",
			advWindow: "Advanced settings",
			advClose: "Close",
			groupCustom: "Custom notification text",
			doneTemplateLabel: "Completion template",
			questionTemplateLabel: "Question template",
			templateHint: "Leave empty for the default text",
			templateVars: "Placeholders: {title} session title, {prefix} conversation prefix, {elapsed} elapsed time, {question} question text, {tool} tool name (approval template)",
			advancedBack: "← Back",
			advancedHead: "All parameters",
			groupNotify: "Notifications",
			groupTitles: "Titles",
			groupTiming: "Timing",
			groupSound: "Sound",
			subagentsLabel: "Subagent completion",
			subagentsHint: "Skip when subagents finish (default)",
			titleLabel: "Completion title",
			runningTitleLabel: "Running title",
			questionTitleLabel: "Question title",
			titleDefault: "DSH Done",
			runningTitleDefault: "DSH Running",
			questionTitleDefault: "DSH Question",
			runningTemplateLabel: "Progress template",
			approvalLabel: "Tool approval",
			approvalHint: "Remind when a tool call waits for your approval",
			approvalTitleLabel: "Approval title",
			approvalTemplateLabel: "Approval template",
			approvalTitleDefault: "DSH Approval",
			debounceLabel: "Debounce (ms)",
			debounceHint: "Wait after the done signal (default 200)",
			minIntervalLabel: "Min interval (ms)",
			minIntervalHint: "Min gap between notifications (default 3000)",
			firstAfterLabel: "First progress reminder (ms)",
			firstAfterHint: "How long a task runs before the first reminder (default 180000)",
			intervalLabel: "Progress reminder interval (ms)",
			intervalHint: "Interval of follow-up reminders (default 300000)",
			volumeLabel: "Volume (%)"
		};
		/** 兜底字典：t 缺失时按页面 lang 选一份（正常情况下由插槽渲染器注入 t）。 */
		const FALLBACK = typeof document !== "undefined" && (document.documentElement.lang || "").toLowerCase().startsWith("zh") ? zh : en;

		/** 当前界面语言（zh/en）：由 apply 里 locale 服务初始化并在 locale/change 时更新；
		 * presence 上报用（宿主据此决定 Windows 通知文本语言）。 */
		let currentLocale = "zh";

		/** 插槽内联样式（data-plugin 预标记，随插件生命周期注入/移除）。
		 * 配色全部走 WebUI 设计令牌（--dsw-alias-* / --dsw-specific-menu / --dsw-shadow-lv3 /
		 * --ds-transition-duration-fast / --ds-ease-in-out），自动适配明暗主题。 */
		const STYLE = [
			".dsd-ding{position:relative;display:inline-flex;align-items:center}",
			".dsd-ding-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:5px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-primary,#c9cedb);cursor:pointer;transition:background var(--ds-transition-duration-fast,.12s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-btn:hover{background:var(--dsw-alias-hover-l2,rgba(128,140,170,.18))}",
			".dsd-ding-btn:active{background:var(--dsw-alias-hover-l2,rgba(128,140,170,.26))}",
			".dsd-ding-btn svg{width:19px;height:19px;display:block}",
			".dsd-ding-btn.dsd-ding-off{color:var(--dsw-alias-label-tertiary,rgba(150,158,175,.55))}",
			// 音量条：铃铛正左侧的行内元素；宽度 0→176px 动画，把同行元素往左推。
			// 内部为 30px 高单行布局（与铃铛按钮同高、垂直居中），滑杆与百分比数字并排，
			// 滑杆左右各留 7px 内边距，右端圆角不会被按钮/数字遮挡。
			".dsd-ding-vol{width:0;overflow:hidden;opacity:0;flex:none;transition:width .18s ease,opacity .18s ease}",
			".dsd-ding-vol.dsd-ding-open{width:176px;opacity:1}",
			".dsd-ding-vol-inner{width:176px;height:30px;display:flex;align-items:center;gap:8px;padding:0 6px 0 4px;box-sizing:border-box}",
			// 自定义滑杆：4px 圆角轨道 + 品牌色填充（--dsh-ding-fill 由组件内联写入）+ 黑白圆球旋钮
			// （亮色模式黑球 / 暗色模式白球，跟随 body[data-ds-dark-theme]，由 WebUI 主题实时切换）
			".dsd-ding-vol input[type=range]{-webkit-appearance:none;appearance:none;flex:1;min-width:0;height:100%;margin:0;padding:0 7px;box-sizing:border-box;background:transparent;cursor:pointer}",
			".dsd-ding-vol input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(to right,var(--dsw-alias-brand-primary,#4d6bfe) var(--dsh-ding-fill,50%),var(--dsw-alias-bg-layer-2,rgba(128,140,170,.28)) var(--dsh-ding-fill,50%))}",
			".dsd-ding-vol input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:#111;box-shadow:0 1px 3px rgba(0,0,0,.35);transition:transform var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			"body[data-ds-dark-theme] .dsd-ding-vol input[type=range]::-webkit-slider-thumb{background:#fff}",
			".dsd-ding-vol input[type=range]::-webkit-slider-thumb:hover{transform:scale(1.08)}",
			".dsd-ding-vol input[type=range]:active::-webkit-slider-thumb{transform:scale(1.16)}",
			".dsd-ding-vol input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2,rgba(128,140,170,.28))}",
			".dsd-ding-vol input[type=range]::-moz-range-progress{height:4px;border-radius:2px;background:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-vol input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:#111;box-shadow:0 1px 3px rgba(0,0,0,.35)}",
			"body[data-ds-dark-theme] .dsd-ding-vol input[type=range]::-moz-range-thumb{background:#fff}",
			".dsd-ding-vol input[type=range]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px;border-radius:4px}",
			".dsd-ding-vol-value{flex:none;font-size:11px;line-height:1;color:var(--dsw-alias-label-secondary,#9aa3b8);min-width:26px;text-align:right}",
			// 设置面板：与 WebUI 菜单同款表面（--dsw-specific-menu / --dsw-shadow-lv3 / 12px 圆角）
			".dsd-ding-menu{position:absolute;top:100%;right:0;z-index:9999;min-width:236px;padding:4px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.38));background:var(--dsw-specific-menu,#1b1f2a);color:var(--dsw-alias-label-primary,#e7e9f0);box-shadow:var(--dsw-shadow-lv3,0 10px 28px rgba(0,0,0,.5));user-select:none;opacity:0;transform:translateY(6px);visibility:hidden;transition:opacity .15s ease,transform .15s ease,visibility 0s linear .15s}",
			".dsd-ding-menu.dsd-ding-open{opacity:1;transform:translateY(0);visibility:visible;transition:opacity .15s ease,transform .15s ease}",
			".dsd-ding-menu-head{font-size:11.5px;color:var(--dsw-alias-label-secondary,#9aa3b8);padding:6px 10px 4px}",
			".dsd-ding-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:34px;padding:5px 10px;border-radius:10px;font-size:13px;color:var(--dsw-alias-label-primary,#e7e9f0);transition:background var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-row:hover{background:var(--dsw-alias-hover-l2,rgba(128,140,170,.16))}",
			// 开关行内的副标题小字（开关说明）
			".dsd-ding-sub{display:block;font-size:10.5px;color:var(--dsw-alias-label-tertiary,rgba(150,158,175,.6));line-height:1.35;margin-top:1px}",
			".dsd-ding-switch{position:relative;flex:none;width:34px;height:18px;padding:0;border:none;border-radius:9px;background:var(--dsw-alias-bg-layer-2,rgba(128,140,170,.32));cursor:pointer;transition:background var(--ds-transition-duration-fast,.15s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-switch::after{content:'';position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;box-shadow:0 1px 2px rgba(0,0,0,.3);transition:left var(--ds-transition-duration-fast,.15s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-switch.dsd-ding-on{background:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-switch.dsd-ding-on::after{left:18px}",
			".dsd-ding-switch:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:1px}",
			".dsd-ding-mute-hint{font-size:11px;color:var(--dsw-alias-state-warn-primary,#e8a13c);padding:2px 10px 8px;line-height:1.4}",
			".dsd-ding-item{display:flex;align-items:center;gap:8px;width:100%;min-height:32px;padding:6px 10px;border:none;border-radius:10px;background:transparent;color:var(--dsw-alias-label-primary,#e7e9f0);font-size:13px;line-height:20px;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden;transition:background var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-item:hover{background:var(--dsw-alias-hover-l2,rgba(128,140,170,.16))}",
			".dsd-ding-item.dsd-ding-active{color:var(--dsw-alias-brand-primary,#86a0ff);font-weight:600}",
			".dsd-ding-item small{color:var(--dsw-alias-label-secondary,#8b93a7);margin-left:auto;font-size:11px;font-weight:400}",
			".dsd-ding-item.dsd-ding-disabled{opacity:.55;cursor:default}",
			".dsd-ding-sep{height:1px;margin:5px 8px;background:var(--dsw-alias-border-l2,rgba(120,132,160,.25))}",
			// 高级设置面板：更宽（300px），包含文本/数字输入
			".dsd-ding-menu.dsd-ding-wide{min-width:300px}",
			".dsd-ding-input{flex:1;min-width:0;height:26px;padding:0 8px;border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.38));border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(128,140,170,.12));color:var(--dsw-alias-label-primary,#e7e9f0);font-size:12.5px;outline:none}",
			".dsd-ding-input:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-input::-webkit-outer-spin-button,.dsd-ding-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0}",
			".dsd-ding-input[type=number]{-moz-appearance:textfield;appearance:textfield}",
			".dsd-ding-row.dsd-ding-input-row{min-height:36px;align-items:center}",
			// 高级设置页面内窗口（modal）：遮罩 + 居中面板
			".dsd-ding-modal{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.45)}",
			".dsd-ding-modal-panel{width:480px;max-width:calc(100vw - 48px);max-height:calc(100vh - 96px);overflow-y:auto;padding:6px;border-radius:14px;border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.38));background:var(--dsw-specific-menu,#1b1f2a);color:var(--dsw-alias-label-primary,#e7e9f0);box-shadow:var(--dsw-shadow-lv3,0 10px 28px rgba(0,0,0,.5));user-select:none}",
			".dsd-ding-modal-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px 4px}",
			".dsd-ding-modal-title{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary,#e7e9f0)}",
			".dsd-ding-modal-close{display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border:none;border-radius:8px;background:transparent;color:var(--dsw-alias-label-secondary,#9aa3b8);font-size:15px;cursor:pointer;transition:background var(--ds-transition-duration-fast,.12s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-modal-close:hover{background:var(--dsw-alias-hover-l2,rgba(128,140,170,.18))}",
			".dsd-ding-textarea{width:100%;box-sizing:border-box;min-height:64px;padding:7px 9px;border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.38));border-radius:8px;background:var(--dsw-alias-bg-layer-1,rgba(128,140,170,.12));color:var(--dsw-alias-label-primary,#e7e9f0);font-size:12.5px;font-family:inherit;line-height:1.5;resize:vertical;outline:none}",
			".dsd-ding-textarea:focus{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-vars-hint{font-size:10.5px;color:var(--dsw-alias-label-tertiary,rgba(150,158,175,.6));line-height:1.45;padding:2px 10px 8px}"
		].join("\n");
		//#endregion

		//#region 错误边界
		/** 高级面板的渲染错误边界：出错时显示错误文本而非崩溃（排查用）。 */
		class AdvancedBoundary extends react.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			render() {
				if (this.state.error) {
					return react.createElement(
						"div",
						{ style: { padding: "12px 14px" } },
						react.createElement("div", { className: "dsd-ding-mute-hint", style: { whiteSpace: "pre-wrap", wordBreak: "break-all" } }, "dsh-ding advanced panel error: " + String(this.state.error && this.state.error.message ? this.state.error.message : this.state.error))
					);
				}
				return this.props.children;
			}
		}
		//#endregion

		//#region 图标
		/** 铃铛图标（on 带声波，off 带斜杠）。 */
		function BellIcon({ muted }) {			return react.createElement(
				"svg",
				{ viewBox: "0 0 24 24", "aria-hidden": true, focusable: "false" },
				react.createElement("path", {
					fill: "currentColor",
					d: "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"
				}),
				muted && react.createElement("line", {
					x1: "3.5", y1: "3.5", x2: "20.5", y2: "20.5",
					stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round"
				})
			);
		}
		//#endregion

		//#region 铃铛组件
		/**
		 * 顶栏铃铛：单击开关提示音；悬停左侧滑出音量条；右键打开通知设置面板。
		 * @param props - 插槽注入（sessionId 等；本组件为全局设置，不依赖会话）。
		 */
		function DingBell(props) {
			const [settings, setSettings] = react.useState(null);
			const [sounds, setSounds] = react.useState(null);
			const [menuOpen, setMenuOpen] = react.useState(false);
			const [popOpen, setPopOpen] = react.useState(false);
			const [advancedOpen, setAdvancedOpen] = react.useState(false);
			const [volume, setVolume] = react.useState(100);
			const [uploading, setUploading] = react.useState(false);
			const fileRef = react.useRef(null);
			const volumeTimer = react.useRef(null);
			const dragging = react.useRef(false);
			const audioRef = react.useRef(null);

			const api = react.useCallback((path, options) =>
				fetch(path, options).then((res) => res.json()).catch(() => null), []);

			/** 浏览器直出试听：请求 /dsh-ding/audio 拿当前音效文件，HTMLAudio 立即播放（无需等 PowerShell）。 */
			const playPreview = react.useCallback((vol) => {
				try {
					let audio = audioRef.current;
					if (!audio) {
						audio = new Audio();
						audioRef.current = audio;
					}
					audio.src = "/dsh-ding/audio?t=" + Date.now();
					audio.volume = Math.max(0, Math.min(1, vol));
					audio.play().catch(() => {});
				} catch { /* 忽略播放失败 */ }
			}, []);

			const loadSettings = react.useCallback(() => {
				api("/dsh-ding/settings").then((result) => {
					if (result && result.ok) {
						setSettings(result.value);
						setVolume(Math.round(result.value.volume * 100));
					}
				});
			}, [api]);

			react.useEffect(() => {
				loadSettings();
				return () => {
					if (volumeTimer.current) clearTimeout(volumeTimer.current);
				};
			}, [loadSettings]);

			/** 上报页面是否在前台（可见且有焦点）、当前查看的会话、界面语言。
			 * 宿主据此决定"当前会话免打扰"是否静默（前台 + 完成会话 == 当前会话才静默），
			 * 并让 Windows 通知文本跟随 WebUI 语言。 */
			const reportPresence = react.useCallback(() => {
				const foreground = !document.hidden && document.hasFocus();
				const body = { foreground };
				if (typeof props.sessionId === "string" && props.sessionId.length > 0) body.sessionId = props.sessionId;
				// 语言以 locale 服务为准（用户显式选择优先），兜底页面 lang
				const lang = (currentLocale || document.documentElement.lang || "").toLowerCase();
				body.locale = lang.startsWith("zh") ? "zh" : "en";
				api("/dsh-ding/presence", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(body)
				});
			}, [api, props.sessionId]);

			react.useEffect(() => {
				reportPresence(); // 组件挂载时立即上报一次
				const onChange = () => reportPresence();
				document.addEventListener("visibilitychange", onChange);
				window.addEventListener("focus", onChange);
				window.addEventListener("blur", onChange);
				// 心跳兜底：服务重启后 state 复位、以及焦点事件可能漏报的场景
				const heartbeat = setInterval(reportPresence, 30000);
				return () => {
					document.removeEventListener("visibilitychange", onChange);
					window.removeEventListener("focus", onChange);
					window.removeEventListener("blur", onChange);
					clearInterval(heartbeat);
					reportPresence(); // 卸载（离开对话页）前最后上报一次当前状态
				};
			}, [reportPresence]);

			/** 提交设置补丁并同步本地状态。 */
			const patchSettings = react.useCallback((patch) => {
				api("/dsh-ding/settings", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(patch)
				}).then((result) => {
					if (result && result.ok) setSettings(result.value);
				});
			}, [api]);

			const commitVolume = react.useCallback((nextVolume, preview) => {
				patchSettings({ volume: Math.max(0, Math.min(1, nextVolume / 100)) });
				if (preview && settings?.sound !== false) playPreview(nextVolume / 100);
			}, [patchSettings, playPreview, settings?.sound]);

			/** 单击铃铛：快速开关提示音。 */
			const onToggle = react.useCallback(() => {
				const nextSound = !(settings?.sound ?? true);
				setSettings((current) => (current ? { ...current, sound: nextSound } : current));
				patchSettings({ sound: nextSound });
			}, [patchSettings, settings?.sound]);

			/** 设置面板里的气泡通知开关。 */
			const onToggleBalloon = react.useCallback(() => {
				const next = !(settings?.balloon ?? true);
				setSettings((current) => (current ? { ...current, balloon: next } : current));
				patchSettings({ balloon: next });
			}, [patchSettings, settings?.balloon]);

			/** 设置面板里的"当前会话免打扰"开关。 */
			const onToggleQuietViewing = react.useCallback(() => {
				const next = !(settings?.quietOnViewing ?? true);
				setSettings((current) => (current ? { ...current, quietOnViewing: next } : current));
				patchSettings({ quietOnViewing: next });
			}, [patchSettings, settings?.quietOnViewing]);

			/** 设置面板里的"运行中提醒"开关。 */
			const onToggleRunning = react.useCallback(() => {
				const next = !(settings?.runningNotify ?? true);
				setSettings((current) => (current ? { ...current, runningNotify: next } : current));
				patchSettings({ runningNotify: next });
			}, [patchSettings, settings?.runningNotify]);

			/** 设置面板里的"提问提醒"开关。 */
			const onToggleQuestion = react.useCallback(() => {
				const next = !(settings?.questionNotify ?? true);
				setSettings((current) => (current ? { ...current, questionNotify: next } : current));
				patchSettings({ questionNotify: next });
			}, [patchSettings, settings?.questionNotify]);

			/** 右键：打开通知设置面板（同时收起音量条）。 */
			const openMenu = react.useCallback((event) => {
				event.preventDefault();
				setPopOpen(false);
				setAdvancedOpen(false);
				setMenuOpen(true);
				if (sounds === null) {
					api("/dsh-ding/sounds").then((result) => {
						if (result && result.ok) setSounds(result.items);
					});
				}
			}, [api, sounds]);

			const chooseSound = react.useCallback((path) => {
				patchSettings({ soundFile: path });
				setMenuOpen(false);
			}, [patchSettings]);

			const onFilePicked = react.useCallback((event) => {
				const file = event.target.files && event.target.files[0];
				event.target.value = "";
				if (!file) return;
				const reader = new FileReader();
				reader.onload = () => {
					const dataUrl = String(reader.result || "");
					const comma = dataUrl.indexOf(",");
					const dataBase64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
					setUploading(true);
					api("/dsh-ding/sounds", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({ name: file.name, dataBase64 })
					}).then((result) => {
						setUploading(false);
						if (result && result.ok) {
							setSounds(result.items);
							if (result.soundFile) {
								setSettings((current) => (current ? { ...current, soundFile: result.soundFile } : current));
							}
							setMenuOpen(false);
						}
					}).catch(() => setUploading(false));
				};
				reader.readAsDataURL(file);
			}, [api]);

			const sound = settings ? settings.sound !== false : true;
			const balloon = settings ? settings.balloon !== false : true;
			const quietOnViewing = settings ? settings.quietOnViewing !== false : true;
			const runningNotify = settings ? settings.runningNotify !== false : true;
			const questionNotify = settings ? settings.questionNotify !== false : true;
			const notifySubagents = settings ? settings.notifySubagents === true : false;
			const muted = !sound;
			// t 由插槽渲染器按 WebUI 语言注入（locale 声明）；缺失时用页面 lang 兜底
			const tf = typeof props.t === "function" ? props.t : (key) => FALLBACK[key] ?? key;
			const tooltip = muted ? tf("toggleOff") : tf("toggleOn");
			const currentPath = settings?.soundFile || "";

			/** 通用布尔开关行（主菜单/高级面板共用）。 */
			const SwitchRow = react.useCallback(({ checked, onToggle, label, hint, aria }) => react.createElement(
				"div",
				{ className: "dsd-ding-row" },
				react.createElement("span", null,
					label,
					hint && react.createElement("small", { className: "dsd-ding-sub" }, hint)
				),
				react.createElement("button", {
					type: "button",
					role: "switch",
					"aria-checked": checked,
					"aria-label": aria,
					className: "dsd-ding-switch" + (checked ? " dsd-ding-on" : ""),
					onClick: onToggle
				})
			), []);

			/** 数字输入行（高级面板）。 */
			const NumberRow = react.useCallback(({ value, onChange, label, hint, min, max }) => react.createElement(
				"div",
				{ className: "dsd-ding-row dsd-ding-input-row" },
				react.createElement("span", null,
					label,
					hint && react.createElement("small", { className: "dsd-ding-sub" }, hint)
				),
				react.createElement("input", {
					type: "number",
					className: "dsd-ding-input",
					value: Number.isFinite(Number(value)) ? Number(value) : 0,
					min: min !== void 0 ? min : 0,
					max: max !== void 0 ? max : void 0,
					onChange: (event) => {
						const next = Number(event.target.value);
						if (Number.isFinite(next)) onChange(Math.max(min !== void 0 ? min : 0, next));
					}
				})
			), []);

			/** 文本输入行（高级面板）。 */
			const TextRow = react.useCallback(({ value, onChange, label, hint }) => react.createElement(
				"div",
				{ className: "dsd-ding-row dsd-ding-input-row" },
				react.createElement("span", null,
					label,
					hint && react.createElement("small", { className: "dsd-ding-sub" }, hint)
				),
				react.createElement("input", {
					type: "text",
					className: "dsd-ding-input",
					value: typeof value === "string" ? value : "",
					onChange: (event) => onChange(event.target.value)
				})
			), []);

			/** 多行文本输入行（模板编辑）。 */
			const TextAreaRow = react.useCallback(({ value, onChange, label, hint }) => react.createElement(
				"div",
				{ className: "dsd-ding-row dsd-ding-input-row", style: { alignItems: "flex-start", padding: "6px 10px" } },
				react.createElement("span", null,
					label,
					hint && react.createElement("small", { className: "dsd-ding-sub" }, hint)
				),
				react.createElement("textarea", {
					className: "dsd-ding-textarea",
					value: typeof value === "string" ? value : "",
					onChange: (event) => onChange(event.target.value)
				})
			), []);

			/** 高级设置窗口内容：完整参数（通知/标题/时机/声音/自定义模板），全部即时保存。 */
			const AdvancedPanel = react.useCallback(() => {
				const s = settings || {};
				const setNum = (key) => (next) => patchSettings({ [key]: Math.max(0, Math.round(next)) });
				const setBool = (key) => () => {
					const next = !(s[key] ?? false);
					setSettings((current) => (current ? { ...current, [key]: next } : current));
					patchSettings({ [key]: next });
				};
				const setText = (key) => (next) => {
					if (typeof next === "string" && next.trim().length > 0) {
						patchSettings({ [key]: next.trim() });
					}
				};
				const setTemplate = (key) => (next) => {
					if (typeof next === "string") patchSettings({ [key]: next });
				};
				return react.createElement(
					react.Fragment,
					null,
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("groupNotify")),
					react.createElement(SwitchRow, { checked: s.sound !== false, onToggle: setBool("sound"), label: tf("soundLabel"), aria: tf("soundLabel") }),
					react.createElement(SwitchRow, { checked: s.balloon !== false, onToggle: setBool("balloon"), label: tf("balloonLabel"), aria: tf("balloonLabel") }),
					react.createElement(SwitchRow, { checked: s.quietOnViewing !== false, onToggle: setBool("quietOnViewing"), label: tf("quietOnViewingLabel"), hint: tf("quietOnViewingHint"), aria: tf("quietOnViewingLabel") }),
					react.createElement(SwitchRow, { checked: s.runningNotify !== false, onToggle: setBool("runningNotify"), label: tf("runningLabel"), hint: tf("runningHint"), aria: tf("runningLabel") }),
					react.createElement(SwitchRow, { checked: s.questionNotify !== false, onToggle: setBool("questionNotify"), label: tf("questionLabel"), hint: tf("questionHint"), aria: tf("questionLabel") }),
					react.createElement(SwitchRow, { checked: s.approvalNotify !== false, onToggle: setBool("approvalNotify"), label: tf("approvalLabel"), hint: tf("approvalHint"), aria: tf("approvalLabel") }),
					react.createElement(SwitchRow, { checked: s.notifySubagents === true, onToggle: setBool("notifySubagents"), label: tf("subagentsLabel"), hint: tf("subagentsHint"), aria: tf("subagentsLabel") }),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("groupTitles")),
					react.createElement(TextRow, { value: s.title === (s.defaults && s.defaults.title) ? tf("titleDefault") : s.title, onChange: setText("title"), label: tf("titleLabel") }),
					react.createElement(TextRow, { value: s.runningTitle === (s.defaults && s.defaults.runningTitle) ? tf("runningTitleDefault") : s.runningTitle, onChange: setText("runningTitle"), label: tf("runningTitleLabel") }),
					react.createElement(TextRow, { value: s.questionTitle === (s.defaults && s.defaults.questionTitle) ? tf("questionTitleDefault") : s.questionTitle, onChange: setText("questionTitle"), label: tf("questionTitleLabel") }),
					react.createElement(TextRow, { value: s.approvalTitle === (s.defaults && s.defaults.approvalTitle) ? tf("approvalTitleDefault") : s.approvalTitle, onChange: setText("approvalTitle"), label: tf("approvalTitleLabel") }),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("groupTiming")),
					react.createElement(NumberRow, { value: s.debounceMs, onChange: setNum("debounceMs"), label: tf("debounceLabel"), hint: tf("debounceHint") }),
					react.createElement(NumberRow, { value: s.minIntervalMs, onChange: setNum("minIntervalMs"), label: tf("minIntervalLabel"), hint: tf("minIntervalHint") }),
					react.createElement(NumberRow, { value: s.runningFirstAfterMs, onChange: setNum("runningFirstAfterMs"), label: tf("firstAfterLabel"), hint: tf("firstAfterHint") }),
					react.createElement(NumberRow, { value: s.runningIntervalMs, onChange: setNum("runningIntervalMs"), label: tf("intervalLabel"), hint: tf("intervalHint") }),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("groupSound")),
					react.createElement(NumberRow, { value: Math.round((s.volume ?? 1) * 100), onChange: (next) => patchSettings({ volume: Math.max(0, Math.min(100, next)) / 100 }), label: tf("volumeLabel"), min: 0, max: 100 }),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("groupCustom")),
					react.createElement(TextAreaRow, { value: s.doneTemplate, onChange: setTemplate("doneTemplate"), label: tf("doneTemplateLabel"), hint: tf("templateHint") }),
					react.createElement(TextAreaRow, { value: s.runningTemplate, onChange: setTemplate("runningTemplate"), label: tf("runningTemplateLabel"), hint: tf("templateHint") }),
					react.createElement(TextAreaRow, { value: s.questionTemplate, onChange: setTemplate("questionTemplate"), label: tf("questionTemplateLabel"), hint: tf("templateHint") }),
					react.createElement(TextAreaRow, { value: s.approvalTemplate, onChange: setTemplate("approvalTemplate"), label: tf("approvalTemplateLabel"), hint: tf("templateHint") }),
					react.createElement("div", { className: "dsd-ding-vars-hint" }, tf("templateVars"))
				);
			}, [settings, patchSettings, tf, SwitchRow, NumberRow, TextRow, TextAreaRow]);

			return react.createElement(
				"div",
				{
					className: "dsd-ding",
					onMouseEnter: () => { setMenuOpen(false); setPopOpen(true); },
					onMouseLeave: () => {
						if (dragging.current) return; // 拖动音量滑杆时不被判定为离开
						setPopOpen(false);
						setMenuOpen(false);
					},
					onPointerUp: () => { dragging.current = false; },
					onContextMenu: openMenu
				},
				// ---- 音量条：铃铛正左侧（行内，宽度动画，同行元素左移） ----
				react.createElement(
					"div",
					{ className: "dsd-ding-vol" + (popOpen && !menuOpen ? " dsd-ding-open" : "") },
					react.createElement(
						"div",
						{ className: "dsd-ding-vol-inner" },
						react.createElement("input", {
							type: "range",
							min: 0,
							max: 100,
							step: 1,
							value: volume,
							"aria-label": tf("volumeAria"),
							style: { "--dsh-ding-fill": volume + "%" },
							onPointerDown: (event) => { event.stopPropagation(); dragging.current = true; },
							onInput: (event) => {
								const next = Number(event.target.value);
								setVolume(next);
								if (volumeTimer.current) clearTimeout(volumeTimer.current);
								volumeTimer.current = setTimeout(() => commitVolume(next, false), 250);
							},
							onPointerUp: (event) => {
								dragging.current = false;
								const next = Number(event.target.value);
								setVolume(next);
								if (volumeTimer.current) clearTimeout(volumeTimer.current);
								commitVolume(next, true);
							},
							onKeyUp: (event) => {
								const next = Number(event.target.value);
								setVolume(next);
								if (volumeTimer.current) clearTimeout(volumeTimer.current);
								commitVolume(next, true);
							}
						}),
						react.createElement("div", { className: "dsd-ding-vol-value" }, `${volume}%`)
					)
				),
				// ---- 铃铛按钮 ----
				react.createElement(
					"button",
					{
						type: "button",
						className: "dsd-ding-btn" + (muted ? " dsd-ding-off" : ""),
						title: tooltip,
						"aria-label": tooltip,
						onClick: onToggle
					},
					react.createElement(BellIcon, { muted })
				),
				// ---- 高级设置：页面内独立窗口（modal，像 WebUI 设置页） ----
				advancedOpen && react.createElement(
					"div",
					{ className: "dsd-ding-modal", onClick: () => setAdvancedOpen(false) },
					react.createElement(
						"div",
						{ className: "dsd-ding-modal-panel", onClick: (event) => event.stopPropagation() },
						react.createElement(
							"div",
							{ className: "dsd-ding-modal-head" },
							react.createElement("div", { className: "dsd-ding-modal-title" }, tf("advWindow")),
							react.createElement("button", {
								type: "button",
								className: "dsd-ding-modal-close",
								"aria-label": tf("advClose"),
								onClick: () => setAdvancedOpen(false)
							}, "✕")
						),
						react.createElement(AdvancedBoundary, null, react.createElement(AdvancedPanel))
					)
				),
				// ---- 通知设置面板（右键）：快捷开关/音效选择；底部入口打开"高级设置"窗口 ----
				react.createElement(
					"div",
					{ className: "dsd-ding-menu" + (menuOpen ? " dsd-ding-open" : ""), onClick: (event) => event.stopPropagation() },
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("menuHead")),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null, tf("soundLabel")),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": sound,
							"aria-label": tf("soundLabel"),
							className: "dsd-ding-switch" + (sound ? " dsd-ding-on" : ""),
							onClick: onToggle
						})
					),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null, tf("balloonLabel")),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": balloon,
							"aria-label": tf("balloonLabel"),
							className: "dsd-ding-switch" + (balloon ? " dsd-ding-on" : ""),
							onClick: onToggleBalloon
						})
					),
					!sound && !balloon && react.createElement("div", { className: "dsd-ding-mute-hint" }, tf("muteHint")),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null,
							tf("quietOnViewingLabel"),
							react.createElement("small", { className: "dsd-ding-sub" }, tf("quietOnViewingHint"))
						),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": quietOnViewing,
							"aria-label": tf("quietOnViewingLabel"),
							className: "dsd-ding-switch" + (quietOnViewing ? " dsd-ding-on" : ""),
							onClick: onToggleQuietViewing
						})
					),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null,
							tf("runningLabel"),
							react.createElement("small", { className: "dsd-ding-sub" }, tf("runningHint"))
						),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": runningNotify,
							"aria-label": tf("runningLabel"),
							className: "dsd-ding-switch" + (runningNotify ? " dsd-ding-on" : ""),
							onClick: onToggleRunning
						})
					),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null,
							tf("questionLabel"),
							react.createElement("small", { className: "dsd-ding-sub" }, tf("questionHint"))
						),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": questionNotify,
							"aria-label": tf("questionLabel"),
							className: "dsd-ding-switch" + (questionNotify ? " dsd-ding-on" : ""),
							onClick: onToggleQuestion
						})
					),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement("div", { className: "dsd-ding-menu-head" }, tf("soundTitle")),
					(sounds || []).map((item) => react.createElement(
						"button",
						{
							key: item.id,
							type: "button",
							className: "dsd-ding-item" + (currentPath === item.path ? " dsd-ding-active" : ""),
							onClick: () => chooseSound(item.path)
						},
						// 内置叮咚跟随界面语言显示（宿主返回的中文名仅作 id=builtin 的标识）
						item.id === "builtin" ? tf("builtin") : item.name,
						currentPath === item.path && react.createElement("small", null, tf("current"))
					)),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement(
						"button",
						{
							type: "button",
							className: "dsd-ding-item" + (uploading ? " dsd-ding-disabled" : ""),
							disabled: uploading,
							onClick: () => { if (fileRef.current) fileRef.current.click(); }
						},
						uploading ? tf("uploading") : tf("upload")
					),
					react.createElement("input", {
						ref: fileRef,
						type: "file",
						accept: ".mp3,.wav,.mid,.wma,.aac,.m4a,.ogg,.flac,audio/*",
						style: { display: "none" },
						onChange: onFilePicked
					}),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement(
						"button",
						{
							type: "button",
							className: "dsd-ding-item",
							onClick: () => { setMenuOpen(false); setAdvancedOpen(true); }
						},
						"⚙ " + tf("advanced")
					)
				)
			);
		}
		//#endregion

		//#region 插件入口
		/** 所需服务：插槽注册表（dsh-client-runtime）+ 多语言（dsh-client-locale，随 WebUI 语言切换）+ 会话服务（通知点击深链打开会话）。 */
		const inject = ["slots", "locale", "sessions"];

		/** base64url 解码为 UTF-8 字符串（通知点击跳转参数）。 */
		function decodeBase64Url(str) {
			try {
				const b64 = str.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - (str.length % 4)) % 4);
				const bytes = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
				return new TextDecoder("utf-8").decode(bytes);
			} catch {
				return "";
			}
		}

		/**
		 * 浏览器端插件主体：把铃铛注册进对话页顶栏工具区；
		 * 并处理通知点击带来的 ?dingOpen=<base64url(sessionId)> 深链参数，直达对应会话。
		 * @param ctx - 客户端根上下文。
		 */
		function apply(ctx) {
			ctx.effect(() => {
				const style = document.createElement("style");
				style.setAttribute("data-plugin", "dsh-ding");
				style.textContent = STYLE;
				document.head.append(style);
				return () => { style.remove(); };
			}, "dsh-ding: styles");

			ctx.effect(() => ctx.locale.register(NS, { zh, en }), "dsh-ding: dictionaries");

			// 语言跟踪：从 locale 服务读当前语言（用户显式选择优先于浏览器），
			// 供 presence 上报（宿主按语言生成 Windows 通知文本）
			ctx.effect(() => {
				try {
					const active = ctx.locale?.getLocale?.()?.active;
					if (typeof active === "string" && active.length > 0) currentLocale = active;
				} catch { /* locale 服务未就绪时保持默认 */ }
				return ctx.on("locale/change", (snapshot) => {
					if (snapshot && typeof snapshot.active === "string" && snapshot.active.length > 0) {
						currentLocale = snapshot.active;
					}
				});
			}, "dsh-ding: locale tracking");

			// 通知点击深链：URL 带 dingOpen 参数时打开对应会话，并清理参数防止刷新重复打开
			// open 带自动重试（页面/会话服务就绪可能慢于 600ms，单次调用会静默失败）
			ctx.effect(() => {
				try {
					const params = new URLSearchParams(window.location.search);
					const openId = params.get("dingOpen");
					if (!openId) return;
					const sessionId = decodeBase64Url(openId);
					if (!sessionId) return;
					let attempts = 0;
					const tryOpen = () => {
						attempts++;
						try {
							ctx.sessions?.open?.(sessionId);
						} catch { /* 静默，继续重试 */ }
						if (attempts < 6) setTimeout(tryOpen, 800); // 最多 6 次，覆盖加载慢的场景
					};
					const timer = setTimeout(() => {
						tryOpen();
						const url = new URL(window.location.href);
						url.searchParams.delete("dingOpen");
						window.history.replaceState(null, "", url.toString());
					}, 600); // 等会话列表/连接就绪后再打开
					return () => clearTimeout(timer);
				} catch {
					return;
				}
			}, "dsh-ding: deep link");

			ctx.effect(() => ctx.slots.inject("conversation.session.header.utilities", () => {
				const dispose = ctx.slots.register({
					name: "conversation.session.header.utilities",
					id: "dsh-ding",
					order: 90,
					locale: NS,
					inject: (sessionId) => ({ sessionId })
				}, DingBell);
				return () => { dispose(); };
			}), "dsh-ding: bell entry");
		}
		//#endregion

		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});
