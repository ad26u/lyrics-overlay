#!/bin/sh
# Downloads the bundled lyric fonts (SIL Open Font License) into src/renderer/lyrics/fonts.
set -e
dir="$(dirname "$0")/../src/renderer/lyrics/fonts"
mkdir -p "$dir"
base=https://raw.githubusercontent.com/google/fonts/main/ofl
get() { [ -f "$dir/$1" ] || curl -fsSL "$2" -o "$dir/$1"; echo "$1 $(wc -c < "$dir/$1") bytes"; }
get Kalam-Regular.ttf "$base/kalam/Kalam-Regular.ttf"
get Kalam-OFL.txt     "$base/kalam/OFL.txt"
get Marhey.ttf        "$base/marhey/Marhey%5Bwght%5D.ttf"
get Marhey-OFL.txt    "$base/marhey/OFL.txt"
