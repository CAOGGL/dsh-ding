// dsh-ding — 浏览器端（client bundle）
//
// 在对话页顶栏（conversation.session.header.utilities 插槽）放一个铃铛按钮：
//   - 单击       ：开关提示音（不弹通知，通知开关仍在配置里）
//   - 悬停       ：弹出音量滑杆（松开时自动试听）
//   - 右键       ：选择音效（内置叮咚 / 自定义列表），并可上传新音效
// 全部设置通过宿主插件挂载的 HTTP API 读写（/dsh-ding/settings、/sounds、/test），
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
				toggleOn: "提示音已开启（单击关闭，右键选音效）",
				toggleOff: "提示音已关闭（单击开启）",
				volumeTitle: "提示音音量",
				menuTitle: "选择提示音",
				builtin: "内置叮咚",
				upload: "上传新音效…",
				uploading: "上传中…",
				previewing: "试听中…",
				current: "当前"
			}
			: {
				toggleOn: "Sound on (click to mute, right-click to choose)",
				toggleOff: "Sound muted (click to unmute)",
				volumeTitle: "Sound volume",
				menuTitle: "Choose sound",
				builtin: "Built-in ding",
				upload: "Upload new sound…",
				uploading: "Uploading…",
				previewing: "Previewing…",
				current: "current"
			};

		/** 插槽内联样式（data-plugin 预标记，随插件生命周期注入/移除）。 */
		const STYLE = [
			".dsd-ding{position:relative;display:inline-flex;align-items:center}",
			".dsd-ding-btn{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;padding:5px;border:none;border-radius:7px;background:transparent;color:#c9cedb;cursor:pointer;transition:background .12s ease}",
			".dsd-ding-btn:hover{background:rgba(128,140,170,.18)}",
			".dsd-ding-btn:active{background:rgba(128,140,170,.28)}",
			".dsd-ding-btn svg{width:19px;height:19px;display:block}",
			".dsd-ding-btn.dsd-ding-off{color:rgba(150,158,175,.5)}",
			".dsd-ding-pop,.dsd-ding-menu{position:absolute;top:calc(100% + 8px);right:0;z-index:9999;min-width:196px;padding:11px 13px;border-radius:11px;border:1px solid rgba(120,132,160,.38);background:#1b1f2a;color:#e7e9f0;box-shadow:0 10px 28px rgba(0,0,0,.5);user-select:none}",
			".dsd-ding-pop-title{font-size:12px;color:#9aa3b8;margin-bottom:9px}",
			".dsd-ding-pop input[type=range]{width:100%;height:18px;accent-color:#4d6bfe;cursor:pointer}",
			".dsd-ding-pop-value{font-size:11px;text-align:right;color:#9aa3b8;margin-top:5px}",
			".dsd-ding-menu{min-width:228px;padding:6px}",
			".dsd-ding-menu-head{font-size:11.5px;color:#9aa3b8;padding:6px 10px 4px}",
			".dsd-ding-item{display:flex;align-items:center;gap:8px;width:100%;padding:7px 10px;border:none;border-radius:7px;background:transparent;color:#e7e9f0;font-size:12.5px;text-align:left;cursor:pointer;white-space:nowrap;overflow:hidden}",
			".dsd-ding-item:hover{background:rgba(77,107,254,.22)}",
			".dsd-ding-item.dsd-ding-active{color:#86a0ff;font-weight:600}",
			".dsd-ding-item small{color:#8b93a7;margin-left:auto;font-size:11px;font-weight:400}",
			".dsd-ding-item.dsd-ding-disabled{opacity:.55;cursor:default}",
			".dsd-ding-sep{height:1px;margin:5px 8px;background:rgba(120,132,160,.25)}"
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
		 * 顶栏铃铛：点击开关提示音；悬停弹音量滑杆；右键选/传音效。
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

			const commitVolume = react.useCallback((nextVolume, preview) => {
				const body = JSON.stringify({ volume: Math.max(0, Math.min(1, nextVolume / 100)) });
				api("/dsh-ding/settings", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body
				}).then((result) => {
					if (result && result.ok) setSettings(result.value);
				});
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
			}, [api, settings?.sound]);

			const onToggle = react.useCallback(() => {
				const nextSound = !(settings?.sound ?? true);
				setSettings((current) => (current ? { ...current, sound: nextSound } : current));
				api("/dsh-ding/settings", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ sound: nextSound })
				}).then((result) => {
					if (result && result.ok) setSettings(result.value);
				});
			}, [api, settings?.sound]);

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
				api("/dsh-ding/settings", {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({ soundFile: path })
				}).then((result) => {
					if (result && result.ok) {
						setSettings(result.value);
						setMenuOpen(false);
					}
				});
			}, [api]);

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
							if (result.soundFile) setSettings((current) => (current ? { ...current, soundFile: result.soundFile } : current));
							setMenuOpen(false);
						}
					}).catch(() => setUploading(false));
				};
				reader.readAsDataURL(file);
			}, [api]);

			const muted = settings ? settings.sound === false : false;
			const tooltip = muted ? TEXT.toggleOff : TEXT.toggleOn;
			const currentPath = settings?.soundFile || "";

			return react.createElement(
				"div",
				{
					className: "dsd-ding",
					onMouseEnter: () => setPopOpen(true),
					onMouseLeave: () => { setPopOpen(false); setMenuOpen(false); },
					onContextMenu: openMenu
				},
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
				popOpen && !menuOpen && react.createElement(
					"div",
					{ className: "dsd-ding-pop", onClick: (event) => event.stopPropagation() },
					react.createElement("div", { className: "dsd-ding-pop-title" }, TEXT.volumeTitle),
					react.createElement("input", {
						type: "range",
						min: 0,
						max: 100,
						step: 1,
						value: volume,
						"aria-label": TEXT.volumeTitle,
						onInput: (event) => {
							const next = Number(event.target.value);
							setVolume(next);
							if (volumeTimer.current) clearTimeout(volumeTimer.current);
							volumeTimer.current = setTimeout(() => commitVolume(next, false), 250);
						},
						onPointerUp: (event) => {
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
					react.createElement("div", { className: "dsd-ding-pop-value" }, `${volume}%`)
				),
				menuOpen && react.createElement(
					"div",
					{ className: "dsd-ding-menu", onClick: (event) => event.stopPropagation() },
					react.createElement("div", { className: "dsd-ding-menu-head" }, TEXT.menuTitle),
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
