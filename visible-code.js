// Explanatory snippets from the existing annotation gesture, not execution tracing.
(() => {
    'use strict';
    const floating = document.getElementById('code-float');
    const metrics = document.getElementById('code-metrics');
    const code = document.querySelector('#code-log code');
    const rounded = (n, digits = 1) => Number(n.toFixed(digits));
    // Tokenize our small generated snippets; DOM text nodes keep source text literal.
    function highlight(source, target = code) {
        const fragment = document.createDocumentFragment();
        const tokens = /\/\/[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b\d+(?:\.\d+)?\b|\b[A-Za-z_$][\w$]*\b|[^\w\s]/g;
        let end = 0;
        for (const match of source.matchAll(tokens)) {
            fragment.append(document.createTextNode(source.slice(end, match.index)));
            const token = match[0], span = document.createElement('span');
            let kind = 'punctuation';
            if (token.startsWith('//')) kind = 'comment';
            else if (/^["']/.test(token)) kind = 'string';
            else if (/^\d/.test(token)) kind = 'number';
            else if (/^[A-Za-z_$]/.test(token)) {
                const next = source.slice(match.index + token.length).trimStart();
                kind = /^(const|let|var|return|if|else|new|function|true|false|null)$/.test(token)
                    ? 'keyword' : next.startsWith('(') ? 'function' : 'variable';
            }
            span.className = 'syntax-' + kind;
            span.textContent = token;
            fragment.append(span);
            end = match.index + token.length;
        }
        fragment.append(document.createTextNode(source.slice(end)));
        target.replaceChildren(fragment);
    }
    function hide() { floating.hidden = true; }
    function show(event, point, bounds, dragging) {
        const x = rounded(bounds.x + point.x * bounds.w);
        const y = rounded(bounds.y + point.y * bounds.h);
        metrics.textContent = `${event.type} · ${event.pointerType} #${event.pointerId} · x ${x} y ${y}`;
        const sample = `{ x: ${rounded(point.x, 4)}, y: ${rounded(point.y, 4)}, t: ${rounded(point.t, 2)} }`;
        const source = dragging
            ? `path.push(${sample});\npoint.x = ${x}; point.y = ${y};\ntrail.points.appendItem(point);`
            : `path = [${sample}];\n// 按住拖动，记录轨迹`;
        highlight(source);
        floating.hidden = false;
        const rect = floating.getBoundingClientRect();
        const gap = event.pointerType === 'touch' ? 28 : 18;
        let left = event.clientX + gap, top = event.clientY + gap;
        if (left + rect.width > innerWidth - 10) left = event.clientX - rect.width - gap;
        if (event.pointerType === 'touch' || top + rect.height > innerHeight - 10) top = event.clientY - rect.height - gap;
        floating.style.left = Math.max(10, Math.min(left, innerWidth - rect.width - 10)) + 'px';
        floating.style.top = Math.max(10, Math.min(top, innerHeight - rect.height - 10)) + 'px';
    }
    window.EACVisibleCode = { show, hide, renderEditor, setSubmitState, showZoom, showDeparture, beginRewind, rewindApplied, renderNote(target, note, transform, t, end, motion) {
        if (motion) target.noteMotion = motion;
        motion = motion || target.noteMotion;
        const previous = departures.get(note.id);
        if (previous) { clearTimeout(previous.timer); previous.node.remove(); departures.delete(note.id); }
        let movement = '';
        if (motion) {
            if (motion.mode === 'interpolate') {
                movement = `const a = path[${motion.index - 1}], b = path[${motion.index}];\nconst f = Math.max(0, Math.min(1,\n  (t - a.t) / (b.t - a.t || 1))); // ${rounded(motion.fraction, 3)}\nconst x = a.x + (b.x - a.x) * f; // ${rounded(motion.x, 4)}\nconst y = a.y + (b.y - a.y) * f; // ${rounded(motion.y, 4)}\n`;
            } else {
                movement = motion.mode === 'static' ? 'const p = path[0]; // static\n' : 'const p = path.at(-1); // endpoint\n';
            }
            const follow = motion.follow;
            if (follow) movement += `const amount = 1 - Math.pow(0.9,\n  elapsed / (1000 / 60)); // ${rounded(follow.amount, 3)}\nstate.x += (dx - direction.x * 40) * amount;\nstate.y += (dy - direction.y * 40) * amount;\n`;
        }
        const source = `${note.source?.originalId ? '// Source: exhaustingacrowd.com/london · #' + note.source.originalId + '\n' : ''}// t: ${rounded(t, 1)} · start: ${rounded(note.start, 1)} · end: ${rounded(end, 1)}\nconst visible = t >= start && t < end; // true\nnote.textContent = ${JSON.stringify(note.text)};\n${movement}`;
        if (!target.inlineParameters) {
            const sourceNode = document.createElement('span');
            const row = document.createElement('span');
            row.className = 'inline-parameters';
            const inputs = {};
            function parameter(name) {
                const input = document.createElement('input');
                input.type = 'number';
                input.step = name === 'opacity' ? '0.05' : '1';
                if (name === 'opacity') { input.min = '0'; input.max = '1'; }
                input.className = 'inline-parameter';
                input.dataset.parameter = name;
                input.setAttribute('aria-label', name === 'opacity' ? 'Annotation opacity' : `Annotation ${name} position in pixels`);
                input.title = `Edit ${name} directly`;
                input.addEventListener('input', () => {
                    if (Number.isFinite(input.valueAsNumber)) window.EACNoteControls?.update(note.id, name, input.valueAsNumber);
                });
                input.addEventListener('focus', () => {
                    input.originalValue = input.value;
                    window.EACNoteControls?.beginEdit(note);
                });
                input.addEventListener('blur', () => {
                    setTimeout(() => window.EACNoteControls?.finishEdit(note.id), 0);
                });
                input.addEventListener('keydown', event => {
                    event.stopPropagation();
                    if (event.key === 'Enter') { event.preventDefault(); input.blur(); }
                    if (event.key === 'Escape') {
                        event.preventDefault();
                        input.value = input.originalValue;
                        window.EACNoteControls?.update(note.id, name, Number(input.originalValue));
                        input.blur();
                    }
                });
                inputs[name] = input;
                row.append(input);
            }
            row.append(document.createTextNode('note.style.transform = "translate('));
            parameter('x');
            row.append(document.createTextNode('px, '));
            parameter('y');
            row.append(document.createTextNode('px)";\nnote.style.opacity = "'));
            parameter('opacity');
            row.append(document.createTextNode('";'));
            target.replaceChildren(sourceNode, row);
            target.inlineParameters = { sourceNode, inputs };
        }
        const refreshCode = !note.source?.originalId || !target.lastSourceUpdate
            || performance.now() - target.lastSourceUpdate >= 200;
        if (target.dataset.source !== source && refreshCode) {
            highlight(source, target.inlineParameters.sourceNode);
            target.dataset.source = source;
            target.lastSourceUpdate = performance.now();
        }
        const coordinates = /translate\(([-\d.]+)px,\s*([-\d.]+)px\)/.exec(transform);
        const values = { x: Number(coordinates?.[1] || 0), y: Number(coordinates?.[2] || 0), opacity: Number(target.style.opacity || 1) };
        for (const [name, input] of Object.entries(target.inlineParameters.inputs)) {
            if (document.activeElement !== input) input.value = String(Math.round(values[name] * 100) / 100);
            input.style.width = Math.max(3, input.value.length + 1) + 'ch';
        }

    } };
    const departures = new Map();
    let zoomTimer;
    function showZoom(point, camera, transform) {
        const panel = document.getElementById('action-code');
        const source = `// zoomAt(${rounded(point.x, 3)}, ${rounded(point.y, 3)})\nconst scale = ${camera.scale};\nvideo.style.transform =\n  ${JSON.stringify(transform)};`;
        highlight(source, panel.firstElementChild);
        panel.hidden = false;
        const rect = panel.getBoundingClientRect();
        panel.style.left = Math.max(8, Math.min(point.x * innerWidth + 18, innerWidth / 2 - rect.width - 8)) + 'px';
        panel.style.top = Math.max(8, Math.min(point.y * innerHeight + 18, innerHeight - rect.height - 8)) + 'px';
        clearTimeout(zoomTimer);
        zoomTimer = setTimeout(() => { panel.hidden = true; }, 1800);
    }
    function showDeparture(label, note, t, end) {
        const prior = departures.get(note.id);
        if (prior) { clearTimeout(prior.timer); prior.node.remove(); departures.delete(note.id); }
        if (departures.size >= 8) {
            const [id, old] = departures.entries().next().value;
            clearTimeout(old.timer); old.node.remove(); departures.delete(id);
        }
        const rect = label.getBoundingClientRect();
        const node = document.createElement('pre');
        node.className = 'note-code code-departure';
        node.dataset.noteId = note.id;
        highlight(`// ${JSON.stringify(note.text)}\n// t: ${rounded(t, 1)} · start: ${rounded(note.start, 1)} · end: ${rounded(end, 1)}\nconst visible = t >= start && t < end; // false\nnote.remove();`, node);
        document.body.append(node);
        node.style.left = Math.max(4, Math.min(rect.left, innerWidth - node.offsetWidth - 4)) + 'px';
        node.style.top = Math.max(4, Math.min(rect.top, innerHeight - node.offsetHeight - 4)) + 'px';
        const timer = setTimeout(() => { node.remove(); departures.delete(note.id); }, 1200);
        departures.set(note.id, { node, timer });
    }
    const editorCode = document.querySelector('#editor-code code');
    const input = document.getElementById('text');
    const submit = document.getElementById('submit-note');
    let editorDraft = null, lastEditorSource = '', submitState = 'ready', resultTimer;
    function renderEditor(draft = editorDraft) {
        if (!draft) return;
        if (editorDraft !== draft) submitState = 'ready';
        editorDraft = draft;
        const source = `const text = ${JSON.stringify(input.value)};\nconst start = ${rounded(draft.start, 2)};\nconst path = draft.path; // ${draft.path.length} points\n\nconst note = { text, start, path };\neditor.hidden = false;\nsubmit.disabled = ${submit.disabled};\n\n// TAKE NOTE · ${submitState}\neditor.onsubmit = async (event) => {\n  event.preventDefault();\n  const result = await apiRequest("POST", note);\n  notes.push(result.note);\n  persist();\n};`;
        if (source !== lastEditorSource) {
            highlight(source, editorCode);
            lastEditorSource = source;
        }
    }
    function setSubmitState(state, draft) {
        if (draft !== editorDraft) return;
        submitState = state;
        renderEditor();
        const area = editorCode.parentElement;
        area.scrollTop = area.scrollHeight;
        if (state === 'saved') {
            const result = document.querySelector('#submit-result-code');
            highlight('// TAKE NOTE · saved\nnotes.push(result.note);\npersist();', result.firstElementChild);
            result.hidden = false;
            clearTimeout(resultTimer);
            resultTimer = setTimeout(() => { result.hidden = true; }, 3000);
        }
    }
    input.addEventListener('input', () => renderEditor());
    new MutationObserver(() => renderEditor()).observe(submit, { attributes: true, attributeFilter: ['disabled'] });
    const clockElement = document.getElementById('clock');
    const clockCode = document.querySelector('#clock-code code');
    let lastClockSource = '';
    function alignClockCode() {
        const rect = clockElement.getBoundingClientRect();
        clockCode.parentElement.style.right = Math.max(0, innerWidth - rect.right) + 'px';
        clockCode.parentElement.style.bottom = Math.max(0, innerHeight - rect.top + 6) + 'px';
    }
    function renderClock() {
        const source = `const seconds = 15 * 3600 + ${rounded(video.currentTime, 2)};\nconst time = new Date(seconds * 1000);\nclock.textContent = time.toISOString().slice(11, 16);\n// ${clockElement.textContent}`;
        if (source !== lastClockSource) {
            highlight(source, clockCode);
            lastClockSource = source;
        }
    }
    new MutationObserver(renderClock).observe(clockElement, { childList: true, characterData: true, subtree: true });
    new ResizeObserver(alignClockCode).observe(clockElement);
    window.addEventListener('resize', alignClockCode);
    alignClockCode();
    const video = document.getElementById('video');
    const videoCode = document.querySelector('#video-code code');
    const rewindPanel = document.getElementById('rewind-code');
    let rewind = null, rewindTimer;
    function positionRewind() {
        const rect = document.getElementById('rewind').getBoundingClientRect();
        rewindPanel.style.left = Math.max(10, rect.left) + 'px';
        rewindPanel.style.bottom = Math.max(10, innerHeight - rect.top + 12) + 'px';
        rewindPanel.style.maxWidth = Math.max(40, innerWidth - Math.max(10, rect.left) - 10) + 'px';
    }
    function renderRewind(state, complete = false) {
        if (!rewind) return;
        const source = `// rewind · ${state}\nconst before = ${rounded(rewind.before, 3)};\nconst target = Math.max(0, before - 10); // ${rounded(rewind.target, 3)}\nvideo.currentTime = target;\n${complete ? '// seeked · actual: ' + rounded(video.currentTime, 3) + ' s\nvideo.play();' : '// waiting for video.seeked'}`;
        highlight(source, rewindPanel.firstElementChild);
        rewindPanel.hidden = false;
        positionRewind();
    }
    function finishRewind(state, complete) {
        if (!rewind) return;
        renderRewind(state, complete);
        rewind = null;
        clearTimeout(rewindTimer);
        rewindTimer = setTimeout(() => { rewindPanel.hidden = true; }, 2400);
    }
    function beginRewind(before) {
        clearTimeout(rewindTimer);
        rewind = { before, target: Math.max(0, before - 10) };
        if (!Number.isFinite(video.duration)) {
            highlight('// rewind · video not ready\n// waiting for metadata', rewindPanel.firstElementChild);
            rewindPanel.hidden = false; positionRewind(); rewind = null;
            rewindTimer = setTimeout(() => { rewindPanel.hidden = true; }, 2400);
            return;
        }
        renderRewind('click → seeking');
        rewindTimer = setTimeout(() => finishRewind('seek still pending', false), 10000);
    }
    function rewindApplied() {
        if (rewind && !video.seeking && Math.abs(video.currentTime - rewind.target) < 0.1)
            finishRewind('already at target', true);
    }
    video.addEventListener('seeking', () => {
        if (!rewind) return;
        if (Math.abs(video.currentTime - rewind.target) > 0.1) finishRewind('interrupted by another seek', false);
        else renderRewind('seeking');
    });
    video.addEventListener('seeked', () => {
        if (!rewind) return;
        if (Math.abs(video.currentTime - rewind.target) > 0.1) finishRewind('interrupted by another seek', false);
        else finishRewind('seeked', true);
    });
    video.addEventListener('error', () => finishRewind('video error', false));
    window.addEventListener('resize', positionRewind);
    const cityHeader = document.getElementById('location-header');
    function alignVideoCode() {
        const rect = cityHeader.getBoundingClientRect();
        const panel = videoCode.parentElement;
        panel.style.left = rect.left + 'px';
        panel.style.top = (rect.bottom + 6) + 'px';
        panel.style.width = rect.width + 'px';
    }
    new ResizeObserver(alignVideoCode).observe(cityHeader);
    window.addEventListener('resize', alignVideoCode);
    alignVideoCode();
    let lastVideoSource = '', videoEvent = 'load';
    function renderVideo() {
        renderClock();
        // Read current media state; displaying code never drives the media player.
        const status = video.error ? 'error' : video.seeking ? 'seeking'
            : video.ended ? 'ended' : video.readyState < 2 ? 'loading'
            : video.paused ? 'paused' : video.readyState < 3 ? 'buffering' : 'playing';
        const duration = Number.isFinite(video.duration) ? rounded(video.duration, 2) : null;
        const source = `// video · ${status} · ${videoEvent}\nconst playback = {\n  currentTime: ${rounded(video.currentTime, 2)},\n  duration: ${duration},\n  paused: ${video.paused},\n  playbackRate: ${video.playbackRate},\n  loop: ${video.loop}\n};`;
        if (source !== lastVideoSource) {
            highlight(source, videoCode);
            lastVideoSource = source;
        }
    }
    for (const type of ['loadedmetadata', 'loadeddata', 'play', 'playing', 'pause', 'seeking', 'seeked', 'ratechange', 'waiting', 'ended', 'error', 'emptied']) {
        video.addEventListener(type, () => { videoEvent = type; renderVideo(); });
    }
    setInterval(() => { if (!document.hidden) renderVideo(); }, 100);
    document.addEventListener('visibilitychange', renderVideo);
    renderVideo();
    window.addEventListener('resize', hide);
    window.addEventListener('blur', hide);
})();

// Render decoded video frames as characters; the original player still owns time and gestures.
(() => {
    'use strict';
    const video = document.getElementById('video');
    const stage = document.getElementById('stage');
    const canvas = document.getElementById('ascii-video');
    const context = canvas.getContext('2d', { alpha: true });
    const sample = document.createElement('canvas');
    const pixels = sample.getContext('2d', { willReadFrequently: true });
    const toggle = document.getElementById('ascii-toggle');
    const mask = document.createElement('canvas');
    const maskContext = mask.getContext('2d');
    const revealPatch = document.createElement('canvas');
    const revealContext = revealPatch.getContext('2d');
    const snapshotTrails = new Map();
    let lastTrailTime = -1;
    const ramp = '01';
    let mode = 'local', enabled = true, dirty = true, lastTime = -1, lastDraw = -Infinity;
    let frameRate = 15;
    let width = 1, height = 1, columns = 1, rows = 1, scale = 1, frame = 0;
    function mirrorCamera() { canvas.style.transform = video.style.transform; }
    new MutationObserver(mirrorCamera).observe(video, { attributes: true, attributeFilter: ['style'] });
    function resize() {
        const rect = stage.getBoundingClientRect();
        width = rect.width; height = rect.height;
        if (!width || !height) return;
        scale = Math.min(2, window.devicePixelRatio || 1);
        canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale);
        mask.width = canvas.width; mask.height = canvas.height;
        snapshotTrails.clear();
        columns = Math.max(1, Math.min(220, Math.floor(width / 6)));
        const fontSize = (width / columns) / 0.602;
        rows = Math.max(1, Math.floor(height / (fontSize * 1.1)));
        sample.width = columns; sample.height = rows;
        canvas.dataset.columns = columns; canvas.dataset.rows = rows;
        dirty = true;
        // Changing backing dimensions clears the frame; refill immediately when possible.
        render();
    }
    function setMode(value) {
        mode = value;
        enabled = mode !== 'original';
        document.body.classList.toggle('box-model', mode === 'box');
        document.body.classList.toggle('local-binary', mode === 'local');
        toggle.setAttribute('aria-pressed', String(enabled));
        toggle.textContent = mode === 'local' ? 'VIDEO TRAIL → BOX MODEL' : mode === 'box' ? 'BOX MODEL → BINARY' : mode === 'binary' ? 'BINARY → ORIGINAL' : 'ORIGINAL → VIDEO TRAIL';
        toggle.title = 'Switch video rendering style';
        if (!enabled) document.body.classList.remove('ascii-ready');
        else { dirty = true; render(); }
    }
    function renderBoxes(data) {
        context.setTransform(scale, 0, 0, scale, 0, 0);
        context.globalCompositeOperation = 'source-over';
        context.fillStyle = '#111416';
        context.fillRect(0, 0, width, height);
        const colors = ['#80aaff', '#61ddbc', '#e9b970'];
        let count = 0;
        function brightness(x, y) {
            const i = (Math.min(rows - 1, Math.floor(y)) * columns + Math.min(columns - 1, Math.floor(x))) * 4;
            return (data[i] * .2126 + data[i + 1] * .7152 + data[i + 2] * .0722) / 255;
        }
        function box(x, y, w, h, depth) {
            const samples = [];
            for (let sy = 0; sy < 3; sy++) for (let sx = 0; sx < 3; sx++)
                samples.push(brightness(x + w * (sx + .5) / 3, y + h * (sy + .5) / 3));
            const mean = samples.reduce((sum, value) => sum + value, 0) / samples.length;
            const contrast = Math.max(...samples) - Math.min(...samples);
            const px = x / columns * width, py = y / rows * height;
            const pw = w / columns * width, ph = h / rows * height;
            if (depth < 2 || (depth < 5 && contrast > .23 && pw > 80 && ph > 55)) {
                box(x, y, w / 2, h / 2, depth + 1);
                box(x + w / 2, y, w / 2, h / 2, depth + 1);
                box(x, y + h / 2, w / 2, h / 2, depth + 1);
                box(x + w / 2, y + h / 2, w / 2, h / 2, depth + 1);
                return;
            }
            const shade = Math.round(9 + mean * 65);
            context.fillStyle = `rgb(${shade}, ${shade + 5}, ${shade + 6})`;
            context.fillRect(px + 2, py + 2, Math.max(0, pw - 4), Math.max(0, ph - 4));
            context.strokeStyle = colors[Math.min(2, Math.floor(mean * 3))];
            context.globalAlpha = .35 + mean * .5;
            context.lineWidth = .8;
            context.setLineDash([3, 3]);
            context.strokeRect(px + 3, py + 3, Math.max(0, pw - 6), Math.max(0, ph - 6));
            if (pw > 105 && ph > 60) {
                context.font = '10px ui-monospace, monospace';
                context.textBaseline = 'top';
                context.fillStyle = colors[Math.min(2, Math.floor(mean * 3))];
                context.fillText(`region[${count}]`, px + 9, py + 9, pw - 15);
            }
            count++;
            context.globalAlpha = 1;
        }
        box(0, 0, columns, rows, 0);
        context.setLineDash([]);
        canvas.dataset.boxes = count;
    }
    function annotationRegions() {
        const regions = [];
        const now = video.currentTime;
        for (const note of notes) {
            if (window.EACObservationTour?.active && window.EACObservationTour.noteId !== note.id) continue;
            const editingTime = window.EACNoteControls?.editingTime(note.id);
            const time = editingTime ?? now;
            if (editingTime === undefined && (time < note.start || time >= noteEndTime(note))) continue;
            const point = position(note, time);
            const area = bounds(note.coordinateSpace, false);
            const first = note.path[0];
            const moving = note.path.some(p => p.x !== first.x || p.y !== first.y);
            regions.push({ id: note.id, time, moving, editing: editingTime !== undefined,
                x: area.x + point.x * area.w, y: area.y + point.y * area.h });
        }
        return regions;
    }
    function maskRegions(regions) {
        maskContext.setTransform(scale, 0, 0, scale, 0, 0);
        maskContext.clearRect(0, 0, width, height);
        const coreRadius = Math.max(40, Math.min(76, width * .055));
        const rx = coreRadius * 1.65;
        const ry = coreRadius * 2 * 1.65;
        const horizontalCore = coreRadius * .5 / (rx * 2);
        const verticalCore = coreRadius * 2 * .6 / (ry * 2);
        const patchWidth = Math.round(rx * 2 * scale);
        const patchHeight = Math.round(ry * 2 * scale);
        if (revealPatch.width !== patchWidth || revealPatch.height !== patchHeight) {
            revealPatch.width = patchWidth;
            revealPatch.height = patchHeight;
            const horizontal = revealContext.createLinearGradient(0, 0, patchWidth, 0);
            horizontal.addColorStop(0, '#ffffff00');
            horizontal.addColorStop(.5 - horizontalCore, '#fff');
            horizontal.addColorStop(.5 + horizontalCore, '#fff');
            horizontal.addColorStop(1, '#ffffff00');
            revealContext.fillStyle = horizontal;
            revealContext.fillRect(0, 0, patchWidth, patchHeight);
            const vertical = revealContext.createLinearGradient(0, 0, 0, patchHeight);
            vertical.addColorStop(0, '#ffffff00');
            vertical.addColorStop(.5 - verticalCore, '#fff');
            vertical.addColorStop(.5 + verticalCore, '#fff');
            vertical.addColorStop(1, '#ffffff00');
            revealContext.globalCompositeOperation = 'destination-in';
            revealContext.fillStyle = vertical;
            revealContext.fillRect(0, 0, patchWidth, patchHeight);
            revealContext.globalCompositeOperation = 'source-over';
        }
        for (const point of regions) {
            maskContext.drawImage(revealPatch, point.x - rx, point.y - ry, rx * 2, ry * 2);
        }
        context.globalCompositeOperation = 'destination-out';
        context.drawImage(mask, 0, 0, width, height);
        context.globalCompositeOperation = 'source-over';
    }
    function drawSnapshotTrails(regions) {
        const now = video.currentTime;
        if (lastTrailTime >= 0 && (now < lastTrailTime - .05 || now > lastTrailTime + 1)) {
            for (const id of snapshotTrails.keys()) {
                if (!regions.some(region => region.id === id && region.editing)) snapshotTrails.delete(id);
            }
        }
        lastTrailTime = now;
        const moving = regions.filter(region => region.moving);
        const ids = new Set(moving.map(region => region.id));
        for (const id of snapshotTrails.keys()) if (!ids.has(id)) snapshotTrails.delete(id);
        const coreRadius = Math.max(40, Math.min(76, width * .055));
        const rx = coreRadius * .75, ry = coreRadius * 2 * .75;
        const ratio = Math.max(width / video.videoWidth, height / video.videoHeight);
        const cropX = (video.videoWidth - width / ratio) / 2;
        const cropY = (video.videoHeight - height / ratio) / 2;
        for (const region of moving) {
            let stamps = snapshotTrails.get(region.id);
            if (!stamps) { stamps = []; snapshotTrails.set(region.id, stamps); }
            const previous = stamps.at(-1);
            const elapsed = previous ? now - previous.time : Infinity;
            const distance = previous ? Math.hypot(region.x - previous.x, region.y - previous.y) : Infinity;
            if (!video.seeking && (!region.editing || Math.abs(region.time - now) < .12)
                && elapsed >= .6 && (distance >= 24 || elapsed >= 1.4)) {
                const image = document.createElement('canvas');
                image.width = Math.min(220, Math.round(rx * 2));
                image.height = image.width * 2;
                const ctx = image.getContext('2d');
                ctx.drawImage(video, cropX + (region.x - rx) / ratio, cropY + (region.y - ry) / ratio,
                    rx * 2 / ratio, ry * 2 / ratio, 0, 0, image.width, image.height);
                stamps.push({ image, x: region.x, y: region.y, time: now });
                while (stamps.length > 20) stamps.shift();
            }
        }
        let total = [...snapshotTrails.values()].reduce((sum, stamps) => sum + stamps.length, 0);
        while (total > 80) {
            let oldest;
            for (const stamps of snapshotTrails.values()) {
                if (stamps.length && (!oldest || stamps[0].time < oldest[0].time)) oldest = stamps;
            }
            if (!oldest) break;
            oldest.shift(); total--;
        }
        const frames = [...snapshotTrails.values()].flat().sort((a, b) => a.time - b.time);
        context.globalCompositeOperation = 'source-over';
        for (const stamp of frames) {
            context.drawImage(stamp.image, stamp.x - rx, stamp.y - ry, rx * 2, ry * 2);
        }
        canvas.dataset.snapshots = frames.length;
    }
    function render() {
        if (!enabled || document.hidden || video.readyState < 2 || !video.videoWidth || !width || !height) return;
        if (!dirty && video.currentTime === lastTime && mode !== 'local') return;
        const regions = mode === 'local' ? annotationRegions() : [];
        canvas.dataset.regions = regions.length;
        try {
            if (mode === 'local') {
                context.setTransform(scale, 0, 0, scale, 0, 0);
                context.globalCompositeOperation = 'source-over';
                context.clearRect(0, 0, width, height);
                if (window.EACTextEffects?.active) window.EACTextEffects.render(context, width, height);
                else drawSnapshotTrails(regions);
                canvas.dataset.frame = ++frame;
                canvas.dataset.mode = mode;
                lastTime = video.currentTime; dirty = false;
                mirrorCamera();
                document.body.classList.add('ascii-ready');
                return;
            }
            // Match object-fit: cover before applying the same camera transform as the video.
            const ratio = Math.max(width / video.videoWidth, height / video.videoHeight);
            const sw = width / ratio, sh = height / ratio;
            pixels.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2,
                sw, sh, 0, 0, columns, rows);
            const sampled = pixels.getImageData(0, 0, columns, rows);
            const data = sampled.data;
            if (mode === 'box') {
                renderBoxes(data);
                canvas.dataset.frame = ++frame;
                canvas.dataset.mode = mode;
                lastTime = video.currentTime; dirty = false;
                mirrorCamera();
                document.body.classList.add('ascii-ready');
                return;
            }
            canvas.dataset.mode = mode;
            context.setTransform(scale, 0, 0, scale, 0, 0);
            context.fillStyle = '#080a09'; context.fillRect(0, 0, width, height);
            context.fillStyle = '#d8ded8';
            context.font = `${(width / columns) / 0.602}px monospace`;
            context.textBaseline = 'top';
            const cellHeight = height / rows;
            let nonSpace = 0;
            for (let y = 0; y < rows; y++) {
                let line = '';
                for (let x = 0; x < columns; x++) {
                    const i = (y * columns + x) * 4;
                    const brightness = (0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) / 255;
                    const shade = Math.round(brightness * 255);
                    data[i] = shade; data[i + 1] = shade; data[i + 2] = shade;
                    const glyph = ramp[Math.min(ramp.length - 1, Math.floor(Math.pow(brightness, 0.85) * ramp.length))];
                    line += glyph;
                    if (glyph !== ' ') nonSpace++;
                }
                context.fillText(line, 0, y * cellHeight, width);
            }
            // Tint the glyphs with sampled grayscale as well as varying their density.
            pixels.putImageData(sampled, 0, 0);
            context.globalCompositeOperation = 'multiply';
            context.imageSmoothingEnabled = false;
            context.drawImage(sample, 0, 0, width, height);
            context.globalCompositeOperation = 'source-over';
            if (mode === 'local') {
                maskRegions(regions.filter(region => !region.moving));
                drawSnapshotTrails(regions);
            }
            canvas.dataset.frame = ++frame;
            canvas.dataset.nonSpace = nonSpace;
            lastTime = video.currentTime; dirty = false;
            mirrorCamera();
            document.body.classList.add('ascii-ready');
            canvas.dispatchEvent(new Event('eac:frame'));
        } catch (error) {
            // A cross-origin frame cannot be sampled without CORS; keep the player usable.
            setMode('original');
            toggle.disabled = true;
            toggle.textContent = '字符画暂不可用';
            toggle.title = error.name === 'SecurityError' ? '视频来源未允许读取画面像素' : '无法读取当前视频画面';
        }
    }
    function tick(now) {
        if (!document.hidden && now - lastDraw >= 1000 / frameRate) { render(); lastDraw = now; }
        requestAnimationFrame(tick);
    }
    window.EACVideoStyle = { setMode, setFrameRate(value) { frameRate = Math.max(1, Math.min(30, Number(value) || 15)); }, get mode() { return mode; } };
    toggle.addEventListener('click', () => setMode(mode === 'local' ? 'box' : mode === 'box' ? 'binary' : mode === 'binary' ? 'original' : 'local'));
    document.body.classList.add('local-binary');
    toggle.textContent = 'VIDEO TRAIL → BOX MODEL';
    for (const event of ['loadeddata', 'seeked', 'playing']) video.addEventListener(event, () => { dirty = true; render(); });
    video.addEventListener('emptied', () => { document.body.classList.remove('ascii-ready'); dirty = true; });
    document.addEventListener('visibilitychange', () => { dirty = true; });
    new ResizeObserver(resize).observe(stage);
    resize(); mirrorCamera();
    requestAnimationFrame(tick);
})();

(() => {
    const key = 'eac:note-layout:v1';
    let saved = {}, selected = null, drag = null, editing = null;
    const layouts = new Map();
    try {
        const value = JSON.parse(localStorage.getItem(key) || '{}');
        if (value && typeof value === 'object' && !Array.isArray(value)) saved = value;
    } catch {}
    function preferences(id) {
        const value = saved[id] || {};
        return { dx: Number.isFinite(value.dx) ? value.dx : 0, dy: Number.isFinite(value.dy) ? value.dy : 0,
            adjusted: value.adjusted === true, opacity: Number.isFinite(value.opacity) ? Math.max(0, Math.min(1, value.opacity)) : 1 };
    }
    function persistLayout() {
        try { localStorage.setItem(key, JSON.stringify(saved)); } catch {}
    }
    function select(note) {
        if (!note) return;
        selected = note.id;
        renderNotes();
    }
    function beginEdit(note) {
        if (!editing || editing.id !== note.id) {
            editing = { id: note.id, time: Math.max(note.start, Math.min(current(), noteEndTime(note) - .001)) };
        }
        select(note);
    }
    function finishEdit(id) {
        if (!editing || editing.id !== id) return;
        const focused = document.activeElement;
        if (focused?.matches('.inline-parameter') && focused.closest('[data-note-id]')?.dataset.noteId === id) return;
        const note = notes.find(note => note.id === id);
        editing = null;
        if (note) {
            seek(note.start);
            pause(false);
        }
        renderNotes();
    }
    function editingTime(id) {
        return editing?.id === id ? editing.time : undefined;
    }
    function layout(note, label, baseX, baseY, size, anchorX, anchorY) {
        const pref = preferences(note.id);
        const maxX = Math.max(0, stageRect.width - size.width), maxY = Math.max(0, stageRect.height - size.height);
        const result = { x: Math.max(0, Math.min(maxX, (pref.adjusted ? anchorX : baseX) + pref.dx * stageRect.width)),
            y: Math.max(0, Math.min(maxY, (pref.adjusted ? anchorY : baseY) + pref.dy * stageRect.height)), opacity: pref.opacity,
            baseX, baseY, anchorX, anchorY, maxX, maxY };
        layouts.set(note.id, result);
        label.classList.toggle('parameter-selected', note.id === selected);
        label.tabIndex = 0;
        label.setAttribute('aria-label', 'Annotation code; drag to move or edit its underlined values: ' + note.text);
        return result;
    }
    function updatePosition(x, y) {
        const previous = layouts.get(selected);
        if (!previous) return;
        x = Math.max(0, Math.min(previous.maxX, x));
        y = Math.max(0, Math.min(previous.maxY, y));
        saved[selected] = { ...preferences(selected), adjusted: true, dx: (x - previous.anchorX) / stageRect.width,
            dy: (y - previous.anchorY) / stageRect.height };
        renderNotes();
    }
    function update(id, name, value) {
        if (!Number.isFinite(value)) return;
        selected = id;
        if (name === 'opacity') {
            saved[id] = { ...preferences(id), opacity: Math.max(0, Math.min(1, value)) };
            renderNotes();
        } else {
            const current = layouts.get(id);
            if (!current) return;
            updatePosition(name === 'x' ? value : current.x, name === 'y' ? value : current.y);
        }
        persistLayout();
    }
    document.addEventListener('pointerdown', event => {
        const label = event.target.closest?.('#notes .note-code');
        if (!label && editing && event.target.closest?.('#stage')) {
            event.preventDefault(); event.stopImmediatePropagation();
            document.activeElement?.blur();
            finishEdit(editing.id);
            return;
        }
        if (!label || event.button !== 0 || draft || gesture) return;
        const note = notes.find(note => note.id === label.dataset.noteId);
        if (!note) return;
        event.stopImmediatePropagation();
        select(note);
        if (event.target.closest('.inline-parameter')) return;
        event.preventDefault();
        const current = layouts.get(selected);
        if (!current) return;
        drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, boxX: current.x, boxY: current.y, label };
        label.setPointerCapture(event.pointerId);
    }, true);
    document.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.preventDefault(); event.stopImmediatePropagation();
        updatePosition(drag.boxX + event.clientX - drag.x, drag.boxY + event.clientY - drag.y);
    }, true);
    function endDrag(event) {
        if (!drag || event.pointerId !== drag.pointerId) return;
        event.stopImmediatePropagation();
        const previous = drag; drag = null;
        if (previous.label.hasPointerCapture(event.pointerId)) previous.label.releasePointerCapture(event.pointerId);
        persistLayout();
    }
    document.addEventListener('pointerup', endDrag, true);
    document.addEventListener('pointercancel', endDrag, true);
    document.addEventListener('keydown', event => {
        if (event.target.closest?.('.inline-parameter')) return;
        const label = event.target.closest?.('#notes .note-code');
        if (!label || !['Enter', ' '].includes(event.key)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        select(notes.find(note => note.id === label.dataset.noteId));
        label.querySelector('[data-parameter="x"]')?.focus();
    }, true);
    window.EACNoteControls = { layout, select, update, beginEdit, finishEdit, editingTime };
})();

