$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$taskRepository = Split-Path -Parent $PSScriptRoot
$taskIconDirectory = Join-Path $taskRepository 'icons'
[System.IO.Directory]::CreateDirectory($taskIconDirectory) | Out-Null

function New-RoundedPath([single]$x, [single]$y, [single]$width, [single]$height, [single]$radius) {
    $taskPath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $taskDiameter = $radius * 2
    $taskPath.AddArc($x, $y, $taskDiameter, $taskDiameter, 180, 90)
    $taskPath.AddArc($x + $width - $taskDiameter, $y, $taskDiameter, $taskDiameter, 270, 90)
    $taskPath.AddArc($x + $width - $taskDiameter, $y + $height - $taskDiameter, $taskDiameter, $taskDiameter, 0, 90)
    $taskPath.AddArc($x, $y + $height - $taskDiameter, $taskDiameter, $taskDiameter, 90, 90)
    $taskPath.CloseFigure()
    return ,$taskPath
}

function New-DashboardBitmap([int]$size, [bool]$maskable = $false) {
    $taskCanvas = [System.Drawing.Bitmap]::new(512, 512, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $taskGraphics = [System.Drawing.Graphics]::FromImage($taskCanvas)
    $taskGraphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $taskGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $taskGraphics.Clear([System.Drawing.Color]::Transparent)
    $taskGradient = [System.Drawing.Drawing2D.LinearGradientBrush]::new([System.Drawing.Point]::new(0, 0), [System.Drawing.Point]::new(512, 512), [System.Drawing.ColorTranslator]::FromHtml('#1b3030'), [System.Drawing.ColorTranslator]::FromHtml('#0b1114'))
    $taskBackground = New-RoundedPath 0 0 512 512 112
    if ($maskable) { $taskGraphics.FillRectangle($taskGradient, 0, 0, 512, 512) }
    else { $taskGraphics.FillPath($taskGradient, $taskBackground) }
    $taskMint = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#bcf5ce'))
    $taskMutedMint = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#74b995'))
    $taskInk = [System.Drawing.SolidBrush]::new([System.Drawing.ColorTranslator]::FromHtml('#142421'))
    $taskTopTile = New-RoundedPath 112 128 112 112 24
    $taskBottomTile = New-RoundedPath 112 264 112 120 24
    $taskMediaTile = New-RoundedPath 248 128 152 256 28
    $taskGraphics.FillPath($taskMint, $taskTopTile)
    $taskGraphics.FillPath($taskMutedMint, $taskBottomTile)
    $taskGraphics.FillPath($taskMint, $taskMediaTile)
    $taskGraphics.FillPolygon($taskInk, [System.Drawing.Point[]]@([System.Drawing.Point]::new(296, 200), [System.Drawing.Point]::new(296, 312), [System.Drawing.Point]::new(360, 256)))
    $taskResult = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $taskResize = [System.Drawing.Graphics]::FromImage($taskResult)
    $taskResize.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $taskResize.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $taskResize.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $taskResize.DrawImage($taskCanvas, [System.Drawing.Rectangle]::new(0, 0, $size, $size), 0, 0, 512, 512, [System.Drawing.GraphicsUnit]::Pixel)
    $taskResize.Dispose()
    $taskGraphics.Dispose()
    $taskCanvas.Dispose()
    foreach ($taskResource in @($taskGradient, $taskBackground, $taskMint, $taskMutedMint, $taskInk, $taskTopTile, $taskBottomTile, $taskMediaTile)) { $taskResource.Dispose() }
    return ,$taskResult
}

foreach ($taskSize in @(32, 192, 512)) {
    $taskBitmap = New-DashboardBitmap $taskSize
    $taskBitmap.Save((Join-Path $taskIconDirectory "dashboard-$taskSize.png"), [System.Drawing.Imaging.ImageFormat]::Png)
    $taskBitmap.Dispose()
}
$taskBitmap = New-DashboardBitmap 180
$taskBitmap.Save((Join-Path $taskRepository 'apple-touch-icon.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$taskBitmap.Dispose()
$taskBitmap = New-DashboardBitmap 512 $true
$taskBitmap.Save((Join-Path $taskIconDirectory 'dashboard-maskable-512.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$taskBitmap.Dispose()

# Classic uncompressed 32-bit ICO entries remain readable by older browsers.
$taskEntries = @()
foreach ($taskSize in @(16, 32, 48)) {
    $taskBitmap = New-DashboardBitmap $taskSize
    $taskStream = [System.IO.MemoryStream]::new()
    $taskWriter = [System.IO.BinaryWriter]::new($taskStream)
    $taskMaskStride = [int]([Math]::Ceiling($taskSize / 32) * 4)
    $taskWriter.Write([uint32]40)
    $taskWriter.Write([int32]$taskSize)
    $taskWriter.Write([int32]($taskSize * 2))
    $taskWriter.Write([uint16]1)
    $taskWriter.Write([uint16]32)
    $taskWriter.Write([uint32]0)
    $taskWriter.Write([uint32]($taskSize * $taskSize * 4 + $taskMaskStride * $taskSize))
    foreach ($taskUnused in 1..4) { $taskWriter.Write([uint32]0) }
    for ($taskY = $taskSize - 1; $taskY -ge 0; $taskY--) {
        for ($taskX = 0; $taskX -lt $taskSize; $taskX++) {
            $taskPixel = $taskBitmap.GetPixel($taskX, $taskY)
            $taskWriter.Write([byte[]]@($taskPixel.B, $taskPixel.G, $taskPixel.R, $taskPixel.A))
        }
    }
    for ($taskY = $taskSize - 1; $taskY -ge 0; $taskY--) {
        $taskMask = [byte[]]::new($taskMaskStride)
        for ($taskX = 0; $taskX -lt $taskSize; $taskX++) {
            if ($taskBitmap.GetPixel($taskX, $taskY).A -eq 0) {
                $taskMask[[int][Math]::Floor($taskX / 8)] = $taskMask[[int][Math]::Floor($taskX / 8)] -bor (1 -shl (7 - ($taskX % 8)))
            }
        }
        $taskWriter.Write($taskMask)
    }
    $taskWriter.Flush()
    $taskEntries += @{ Size = $taskSize; Bytes = $taskStream.ToArray() }
    $taskWriter.Dispose()
    $taskStream.Dispose()
    $taskBitmap.Dispose()
}
$taskIcoStream = [System.IO.File]::Create((Join-Path $taskRepository 'favicon.ico'))
$taskIcoWriter = [System.IO.BinaryWriter]::new($taskIcoStream)
$taskIcoWriter.Write([uint16]0)
$taskIcoWriter.Write([uint16]1)
$taskIcoWriter.Write([uint16]$taskEntries.Count)
$taskOffset = 6 + 16 * $taskEntries.Count
foreach ($taskEntry in $taskEntries) {
    $taskIcoWriter.Write([byte[]]@($taskEntry.Size, $taskEntry.Size, 0, 0))
    $taskIcoWriter.Write([uint16]1)
    $taskIcoWriter.Write([uint16]32)
    $taskIcoWriter.Write([uint32]$taskEntry.Bytes.Length)
    $taskIcoWriter.Write([uint32]$taskOffset)
    $taskOffset += $taskEntry.Bytes.Length
}
foreach ($taskEntry in $taskEntries) { $taskIcoWriter.Write([byte[]]$taskEntry.Bytes) }
$taskIcoWriter.Dispose()
$taskIcoStream.Dispose()
Write-Output 'Generated Dashboard PNG and ICO icons.'
