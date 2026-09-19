"""Measure presented Godot surface frames, not Android View/UI frames. Requires ADB."""
import argparse
import json
import statistics
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('--seconds', type=float, default=30)
parser.add_argument('--output', required=True)
parser.add_argument('--scenario', required=True)
args = parser.parse_args()
lines = subprocess.check_output(['adb', 'shell', 'dumpsys SurfaceFlinger --list'], text=True).splitlines()
candidates = [line for line in lines if 'SurfaceView[org.decentraland.godotexplorer/' in line and '(BLAST)#' in line]
if not candidates:
    raise SystemExit('No running Godot Explorer SurfaceView found')
layer = candidates[-1].removeprefix('RequestedLayerState{').split(' parentId=')[0].rstrip('}')
command = 'dumpsys SurfaceFlinger --latency "' + layer + '"'
def frames():
    output = subprocess.check_output(['adb', 'shell', command], text=True)
    return {int(row.split()[1]) for row in output.splitlines()[1:] if len(row.split()) == 3 and 0 < int(row.split()[1]) < 9223372036854775807}
initial = frames()
cutoff = max(initial, default=0)
seen = set()
start = time.monotonic()
while time.monotonic() - start < args.seconds:
    seen.update(n for n in frames() if n > cutoff)
    time.sleep(.75)
timestamps = sorted(seen)
if len(timestamps) < 2:
    raise SystemExit('No fresh game frames; ensure Explorer is foregrounded')
intervals = [(b-a)/1e6 for a,b in zip(timestamps, timestamps[1:])]
ordered = sorted(intervals)
report = {'scenario': args.scenario, 'method': 'SurfaceFlinger actual-present timestamps; deduplicated; initial history excluded', 'frames': len(timestamps), 'seconds': (timestamps[-1]-timestamps[0])/1e9, 'fps': 1000/statistics.mean(intervals), 'frame_ms_p50': ordered[int(len(ordered)*.5)], 'frame_ms_p95': ordered[int(len(ordered)*.95)], 'frame_ms_p99': ordered[int(len(ordered)*.99)], 'over_33_4ms': sum(n>33.4 for n in intervals), 'over_50ms': sum(n>50 for n in intervals), 'intervals_ms': intervals}
with open(args.output, 'w') as out:
    json.dump(report, out, indent=2)
print(json.dumps({k:v for k,v in report.items() if k != 'intervals_ms'}, indent=2))
