# toast-activate.ps1 — dsh-ding 通知点击激活处理器
# 点击 Windows 通知（toast/气泡）时被调用，打开 WebUI 直达对应会话。
# 两种输入格式（都支持）：
#   1. dsh-ding://open/<u>/<b>     —— toast 点击走快捷方式传参（主路径，u/b 为 base64url）
#   2. dsh-ding://open?u=<u>&b=<b> —— 手动打开协议链接（兼容旧格式）
# u = base64url(sessionId)，b = base64url(baseUrl)
# 打开 WebUI 的 ?dingOpen=<u> URL，由浏览器端插件解析并直达会话。
# 注意：本脚本必须保持 UTF-8 with BOM 编码（PowerShell 5.1 中文环境下无 BOM 会乱码）。

param([string]$Uri)

# 诊断日志（排查点击跳转用；TEMP 下，写失败不影响功能）
$actLog = Join-Path $env:TEMP 'dsh-ding-activate.log'
try {
    Add-Content -LiteralPath $actLog -Value ("[{0}] activate called, Uri=[{1}]" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Uri) -ErrorAction Stop
} catch { }

# base64url -> UTF-8 字符串
function ConvertFrom-Base64Url {
    param([string]$Value)
    if ([string]::IsNullOrEmpty($Value)) { return "" }
    try {
        $b64 = $Value.Replace('-', '+').Replace('_', '/')
        $pad = (4 - ($b64.Length % 4)) % 4
        if ($pad -gt 0) { $b64 = $b64 + ('=' * $pad) }
        $bytes = [Convert]::FromBase64String($b64)
        return [Text.Encoding]::UTF8.GetString($bytes)
    } catch {
        return ""
    }
}

if ([string]::IsNullOrEmpty($Uri)) { exit 0 }

try {
    $parsed = New-Object System.Uri $Uri
    $sessionB64 = ""
    $baseB64 = ""

    # 路径格式：/open/<u>/<b>
    $segments = @($parsed.AbsolutePath.Split('/') | Where-Object { $_ -ne "" })
    if ($segments.Count -ge 3 -and $segments[0] -eq "open") {
        $sessionB64 = $segments[1]
        $baseB64 = $segments[2]
    } else {
        # 兼容查询格式：?u=<u>&b=<b>
        $query = $parsed.Query.TrimStart('?')
        $params = @{}
        foreach ($pair in $query.Split('&')) {
            if ($pair -match '^([^=]+)=(.*)$') {
                $params[$matches[1]] = [Uri]::UnescapeDataString($matches[2])
            }
        }
        if ($params.ContainsKey('u')) { $sessionB64 = $params['u'] }
        if ($params.ContainsKey('b')) { $baseB64 = $params['b'] }
    }

    $sessionId = ConvertFrom-Base64Url $sessionB64
    $baseUrl   = ConvertFrom-Base64Url $baseB64

    if ($baseUrl -and $sessionId) {
        # 打开 WebUI 并携带 dingOpen 参数（base64url 只含安全字符，可直接拼进 URL）
        $target = $baseUrl.TrimEnd('/') + '/?dingOpen=' + $sessionB64
        try {
            Add-Content -LiteralPath $actLog -Value ("[{0}] opening [{1}]" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $target) -ErrorAction Stop
        } catch { }
        Start-Process $target
    } else {
        try {
            Add-Content -LiteralPath $actLog -Value ("[{0}] parse failed: session=[{1}] base=[{2}]" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $sessionId, $baseUrl) -ErrorAction Stop
        } catch { }
    }
} catch {
    try {
        Add-Content -LiteralPath $actLog -Value ("[{0}] activate ERROR: {1}" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $_.Exception.Message) -ErrorAction Stop
    } catch { }
    # 激活失败时静默退出，不影响用户
}

exit 0
