# EaC — Visual Iterations 01–19

All 19 visual experiments, including binary video, box models, editable annotations, trajectories, time-depth video slices, and the Space-key transition.

## Video

All versions share the included first 3 minutes of video (original-quality 1080p H.264 without re-encoding, approximately 79 MB), playing on a loop. The full-length original is excluded. Existing annotation data is preserved; annotations outside the excerpt remain stored but cannot play within this excerpt.

## Run

Python 3.9 or later is required. No additional packages are required for local video playback.

```sh
python3 run.py
```

Open http://127.0.0.1:8009 and use the top-left selector to switch versions. The included SQLite database supplies existing annotations. New annotations are saved locally, and the trajectory snapshot updates in the background. Stop with Ctrl+C.

## Hosting

GitHub Pages publishes all 19 versions with the short video and existing annotations. New annotations are stored only in the visitor’s browser and also appear in that browser’s trajectory views. They are not shared with other visitors.

The included Python backend remains available for local use with shared annotations. The Pages workflow builds a static artifact with `python3 tools/build_pages.py`; the database and backend files are excluded from that artifact.

## Attribution

A study project based on [Exhausting a Crowd](https://www.exhaustingacrowd.com/london), not its official website. Original project, video, fonts and third-party assets belong to their respective creators; this repository does not grant a license to those assets.
