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
		const TEXT = typeof document !== "undefined" && (document.documentElement.lang || "").toLowerCase().startsWith("zh")
			? {
				toggleOn: "提示音已开启（单击关闭，右键打开设置）",
				toggleOff: "提示音已关闭（单击开启）",
				volumeTitle: "提示音音量",
				menuHead: "通知设置",
				soundLabel: "提示音",
				balloonLabel: "气泡通知",
				muteHint: "已全部关闭：对话完成时将没有任何提示",
				soundTitle: "音效",
				builtin: "内置叮咚",
				upload: "上传新音效…",
				uploading: "上传中…",
				current: "当前"
			}
			: {
				toggleOn: "Sound on (click to mute, right-click for settings)",
				toggleOff: "Sound muted (click to unmute)",
				volumeTitle: "Sound volume",
				menuHead: "Notifications",
				soundLabel: "Sound",
				balloonLabel: "Toast",
				muteHint: "Everything off: no notification when a conversation finishes",
				soundTitle: "Sound effect",
				builtin: "Built-in ding",
				upload: "Upload new sound…",
				uploading: "Uploading…",
				current: "current"
			};

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
			// 音量条：铃铛正左侧的行内元素；宽度 0→176px 动画，把同行元素往左推
			".dsd-ding-vol{width:0;overflow:hidden;opacity:0;flex:none;transition:width .18s ease,opacity .18s ease}",
			".dsd-ding-vol.dsd-ding-open{width:176px;opacity:1}",
			".dsd-ding-vol-inner{width:176px;padding:0 3px}",
			".dsd-ding-vol-title{font-size:12px;color:var(--dsw-alias-label-secondary,#9aa3b8);margin-bottom:7px}",
			// 自定义滑杆：4px 圆角轨道 + 品牌色填充（--dsh-ding-fill 由组件内联写入）+ 主题化旋钮
			".dsd-ding-vol input[type=range]{-webkit-appearance:none;appearance:none;width:100%;height:18px;margin:0;background:transparent;cursor:pointer}",
			".dsd-ding-vol input[type=range]::-webkit-slider-runnable-track{height:4px;border-radius:2px;background:linear-gradient(to right,var(--dsw-alias-brand-primary,#4d6bfe) var(--dsh-ding-fill,50%),var(--dsw-alias-bg-layer-2,rgba(128,140,170,.28)) var(--dsh-ding-fill,50%))}",
			".dsd-ding-vol input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:14px;height:14px;margin-top:-5px;border-radius:50%;background:var(--dsw-alias-bg-base,#f2f4f8);border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.55));box-shadow:0 1px 3px rgba(0,0,0,.28);transition:border-color var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease),transform var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-vol input[type=range]::-webkit-slider-thumb:hover{border-color:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-vol input[type=range]:active::-webkit-slider-thumb{transform:scale(1.12);border-color:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-vol input[type=range]::-moz-range-track{height:4px;border-radius:2px;background:var(--dsw-alias-bg-layer-2,rgba(128,140,170,.28))}",
			".dsd-ding-vol input[type=range]::-moz-range-progress{height:4px;border-radius:2px;background:var(--dsw-alias-brand-primary,#4d6bfe)}",
			".dsd-ding-vol input[type=range]::-moz-range-thumb{width:13px;height:13px;border-radius:50%;background:var(--dsw-alias-bg-base,#f2f4f8);border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.55));box-shadow:0 1px 3px rgba(0,0,0,.28)}",
			".dsd-ding-vol input[type=range]:focus-visible{outline:2px solid var(--dsw-alias-brand-primary,#4d6bfe);outline-offset:2px;border-radius:4px}",
			".dsd-ding-vol-value{font-size:11px;text-align:right;color:var(--dsw-alias-label-secondary,#9aa3b8);margin-top:5px}",
			// 设置面板：与 WebUI 菜单同款表面（--dsw-specific-menu / --dsw-shadow-lv3 / 12px 圆角）
			".dsd-ding-menu{position:absolute;top:100%;right:0;z-index:9999;min-width:236px;padding:4px;border-radius:12px;border:1px solid var(--dsw-alias-border-l2,rgba(120,132,160,.38));background:var(--dsw-specific-menu,#1b1f2a);color:var(--dsw-alias-label-primary,#e7e9f0);box-shadow:var(--dsw-shadow-lv3,0 10px 28px rgba(0,0,0,.5));user-select:none;opacity:0;transform:translateY(6px);visibility:hidden;transition:opacity .15s ease,transform .15s ease,visibility 0s linear .15s}",
			".dsd-ding-menu.dsd-ding-open{opacity:1;transform:translateY(0);visibility:visible;transition:opacity .15s ease,transform .15s ease}",
			".dsd-ding-menu-head{font-size:11.5px;color:var(--dsw-alias-label-secondary,#9aa3b8);padding:6px 10px 4px}",
			".dsd-ding-row{display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:34px;padding:5px 10px;border-radius:10px;font-size:13px;color:var(--dsw-alias-label-primary,#e7e9f0);transition:background var(--ds-transition-duration-fast,.1s) var(--ds-ease-in-out,ease)}",
			".dsd-ding-row:hover{background:var(--dsw-alias-hover-l2,rgba(128,140,170,.16))}",
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
			".dsd-ding-sep{height:1px;margin:5px 8px;background:var(--dsw-alias-border-l2,rgba(120,132,160,.25))}"
		].join("\n");
		//#endregion

		//#region 图标
		/** 铃铛图标（on 带声波，off 带斜杠）。 */
		function BellIcon({ muted }) {
			return react.createElement(
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
			const [volume, setVolume] = react.useState(100);
			const [uploading, setUploading] = react.useState(false);
			const fileRef = react.useRef(null);
			const volumeTimer = react.useRef(null);
			const lastTest = react.useRef(0);
			const dragging = react.useRef(false);

			const api = react.useCallback((path, options) =>
				fetch(path, options).then((res) => res.json()).catch(() => null), []);

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
				if (preview && settings?.sound !== false) {
					const now = Date.now();
					if (now - lastTest.current >= 500) {
						lastTest.current = now;
						api("/dsh-ding/test", {
							method: "POST",
							headers: { "content-type": "application/json" },
							body: JSON.stringify({ volume: nextVolume / 100 })
						});
					}
				}
			}, [api, patchSettings, settings?.sound]);

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

			/** 右键：打开通知设置面板（同时收起音量条）。 */
			const openMenu = react.useCallback((event) => {
				event.preventDefault();
				setPopOpen(false);
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
			const muted = !sound;
			const tooltip = muted ? TEXT.toggleOff : TEXT.toggleOn;
			const currentPath = settings?.soundFile || "";

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
						react.createElement("div", { className: "dsd-ding-vol-title" }, TEXT.volumeTitle),
						react.createElement("input", {
							type: "range",
							min: 0,
							max: 100,
							step: 1,
							value: volume,
							"aria-label": TEXT.volumeTitle,
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
				// ---- 通知设置面板（右键）：提示音/气泡开关 + 音效选择 ----
				react.createElement(
					"div",
					{ className: "dsd-ding-menu" + (menuOpen ? " dsd-ding-open" : ""), onClick: (event) => event.stopPropagation() },
					react.createElement("div", { className: "dsd-ding-menu-head" }, TEXT.menuHead),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null, TEXT.soundLabel),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": sound,
							"aria-label": TEXT.soundLabel,
							className: "dsd-ding-switch" + (sound ? " dsd-ding-on" : ""),
							onClick: onToggle
						})
					),
					react.createElement(
						"div",
						{ className: "dsd-ding-row" },
						react.createElement("span", null, TEXT.balloonLabel),
						react.createElement("button", {
							type: "button",
							role: "switch",
							"aria-checked": balloon,
							"aria-label": TEXT.balloonLabel,
							className: "dsd-ding-switch" + (balloon ? " dsd-ding-on" : ""),
							onClick: onToggleBalloon
						})
					),
					!sound && !balloon && react.createElement("div", { className: "dsd-ding-mute-hint" }, TEXT.muteHint),
					react.createElement("div", { className: "dsd-ding-sep" }),
					react.createElement("div", { className: "dsd-ding-menu-head" }, TEXT.soundTitle),
					(sounds || []).map((item) => react.createElement(
						"button",
						{
							key: item.id,
							type: "button",
							className: "dsd-ding-item" + (currentPath === item.path ? " dsd-ding-active" : ""),
							onClick: () => chooseSound(item.path)
						},
						item.name,
						currentPath === item.path && react.createElement("small", null, TEXT.current)
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
						uploading ? TEXT.uploading : TEXT.upload
					),
					react.createElement("input", {
						ref: fileRef,
						type: "file",
						accept: ".mp3,.wav,.mid,.wma,.aac,.m4a,.ogg,.flac,audio/*",
						style: { display: "none" },
						onChange: onFilePicked
					})
				)
			);
		}
		//#endregion

		//#region 插件入口
		/** 所需服务：插槽注册表（由 dsh-client-runtime 提供）。 */
		const inject = ["slots"];

		/**
		 * 浏览器端插件主体：把铃铛注册进对话页顶栏工具区。
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

			ctx.effect(() => ctx.slots.inject("conversation.session.header.utilities", () => {
				const dispose = ctx.slots.register({
					name: "conversation.session.header.utilities",
					id: "dsh-ding",
					order: 90,
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
