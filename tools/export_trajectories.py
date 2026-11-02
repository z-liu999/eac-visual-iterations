"""Publish a text-free coordinate snapshot for the standalone trajectory view."""
from pathlib import Path
import argparse
import datetime
import fcntl
import hashlib
import json
import sqlite3
import time
from classify_note_text import classify, CATEGORIES, VERSION

ROOT = Path(__file__).resolve().parents[1]

def export(connection):
    entries = []
    moving_count = 0
    counts = {key: 0 for key in CATEGORIES}
    audit = []
    override_path = ROOT/'data/text-category-overrides.json'
    overrides = json.loads(override_path.read_text()) if override_path.exists() else {}
    for note_id, payload in connection.execute('SELECT id,payload FROM notes WHERE media=? ORDER BY start,id', ('fixed:observation-video.webm',)):
        note = json.loads(payload)
        path = note.get('path', [])
        if not path:
            continue
        first = path[0]
        moving = any(p['x'] != first['x'] or p['y'] != first['y'] for p in path)
        moving_count += int(moving)
        points = [[round(p['x'], 5), round(p['y'], 5), round(p['t'], 4)] for p in path]
        classification = dict(classify(note.get('text', '')))
        override = overrides.get(note_id)
        if override in (1, 2, 3, 4):
            classification.update(category=override, confidence=1, reason='Manual correction', needsReview=False, method='manual')
        if classification['needsReview']:
            classification['originalCategory'] = classification['category']
            digest = hashlib.sha256(('category-random-v1:' + note_id).encode()).digest()
            classification.update(category=int.from_bytes(digest[:8], 'big') % 4 + 1,
                                  method='stable-random', reason='Uncertain text; randomly assigned at user request')
        counts[classification['category']] += 1
        audit.append({'id': note_id, 'text': note.get('text', ''), **classification})
        entries.append({'id': note_id, 'start': note['start'], 'end': note['end'], 'moving': moving, 'path': points, 'text': note.get('text', ''), 'category': classification['category']})
    result = {'version': 2, 'updatedAt': datetime.datetime.now(datetime.timezone.utc).isoformat(),
              'entries': entries, 'duration': 180.0132, 'total': len(entries),
              'tracks': moving_count, 'dots': len(entries)-moving_count, 'categories': CATEGORIES, 'categoryCounts': counts}
    report = {'method': VERSION, 'counts': counts, 'needsReview': sum(n['needsReview'] for n in audit), 'notes': audit}
    audit_target = ROOT/'data/text-categories.json'
    audit_tmp = audit_target.with_suffix('.json.tmp')
    audit_tmp.write_text(json.dumps(report, ensure_ascii=False))
    audit_tmp.replace(audit_target)
    target = ROOT/'assets/trajectories-data.json'
    temporary = target.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(result, separators=(',', ':')))
    temporary.replace(target)
    print(json.dumps({'total': result['total'], 'tracks': result['tracks'], 'dots': result['dots']}), flush=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--watch', action='store_true')
    args = parser.parse_args()
    lock = (ROOT/'data/trajectories-export.lock').open('a')
    try:
        fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        return
    connection = sqlite3.connect('file:'+str(ROOT/'data/notes.sqlite3')+'?mode=ro', uri=True, timeout=10)
    previous = None
    while True:
        override = ROOT/'data/text-category-overrides.json'
        version = (connection.execute('PRAGMA data_version').fetchone()[0], override.stat().st_mtime_ns if override.exists() else 0)
        if version != previous:
            export(connection)
            previous = version
        if not args.watch:
            break
        time.sleep(5)

if __name__ == '__main__':
    main()
