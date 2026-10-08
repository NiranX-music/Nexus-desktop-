import subprocess
import os

ps_script = """
Add-Type -AssemblyName System.Windows.Forms,System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bmp = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$gfx = [System.Drawing.Graphics]::FromImage($bmp)
$gfx.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bmp.Save('test_screen.png', [System.Drawing.Imaging.ImageFormat]::Png)
$bmp.Dispose()
$gfx.Dispose()
Write-Host "SUCCESS: $($bounds.Width)x$($bounds.Height)"
"""

res = subprocess.run(["powershell", "-NoProfile", "-Command", ps_script], capture_output=True, text=True)
print("STDOUT:", res.stdout.strip())
print("STDERR:", res.stderr.strip())
print("File exists:", os.path.exists("test_screen.png"))
if os.path.exists("test_screen.png"):
    print("File size:", os.path.getsize("test_screen.png"))
    os.remove("test_screen.png")
