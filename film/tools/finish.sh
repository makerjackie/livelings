#!/usr/bin/env bash
# Delivery encode: H.264 CRF 20 (TV-range yuv420p), loudness to -14 LUFS with
# true peak <= -1.5 dBTP (two-pass loudnorm), AAC 192k, faststart. Also a poster
# frame and a contact sheet. Usage: bash tools/finish.sh [zh|en ...]
set -euo pipefail
cd "$(dirname "$0")/.."
for lang in "${@:-zh en}"; do
  for l in $lang; do
    raw="renders/livelings-launch-$l-raw.mp4"
    out="renders/livelings-launch-$l-1080p60.mp4"
    [ -f "$raw" ] || { echo "missing $raw"; continue; }
    m=$(ffmpeg -hide_banner -i "$raw" -af loudnorm=I=-14:TP=-1.5:LRA=9:print_format=json -f null - 2>&1 | sed -n '/^{/,/^}/p')
    get() { echo "$m" | python3 -c "import json,sys; print(json.load(sys.stdin)['$1'])"; }
    ffmpeg -loglevel error -y -i "$raw" \
      -vf "scale=out_range=tv,format=yuv420p" -c:v libx264 -preset slow -crf 20 -profile:v high -r 60 -g 120 \
      -af "loudnorm=I=-14:TP=-1.5:LRA=9:measured_I=$(get input_i):measured_TP=$(get input_tp):measured_LRA=$(get input_lra):measured_thresh=$(get input_thresh):offset=$(get target_offset):linear=true" \
      -ar 48000 -c:a aac -b:a 192k -movflags +faststart "$out"
    ffmpeg -loglevel error -y -ss 81.5 -i "$out" -frames:v 1 -q:v 2 "renders/livelings-launch-$l-poster.jpg"
    ffmpeg -loglevel error -y -i "$out" -vf "fps=1/3,scale=384:-2,tile=6x5:padding=4" -frames:v 1 -q:v 3 "renders/livelings-launch-$l-sheet.jpg"
    echo "== $out"
    ffmpeg -hide_banner -nostats -i "$out" -af ebur128=peak=true -f null - 2>&1 | grep -A12 Summary | grep -E "I:|Peak:" | sed 's/^ */   /'
    ffprobe -v error -show_entries stream=codec_name,width,height,r_frame_rate,pix_fmt -show_entries format=duration,size -of compact=p=0 "$out"
  done
done
