<#
  Minimal static file server for local development (no Node/Python required).
  Supports HTTP Range requests, which browsers use for video seeking.

  Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080]
  Then open http://localhost:8080/
#>
param([int]$Port = 8080)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$mime = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'
  '.js' = 'text/javascript; charset=utf-8'; '.mjs' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'; '.mp4' = 'video/mp4'; '.webm' = 'video/webm'
  '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.png' = 'image/png'; '.webp' = 'image/webp'
  '.svg' = 'image/svg+xml'; '.ico' = 'image/x-icon'; '.glb' = 'model/gltf-binary'
  '.gltf' = 'model/gltf+json'; '.bin' = 'application/octet-stream'; '.md' = 'text/plain; charset=utf-8'
  '.woff2' = 'font/woff2'
}

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
try { $listener.Start() } catch { Write-Error "Could not listen on port $Port. Try -Port 8081."; exit 1 }
Write-Host "Serving $root"
Write-Host "Open http://localhost:$Port/   (Ctrl+C to stop)"

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $req = $ctx.Request; $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($req.Url.AbsolutePath.TrimStart('/'))
      if ($rel -eq '') { $rel = 'index.html' }
      $path = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if (-not $path.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -or -not (Test-Path $path -PathType Leaf)) {
        $res.StatusCode = 404
        $b = [Text.Encoding]::UTF8.GetBytes('Not found')
        $res.OutputStream.Write($b, 0, $b.Length)
        Write-Host "404 $rel"
        continue
      }
      $ext = [IO.Path]::GetExtension($path).ToLower()
      $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
      $res.Headers['Accept-Ranges'] = 'bytes'
      $res.Headers['Cache-Control'] = 'no-cache'
      $fs = [IO.File]::OpenRead($path)
      try {
        $len = $fs.Length; $start = 0; $end = $len - 1
        $range = $req.Headers['Range']
        if ($range -and $range -match '^bytes=(\d*)-(\d*)$') {
          if ($matches[1] -ne '') { $start = [int64]$matches[1] }
          if ($matches[2] -ne '') { $end = [Math]::Min([int64]$matches[2], $len - 1) }
          if ($matches[1] -eq '' -and $matches[2] -ne '') { $start = $len - [int64]$matches[2]; $end = $len - 1 }
          if ($start -gt $end -or $start -ge $len) {
            $res.StatusCode = 416; $res.Headers['Content-Range'] = "bytes */$len"; continue
          }
          $res.StatusCode = 206
          $res.Headers['Content-Range'] = "bytes $start-$end/$len"
        }
        $count = $end - $start + 1
        $res.ContentLength64 = $count
        if ($req.HttpMethod -ne 'HEAD') {
          $fs.Position = $start
          $buf = New-Object byte[] 262144
          while ($count -gt 0) {
            $n = $fs.Read($buf, 0, [int][Math]::Min($buf.Length, $count))
            if ($n -le 0) { break }
            $res.OutputStream.Write($buf, 0, $n)
            $count -= $n
          }
        }
      } finally { $fs.Dispose() }
    } catch {
      # Client aborted (common while seeking video) — ignore.
    } finally {
      try { $res.OutputStream.Close() } catch {}
    }
  }
} finally {
  $listener.Stop()
}
