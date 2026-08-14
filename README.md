# dsh-ding 🔔

DSH（DeepSeek Harness）宿主插件：**对话完成时提醒你**——每当 Agent 结束一轮对话（状态回到 idle，不再主动输出），播放提示音并弹出 Windows 通知，让你切到别的窗口等回复时也不会错过。

A DSH host plugin that **notifies you when a conversation finishes**: whenever the Agent completes a turn (back to `idle`, no more proactive output), it plays a sound and shows a Windows notification, so you never miss the reply while working in another window.

**切换语言 / Language：** [中文](#中文) · [English](#english)

---

## 中文

### 主要功能

- 🔔 **提示音**：对话完成后播放提示音——默认使用 `ding.mp3`（可配置任意音频文件：mp3/wav/mid/wma/aac），找不到时回退系统"叮咚"双音
- 🪟 **Windows 原生通知**：弹出系统原生 Toast（含会话标题、DSH 蓝鲸图标）。首次使用时自动注册 AppUserModelID（开始菜单快捷方式），确保通知真正显示——未注册的 AUMID 会被 Windows 静默丢弃
- 🎚️ **音量可调**：`volume` 配置项（0.0 ~ 1.0）控制提示音大小，改配置即时生效
- 🔔 **Web 铃铛按钮**：对话页顶栏有个铃铛——**单击**开关提示音、**悬停**拖音量滑杆（松手自动试听）、**右键**选择音效并可上传自己的音频文件；设置即时保存，无需改配置
- 🎯 **时机精准**：订阅宿主事件 `agent/status`，状态从 `running` 变为 `idle` 时触发——这正是"整轮对话彻底结束、不会再主动输出"的时刻
- 🧹 **不误报**：自动跳过子代理（subagent）的完成事件（那只是主对话的中间过程）；跳过 inbox 仍有待处理消息的空闲（马上会继续）
- ⚡ **防抖节流**：默认 800ms 防抖 + 3s 全局节流，避免连发
- ♻️ **热生效**：配置文件（`cordis.patch.yml`）改动即时生效，无需重启服务

### 安装方法

`$DSH_HOME` 默认为 `~/.dsh`。

**方法 A：一行命令（推荐，bundle 安装）**

```bash
dsh plugin --profile web add github:CAOGGL/dsh-ding
```

装完**重启 `dsh web`** 生效（依赖 pnpm，`npm install -g pnpm` 即可）。本插件也支持 insert 行挂载（改配置即时生效），见方法 C。

**方法 B：插件市场**

设置 → 插件市场 → 搜索 `dsh-ding` → 一键安装（已收录于 awesome-dsh-plugin，市场目录每日刷新后出现）。

**方法 C：手动放置（无需 pnpm）**

1. 把本仓库克隆（或下载）到：`$DSH_HOME/profiles/node_modules/dsh-ding/`
2. 在 profile 的用户补丁 `$DSH_HOME/profiles/web/cordis.patch.yml`（其他 profile 同理）追加：

```yaml
- insert:
    - id: dsh-ding
      name: 'dsh-ding'
      inject: ['webServer']   # 必需：声明对 webServer 的依赖，Web 铃铛 API 才能挂载
      config:
        sound: true
        balloon: true
```

3. 保存即生效（补丁文件是热监控的）；插件代码本身的改动需要重启服务才生效。

> npm（`dsh plugin --profile web add dsh-ding`）：即将上线，上线后安装更快。

**验证**：对话完成后应听到提示音并看到通知；也可以先单独测试通知脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-ding\notify.ps1" -Title "测试" -Text "dsh-ding 工作正常"
```

### 配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `sound` | `true` | 播放提示音 |
| `soundFile` | 空 | 提示音文件路径（mp3/wav/mid/wma/aac）。留空时自动在 服务器工作目录 / 插件目录 / 用户主目录 找 `ding.mp3`，找不到则回退系统"叮咚"双音 |
| `volume` | `1.0` | 提示音音量（0.0 ~ 1.0，1.0 为原始音量，如 `0.5` 即一半音量） |
| `balloon` | `true` | 显示 Windows 通知 |
| `title` | `DSH 完成` | 通知标题 |
| `debounceMs` | `800` | 状态防抖毫秒数 |
| `minIntervalMs` | `3000` | 两次通知的最小间隔 |
| `notifySubagents` | `false` | 是否也通知子代理完成 |

完整示例：

```yaml
- insert:
    - id: dsh-ding
      name: 'dsh-ding'
      config:
        sound: true
        soundFile: 'C:\codewhale\ding.mp3'
        volume: 0.8
        balloon: true
        title: 'DSH 完成'
        debounceMs: 800
        minIntervalMs: 3000
```

### Web 铃铛按钮（v0.4.0+）

对话页顶栏右侧的铃铛，全部设置即时保存到 `$DSH_HOME/profiles/<name>/data/dsh-ding.json`（仅覆盖你动过的项，其余仍跟随 `cordis.patch.yml` 配置）：

| 操作 | 效果 |
| --- | --- |
| 单击铃铛 | 快速开关提示音 |
| 悬停铃铛 | 铃铛**正左侧**滑出音量条（行内元素带宽度动画，同行元素自动左移）；拖动松手自动试听 |
| 右键铃铛 | 打开通知设置面板：**提示音**/**气泡通知**开关（两个都关 = 对话完成时无任何提示），下方可选音效（内置叮咚 / 已上传的音频）或上传新音效（mp3/wav/mid/wma/aac/m4a/ogg/flac，存到 `data/sounds/`） |

### 卸载

1. 从 `cordis.patch.yml` 删掉 `dsh-ding` 那一整块
2. 删除 `$DSH_HOME/profiles/node_modules/dsh-ding/` 目录

### 更新日志

- **v0.4.4**（2026-08-14）：**松手立即试听**——新增 `GET /dsh-ding/audio` 路由，浏览器直接用 HTMLAudio 播放音效（不再等 PowerShell 启动）；宿主端对"内置叮咚"做与 notify.ps1 相同的 ding.mp3 兜底解析。音量条改版：百分比数字移到滑杆**右侧同一行**、滑杆与铃铛按钮**同高（30px）垂直对齐**、滑杆左右留白使轨道圆角不被按钮遮挡
- **v0.4.3**（2026-08-14）：滑杆旋钮改为**亮色黑球 / 暗色白球**（跟随 WebUI 主题实时切换）；移除音量条标题行；菜单文案改为跟随 **WebUI 语言设置**（`ctx.locale`，切换语言即时生效，不再是页面 lang）
- **v0.4.2**（2026-08-14）：**滑杆与右键菜单改用 WebUI 设计令牌**（`--dsw-alias-*`）——自定义滑杆：4px 圆角轨道 + 品牌色填充 + 主题化旋钮（悬停/按压放大）；菜单表面/边框/阴影/文字/悬停/选中色全部对齐 WebUI 弹层样式（`--dsw-specific-menu` / `--dsw-shadow-lv3`），自动适配明暗主题
- **v0.4.1**（2026-08-14）：铃铛交互改版——音量条移至铃铛正左侧（行内宽度动画、同行元素自动左移）；右键设置面板新增**提示音/气泡通知开关**（全关 = 无任何提示）；弹层增加过渡动画；修复悬停时菜单被误关的问题
- **v0.4.0**（2026-08-14）：**新增 Web 铃铛按钮**——对话页顶栏单击开关提示音、悬停调音量（松手试听）、右键选音效/上传自定义音频；新增 `GET/POST /dsh-ding/settings`、`/dsh-ding/test`、`/dsh-ding/sounds` HTTP API，设置持久化到 `data/dsh-ding.json`
- **v0.3.1**（2026-08-14）：通知图标改为 DSH 蓝鲸 logo；README 同步安装方法并新增本日志
- **v0.3.0**（2026-08-14）：**修复原生通知不显示**——自动注册 AppUserModelID（未注册的 AUMID 会被 Windows 静默丢弃）
- **v0.2.0**（2026-08-14）：bundle 化，支持 `dsh plugin add github:CAOGGL/dsh-ding` 一行安装
- **v0.1.0**（2026-08-14）：首版——对话完成播放提示音 + Windows 通知；支持 soundFile / volume / 防抖节流 / 跳过子代理

### 常见问题

- **没有声音？** 检查 `soundFile` 指向的文件是否存在；文件不存在会自动回退系统"叮咚"双音；两者都无声请检查系统音量/静音。
- **没有通知？** 插件首次使用时会在开始菜单注册 `dsh-ding-notifier` 快捷方式（AppUserModelID 注册，这是 Windows 显示 toast 的前提）。若通知仍不显示，检查 设置 → 系统 → 通知 里 `dsh-ding-notifier` 是否被关闭；WinRT Toast 失败时脚本会自动回退 NotifyIcon 气泡。
- **想换提示音？** 在对话页铃铛上**右键**即可选/传音效；也可以放一个新音频文件，改 `soundFile` 指向它（即时生效）。

---

## English

### Features

- 🔔 **Sound alert**: plays `ding.mp3` (configurable to any audio file: mp3/wav/mid/wma/aac) when a conversation completes; falls back to the system "ding-dong" beep if the file is missing
- 🪟 **Native Windows notification**: shows a system toast (including the session title and the DSH whale logo). On first use the plugin registers an AppUserModelID (Start Menu shortcut) so the toast is actually displayed — toasts with an unregistered AUMID are silently dropped by Windows
- 🎚️ **Adjustable volume**: the `volume` option (0.0 ~ 1.0) controls the alert loudness; config changes apply immediately
- 🔔 **Web bell button**: a bell in the conversation header — **click** toggles the sound, **hover** slides a volume bar out on the left of the bell (in-flow width animation; the other items in the row shift left), **right-click** opens the notification settings panel: sound/toast toggles (both off = no notification at all), sound picker and upload; changes save immediately, no config editing
- 🎯 **Precise timing**: subscribes to the host `agent/status` event and fires when the status transitions from `running` to `idle` — exactly the moment the turn is fully done with no more proactive output
- 🧹 **No false positives**: ignores subagent completion events (they are just intermediate steps of the main conversation) and idle states with pending inbox messages (the agent is about to continue)
- ⚡ **Debounced & throttled**: 800ms debounce and 3s global rate limit by default
- ♻️ **Hot reload**: config changes in `cordis.patch.yml` take effect immediately without restarting the service

### Installation

`$DSH_HOME` defaults to `~/.dsh`.

**Method A: one-line install (recommended, bundle)**

```bash
dsh plugin --profile web add github:CAOGGL/dsh-ding
```

Then **restart `dsh web`** (requires pnpm — `npm install -g pnpm`). The plugin also supports insert-row mounting with live config reload (see Method C).

**Method B: plugin market**

Settings → Plugin Market → search `dsh-ding` → one-click install (listed in awesome-dsh-plugin; the market catalog refreshes daily).

**Method C: manual placement (no pnpm needed)**

1. Clone (or download) this repo to: `$DSH_HOME/profiles/node_modules/dsh-ding/`
2. Append to your profile's user patch file `$DSH_HOME/profiles/web/cordis.patch.yml` (same for other profiles):

```yaml
- insert:
    - id: dsh-ding
      name: 'dsh-ding'
      inject: ['webServer']   # required: depends on the webServer service so the bell API mounts
      config:
        sound: true
        balloon: true
```

3. It takes effect immediately on save (the patch file is hot-watched). Changes to the plugin code itself require a service restart.

> npm (`dsh plugin --profile web add dsh-ding`): coming soon — faster installs once published.

**Verification**: finish a conversation and you should hear the sound and see the notification. You can also test the notification script standalone:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-ding\notify.ps1" -Title "Test" -Text "dsh-ding works"
```

### Configuration

| Option | Default | Description |
| --- | --- | --- |
| `sound` | `true` | Play the alert sound |
| `soundFile` | empty | Path to the sound file (mp3/wav/mid/wma/aac). When empty, the script looks for `ding.mp3` in the server working directory / plugin directory / user home; falls back to the system beep if not found |
| `volume` | `1.0` | Alert sound volume (0.0 ~ 1.0; `1.0` = original volume, e.g. `0.5` = half volume) |
| `balloon` | `true` | Show the Windows notification |
| `title` | `DSH 完成` | Notification title |
| `debounceMs` | `800` | Status debounce in ms |
| `minIntervalMs` | `3000` | Minimum interval between two notifications |
| `notifySubagents` | `false` | Also notify when subagents finish |

Full example:

```yaml
- insert:
    - id: dsh-ding
      name: 'dsh-ding'
      config:
        sound: true
        soundFile: 'C:\codewhale\ding.mp3'
        volume: 0.8
        balloon: true
        title: 'DSH 完成'
        debounceMs: 800
        minIntervalMs: 3000
```

### Web bell button (v0.4.0+)

The bell in the conversation header saves every change immediately to `$DSH_HOME/profiles/<name>/data/dsh-ding.json` (only the fields you touched; everything else still follows `cordis.patch.yml`):

| Action | Effect |
| --- | --- |
| Click the bell | Quickly toggle the sound |
| Hover the bell | A volume bar slides out on the **left** of the bell (in-flow width animation; the other items in the row shift left automatically); releasing the slider previews the sound once |
| Right-click the bell | Notification settings panel: **Sound** / **Toast** toggles (both off = no notification when a conversation finishes), plus the sound picker (built-in ding / your uploaded files) and upload (mp3/wav/mid/wma/aac/m4a/ogg/flac, stored in `data/sounds/`) |

### Uninstall

1. Remove the whole `dsh-ding` block from `cordis.patch.yml`
2. Delete the `$DSH_HOME/profiles/node_modules/dsh-ding/` directory

### Changelog

- **v0.4.4** (2026-08-14): **Instant preview on release** — new `GET /dsh-ding/audio` route lets the browser play the sound directly via HTMLAudio (no more PowerShell startup wait); the host resolves `ding.mp3` for the built-in sound exactly like notify.ps1 does. Volume bar redesign: the percentage moved to the **same row, right of the slider**, the slider is now **aligned with the bell button (30px)**, and horizontal padding keeps the track's rounded ends clear of the button
- **v0.4.3** (2026-08-14): Slider knob is now **black in light mode / white in dark mode** (follows the WebUI theme live); the volume-bar title row was removed; the menu copy now follows the **WebUI language setting** (`ctx.locale`, switches instantly, no longer tied to the page lang)
- **v0.4.2** (2026-08-14): **Slider and right-click menu restyled with WebUI design tokens** (`--dsw-alias-*`) — custom slider: 4px rounded track, brand-colored fill, themed knob (grows on hover/press); the menu surface/border/shadow/text/hover/active colors now match the WebUI popover style (`--dsw-specific-menu` / `--dsw-shadow-lv3`) and adapt to light/dark themes automatically
- **v0.4.1** (2026-08-14): Bell interaction redesign — the volume bar moved to the left of the bell (in-flow width animation, row items shift left); the right-click panel gained **Sound/Toast toggles** (both off = completely silent); popups got transition animations; fixed the hover menu closing too early
- **v0.4.0** (2026-08-14): **Web bell button added** — click the bell in the conversation header to toggle the sound, hover for a volume slider (release to preview), right-click to pick/upload sounds; new `GET/POST /dsh-ding/settings`, `/dsh-ding/test`, `/dsh-ding/sounds` HTTP APIs; settings persist to `data/dsh-ding.json`
- **v0.3.1** (2026-08-14): Toast icon switched to the DSH whale logo; README install methods updated, changelog added
- **v0.3.0** (2026-08-14): **Fixed native notifications not showing** — auto-registers an AppUserModelID (toasts with an unregistered AUMID are silently dropped by Windows)
- **v0.2.0** (2026-08-14): Bundled, installable with `dsh plugin add github:CAOGGL/dsh-ding`
- **v0.1.0** (2026-08-14): Initial release — sound + Windows notification when a conversation finishes; supports soundFile / volume / debounce & throttle / skip-subagents

### FAQ

- **No sound?** Check that the file pointed to by `soundFile` exists; if it doesn't, the script falls back to the system beep. If both are silent, check your system volume/mute settings.
- **No notification?** On first use the plugin registers the `dsh-ding-notifier` Start Menu shortcut (AppUserModelID registration — required for Windows to display toasts). If notifications still don't show, check Settings → System → Notifications to make sure `dsh-ding-notifier` is enabled. If the WinRT toast fails, the script falls back to a NotifyIcon balloon automatically.
- **Want a different sound?** Right-click the bell in the web UI to pick/upload one; or drop in a new audio file and point `soundFile` to it (takes effect immediately).

---

## License

MIT
