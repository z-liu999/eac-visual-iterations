"""Build a self-contained GitHub Pages artifact without the Python backend."""
import json
import shutil
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / '_site'

def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir()
    for name in ('index.html', 'mouse-trail.html', 'app.js', 'style.css', 'visible-code.js',
                 'visible-code.css', 'observation-video-original-3min.mp4'):
        shutil.copy2(ROOT / name, OUT / name)
    shutil.copytree(ROOT / 'assets', OUT / 'assets')
    (OUT / '.nojekyll').touch()
    (OUT / 'media-config.js').write_text(
        'window.EAC_MEDIA_CONFIG={"videoUrl":"observation-video-original-3min.mp4","staticMode":true};\n')
    with sqlite3.connect(ROOT / 'data/notes.sqlite3') as connection:
        notes = [json.loads(row[0]) for row in connection.execute(
            'SELECT payload FROM notes WHERE start<=180.02 AND end>=0 ORDER BY start,id')]
    (OUT / 'assets/notes.json').write_text(json.dumps(notes, separators=(',', ':')))
    target = OUT / 'assets/trajectories-data.json'
    value = json.loads(target.read_text())
    value['duration'] = 180.0132
    value['entries'] = [entry for entry in value['entries'] if entry['start'] <= 180.02]
    value['total'] = len(value['entries'])
    value['tracks'] = sum(entry['moving'] for entry in value['entries'])
    value['dots'] = value['total'] - value['tracks']
    value['categoryCounts'] = {str(category): sum(entry['category'] == category for entry in value['entries'])
                               for category in range(1, 5)}
    target.write_text(json.dumps(value, separators=(',', ':')))
    print(f'Built {OUT}: {len(notes)} annotations, {value["total"]} trajectories')

if __name__ == '__main__':
    main()
