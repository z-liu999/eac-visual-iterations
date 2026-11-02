# EaC — Visual Iterations 01–19

All 19 visual experiments, including binary video, box models, editable annotations, trajectories, time-depth video slices, and the Space-key transition.

## Video

All versions share the included first 3 minutes of video (1080p H.264, approximately 28.4 MB), playing on a loop. The full-length original is excluded. Existing annotation data is preserved; annotations outside the excerpt remain stored but cannot play within this excerpt.

## Run

Python 3.9 or later is required. No additional packages are required for local video playback.

```sh
python3 run.py
```

Open http://127.0.0.1:8009 and use the top-left selector to switch versions. The included SQLite database supplies existing annotations. New annotations are saved locally, and the trajectory snapshot updates in the background. Stop with Ctrl+C.

## Hosting

This repository includes a Python backend. Uploading to GitHub stores the complete source and assets; GitHub Pages alone cannot run the shared annotation backend. To retain every feature online, deploy this folder on a Python-capable server.

## Attribution

A study project based on [Exhausting a Crowd](https://www.exhaustingacrowd.com/london), not its official website. Original project, video, fonts and third-party assets belong to their respective creators; this repository does not grant a license to those assets.
