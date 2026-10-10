<#
  Re-encodes the source film (realestate.mp4) into scrub-friendly web assets and
  extracts high-quality stills used by the site.

  Why: the source has a keyframe only every ~5 s and its moov atom at the END of
  the file. Seeking backwards would decode up to 150 frames per seek. These
  outputs use a keyframe every 6 frames, no B-frames and +faststart, so
  scroll-scrubbing is smooth in both directions.

  The source's final ~2 s (from 34.95 s) cut to a DIFFERENT house, so the tour
  is trimmed at 34.9 s. The final reveal uses a still of the opening exterior.

  Usage:
    powershell -ExecutionPolicy Bypass -File tools\optimize-video.ps1 -Ffmpeg "C:\path\to\ffmpeg.exe"
    (add -SkipVideo to regenerate only the stills)
#>
param(
  [Parameter(Mandatory = $true)][string]$Ffmpeg,
  [string]$Source = '',
  [double]$TourEnd = 34.9,
  [switch]$SkipVideo
)
$ErrorActionPreference = 'Stop'
$here   = Split-Path -Parent $MyInvocation.MyCommand.Path
$root   = Resolve-Path (Join-Path $here '..')
if (-not $Source) { $Source = Join-Path $root 'realestate.mp4' }
$video  = Join-Path $root 'assets\video'
$images = Join-Path $root 'assets\images'
$scenes = Join-Path $images 'scenes'
New-Item -ItemType Directory -Force $video, $images, $scenes | Out-Null

$common = @('-hide_banner', '-loglevel', 'error', '-y')
$x264   = @('-c:v', 'libx264', '-preset', 'slow', '-profile:v', 'high', '-pix_fmt', 'yuv420p',
            '-g', '6', '-keyint_min', '6', '-sc_threshold', '0', '-bf', '0',
            '-movflags', '+faststart', '-an')

if (-not $SkipVideo) {
  Write-Host 'Encoding tour-1080.mp4 ...'
  & $Ffmpeg @common -i $Source -t $TourEnd -vf 'scale=1920:1080:flags=lanczos' @x264 -crf 21 -tune film (Join-Path $video 'tour-1080.mp4')
  Write-Host 'Encoding tour-720.mp4 ...'
  & $Ffmpeg @common -i $Source -t $TourEnd -vf 'scale=1280:720:flags=lanczos' @x264 -crf 23 -tune film (Join-Path $video 'tour-720.mp4')
}

# Stills: time (s) -> name. Times are chosen on steady frames (no dissolves or motion blur).
$stills = [ordered]@{
  '0.0'  = 'arrival'
  '2.2'  = 'garden'
  '4.5'  = 'facade'
  '6.67' = 'frontage'
  '8.5'  = 'entrance'
  '10.4' = 'foyer'
  '13.6' = 'living'
  '15.2' = 'dining'
  '17.2' = 'kitchen'
  '19.6' = 'staircase'
  '22.4' = 'landing'
  '25.6' = 'bedroom'
  '29.0' = 'bathroom'
  '31.6' = 'suite-view'
  '34.2' = 'balcony'
}
# Light sharpening restores crispness lost to the source's compression.
$sharp = 'unsharp=5:5:0.55:5:5:0'
$webp  = @('-c:v', 'libwebp', '-quality', '90', '-compression_level', '6', '-preset', 'photo')
foreach ($t in $stills.Keys) {
  $name = $stills[$t]
  Write-Host "Still $t s -> $name"
  & $Ffmpeg @common -ss $t -i $Source -frames:v 1 -vf "scale=1920:-2:flags=lanczos,$sharp" @webp (Join-Path $scenes "$name.webp")
  & $Ffmpeg @common -ss $t -i $Source -frames:v 1 -vf "scale=1280:-2:flags=lanczos,$sharp" @webp (Join-Path $scenes "$name-md.webp")
  & $Ffmpeg @common -ss $t -i $Source -frames:v 1 -vf "scale=800:-2:flags=lanczos,$sharp"  @webp (Join-Path $scenes "$name-sm.webp")
}
# Poster shown while the film loads (first frame of the tour) — JPEG for universal support.
& $Ffmpeg @common -ss 0 -i $Source -frames:v 1 -vf "scale=1920:-2:flags=lanczos,$sharp" -q:v 3 (Join-Path $images 'poster.jpg')
Write-Host 'Done.'
Get-ChildItem $video, $images, $scenes -File | Select-Object Name, @{n = 'KB'; e = { [int]($_.Length / 1KB) } } | Format-Table -AutoSize
