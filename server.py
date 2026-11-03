"""EaC local server: python3 server.py --port 8001"""
import argparse
import gzip
import io
import threading
import json
import math
import sqlite3
import uuid
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlsplit, parse_qs, unquote
import re

ROOT = Path(__file__).resolve().parent
MEDIA = 'fixed:observation-video.webm'
DB = ROOT / 'data' / 'notes.sqlite3'
TRAJECTORY_GZIP = None
TRAJECTORY_GZIP_LOCK = threading.Lock()
R2_CLIENT = None
R2_BUCKET = 'eac-video'
R2_KEY = 'observation-video.webm'


def connect():
    connection = sqlite3.connect(DB, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def initialize():
    DB.parent.mkdir(parents=True, exist_ok=True)
    with connect() as connection:
        connection.execute('PRAGMA journal_mode=WAL')
        connection.execute('''CREATE TABLE IF NOT EXISTS notes (
            id TEXT PRIMARY KEY, media TEXT NOT NULL, start REAL NOT NULL,
            end REAL NOT NULL, payload TEXT NOT NULL,
            created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)''')
        connection.execute('CREATE INDEX IF NOT EXISTS notes_media_time ON notes(media, start, end)')


def normalize(data):
    if not isinstance(data, dict):
        raise ValueError('Invalid note')
    text = data.get('text')
    path = data.get('path')
    if not isinstance(text, str) or not text.strip() or len(text) > 240:
        raise ValueError('Text must contain 1–240 characters')
    if not isinstance(path, list) or not 1 <= len(path) <= 50000:
        raise ValueError('Invalid path length')
    clean = []
    previous = -1
    for point in path:
        if not isinstance(point, dict):
            raise ValueError('Invalid point')
        values = [point.get(key) for key in ('x', 'y', 't')]
        if any(type(v) not in (int, float) or not math.isfinite(v) for v in values):
            raise ValueError('Invalid coordinates')
        x, y, t = values
        if not (0 <= x <= 1 and 0 <= y <= 1 and 0 <= t <= 86400 and previous <= t):
            raise ValueError('Invalid path time or coordinates')
        previous = t
        clean.append(dict(x=x, y=y, t=t))
    space = data.get('coordinateSpace', 'stage')
    if space not in ('stage', 'video'):
        raise ValueError('Invalid coordinate space')
    start = clean[0]['t']
    # Match JavaScript UTF-16 character counting.
    length = len(text.strip().encode('utf-16-le')) // 2
    is_static = all(p['x'] == clean[0]['x'] and p['y'] == clean[0]['y'] for p in clean)
    end = start + 10 if is_static else max(clean[-1]['t'], start + 3 + length / 140 * 6)
    return dict(id=str(uuid.UUID(data['id'])) if data.get('id') else str(uuid.uuid4()),
                coordinateSpace=space, text=text.strip(), path=clean,
                start=start, observedStart=start,
                end=end)


class PreviewServer(ThreadingHTTPServer):
    request_queue_size = 64


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        self.remaining = None
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        # Local previews must always load the latest UI.
        path = urlsplit(self.path).path
        if not path.startswith('/api/') and not path.endswith(('.mp4', '.webm')):
            self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()

    def reply(self, status, value):
        body = json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()
        compressed = len(body) > 1024 and 'gzip' in self.headers.get('Accept-Encoding', '')
        if compressed:
            body = gzip.compress(body, compresslevel=4)
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Vary', 'Accept-Encoding')
        if compressed:
            self.send_header('Content-Encoding', 'gzip')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        url = urlsplit(self.path)
        if url.path == '/api/media':
            if R2_CLIENT is None:
                return self.reply(200, {'url': None, 'source': 'configured'})
            # 密钥只在服务器内存中；给浏览器的仅是临时只读播放链接。
            signed = R2_CLIENT.generate_presigned_url('get_object',
                Params={'Bucket': R2_BUCKET, 'Key': R2_KEY}, ExpiresIn=28800)
            return self.reply(200, {'url': signed, 'source': 'r2-private', 'expiresIn': 28800})
        if url.path == '/api/notes':
            query = parse_qs(url.query)
            try:
                start = float(query.get('from', ['0'])[0])
                end = float(query.get('to', ['86400'])[0])
                if not math.isfinite(start) or not math.isfinite(end) or start > end:
                    raise ValueError()
            except ValueError:
                return self.reply(400, {'error': 'Invalid time range'})
            try:
                cursor = int(query['cursor'][0]) if 'cursor' in query else None
                after = float(query['after'][0]) if 'after' in query else None
                if cursor is not None and cursor < 0:
                    raise ValueError()
                if after is not None and not math.isfinite(after):
                    raise ValueError()
            except (ValueError, IndexError):
                return self.reply(400, {'error': 'Invalid synchronization cursor'})
            with connect() as connection:
                latest = connection.execute('SELECT COALESCE(MAX(rowid),0) FROM notes WHERE media=?', (MEDIA,)).fetchone()[0]
                incremental = cursor is not None and after is not None and cursor <= latest and after <= end
                sql = 'SELECT payload FROM notes WHERE media=? AND end>=? AND start<=?'
                parameters = [MEDIA, start, end]
                if incremental:
                    sql += ' AND (rowid>? OR start>?)'
                    parameters.extend((cursor, after))
                rows = connection.execute(sql + ' ORDER BY start,id', parameters).fetchall()
            return self.reply(200, {'notes': [json.loads(row['payload']) for row in rows],
                                    'cursor': latest, 'to': end, 'complete': not incremental})
        return super().do_GET()

    def do_POST(self):
        if urlsplit(self.path).path != '/api/notes':
            return self.reply(404, {'error': 'Not found'})
        try:
            size = int(self.headers.get('Content-Length', '0'))
            if not 0 < size <= 8 * 1024 * 1024:
                return self.reply(413, {'error': 'Invalid request size'})
            note = normalize(json.loads(self.rfile.read(size)))
        except (ValueError, KeyError, TypeError, UnicodeError):
            return self.reply(400, {'error': 'Invalid note data'})
        with connect() as connection:
            # Retried submissions keep the same ID and never create duplicates.
            connection.execute('INSERT OR IGNORE INTO notes(id,media,start,end,payload) VALUES(?,?,?,?,?)',
                               (note['id'], MEDIA, note['start'], note['end'], json.dumps(note)))
            row = connection.execute('SELECT payload FROM notes WHERE id=?', (note['id'],)).fetchone()
        self.reply(200, {'note': json.loads(row['payload'])})

    def send_head(self):
        path = Path(self.translate_path(self.path)).resolve()
        # Serve only public website files; never expose the database or source.
        relative = path.relative_to(ROOT) if path.is_relative_to(ROOT) else None
        if relative is None or not (str(relative) in ('.', 'index.html', 'style.css', 'app.js', 'visible-code.css', 'visible-code.js', 'media-config.js', 'observation-video.webm', 'observation-video-original-3min.mp4')
                                    or (relative.parts[0] == 'assets' and path.is_file())):
            self.send_error(404)
            return None
        if str(relative) == 'assets/trajectories-data.json' and 'gzip' in self.headers.get('Accept-Encoding', ''):
            global TRAJECTORY_GZIP
            stat = path.stat()
            stamp = (stat.st_mtime_ns, stat.st_size)
            with TRAJECTORY_GZIP_LOCK:
                if TRAJECTORY_GZIP is None or TRAJECTORY_GZIP[0] != stamp:
                    TRAJECTORY_GZIP = (stamp, gzip.compress(path.read_bytes(), compresslevel=5))
                payload = TRAJECTORY_GZIP[1]
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Encoding', 'gzip')
            self.send_header('Vary', 'Accept-Encoding')
            self.send_header('Last-Modified', self.date_time_string(stat.st_mtime))
            self.send_header('Content-Length', str(len(payload)))
            self.end_headers()
            return io.BytesIO(payload)
        header = self.headers.get('Range', '')
        if path.is_file() and path.suffix in ('.webm', '.mp4') and header:
            size = path.stat().st_size
            match = re.fullmatch(r'bytes=(\d+)-(\d*)', header)
            if match:
                start = int(match[1])
                end = min(int(match[2]) if match[2] else size - 1, size - 1)
                if start > end:
                    self.send_response(416)
                    self.send_header('Content-Range', f'bytes */{size}')
                    self.end_headers()
                    return None
                stream = path.open('rb')
                stream.seek(start)
                self.remaining = end - start + 1
                self.send_response(206)
                self.send_header('Content-Type', 'video/mp4' if path.suffix == '.mp4' else 'video/webm')
                self.send_header('Content-Length', str(self.remaining))
                self.send_header('Accept-Ranges', 'bytes')
                self.send_header('Content-Range', f'bytes {start}-{end}/{size}')
                self.end_headers()
                return stream
        return super().send_head()

    def copyfile(self, source, outputfile):
        try:
            if self.remaining is None:
                return super().copyfile(source, outputfile)
            while self.remaining > 0:
                chunk = source.read(min(1024 * 1024, self.remaining))
                if not chunk:
                    break
                outputfile.write(chunk)
                self.remaining -= len(chunk)
        except (BrokenPipeError, ConnectionResetError):
            pass

    def log_message(self, *args):
        pass


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8001)
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--db', type=Path, default=DB)
    parser.add_argument('--r2-private', action='store_true')
    args = parser.parse_args()
    if args.r2_private:
        # 当前无登录系统，私有预览签名接口仅允许本机使用。
        if args.host not in ('127.0.0.1', 'localhost', '::1'):
            parser.error('Private R2 preview must bind to localhost until authentication is added.')
        import getpass
        import boto3
        from botocore.config import Config
        access = getpass.getpass('R2 Access Key ID (hidden): ')
        secret = getpass.getpass('R2 Secret Access Key (hidden): ')
        R2_CLIENT = boto3.client('s3',
            endpoint_url='https://580d9f54f6c8424b642705d625b34fca.r2.cloudflarestorage.com',
            aws_access_key_id=access, aws_secret_access_key=secret,
            region_name='auto', config=Config(signature_version='s3v4'))
        remote = R2_CLIENT.head_object(Bucket=R2_BUCKET, Key=R2_KEY)
        if remote['ContentLength'] != 9364078127:
            raise SystemExit('Remote video size mismatch.')
        del access, secret
        print('Private R2 video verified. Credentials remain in server memory only.', flush=True)
    DB = args.db.resolve()
    initialize()
    print(f'EaC: http://{args.host}:{args.port} | Database: {DB}', flush=True)
    PreviewServer((args.host, args.port), Handler).serve_forever()
