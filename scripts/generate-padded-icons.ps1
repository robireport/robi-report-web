Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$srcPath = Join-Path $root 'assets/Squared logo.png'

function New-PaddedIcon {
    param(
        [int]$CanvasSize,
        [double]$LogoScale,
        [string]$OutputPath
    )

    $source = [System.Drawing.Image]::FromFile($srcPath)
    try {
        $logoSize = [int][Math]::Round($CanvasSize * $LogoScale)
        $offset = [int][Math]::Floor(($CanvasSize - $logoSize) / 2)

        $canvas = New-Object System.Drawing.Bitmap $CanvasSize, $CanvasSize
        $graphics = [System.Drawing.Graphics]::FromImage($canvas)
        try {
            $graphics.Clear([System.Drawing.Color]::Transparent)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
            $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
            $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
            $dest = New-Object System.Drawing.Rectangle $offset, $offset, $logoSize, $logoSize
            $graphics.DrawImage($source, $dest)
        } finally {
            $graphics.Dispose()
        }

        $canvas.Save($OutputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $canvas.Dispose()
    } finally {
        $source.Dispose()
    }
}

New-PaddedIcon -CanvasSize 180 -LogoScale 0.68 -OutputPath (Join-Path $root 'assets/squared-logo-icon-180.png')
New-PaddedIcon -CanvasSize 32 -LogoScale 0.68 -OutputPath (Join-Path $root 'assets/squared-logo-icon-32.png')
New-PaddedIcon -CanvasSize 512 -LogoScale 0.68 -OutputPath (Join-Path $root 'assets/squared-logo-icon-512.png')

Write-Host 'Generated padded icon assets in assets/'
