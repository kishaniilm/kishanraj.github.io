param (
    [int]$Port = 5500
)

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:${Port}/")
$listener.Prefixes.Add("http://127.0.0.1:${Port}/")

try {
    $listener.Start()
    Write-Host "Local server listening at http://localhost:${Port}/"
} catch {
    Write-Error "Failed to start listener on port ${Port}"
    exit 1
}

$root = (Get-Location).Path

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".htm"  = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".svg"  = "image/svg+xml"
    ".pdf"  = "application/pdf"
    ".mp4"  = "video/mp4"
    ".ico"  = "image/x-icon"
}

try {
    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $path = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($path)) {
            $path = "index.html"
        }
        $path = [System.Uri]::UnescapeDataString($path)
        $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($root, $path))

        # Check directory traversal
        if (-not $fullPath.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase)) {
            $res.StatusCode = 403
            $res.Close()
            continue
        }

        if ([System.IO.File]::Exists($fullPath)) {
            $ext = [System.IO.Path]::GetExtension($fullPath).ToLower()
            $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $res.ContentType = $mime
            $res.AddHeader("Access-Control-Allow-Origin", "*")

            if ($ext -in @(".html", ".htm", ".css", ".js")) {
                $res.AddHeader("Cache-Control", "no-cache, no-store, must-revalidate")
                $res.AddHeader("Pragma", "no-cache")
                $res.AddHeader("Expires", "0")
            } else {
                $res.AddHeader("Cache-Control", "public, max-age=86400")
            }

            $bytes = [System.IO.File]::ReadAllBytes($fullPath)
            $res.ContentLength64 = $bytes.Length
            $res.StatusCode = 200
            $res.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $res.StatusCode = 404
            $err = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $res.ContentLength64 = $err.Length
            $res.OutputStream.Write($err, 0, $err.Length)
        }
        $res.Close()
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
