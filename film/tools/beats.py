"""Beat map of the soundtrack: a fitted grid, each beat snapped to the nearest
strong onset within 70 ms (the track is generated and breathes a little).

    python3 tools/beats.py public/music/scene-funk-90.mp3 beats.json

Bars start on beats 1, 5, 9, ... (bar k = beat 1 + 4k), checked against the
break at bar 30, where the band stops.
"""
import json, subprocess, sys
import numpy as np

src, out = sys.argv[1], sys.argv[2]
sr = 22050
raw = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', src, '-ac', '1', '-ar', str(sr), '-f', 's16le', '-'], capture_output=True, check=True).stdout
y = np.frombuffer(raw, dtype=np.int16).astype(np.float32) / 32768
hop, n = 64, 1024
frames = 1 + (len(y) - n) // hop
win = np.hanning(n).astype(np.float32)
idx = np.arange(n)[None, :] + hop * np.arange(frames)[:, None]
mag = np.log1p(np.abs(np.fft.rfft(y[idx] * win, axis=1)) * 10)
fl = np.concatenate([[0], np.maximum(0, np.diff(mag, axis=0)).sum(axis=1)])
fl = (fl - fl.mean()) / fl.std()
fps = sr / hop
dur = len(y) / sr
w = int(0.012 * fps)
pool = np.array([fl[max(0, i - w):i + w + 1].max() for i in range(len(fl))])
best = (-1e9, 0.0, 0.0)
for p in np.arange(0.530, 0.540, 0.00002):
    for o in np.arange(0, p, 0.004):
        ii = np.round(np.arange(o, dur - 0.1, p) * fps).astype(int)
        s = pool[ii].mean()
        if s > best[0]:
            best = (s, p, o)
_, period, offset = best
grid = np.arange(offset, dur - 0.05, period)
snapped = []
for t in grid:
    a, b = int((t - 0.07) * fps), int((t + 0.07) * fps)
    a = max(a, 0)
    seg = fl[a:b]
    if len(seg) and seg.max() > 1.0:
        snapped.append((a + int(np.argmax(seg))) / fps)
    else:
        snapped.append(float(t))
# keep it monotonic and smooth: a snapped beat may not move more than 70 ms from the grid
beats = [round(float(s), 4) for s in snapped]
json.dump({'source': src, 'bpm': round(60 / period, 3), 'period': round(float(period), 5), 'duration': round(dur, 3),
           'barBeat': 1, 'beats': beats}, open(out, 'w'), indent=0)
print(f'{60 / period:.2f} bpm, {len(beats)} beats, bar 0 at {beats[1]:.3f}s, bar 30 at {beats[121]:.3f}s, bar 37 at {beats[149]:.3f}s')
