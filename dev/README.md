Dev harness for lyric styles (no Electron needed):

    npx esbuild dev/harness.ts --bundle --format=esm --outfile=dev/out/harness.js
    sed 's#./main.ts#./harness.js#' src/renderer/lyrics/index.html | sed '/Content-Security-Policy/d' > dev/out/harness.html
    cd dev/out && python -m http.server 8765
    # open http://127.0.0.1:8765/harness.html?style=stars&lang=ar&t=7200
