param()

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$projectRoot = Split-Path -Parent $PSScriptRoot
$outputDir = Join-Path $projectRoot "public\icons"
New-Item -ItemType Directory -Force -Path $outputDir | Out-Null

function New-RoundedRectanglePath([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $diameter = $radius * 2
  $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
  $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
  $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function Write-LedgerIcon([int]$size, [string]$path) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#245746"))

  $scale = $size / 512.0
  $cardPath = New-RoundedRectanglePath (118 * $scale) (105 * $scale) (276 * $scale) (302 * $scale) (46 * $scale)
  $cardBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#FCFCF8"))
  $graphics.FillPath($cardBrush, $cardPath)

  $topBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#DCE9DF"))
  $topPath = New-RoundedRectanglePath (148 * $scale) (142 * $scale) (216 * $scale) (68 * $scale) (22 * $scale)
  $graphics.FillPath($topBrush, $topPath)

  $linePen = New-Object System.Drawing.Pen([System.Drawing.ColorTranslator]::FromHtml("#245746"), (18 * $scale))
  $linePen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $linePen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $graphics.DrawLine($linePen, (160 * $scale), (258 * $scale), (352 * $scale), (258 * $scale))
  $graphics.DrawLine($linePen, (160 * $scale), (313 * $scale), (302 * $scale), (313 * $scale))

  $accentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#C55447"))
  $graphics.FillEllipse($accentBrush, (319 * $scale), (292 * $scale), (42 * $scale), (42 * $scale))

  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $accentBrush.Dispose()
  $linePen.Dispose()
  $topBrush.Dispose()
  $topPath.Dispose()
  $cardBrush.Dispose()
  $cardPath.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

Write-LedgerIcon 192 (Join-Path $outputDir "icon-192.png")
Write-LedgerIcon 512 (Join-Path $outputDir "icon-512.png")
Write-LedgerIcon 180 (Join-Path $outputDir "apple-touch-icon.png")
