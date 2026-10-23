"""Music stems for the two edits, cut only on bar lines where the bars match.

    python3 tools/stems.py

Reads public/music/scene-chamber-40.mp3 and its beat map (tools/beats.py),
writes public/music/<edit>.wav and edits/<edit>-beats.json, whose beats are in
the stem's own time. Bars of this track start on beats 0, 4, 8, ... and bars
3-6 repeat as 7-10 (chroma similarity 0.999), so:

  short: from bar 8 (the theme coming back) to the end, about 42 s
  long:  bars 0-6, then 3-6 once more, then 3 to the end, about 75 s
"""
import json
import subprocess
from pathlib import Path

root = Path(__file__).resolve().parents[1]
track = root / 'public/music/scene-chamber-40.mp3'
beatmap = root / 'edits/chamber-40-beats.json'
if not beatmap.exists():
    subprocess.run(['python3', str(root / 'tools/beats.py'), str(track), str(beatmap)], check=True)
B = json.loads(beatmap.read_text())
beats = B['beats']
dur = B['duration']
bar = lambda k: beats[4 * k] if 4 * k < len(beats) else dur

EDITS = {
    'short': [(8, None)],
    'long': [(0, 7), (3, 7), (3, None)],
}
XF = 0.03  # crossfade at each join, long enough to hide a click, short enough to keep the downbeat

for name, segs in EDITS.items():
    parts, out_beats, t = [], [], 0.0
    for i, (a, b) in enumerate(segs):
        s = bar(a)
        e = bar(b) if b is not None else dur
        parts.append((s, e))
        for x in beats:
            if s - 1e-6 <= x < e - 1e-6:
                out_beats.append(round(t + x - s, 4))
        t += e - s
    # ffmpeg: trim each part, then chain short crossfades
    inputs, chain = [], ''
    for i, (s, e) in enumerate(parts):
        inputs += ['-ss', f'{s:.4f}', '-t', f'{e - s + (XF if i < len(parts) - 1 else 0):.4f}', '-i', str(track)]
    label = '[0:a]'
    for i in range(1, len(parts)):
        chain += f'{label}[{i}:a]acrossfade=d={XF}:c1=tri:c2=tri[x{i}];'
        label = f'[x{i}]'
    out = root / f'public/music/{name}.wav'
    cmd = ['ffmpeg', '-loglevel', 'error', '-y', *inputs]
    if len(parts) > 1:
        cmd += ['-filter_complex', chain.rstrip(';'), '-map', label]
    cmd += ['-ar', '48000', '-ac', '2', str(out)]
    subprocess.run(cmd, check=True)
    length = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(out)], capture_output=True, text=True).stdout)
    (root / f'edits/{name}-beats.json').write_text(json.dumps({'source': f'public/music/{name}.wav', 'bpm': B['bpm'], 'period': B['period'], 'duration': round(length, 3), 'barBeat': 0, 'beats': out_beats}, indent=0))
    print(f'{name}: {length:.2f} s, {len(out_beats)} beats, {len(out_beats) // 4} bars')
