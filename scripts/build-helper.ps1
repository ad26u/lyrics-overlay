# Builds helpers/win-media into resources/win-media.exe (needs the .NET 8 SDK).
$ErrorActionPreference = 'Stop'
dotnet publish "$PSScriptRoot/../helpers/win-media/win-media.csproj" -c Release -r win-x64 --self-contained true `
  -p:PublishSingleFile=true -p:IncludeNativeLibrariesForSelfExtract=true -o "$PSScriptRoot/../helpers/win-media/publish"
Copy-Item "$PSScriptRoot/../helpers/win-media/publish/win-media.exe" "$PSScriptRoot/../resources/win-media.exe" -Force
