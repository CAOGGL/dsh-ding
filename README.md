# dsh-ding 🔔

[![awesome · DSH plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

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
- 🖱️ **通知点击直达会话**：Windows 通知（toast/气泡）**点击后直达输出完成的对话**（快捷方式激活 + `dsh-ding://` 协议）。`dsh web` 启动时打开浏览器并用 `?dingOpen=` 定位会话；**DeepSeek Harness 桌面版**启动时改为**在应用窗口内直接切换会话**（宿主事件流推送 + `dsh://open` 聚焦窗口），不弹浏览器、也不会撞上 WebUI 的认证拦截
- 🔕 **当前会话免打扰**：窗口在前台且完成的会话正是你正在查看的会话时静默；切走窗口、看别的会话、或没开对话页时照常提醒
- ⏱ **长任务运行中提醒**：任务运行超 3 分钟后每 5 分钟提醒一次（只弹通知、不响铃），提醒文本含已运行时长
- ❓ **用户提问提醒**：Agent 通过 `ask_user_question` 提问等待回答时立即提醒（文本区别于完成通知）
- 🛡️ **工具审批提醒**：工具调用等待你批准（approval/request）时立即提醒，点击通知直达该会话，在 WebUI 里完成审批
- 🛠 **高级设置弹窗**：右键菜单底部「⚙ 高级设置」打开页面内设置窗口，可改全部参数（通知开关/标题/时机毫秒/音量/自定义通知模板），**自定义模板支持参数引用**：`{title}` 会话标题、`{prefix}` 对话前缀、`{elapsed}` 耗时、`{question}` 问题文本、`{tool}` 工具名（审批模板）
- 💾 **导入/导出配置**：右键菜单底部可**导出配置**（下载 JSON 文件）或**导入配置**（从 JSON 恢复全部设置）
- ▶ **铃声试听**：右键菜单铃声列表每项右侧有播放按钮，可单独试听每个铃声（不切换当前铃声）
- 🧪 **通知测试按钮**：高级设置页提供完成 / 运行中 / 提问 / 审批 4 个测试按钮，点击立即弹出对应类型的真实通知，点击通知打开测试结果页
- 🏷️ **通知应用名可改**：高级设置可自定义通知应用名；留空时跟随 WebUI 中英文自动切换（中文：DSH叮当通知，英文：dsh-ding-notifier）
- 📦 **内置 ding.mp3**：提示音文件随插件包分发，不再依赖启动目录或主目录存在 ding.mp3
- 🌐 **双语**：通知正文与标题、面板文案跟随 WebUI 界面语言（中/英）
- 🎯 **时机精准**：以会话 turn 是否真正结束判断完成（排除回复中途的短暂空闲），完成通知带耗时
- 🧹 **不误报**：自动跳过子代理（subagent）的完成事件（那只是主对话的中间过程）
- ⚡ **防抖节流**：默认 200ms 防抖 + 3s 全局节流，避免连发

### 安装方法

`$DSH_HOME` 默认为 `~/.dsh`。

**方法 A：npm 安装（推荐）**

```bash
dsh plugin --profile web add dsh-ding
```

也可以直接在项目里装：

```bash
npm install dsh-ding
```

装完**重启 `dsh web`** 生效。已发布版本见 https://www.npmjs.com/package/dsh-ding 。

**方法 B：从 GitHub 安装（bundle）**

```bash
dsh plugin --profile web add github:CAOGGL/dsh-ding
```

依赖 pnpm（`npm install -g pnpm` 即可）。本插件也支持 insert 行挂载（改配置即时生效），见方法 D。

**方法 C：插件市场**

设置 → 插件市场 → 搜索 `dsh-ding` → 一键安装（已收录于 awesome-dsh-plugin，市场目录每日刷新后出现）。

**方法 D：手动放置（无需 pnpm）**

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

**验证**：对话完成后应听到提示音并看到通知；也可以先单独测试通知脚本：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-ding\notify.ps1" -Title "测试" -Text "dsh-ding 工作正常"
```

### 配置

| 配置项 | 默认值 | 说明 |
| --- | --- | --- |
| `sound` | `true` | 播放提示音 |
| `soundFile` | 空 | 提示音文件路径（mp3/wav/mid/wma/aac）。留空时自动在 服务器工作目录 / 插件目录（**自带 ding.mp3**）/ 用户主目录 找 `ding.mp3`，找不到则回退系统"叮咚"双音 |
| `volume` | `1.0` | 提示音音量（0.0 ~ 1.0，1.0 为原始音量，如 `0.5` 即一半音量） |
| `balloon` | `true` | 显示 Windows 通知 |
| `title` | `DSH 完成` | 通知标题 |
| `debounceMs` | `200` | 状态防抖毫秒数 |
| `minIntervalMs` | `3000` | 两次通知的最小间隔 |
| `notifySubagents` | `false` | 是否也通知子代理完成 |
| `quietOnViewing` | `true` | 当前会话免打扰：窗口在前台（可见且有焦点）且完成的会话正是正在查看的会话时静默；切走窗口 / 看别的会话 / 没开对话页时照常提醒 |
| `runningNotify` | `true` | 长任务运行中提醒：只弹 Windows 通知、不响铃 |
| `runningFirstAfterMs` | `180000` | 运行中提醒首次延迟毫秒数（默认 3 分钟） |
| `runningIntervalMs` | `300000` | 运行中提醒后续间隔毫秒数（默认 5 分钟） |
| `runningTitle` | `DSH 运行中` | 运行中提醒的通知标题（v1.0.0 更新新增） |
| `questionNotify` | `true` | 用户提问提醒：Agent 通过 `ask_user_question` 提问等待回答时立即提醒（文本区别于完成通知） |
| `questionTitle` | `DSH 提问` | 提问提醒的通知标题 |
| `doneTemplate` | 空 | 自定义完成通知文本（支持 `{title}`/`{prefix}`/`{elapsed}`，留空用默认） |
| `runningTemplate` | 空 | 自定义运行中提醒文本（支持 `{title}`/`{prefix}`/`{elapsed}`，留空用默认） |
| `questionTemplate` | 空 | 自定义提问通知文本（支持 `{title}`/`{prefix}`/`{question}`，留空用默认） |
| `approvalNotify` | `true` | 工具审批提醒：工具调用等待你批准时立即提醒 |
| `approvalTitle` | `DSH 审批` | 审批提醒的通知标题 |
| `approvalTemplate` | 空 | 自定义审批通知文本（支持 `{title}`/`{prefix}`/`{tool}`，留空用默认） |
| `notifierName` | 空 | 通知应用显示名（Windows 通知设置里显示的名称）。留空时跟随 WebUI 语言自动切换：中文「DSH叮当通知」，英文「dsh-ding-notifier」；填写后固定使用该名称 |

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
        debounceMs: 200
        minIntervalMs: 3000
        quietOnViewing: true
        runningNotify: true
        runningFirstAfterMs: 180000
        runningIntervalMs: 300000
```

### Web 铃铛按钮（v0.4.0+）

对话页顶栏右侧的铃铛，全部设置即时保存到 `$DSH_HOME/profiles/<name>/data/dsh-ding.json`（仅覆盖你动过的项，其余仍跟随 `cordis.patch.yml` 配置）：

| 操作 | 效果 |
| --- | --- |
| 单击铃铛 | 快速开关提示音 |
| 悬停铃铛 | 铃铛**正左侧**滑出音量条（行内元素带宽度动画，同行元素自动左移）；拖动松手自动试听 |
| 右键铃铛 | 打开通知设置面板：**提示音**/**气泡通知**开关（两个都关 = 对话完成时无任何提示）、**当前会话免打扰**（正在查看的会话完成时不提醒，别的会话完成/切走后照常提醒）、**运行中提醒**（任务运行中超 3 分钟后每 5 分钟提醒一次，仅通知）、**提问提醒**（Agent 提问等待回答时立即提醒），下方可选音效（内置叮咚 / 已上传的音频）或上传新音效（mp3/wav/mid/wma/aac/m4a/ogg/flac，存到 `data/sounds/`）；面板底部 **⚙ 高级设置** 进入全部参数编辑（通知开关/标题/时机毫秒/音量，即时保存）；底部还有 **导出配置 / 导入配置**（下载/恢复 JSON 配置） |

### 卸载

1. 从 `cordis.patch.yml` 删掉 `dsh-ding` 那一整块
2. 删除 `$DSH_HOME/profiles/node_modules/dsh-ding/` 目录

### 更新日志

- **v1.1.2**（2026-10-25）：**回环判定放宽到整个 `127.0.0.0/8`**——`POST /dsh-ding/activate` 原先只认 `127.0.0.1` 字面值，导致同为本机、但源地址为 `127.0.0.2`/`127.13.37.9` 这类回环地址的调用被误判成"非本机"而 403（本地代理、端口转发、部分容器工具会遇到）；现按 `127.` 前缀判定，覆盖 `127/8` 与 IPv4 映射形态 `::ffff:127.`，安全性不变（该段不可路由）。本次同时把 v1.1.0 的文档表述收窄，并在常见问题里补了"桌面版启动认证失败"的上游排查说明
- **v1.1.1**（2026-10-24）：**修复右键菜单半透明**——设置面板与高级设置弹窗此前只取了 `--dsw-specific-menu`（该令牌只带 94% 不透明度）却没带核心菜单配套的 `backdrop-filter`，导致背后的对话正文清晰透上来；现补上 `backdrop-filter: var(--dsw-menu-backdrop-filter)` 并把表面同色叠两层（≈99.6% 不透明），即使环境不支持背景模糊也不会再透字
- **v1.1.0**（2026-10-24）：**桌面版通知点击直达**——点击 Windows 通知时先判断宿主：`dsh web` 命令行启动仍打开浏览器（行为不变）；**DeepSeek Harness 桌面版**改为在应用窗口内直接切到目标会话并聚焦窗口，不再弹出浏览器（因此**点击通知这条路径**不会再撞上 WebUI 的登录/认证页；注意这与「桌面版启动时提示认证失败」是两件事，后者见常见问题，本插件不涉及）（新增 `POST /dsh-ding/activate` 与 `GET /dsh-ding/events` 事件流，宿主把会话 id 推给已连接客户端；宿主判定为 Electron 运行时的桌面版 vs 命令行 `dsh web`）。**同时修复三处**：① 会话跳转改调核心 `uiWorkspace.openSession`——原来用的 `sessions.open` 在 WebUI 服务里并不存在，点击通知其实**从未真正切换会话**（`dsh web` 的 `?dingOpen=` 深链同样受影响）；② NotifyIcon 气泡兜底点击改走同一套判定，不再一律打开浏览器；③ `POST /dsh-ding/activate` 只接受本机回环 + `application/json`，避免任意网页或局域网对本地服务做 CSRF 式跳转。**版本号说明**：npm 上 `1.0.4`/`1.0.5`/`1.0.6` 曾于 2026-09-30 发布后删除，npm 永久禁止复用已发布过的版本号，故本次直接从 `1.0.3` 跳到 `1.1.0`
- **v1.0.3**（2026-10-24）：**npm 正式发布**——插件已发布到 npm registry（包名 `dsh-ding`），内容与 v1.0.2 相同，仅版本号对齐 npm `latest`；安装方式：`npm install dsh-ding` 或 `dsh plugin add dsh-ding`
- **v1.0.2**（2026-08-21）：**铃声试听**——右键菜单铃声列表每项右侧新增 ▶ 播放按钮，可单独试听每个铃声（不切换当前铃声），`GET /dsh-ding/audio` 支持 `?file=<id>` 指定音效；**配置导入/导出**——右键菜单底部新增「导出配置 / 导入配置」，可把当前配置下载为 JSON 或从 JSON 恢复全部设置；**内置 ding.mp3**——`ding.mp3` 随插件包分发，`notify.ps1` 搜索链新增插件自身目录，不再依赖启动目录或用户主目录里存在 ding.mp3；**四种通知测试按钮**——高级设置页新增完成/运行中/提问/审批四个测试按钮，点击立即发出对应类型的真实通知，点击通知跳转到测试结果页，并记录本次测试使用的配置；**通知应用名可改**——高级设置新增「通知应用名」，留空时跟随 WebUI 中英文自动切换（中文默认：DSH叮当通知，英文默认：dsh-ding-notifier），填写后固定使用
- **v1.0.1**（2026-08-17）：**工具审批提醒**——工具调用等待你批准（`approval/request`）时播放提示音并弹出 Windows 审批通知（标题与文案可自定义，支持 `{tool}` 工具名参数）；点击通知直达发起审批的会话，在 WebUI 里完成批准/拒绝；新增配置项 `approvalNotify` / `approvalTitle` / `approvalTemplate`（可在高级设置里编辑）；**提示音异步播放**——提示音与通知同时弹出，不再等待音效放完（修复音效尾音长时通知卡顿的问题）
- **v1.0.0**（2026-08-15，08-16/08-17 更新）：**提醒体系完整版**——① **当前会话免打扰**（默认开）：窗口在前台且完成的会话正是你正在查看的会话时静默；切走窗口、看别的会话、或没开对话页时照常提醒（浏览器上报前台状态与当前会话，新增 `POST /dsh-ding/presence`）；② **完成通知带耗时**：通知文本显示"用时 X 分 Y 秒"（宿主自动记录任务开始时间）；③ **长任务运行中提醒**（默认开）：任务运行超 3 分钟后首次提醒、之后每 5 分钟一次，只弹通知不响铃（尊重"完成前不打扰"），提醒文本含已运行时长；④ **点击通知跳转会话**：点击 Windows 通知自动打开浏览器直达对应对话（`dsh-ding://` 协议激活 + `toast-activate.ps1` + `?dingOpen=` 深链）；⑤ **用户提问提醒**（默认开）：Agent 通过 `ask_user_question` 提问等待回答时立即提醒；⑥ **高级设置弹窗**：右键菜单「⚙ 高级设置」打开页面内设置窗口（遮罩 + 居中面板），全部参数运行时编辑（通知开关/标题/时机毫秒/音量/子代理完成通知）；⑦ **自定义通知模板**：完成/运行中/提问通知文本可自定义，支持 `{title}`/`{prefix}`/`{elapsed}`/`{question}` 参数引用；⑧ **双语通知**：通知正文与标题跟随 WebUI 界面语言（DSH 完成/DSH Done、DSH 提问/DSH Question、DSH 运行中/DSH Running），内置音效名跟随语言；⑨ **完成判定修复**：以 turn 真正结束 + 相位过滤判断完成，修复回复中途误通知与完成不通知的问题。**（08-16 更新）**：⑩ **运行中提醒独立标题**——运行中通知标题由「DSH 完成」改为「DSH 运行中」，并新增 `runningTitle` 配置项与高级设置「运行中通知标题」输入框；⑪ **运行中通知模板**——新增 `runningTemplate` 配置项与高级设置「运行中通知模板」编辑框；⑫ **标题框语言化**——标题输入框在未自定义时随 WebUI 语言显示对应默认标题（中文 DSH 完成/DSH 运行中/DSH 提问，英文 DSH Done/DSH Running/DSH Question）；⑬ **设置文件热重载**——直接编辑 `data/dsh-ding.json` 保存后即时生效，无需重启。**（08-17 更新）**：⑭ **点击跳转修复**——Windows 11 对非打包应用的 toast 点击（foreground 激活）失效，改为 `activationType="protocol"` 协议激活，并补全 `URL Protocol` 注册标志、修复 launch 参数解析（`dsh-ding://open/<u>/<b>` 中 open 被解析为 host 的情况）、浏览器端深链加自动重试；⑮ **跳转黑窗修复**——协议命令改用 wscript + `toast-activate.vbs` 无窗口启动器（避免 powershell 控制台黑窗闪烁）。新增配置项：`quietOnViewing` / `runningNotify` / `runningFirstAfterMs` / `runningIntervalMs` / `questionNotify` / `questionTitle` / `runningTitle` / `doneTemplate` / `runningTemplate` / `questionTemplate`，全部参数可在高级设置窗口运行时修改
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
- **桌面版启动时提示认证失败 / 打不开？** 这与本插件无关，是桌面版（DSH 壳体）自身的问题：壳每次启动用随机端口（`--port 0`），而 WebUI 的会话 cookie 名是 `dsh-auth-<authority 的哈希>`——**cookie 名里含端口**，浏览器又不按端口隔离 cookie，于是每启动一次就多堆一条（约 226 字节）。攒到约 70 条时请求头超过 Node 默认的 16 KiB 上限，服务器回 `431`，而壳只认 303，于是报成「认证失败」。排查方式：完全退出桌面版后，备份并清理 `%APPDATA%\@deepseek-ai\dsh-desktop\Network\Cookies` 里 `dsh-auth-*` 的记录（属于应用数据，删除前请先备份）。

---

## English

### Features

- 🔔 **Sound alert**: plays `ding.mp3` (configurable to any audio file: mp3/wav/mid/wma/aac) when a conversation completes; falls back to the system "ding-dong" beep if the file is missing
- 🪟 **Native Windows notification**: shows a system toast (including the session title and the DSH whale logo). On first use the plugin registers an AppUserModelID (Start Menu shortcut) so the toast is actually displayed — toasts with an unregistered AUMID are silently dropped by Windows
- 🎚️ **Adjustable volume**: the `volume` option (0.0 ~ 1.0) controls the alert loudness; config changes apply immediately
- 🔔 **Web bell button**: a bell in the conversation header — **click** toggles the sound, **hover** slides a volume bar out on the left of the bell (in-flow width animation; the other items in the row shift left), **right-click** opens the notification settings panel: sound/toast toggles (both off = no notification at all), sound picker and upload; changes save immediately, no config editing
- 🖱️ **Click the notification to jump to the conversation**: clicking the Windows toast/balloon **lands on the finished conversation** (shortcut activation + `dsh-ding://` protocol). With `dsh web` it opens the browser and uses the `?dingOpen=` deep link; with the **DeepSeek Harness desktop app** it **switches the conversation inside the app window** instead (host event-stream push + `dsh://open` to focus), so no browser pops up and the WebUI authentication gate is never hit
- 🔕 **Quiet on current**: silent while the window is focused AND the finishing session is the one you are viewing; still reminds when you switch away, view another session, or no conversation page is open
- ⏱ **Long-task progress reminder**: first toast after 3 minutes, then every 5 minutes (toast only, no sound), with the elapsed time in the text
- ❓ **Question reminder**: alerts immediately when the agent asks you via `ask_user_question` and waits (text differs from completion)
- 🛡️ **Tool approval reminder**: alerts immediately when a tool call waits for your approval (`approval/request`); clicking the notification jumps to that conversation, where you approve or reject in the WebUI
- 🛠 **Advanced settings window**: the "⚙ Advanced settings" entry in the right-click menu opens an in-page settings window with every parameter (notification toggles, titles, timing in ms, volume, custom notification templates). **Templates support placeholders**: `{title}` session title, `{prefix}` conversation prefix, `{elapsed}` elapsed time, `{question}` question text, `{tool}` tool name (approval template)
- 💾 **Export/import config**: at the bottom of the right-click menu you can **export config** (download a JSON file) or **import config** (restore all settings from JSON)
- ▶ **Per-sound preview**: every sound item in the right-click menu has a play button to preview that sound without switching
- 🧪 **Notification test buttons**: the advanced settings page provides 4 test buttons (completion / running / question / approval) that immediately send a real notification of that type; clicking the toast opens a test result page
- 🏷️ **Renamable notification app name**: advanced settings lets you rename the notification app name; leave it empty to follow the WebUI language automatically (zh: DSH叮当通知, en: dsh-ding-notifier)
- 📦 **Bundled ding.mp3**: the alert sound ships with the plugin package, so it no longer depends on the start directory or home directory containing ding.mp3
- 🌐 **Bilingual**: notification text & title and panel copy follow the WebUI language (zh/en)
- 🎯 **Precise timing**: completion is judged by the turn actually ending (phase filter excludes mid-reply pauses); completion text includes the elapsed time
- 🧹 **No false positives**: ignores subagent completion events (they are just intermediate steps of the main conversation)
- ⚡ **Debounced & throttled**: 200ms debounce and 3s global rate limit by default

### Installation

`$DSH_HOME` defaults to `~/.dsh`.

**Method A: npm install (recommended)**

```bash
dsh plugin --profile web add dsh-ding
```

Or install it in your project:

```bash
npm install dsh-ding
```

Then **restart `dsh web`**. Published versions: https://www.npmjs.com/package/dsh-ding

**Method B: install from GitHub (bundle)**

```bash
dsh plugin --profile web add github:CAOGGL/dsh-ding
```

Requires pnpm (`npm install -g pnpm`). The plugin also supports insert-row mounting with live config reload (see Method D).

**Method C: plugin market**

Settings → Plugin Market → search `dsh-ding` → one-click install (listed in awesome-dsh-plugin; the market catalog refreshes daily).

**Method D: manual placement (no pnpm needed)**

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

**Verification**: finish a conversation and you should hear the sound and see the notification. You can also test the notification script standalone:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "$env:USERPROFILE\.dsh\profiles\node_modules\dsh-ding\notify.ps1" -Title "Test" -Text "dsh-ding works"
```

### Configuration

| Option | Default | Description |
| --- | --- | --- |
| `sound` | `true` | Play the alert sound |
| `soundFile` | empty | Path to the sound file (mp3/wav/mid/wma/aac). When empty, the script looks for `ding.mp3` in the server working directory / plugin directory (**bundled ding.mp3**) / user home; falls back to the system beep if not found |
| `volume` | `1.0` | Alert sound volume (0.0 ~ 1.0; `1.0` = original volume, e.g. `0.5` = half volume) |
| `balloon` | `true` | Show the Windows notification |
| `title` | `DSH Done` | Notification title |
| `debounceMs` | `200` | Status debounce in ms |
| `minIntervalMs` | `3000` | Minimum interval between two notifications |
| `notifySubagents` | `false` | Also notify when subagents finish |
| `quietOnViewing` | `true` | Quiet on current: silent while the window is focused AND the finishing session is the one you are viewing; still reminds when you switch away, view another session, or no conversation page is open |
| `runningNotify` | `true` | Long-task progress reminder: Windows toast only, no sound |
| `runningFirstAfterMs` | `180000` | First progress reminder delay in ms (default 3 min) |
| `runningIntervalMs` | `300000` | Progress reminder interval in ms (default 5 min) |
| `runningTitle` | `DSH Running` | Notification title for progress reminders (new in v1.0.0 update) |
| `questionNotify` | `true` | Question reminder: alerts immediately when the agent asks you something via `ask_user_question` and waits (text differs from completion) |
| `questionTitle` | `DSH Question` | Notification title for question reminders |
| `doneTemplate` | empty | Custom completion text (`{title}`/`{prefix}`/`{elapsed}`; empty = default) |
| `runningTemplate` | empty | Custom progress-reminder text (`{title}`/`{prefix}`/`{elapsed}`; empty = default) |
| `questionTemplate` | empty | Custom question text (`{title}`/`{prefix}`/`{question}`; empty = default) |
| `approvalNotify` | `true` | Tool approval reminder: alert when a tool call waits for your approval |
| `approvalTitle` | `DSH Approval` | Notification title for approval reminders |
| `approvalTemplate` | empty | Custom approval text (`{title}`/`{prefix}`/`{tool}`; empty = default) |
| `notifierName` | empty | Notification app display name (shown in Windows notification settings). Leave empty to follow the WebUI language: Chinese "DSH叮当通知", English "dsh-ding-notifier"; enter a name to pin it |

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
        debounceMs: 200
        minIntervalMs: 3000
        quietOnViewing: true
        runningNotify: true
        runningFirstAfterMs: 180000
        runningIntervalMs: 300000
```

### Web bell button (v0.4.0+)

The bell in the conversation header saves every change immediately to `$DSH_HOME/profiles/<name>/data/dsh-ding.json` (only the fields you touched; everything else still follows `cordis.patch.yml`):

| Action | Effect |
| --- | --- |
| Click the bell | Quickly toggle the sound |
| Hover the bell | A volume bar slides out on the **left** of the bell (in-flow width animation; the other items in the row shift left automatically); releasing the slider previews the sound once |
| Right-click the bell | Notification settings panel: **Sound** / **Toast** toggles (both off = no notification when a conversation finishes), **Quiet on current** (skip when the session you are viewing finishes; other sessions and away-window still remind), **While running** (progress toast every 5 min after 3 min, toast only), **While asked** (alert when the agent asks you a question and waits), plus the sound picker (built-in ding / your uploaded files) and upload (mp3/wav/mid/wma/aac/m4a/ogg/flac, stored in `data/sounds/`); the **⚙ Advanced settings** entry at the bottom opens the full parameter editor (notification toggles, titles, timing in ms, volume — saved instantly); the bottom also has **Export config / Import config** (download/restore JSON settings) |

### Uninstall

1. Remove the whole `dsh-ding` block from `cordis.patch.yml`
2. Delete the `$DSH_HOME/profiles/node_modules/dsh-ding/` directory

### Changelog

- **v1.1.2** (2026-10-25): **Loopback check widened to the whole `127.0.0.0/8` block** — `POST /dsh-ding/activate` used to compare against the literal `127.0.0.1`, so a caller on the same machine but whose source address was `127.0.0.2` / `127.13.37.9` was rejected with 403 as "not local" (local proxies, port forwarders and some container tooling hit this); the check now matches the `127.` prefix, covering `127/8` and the IPv4-mapped form `::ffff:127.`, with no security change (that block is unroutable). This release also narrows the v1.1.0 wording and adds the upstream "desktop app fails to start with an authentication error" note to the FAQ
- **v1.1.1** (2026-10-24): **Fixed the see-through settings panel** — the right-click panel and the advanced-settings modal only used `--dsw-specific-menu` (a 94%-opaque token) without the `backdrop-filter` that core DSH menus pair it with, so conversation text behind the panel stayed readable. Both surfaces now apply `backdrop-filter: var(--dsw-menu-backdrop-filter)` and stack the same colour twice (≈99.6% opaque), so nothing bleeds through even where background blur is unavailable
- **v1.1.0** (2026-10-24): **Desktop-aware notification click** — the click handler now detects the host: with `dsh web` it still opens the browser (unchanged); with the **DeepSeek Harness desktop app** it switches to the target conversation inside the app window and focuses it, so no browser pops up — which means the **notification-click path** never hits the WebUI login/auth page (this is unrelated to the separate "desktop app fails to start with an authentication error" issue described in the FAQ, which this plugin does not touch) (new `POST /dsh-ding/activate` and `GET /dsh-ding/events` event stream so the host can push the session id to connected clients; the host is detected as an Electron runtime vs the `dsh web` CLI). **Three fixes alongside**: ① session navigation now calls the core `uiWorkspace.openSession` — the previously used `sessions.open` does not exist, so clicking a notification never actually switched conversations (the `dsh web` `?dingOpen=` deep link was affected too); ② the NotifyIcon balloon fallback now uses the same host detection instead of always opening a browser; ③ `POST /dsh-ding/activate` only accepts loopback requests with `application/json`, so no web page or LAN peer can CSRF-navigate the local UI. **Version note**: `1.0.4` / `1.0.5` / `1.0.6` were published on 2026-09-30 and later unpublished; npm permanently forbids reusing a published version number, so this release jumps from `1.0.3` to `1.1.0`
- **v1.0.3** (2026-10-24): **npm release** — the plugin is now published on the npm registry as `dsh-ding`; content is identical to v1.0.2 and the version aligns with the npm `latest` tag. Install with `npm install dsh-ding` or `dsh plugin add dsh-ding`
- **v1.0.2** (2026-08-21): **Per-sound preview** — every sound item in the right-click menu now has a ▶ play button to preview that sound without switching; `GET /dsh-ding/audio` supports `?file=<id>`. **Export/import config** — new **Export config / Import config** entries at the bottom of the right-click menu (download/restore JSON settings). **Bundled ding.mp3** — the plugin now ships its own `ding.mp3`; `notify.ps1` searches the plugin directory, so it no longer depends on the start directory or home directory containing ding.mp3; **Four notification test buttons** — the advanced settings page gains four test buttons (completion/running/question/approval) that immediately send a real notification of that type; clicking the toast opens a test result page and records the configuration used for the test; **Renamable notification app name** — a new "Notification app name" field in advanced settings; leave it empty to follow the WebUI language automatically (zh default: DSH叮当通知, en default: dsh-ding-notifier), or enter a name to pin it
- **v1.0.1** (2026-08-17): **Tool approval reminder** — when a tool call waits for your approval (`approval/request`), the plugin plays the sound and shows an approval notification (title & text customizable, `{tool}` placeholder supported); clicking the notification jumps to the conversation that requested approval, where you approve or reject in the WebUI. New config keys: `approvalNotify` / `approvalTitle` / `approvalTemplate` (editable in Advanced settings). **Async sound** — the alert sound now plays in parallel with the notification instead of blocking it until the sound file finishes (fixes notification lag with long tail sounds)
- **v1.0.0** (2026-08-15, updated 08-16): **Complete reminder system** — ① **Quiet on current** (default on): silent while the window is focused AND the finishing session is the one you are viewing; still reminds when you switch away, view another session, or no conversation page is open (the browser reports foreground state and the current session via the new `POST /dsh-ding/presence`); ② **Completion text with elapsed time**: the notification now shows "took Xm Ys" (the host tracks when the task started); ③ **Long-task progress reminder** (default on): first toast after 3 minutes, then every 5 minutes — toast only, no sound (respects "no noise before the task finishes"), with the elapsed time in the text; ④ **Click the notification to jump to the conversation**: opens the browser and lands directly on the finished session (shortcut activation + `dsh-ding://` protocol + `?dingOpen=` deep link, new `toast-activate.ps1`); ⑤ **Question reminder** (default on): alerts immediately when the agent asks you via `ask_user_question` and waits; ⑥ **Advanced settings window**: the "⚙ Advanced settings" entry opens an in-page modal window (overlay + centered panel) with every parameter editable at runtime (notification toggles, titles, timing in ms, volume, subagent completion); ⑦ **Custom notification templates**: completion and question text are customizable with `{title}`/`{prefix}`/`{elapsed}`/`{question}` placeholders; ⑧ **Bilingual notifications**: text and title follow the WebUI language (DSH 完成/DSH Done, DSH 提问/DSH Question, DSH 运行中/DSH Running), built-in sound name follows too; ⑨ **Completion detection fix**: completion is judged by the turn actually ending plus phase filtering — fixes mid-reply false notifications and missed completion notifications. **(2026-08-16 update)**: ⑩ **Dedicated progress-reminder title** — the progress toast title changed from "DSH 完成" to "DSH 运行中" and a new `runningTitle` config key plus an advanced-settings "Running title" input were added; ⑪ **Progress-reminder template** — new `runningTemplate` config key plus an advanced-settings "Progress template" editor (`{title}`/`{prefix}`/`{elapsed}`); ⑫ **Localized title inputs** — when a title input still holds its default value, the advanced settings show the localized default (DSH 完成/DSH 运行中/DSH 提问 in Chinese, DSH Done/DSH Running/DSH Question in English) and switch with the WebUI language. New config keys: `quietOnViewing` / `runningNotify` / `runningFirstAfterMs` / `runningIntervalMs` / `questionNotify` / `questionTitle` / `runningTitle` / `doneTemplate` / `runningTemplate` / `questionTemplate`, all editable at runtime in the advanced settings window
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
- **Desktop app fails to start with an authentication error?** Not this plugin — it is the desktop shell: the shell starts the WebUI on a random port (`--port 0`) every launch, while the session cookie is named `dsh-auth-<hash of authority>`, so **the port is baked into the cookie name**; cookies are not port-scoped, so every launch leaves one more behind (~226 bytes each). Around 70 of them the request headers exceed Node's default 16 KiB limit, the server answers `431`, and the shell only accepts 303 — so it reports "authentication failed". To check: fully quit the desktop app, back up and then clean the `dsh-auth-*` rows from `%APPDATA%\@deepseek-ai\dsh-desktop\Network\Cookies` (app data — back it up first).

---

## License

MIT
