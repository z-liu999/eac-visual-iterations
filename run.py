"""Start the website and keep trajectory data synchronized."""
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if __name__ == '__main__':
    processes = []
    try:
        subprocess.run([sys.executable, str(ROOT/'tools/export_trajectories.py')], cwd=ROOT, check=True)
        processes.append(subprocess.Popen([sys.executable, str(ROOT/'tools/export_trajectories.py'), '--watch'], cwd=ROOT))
        processes.append(subprocess.Popen([sys.executable, str(ROOT/'server.py'), '--port', '8009'], cwd=ROOT))
        print('Open http://127.0.0.1:8009', flush=True)
        processes[-1].wait()
    except KeyboardInterrupt:
        pass
    finally:
        for process in processes:
            if process.poll() is None:
                process.terminate()
        for process in processes:
            process.wait()