(() => {
    const launch=document.getElementById('observation-tour-start');
    const panel=document.getElementById('observation-tour');
    const compare=document.getElementById('effects-compare');
    const gray=document.createElement('canvas');
    const pixels=gray.getContext('2d',{willReadFrequently:true});
    const state={active:false,enabled:true,render};
    let previousMode='local';
    window.EACTextEffects=state;
    window.EACObservationTour={active:false,noteId:null};
    function render(ctx,width,height){
        if(!state.active||!state.enabled||video.readyState<2)return;
        const active=[];
        for(const note of notes){
            const held=window.EACNoteControls?.editingTime(note.id);
            const t=held??current();
            if(held===undefined&&(t<note.start||t>=noteEndTime(note)))continue;
            const p=position(note,t), area=bounds(note.coordinateSpace,false);
            active.push({x:area.x+p.x*area.w,y:area.y+p.y*area.h,
                fade:held!==undefined?1:Math.min(1,(t-note.start)/.6,(noteEndTime(note)-t)/.8)});
        }
        const canvas=document.querySelector('#ascii-video');
        canvas.dataset.attentionRegions=active.length;
        document.getElementById('effects-status').textContent=active.length+' observations shaping visibility';
        if(!active.length)return;
        const h=Math.max(1,Math.round(320*height/width));
        if(gray.width!==320||gray.height!==h){gray.width=320;gray.height=h;}
        const ratio=Math.max(width/video.videoWidth,height/video.videoHeight);
        pixels.drawImage(video,(video.videoWidth-width/ratio)/2,(video.videoHeight-height/ratio)/2,
            width/ratio,height/ratio,0,0,gray.width,gray.height);
        const image=pixels.getImageData(0,0,gray.width,gray.height);
        for(let i=0;i<image.data.length;i+=4){
            const shade=(image.data[i]*.2126+image.data[i+1]*.7152+image.data[i+2]*.0722)*.3;
            image.data[i]=image.data[i+1]=image.data[i+2]=shade;
        }
        pixels.putImageData(image,0,0);
        ctx.imageSmoothingEnabled=true;ctx.drawImage(gray,0,0,width,height);
        ctx.globalCompositeOperation='destination-out';
        const radius=Math.max(45,Math.min(85,width*.06));
        for(const point of active){
            ctx.save();ctx.translate(point.x,point.y);ctx.scale(radius,radius*1.4);
            const gradient=ctx.createRadialGradient(0,0,.1,0,0,1);
            gradient.addColorStop(0,'rgba(255,255,255,'+(.48*Math.max(0,point.fade))+')');
            gradient.addColorStop(1,'rgba(255,255,255,0)');
            ctx.fillStyle=gradient;ctx.beginPath();ctx.arc(0,0,1,0,Math.PI*2);ctx.fill();ctx.restore();
        }
        ctx.globalCompositeOperation='source-over';
    }
    function stop(){
        if(!state.active)return;
        state.active=false;panel.hidden=true;launch.hidden=false;
        document.body.classList.remove('observation-tour-active');
        window.EACVideoStyle.setMode(previousMode);
    }
    launch.onclick=()=>{
        previousMode=window.EACVideoStyle.mode;
        state.active=true;state.enabled=true;
        window.EACVideoStyle.setMode('local');
        panel.hidden=false;launch.hidden=true;
        document.body.classList.add('observation-tour-active');
        compare.textContent='SHOW ORIGINAL';
    };
    document.getElementById('tour-pause').onclick=()=>pause(!video.paused);
    compare.onclick=()=>{
        state.enabled=!state.enabled;compare.textContent=state.enabled?'SHOW ORIGINAL':'SHOW ATTENTION';
        window.EACVideoStyle.setMode('local');
    };
    document.getElementById('tour-exit').onclick=stop;
    document.addEventListener('keydown',event=>{
        if(state.active&&event.key==='Escape'&&!event.target.matches('input,textarea'))stop();
    });
})();
