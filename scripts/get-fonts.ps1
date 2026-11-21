# Downloads the bundled lyric fonts (SIL Open Font License) into src/renderer/lyrics/fonts.
$ErrorActionPreference = 'Stop'
$dir = Join-Path $PSScriptRoot '../src/renderer/lyrics/fonts'
New-Item -ItemType Directory -Force $dir | Out-Null
$base = 'https://raw.githubusercontent.com/google/fonts/main/ofl'
$files = @{
  'Kalam-Regular.ttf' = "$base/kalam/Kalam-Regular.ttf"
  'Kalam-OFL.txt'     = "$base/kalam/OFL.txt"
  'Marhey.ttf'        = "$base/marhey/Marhey%5Bwght%5D.ttf"
  'Marhey-OFL.txt'    = "$base/marhey/OFL.txt"
}
foreach ($name in $files.Keys) {
  $out = Join-Path $dir $name
  if (-not (Test-Path $out)) { Invoke-WebRequest -UseBasicParsing $files[$name] -OutFile $out }
  '{0}  {1:N0} bytes' -f $name, (Get-Item $out).Length
}
