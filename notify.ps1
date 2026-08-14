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
    [switch]$NoToast
)

# 音量钳制到 0.0~1.0
$Volume = [Math]::Max(0.0, [Math]::Min(1.0, $Volume))

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
        } catch {
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
        } catch { }
    }
}

# ---------- 2) Windows 通知 ----------
if (-not $NoToast) {
    $shown = $false

    # 2a) 首选：WinRT 原生 Toast（Windows 10/11 通知中心）
    try {
        $escapedTitle = $Title.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
        $escapedText  = $Text.Replace('&', '&amp;').Replace('<', '&lt;').Replace('>', '&gt;').Replace('"', '&quot;')
        [Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
        [Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
        $xml = New-Object Windows.Data.Xml.Dom.XmlDocument
        $xml.LoadXml("<toast><visual><binding template='ToastGeneric'><text>$escapedTitle</text><text>$escapedText</text></binding></visual></toast>")
        $toast = New-Object Windows.UI.Notifications.ToastNotification -ArgumentList $xml
        [Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier('dsh-ding').Show($toast)
        $shown = $true
        Start-Sleep -Seconds 3
    } catch { }

    # 2b) 兜底：经典气泡通知（NotifyIcon，通知区域 + 操作中心）
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
            $notify.ShowBalloonTip(6000)
            $end = [DateTime]::UtcNow.AddSeconds(12)
            while ([DateTime]::UtcNow -lt $end) {
                [System.Windows.Forms.Application]::DoEvents()
                Start-Sleep -Milliseconds 200
            }
            $notify.Visible = $false
            $notify.Dispose()
            $shown = $true
        } catch { }
    }

    if (-not $shown) { Start-Sleep -Seconds 1 }
}
