#!/usr/bin/env bash
# Delivery encode: H.264 CRF 20 (TV-range yuv420p), loudness to -14 LUFS (measured
# gain + limiter, true peak under -1 dBTP), AAC 192k, faststart, plus a
# contact sheet. Usage: bash tools/finish.sh [short-zh short-en long-zh]
set -euo pipefail
cd "$(dirname "$0")/.."
for name in ${@:-short-zh short-en long-zh}; do
  raw="renders/livelings-$name-raw.mp4"
  out="renders/livelings-$name-1080p60.mp4"
  [ -f "$raw" ] || { echo "missing $raw"; continue; }
  # measure, add the gain to -14 LUFS, then a limiter holds the peaks under about -2.5 dBFS
  # (linear loudnorm cannot both raise the level and keep narration peaks down)
  i=$(ffmpeg -hide_banner -i "$raw" -af loudnorm=I=-14:TP=-2:LRA=11:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p' | python3 -c "import json,sys; print(json.load(sys.stdin)['input_i'])")
  gain=$(python3 -c "print(round(-14 - float('$i'), 2))")
  ffmpeg -loglevel error -y -i "$raw" \
    -vf "scale=out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 20 -profile:v high -r 60 -g 120 \
    -af "volume=${gain}dB,alimiter=limit=0.75:attack=2:release=60:level=false" \
    -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$out"
  ffmpeg -loglevel error -y -i "$out" -vf "fps=1/2,scale=384:-2,tile=6x7:padding=4" -frames:v 1 -q:v 3 "renders/livelings-$name-sheet.jpg"
  echo "== $out"
  ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -A14 Summary | grep -E " I:|Peak:" | sed 's/^ */   /'
  ffprobe -v error -show_entries format=duration,size -of compact=p=0 "$out"
done
