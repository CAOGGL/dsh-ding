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

# 兜底：按 baseUrl 的监听端口查进程名判断宿主类型（旧通知没有第三段时用）
#   桌面版监听进程为 "DeepSeek Harness"，命令行 dsh web 为 "node"
function Get-HostKind {
    param([string]$BaseUrl)
    try {
        $uri = New-Object System.Uri $BaseUrl
        $port = $uri.Port
        if ($port -le 0) { return "" }
        $ownerPid = 0
        foreach ($line in (netstat -ano 2>$null)) {
            if ($line -match ":$port\s+\S+\s+LISTENING\s+(\d+)") { $ownerPid = [int]$matches[1]; break }
        }
        if ($ownerPid -le 0) { return "" }
        $proc = Get-Process -Id $ownerPid -ErrorAction SilentlyContinue
        if (-not $proc) { return "" }
        if ($proc.ProcessName -match 'DeepSeek.*Harness') { return 'desktop' }
        return 'web'
    } catch {
        return ""
    }
}

if ([string]::IsNullOrEmpty($Uri)) { exit 0 }
try {
    $parsed = New-Object System.Uri $Uri
    $sessionB64 = ""
    $baseB64 = ""
    $kindB64 = ""

    # 路径/authority 格式：/open/<u>/<b>[/<k>]
    $segments = @($parsed.AbsolutePath.Split('/') | Where-Object { $_ -ne "" })
    if ($parsed.Host -eq "open" -and $segments.Count -ge 2) {
        # dsh-ding://open/<u>/<b>：System.Uri 把 open 解析为 host，path 只剩 u/b[/k]
        $sessionB64 = $segments[0]
        $baseB64 = $segments[1]
        if ($segments.Count -ge 3) { $kindB64 = $segments[2] }
    } elseif ($segments.Count -ge 3 -and $segments[0] -eq "open") {
        # dsh-ding:///open/<u>/<b>[/<k>]：open 在 path 首位
        $sessionB64 = $segments[1]
        $baseB64 = $segments[2]
        if ($segments.Count -ge 4) { $kindB64 = $segments[3] }
    } else {
        # 兼容查询格式：?u=<u>&b=<b>&k=<k>
        $query = $parsed.Query.TrimStart('?')
        $params = @{}
        foreach ($pair in $query.Split('&')) {
            if ($pair -match '^([^=]+)=(.*)$') {
                $params[$matches[1]] = [Uri]::UnescapeDataString($matches[2])
            }
        }
        if ($params.ContainsKey('u')) { $sessionB64 = $params['u'] }
        if ($params.ContainsKey('b')) { $baseB64 = $params['b'] }
        if ($params.ContainsKey('k')) { $kindB64 = $params['k'] }
    }

    $sessionId = ConvertFrom-Base64Url $sessionB64
    $baseUrl   = ConvertFrom-Base64Url $baseB64
    $hostKind  = ConvertFrom-Base64Url $kindB64

    if ($baseUrl -and $sessionId) {
        # 宿主类型优先用宿主自己上报的（dsh-ding:// 第三段）：
        #   desktop = 桌面版，WebUI 带 launch token 认证，浏览器打开会被 401 拦截 → 应用内直达
        #   web     = 命令行 dsh web，保持原来的浏览器跳转
        # 旧通知（无第三段）时按端口查监听进程名兜底。
        if (-not $hostKind) { $hostKind = Get-HostKind $baseUrl }
        if ($hostKind -eq 'desktop') {
            $activateUrl = $baseUrl.TrimEnd('/') + '/dsh-ding/activate'
            $pushed = $false
            try {
                $payload = @{ session = $sessionId } | ConvertTo-Json -Compress
                Invoke-RestMethod -Uri $activateUrl -Method Post -ContentType 'application/json' -Body $payload -TimeoutSec 5 | Out-Null
                $pushed = $true
            } catch { }
            try {
                Add-Content -LiteralPath $actLog -Value ("[{0}] desktop host: activate pushed={1}; focusing window" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $pushed) -ErrorAction Stop
            } catch { }
            # 唤起并聚焦桌面版主窗口（dsh:// 由桌面版注册；已在运行时单实例机制会聚焦原窗口）
            try { Start-Process 'dsh://open' } catch { }
            exit 0
        }
        # 打开 WebUI 并携带 dingOpen 参数（base64url 只含安全字符，可直接拼进 URL）
        $target = $baseUrl.TrimEnd('/') + '/?dingOpen=' + $sessionB64
        try {
            Add-Content -LiteralPath $actLog -Value ("[{0}] opening [{1}] (kind={2})" -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $target, $hostKind) -ErrorAction Stop
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
