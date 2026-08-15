# notify.ps1 — dsh-ding 的通知脚本：提示音 + Windows 原生通知
# 由 dsh-ding 插件以隐藏窗口方式调用。
# -SoundFile 指定提示音文件（mp3/wav 等）；不指定时自动在常见位置找 ding.mp3。
# -Volume 指定音量 0.0~1.0（默认 1.0 = 原始音量）。
param(
    [string]$Title = "DSH 完成",
    [string]$Text  = "对话已完成",
    [string]$SoundFile = "",
    [double]$Volume = 1.0,
    [switch]$NoSound,
    [switch]$NoToast,
    [switch]$SoundOnly,   # 仅播放提示音（试听用），不弹任何通知
    [string]$SessionId = "",  # 完成/运行中的会话 id：通知点击后跳转到该会话
    [string]$BaseUrl = ""     # WebUI 地址（如 http://127.0.0.1:3080）
)

# 音量钳制到 0.0~1.0
$Volume = [Math]::Max(0.0, [Math]::Min(1.0, $Volume))

# 诊断日志（每次运行记录各环节成败，排查用；TEMP 下，写失败不影响功能）
$logPath = Join-Path $env:TEMP 'dsh-ding-notify.log'
function Write-DingLog {
    param([string]$Message)
    try {
        Add-Content -LiteralPath $logPath -Value ("[{0}] {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message) -ErrorAction Stop
    } catch { }
}
Write-DingLog ("run: title=[{0}] text=[{1}] soundOnly={2} noSound={3} noToast={4} session=[{5}] base=[{6}]" -f $Title, $Text, $SoundOnly.IsPresent, $NoSound.IsPresent, $NoToast.IsPresent, $SessionId, $BaseUrl)

# ---------- 定位提示音文件 ----------
function Resolve-SoundFile {
    param([string]$Specified)
    $candidates = @()
    if ($Specified) { $candidates += $Specified }
    $candidates += (Join-Path (Get-Location) 'ding.mp3')   # 服务器工作目录
    $candidates += (Join-Path $PSScriptRoot '..\ding.mp3') # 插件目录
    $candidates += (Join-Path $HOME 'ding.mp3')            # 用户主目录
    foreach ($c in $candidates) {
        if ($c -and (Test-Path -LiteralPath $c -PathType Leaf)) { return $c }
    }
    return $null
}

$soundPath = Resolve-SoundFile -Specified $SoundFile

# ---------- 1) 提示音 ----------
if (-not $NoSound) {
    $played = $false
    if ($soundPath) {
        try {
            Add-Type -Namespace Dsh -Name Mci -MemberDefinition @'
[System.Runtime.InteropServices.DllImport("winmm.dll", CharSet = System.Runtime.InteropServices.CharSet.Unicode)]
public static extern int mciSendString(string command, System.Text.StringBuilder returnString, int returnLength, System.IntPtr hwndCallback);
'@ -ErrorAction Stop
            $ext = [System.IO.Path]::GetExtension($soundPath).ToLowerInvariant()
            $mciType = switch ($ext) {
                '.wav'   { 'waveaudio' }
                '.mid'   { 'sequencer' }
                '.mp3'   { 'mpegvideo' }
                '.wma'   { 'mpegvideo' }
                '.aac'   { 'mpegvideo' }
                default  { 'mpegvideo' }
            }
            $sb = New-Object System.Text.StringBuilder 256
            $quoted = '"' + $soundPath.Replace('"', '""') + '"'
            [Dsh.Mci]::mciSendString("open $quoted type $mciType alias dshding", $sb, 256, [IntPtr]::Zero) | Out-Null
            if ($Volume -lt 1.0) {
                # MCI 音量范围 0~1000；设置失败（不支持的驱动）时忽略，保持原始音量
                [Dsh.Mci]::mciSendString("setaudio dshding volume to $([int]($Volume * 1000))", $sb, 256, [IntPtr]::Zero) | Out-Null
            }
            [Dsh.Mci]::mciSendString("play dshding wait", $sb, 256, [IntPtr]::Zero) | Out-Null
            [Dsh.Mci]::mciSendString("close dshding", $sb, 256, [IntPtr]::Zero) | Out-Null
            $played = $true
            Write-DingLog "sound: MCI played $soundPath (vol=$Volume)"
        } catch {
            Write-DingLog ("sound: MCI failed: " + $_.Exception.Message)
            try { [Dsh.Mci]::mciSendString("close dshding", $null, 0, [IntPtr]::Zero) | Out-Null } catch { }
        }
    }
    if (-not $played) {
        # 兜底：双音“叮咚” + 系统提示音
        try {
            [System.Media.SystemSounds]::Asterisk.Play()
            [Console]::Beep(880, 180)
            Start-Sleep -Milliseconds 60
            [Console]::Beep(1174, 260)
            Write-DingLog "sound: fallback beep played"
        } catch { }
    }
}

# ---------- 1.5) 试听模式：只出声，立即退出 ----------
if ($SoundOnly) { exit 0 }

# ---------- 2) Windows 通知 ----------
if (-not $NoToast) {
    $shown = $false
    $AUMID = 'DshDing.Notifier'
    $lnkPath = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\dsh-ding-notifier.lnk'

    # 2a) 确保 AUMID 已注册：未注册的 appId 会被 Windows 静默丢弃（toast 调用了也不显示）。
    #     注册方式：开始菜单快捷方式 + System.AppUserModel.ID 属性。
    #     快捷方式 Target 必须是 toast-activate.ps1：非打包 AUMID 的 toast 点击时，
    #     Windows 会把 launch 参数作为命令行参数追加给快捷方式 Target
    #     （协议激活只对打包应用生效，所以不能只靠 2a2 的协议注册）。
    $activateScript = Join-Path $PSScriptRoot 'toast-activate.ps1'
    $lnkExists = Test-Path $lnkPath
    try {
        $icoPath = Join-Path $PSScriptRoot '..\ds.ico'
        $ws = New-Object -ComObject WScript.Shell
        $sc = $ws.CreateShortcut($lnkPath)
        $sc.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"
        $expectedArgs = '-NoProfile -WindowStyle Hidden -File "' + $activateScript + '"'
        $needAumid = -not $lnkExists
        if ($sc.Arguments -ne $expectedArgs) {
            $sc.Arguments = $expectedArgs
            $needAumid = $true  # Arguments 被改过，AUMID 属性可能也随之丢失，重写保险
        }
        $sc.WorkingDirectory = $env:WINDIR
        if (Test-Path $icoPath) { $sc.IconLocation = "$icoPath, 0" }
        $sc.Save()
        if ($needAumid) {
            Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class DshDingAumid {
    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    public struct PROPERTYKEY { public Guid fmtid; public uint pid; }
    [StructLayout(LayoutKind.Sequential)]
    public struct PROPVARIANT {
        public ushort vt;
        public ushort wReserved1, wReserved2, wReserved3;
        public IntPtr pValue;
        public IntPtr pValue2;
    }
    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    public interface IPropertyStore {
        void GetCount(out uint cProps);
        void GetAt(uint iProp, out PROPERTYKEY pkey);
        void GetValue(ref PROPERTYKEY key, out PROPVARIANT pv);
        void SetValue(ref PROPERTYKEY key, ref PROPVARIANT pv);
        void Commit();
    }
    const ushort VT_LPWSTR = 31;
    const int GPS_READWRITE = 0x2;
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHGetPropertyStoreFromParsingName(string pszPath, IntPtr pbc, int flags, ref Guid riid, out IntPtr ppv);
    public static void Set(string lnkPath, string aumid) {
        Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
        IntPtr ppv;
        int hr = SHGetPropertyStoreFromParsingName(lnkPath, IntPtr.Zero, GPS_READWRITE, ref iid, out ppv);
        if (hr != 0) throw new COMException("property store open failed 0x" + hr.ToString("X8"));
        IPropertyStore ps = (IPropertyStore)Marshal.GetObjectForIUnknown(ppv);
        PROPERTYKEY key = new PROPERTYKEY { fmtid = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), pid = 5 };
        PROPVARIANT pv = new PROPVARIANT();
        pv.vt = VT_LPWSTR;
        pv.pValue = Marshal.StringToCoTaskMemUni(aumid);
        try {
            ps.SetValue(ref key, ref pv);
            ps.Commit();
        } finally {
            Marshal.FreeCoTaskMem(pv.pValue);
            Marshal.Release(ppv);
        }
    }
}
'@ -ErrorAction Stop
            [DshDingAumid]::Set($lnkPath, $AUMID)
        }
    } catch { }

    # 2a2) 注册 dsh-ding:// 协议（HKCU，无需管理员）：手动打开 dsh-ding:// 链接时的入口，
    #      同样路由到 toast-activate.ps1（toast 点击本身不走协议，走 2a 的快捷方式传参）。
    if (Test-Path -LiteralPath $activateScript) {
        try {
            $protoKey = 'HKCU:\Software\Classes\dsh-ding'
            if (-not (Test-Path $protoKey)) { New-Item -Path $protoKey -Force | Out-Null }
            $cmdKey = "$protoKey\shell\open\command"
            if (-not (Test-Path $cmdKey)) { New-Item -Path $cmdKey -Force | Out-Null }
            $cmd = '"' + $env:WINDIR + '\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -WindowStyle Hidden -File "' + $activateScript + '" "%1"'
            Set-ItemProperty -Path $cmdKey -Name '(Default)' -Value $cmd
        } catch { }
    }

    # 通知点击跳转目标：BaseUrl + dingOpen=<base64url(sessionId)>
    # （浏览器端插件解析该参数后 sessions.open() 直达会话）
    $jumpB64 = ''
    $jumpUrl = ''
    if ($SessionId -and $BaseUrl) {
        try {
            $jumpB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($SessionId)).TrimEnd('=').Replace('+', '-').Replace('/', '_')
            $jumpUrl = $BaseUrl.TrimEnd('/') + '/?dingOpen=' + $jumpB64
        } catch { }
    }

    # 2b) 首选：WinRT 原生 Toast（使用已注册的 AUMID；注册失败则退回无 AUMID）。
    #     launch 属性 = dsh-ding://open/<u>/<b>（u/b 为 base64url，路径形式无 & ? 空格等
    #     命令行特殊字符；点击 toast 时 Windows 把它作为参数传给快捷方式 Target）。
    #     XML 里也要保证没有非法字符（& 等），否则 LoadXml 失败 → toast 静默不显示。
    try {
        $escapedTitle = $Title.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
        $escapedText  = $Text.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        if ($jumpUrl) {
            $baseB64 = [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($BaseUrl.TrimEnd('/'))).TrimEnd('=').Replace('+', '-').Replace('/', '_')
            $launch = 'dsh-ding://open/' + $jumpB64 + '/' + $baseB64
            $launchXml = $launch.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
            $xml.LoadXml("<toast launch='$launchXml'><visual><binding template='ToastGeneric'><text>$escapedTitle</text><text>$escapedText</text></binding></visual></toast>")
        } else {
            $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$escapedTitle</text><text>$escapedText</text></binding></visual></toast>")
        }
        $toast = New-Object Windows.UI.Notifications.ToastNotification -ArgumentList $xml
        $appId = if (Test-Path $lnkPath) { $AUMID } else { 'dsh-ding' }
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
        $shown = $true
        Write-DingLog "toast: shown via $appId"
        Start-Sleep -Seconds 3
    } catch {
        Write-DingLog ("toast: FAILED: " + $_.Exception.Message)
    }

    # 2c) 兜底：经典气泡通知（NotifyIcon，通知区域 + 操作中心）。
    #     点击气泡跳转到对应会话（BalloonTipClicked 事件）。
    if (-not $shown) {
        try {
            Add-Type -AssemblyName System.Windows.Forms
            Add-Type -AssemblyName System.Drawing
            $notify = New-Object System.Windows.Forms.NotifyIcon
            $notify.Icon = [System.Drawing.SystemIcons]::Information
            $notify.Visible = $true
            $notify.BalloonTipTitle = $Title
            $notify.BalloonTipText = $Text
            $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
            if ($jumpUrl) {
                # 点击跳转注册放独立 try：注册失败不能连累气泡本身显示
                try {
                    $script:dingJumpUrl = $jumpUrl
                    $notify.add_BalloonTipClicked([System.Windows.Forms.EventHandler]{
                        param($sender, $eventArgs)
                        if ($script:dingJumpUrl) { Start-Process $script:dingJumpUrl }
                    })
                } catch { }
            }
            $notify.ShowBalloonTip(6000)
            $end = [DateTime]::UtcNow.AddSeconds(12)
            while ([DateTime]::UtcNow -lt $end) {
                [System.Windows.Forms.Application]::DoEvents()
                Start-Sleep -Milliseconds 200
            }
            $notify.Visible = $false
            $notify.Dispose()
            $shown = $true
            Write-DingLog "balloon: shown via NotifyIcon"
        } catch {
            Write-DingLog ("balloon: FAILED: " + $_.Exception.Message)
        }
    }

    if (-not $shown) {
        Write-DingLog "notify: NOTHING shown (all paths failed)"
        Start-Sleep -Seconds 1
    } else {
        Write-DingLog "notify: done"
    }
}
