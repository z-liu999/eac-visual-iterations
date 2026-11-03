// ========================================
// 1. 页面元素与运行状态
// ========================================

'use strict';
const $ = id => document.getElementById(id),
    stage = $('stage'),
    video = $('video');

// 视频地址可以更换，标注标识保持固定，已有数据库记录不会丢失。
const VIDEO_URL = window.EAC_MEDIA_CONFIG?.videoUrl || 'observation-video.webm';
const mediaKey = 'fixed:observation-video.webm';
// MP4 后台启用后，本地旧地址也进入同一播放源；标注标识不变。
if (window.EAC_MEDIA_CONFIG?.localSiteUrl
    && ['127.0.0.1', 'localhost'].includes(location.hostname)
    && ['8001', '8003'].includes(location.port)) {
    location.replace(window.EAC_MEDIA_CONFIG.localSiteUrl);
}

// 旧测试网址刷新后自动进入同源同步版本。
if (location.hostname === 'merchandise-sitemap-nest-participants.trycloudflare.com') {
    location.replace(window.EAC_MEDIA_CONFIG.publicUrl + '/' + location.hash);
}
let playing = true,
    active = null,
    draft = null,
    notes = [],
    videoRetry = null;

// 移动超过 6 像素才算拖动，避免单击时手部抖动。
const DRAG_THRESHOLD = 6;

// 与原站一致：至少 3 秒，另外按每 140 字符 6 秒计算阅读时间。
const STATIC_NOTE_SECONDS = 10;
const NOTE_MIN_SECONDS = 3;
const NOTE_READING_SECONDS = 6;
const NOTE_READING_CHARACTERS = 140;
let gesture = null;

// 点击后的放大倍率；坐标与标注一起转换，避免位置偏移。
const ZOOM_SCALE = 2;
let camera = { scale : 1, x : 0, y : 0 };

// ========================================
// 2. 提示文字、浏览器备份与服务器同步
// ========================================

function message(s) {
    $('hint').textContent = s;
}

// 轨迹够长就按轨迹结束；不足阅读时间时，在终点继续停留。
// 不修改原始轨迹时间戳，避免为延长显示而减慢移动速度。
function noteEndTime(note) {
    const first = note.path?.[0];
    const isStatic = first && note.path.every(p => p.x === first.x && p.y === first.y);
    if (isStatic) return note.start + STATIC_NOTE_SECONDS;
    const pathEnd = note.path?.at(-1)?.t ?? note.start;
    const readingTime = NOTE_MIN_SECONDS
        + (note.text || '').length / NOTE_READING_CHARACTERS * NOTE_READING_SECONDS;
    return Math.max(pathEnd, note.start + readingTime);
}

function loadNotes() {
    try {
        notes = JSON.parse(localStorage.getItem('eac:' + mediaKey) || '[]');
        if (!Array.isArray(notes)) notes = [];
        // 旧记录按原始轨迹和文字重新计算，不沿用固定 15 秒的结束时间。
        notes = notes.filter(n => Number.isFinite(n.start) && !n.source?.originalId).map(n => ({
            ...n,
            end : noteEndTime(n)
        }));
    } catch {
        notes = [];
    }
}

function persist() {
    try {
        localStorage.setItem('eac:' + mediaKey, JSON.stringify(notes.filter(note => !note.source?.originalId)));
    } catch {
        message('浏览器无法保存，请导出标注备份。');
    }
}
loadNotes();

// 浏览器仅保留备份；服务器数据库是共享标注的来源。
const migrationKey = 'eac:migrated:' + mediaKey;
let syncing = false, noteCursor = null, noteWindowTo = null, noteSeekVersion = 0;

async function apiRequest(method, note) {
    if (window.EACStaticStore) return window.EACStaticStore.request(method, note, Math.max(0, current() - 15), current() + 40);
    const from = Math.max(0, current() - 15);
    const to = current() + 40;
    const incremental = method === 'GET' && Number.isInteger(noteCursor) && Number.isFinite(noteWindowTo) && to >= noteWindowTo;
    const url = method === 'GET' ? `/api/notes?from=${from}&to=${to}` + (incremental ? `&cursor=${noteCursor}&after=${noteWindowTo}` : '') : '/api/notes';
    const response = await fetch(url, {
        method,
        headers : method === 'POST' ? { 'Content-Type' : 'application/json' } : {},
        body : method === 'POST' ? JSON.stringify(note) : undefined,
        cache : 'no-store',
        signal : AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error('Server returned ' + response.status);
    return response.json();
}

function syncStatus(text) {
    $('sync-status').textContent = text;
    $('sync-status').hidden = !text;
}

async function syncNotes() {
    if (syncing) return;
    syncing = true;
    let resyncAfterSeek = false;
    try {
        if (!localStorage.getItem(migrationKey)) {
            // 旧标注逐条上传，按 ID 去重；中断后可安全重试。
            for (const note of notes.slice()) {
                const result = await apiRequest('POST', note);
                note.id = result.note.id;
            }
            localStorage.setItem(migrationKey, '1');
        }
        const requestedSeek = noteSeekVersion;
        const result = await apiRequest('GET');
        if (requestedSeek !== noteSeekVersion) { resyncAfterSeek = true; return; }
        if (Number.isInteger(result.cursor) && Number.isFinite(result.to)) { noteCursor = result.cursor; noteWindowTo = result.to; }
        const currentTime = current();
        const combined = new Map(notes.filter(note => !note.source?.originalId
            || (note.end >= currentTime - 15 && note.start <= currentTime + 40)
            || window.EACNoteControls?.editingTime(note.id) !== undefined).map(note => [note.id, note]));
        for (const note of result.notes) {
            const existing = combined.get(note.id);
            // 保留对象身份，定期同步不会重置文字框的追赶状态。
            combined.set(note.id, existing ? Object.assign(existing, note) : note);
        }
        notes = [...combined.values()].sort((a, b) => a.start - b.start);
        persist();
        syncStatus('');
        renderNotes();
    } catch (error) {
        syncStatus('SERVER OFFLINE — Retrying automatically. Browser backup retained.');
        console.error('Note synchronization failed:', error);
    } finally {
        syncing = false;
        if (resyncAfterSeek && !video.seeking) setTimeout(syncNotes, 200);
    }
}

syncNotes();
setInterval(syncNotes, 2000);
window.addEventListener('online', syncNotes);
video.addEventListener('seeking', () => { noteCursor = noteWindowTo = null; noteSeekVersion++; });
video.addEventListener('seeked', syncNotes);

// ========================================
// 3. 时间显示、持续播放与历史时间跳转
// ========================================

function clock(t) {
    return new Date((15 * 3600 + t) * 1000).toISOString().slice(11, 19);
}

function current() {
    return video.currentTime || 0;
}

function pause(value) {
    playing = !value;
    if (value) {
        video.pause();
    } else {
        video.play().catch(() => {
            message('视频尚未就绪或自动播放被浏览器阻止，点击画面可重试。');
        });
    }
}

function seek(t) {
    if (!Number.isFinite(video.duration)) return;
    video.currentTime = Math.min(Math.max(0, t), video.duration);
    renderNotes();
}

// 每个页面独立播放；不请求共享时钟，也不自动跟随其他用户跳转。
// 清理旧主控链接，但不读取或发送旧权限。
if (new URLSearchParams(location.hash.slice(1)).has('host')) {
    history.replaceState(null, '', location.pathname + location.search);
}
sessionStorage.removeItem('eac:playback-host');

// ========================================
// 4. 画面尺寸与鼠标坐标
// ========================================

// screen 为 false 时返回原始画面范围，用于计算缩放中心。
let stageRect = stage.getBoundingClientRect();
function updateStageRect() {
    stageRect = stage.getBoundingClientRect();
}
new ResizeObserver(updateStageRect).observe(stage);
window.addEventListener('scroll', updateStageRect, { passive : true, capture : true });

function bounds(space = 'video', screen = true) {
    const r = stageRect;
    const ratio = video.videoWidth ? video.videoWidth / video.videoHeight : 16 / 9;
    let w = r.width;
    let h = r.height;

    if (space !== 'stage') {
        h = w / ratio;
        if (h < r.height) {
            h = r.height;
            w = h * ratio;
        }
    }

    const x = (r.width - w) / 2;
    const y = (r.height - h) / 2;
    return {
        x : screen ? x * camera.scale + camera.x : x,
        y : screen ? y * camera.scale + camera.y : y,
        w : screen ? w * camera.scale : w,
        h : screen ? h * camera.scale : h
    };
}

function zoomAt(p, redraw = true) {
    const area = bounds('stage', false);
    camera = {
        scale : ZOOM_SCALE,
        x : Math.min(0, Math.max(area.w * (1 - ZOOM_SCALE), area.w / 2 - p.x * area.w * ZOOM_SCALE)),
        y : Math.min(0, Math.max(area.h * (1 - ZOOM_SCALE), area.h / 2 - p.y * area.h * ZOOM_SCALE))
    };
    applyZoom(redraw);
}

function applyZoom(redraw = true) {
    const transform = `translate(${camera.x}px, ${camera.y}px) scale(${camera.scale})`;
    if (video.style.transform !== transform) video.style.transform = transform;
    if (redraw) renderNotes();
}

function resetZoom() {
    camera = { scale : 1, x : 0, y : 0 };
    applyZoom();
}

window.addEventListener('resize', resetZoom);

function point(e) {
    const r = stageRect,
    b = bounds('stage'),
    x = (e.clientX - r.left - b.x) / b.w,
    y = (e.clientY - r.top - b.y) / b.h;
    return x >= 0 && x <= 1 && y >= 0 && y <= 1 ? {
        x,
        y,
        t : current()
    } : null;
}

// ========================================
// 5. 开始跟随与打开输入框
// ========================================

function begin(p) {
    if (draft) return;
    if (video.readyState < 2) {
        message('视频下载完成并加载后，即可开始标注。');
        return;
    }
    if (video.paused) pause(false);
    active = {
        coordinateSpace : 'stage',
        start : p.t,
        path : [p]
    };
    message('按住并拖动可记录轨迹，松开后输入内容。');
}

function finish() {
    draft = active;
    active = null;
    // 输入期间重播刚才的事件，短轨迹至少播放 3 秒。
    const pathEnd = draft.path.at(-1).t;
    draft.previewEnd = Math.max(pathEnd, draft.start + 3);
    if (Number.isFinite(video.duration)) {
        draft.previewEnd = Math.min(draft.previewEnd, video.duration);
    }
    seek(draft.start);
    pause(false);
    zoomAt(draft.path[0]);
    window.EACVisibleCode?.showZoom(draft.path[0], camera, video.style.transform);
    // 输入框固定占据右半屏，取消按钮显示在原回退按钮的位置。
    document.body.classList.add('note-input');
    $('editor').hidden = false;
    $('cancel').hidden = false;
    $('text').value = '';
    window.EACVisibleCode?.renderEditor(draft);
    $('text').focus();
}

// ========================================
// 6. 鼠标与键盘操作
// ========================================

stage.addEventListener('pointerdown', e => {
    if (e.button !== 0 || draft || gesture) return;
    const p = point(e);
    if (!p) return;
    begin(p);
    if (!active) return;

    gesture = {
        pointerId : e.pointerId,
        x : e.clientX,
        y : e.clientY,
        dragging : false
    };
    stage.setPointerCapture(e.pointerId);
    window.EACVisibleCode?.show(e, p, bounds('stage', false), false);
    e.preventDefault();
});

stage.addEventListener('pointermove', e => {
    if (!active || !gesture || e.pointerId !== gesture.pointerId) return;
    const distance = Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y);
    if (distance > DRAG_THRESHOLD) gesture.dragging = true;

    if (gesture.dragging) {
        const p = point(e);
        if (p) {
            active.path.push(p);
            renderNotes();
            window.EACVisibleCode?.show(e, p, bounds('stage', false), true);
        }
    }
});

stage.addEventListener('pointerup', e => {
    if (!active || !gesture || e.pointerId !== gesture.pointerId) return;
    const p = point(e);
    const distance = Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y);
    if (distance > DRAG_THRESHOLD) gesture.dragging = true;

    // 普通单击仅保留起点，文字固定；拖动保留完整路径。
    if (gesture.dragging && p) active.path.push(p);
    window.EACVisibleCode?.hide();
    gesture = null;
    if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
    finish();
});

stage.addEventListener('pointercancel', () => cancel());
stage.addEventListener('lostpointercapture', () => {
    if (gesture) cancel();
});

stage.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !draft && !gesture) {
        e.preventDefault();
        begin({
            x : .5,
            y : .5,
            t : current()
        });
        if (active) finish();
    }
});

// ========================================
// 7. 取消与保存观察
// ========================================

function cancel() {
    window.EACVisibleCode?.hide();
    gesture = null;
    active = null;
    draft = null;
    $('editor').hidden = true;
    $('cancel').hidden = true;
    document.body.classList.remove('note-input');
    // 发送和取消都会调用这里，统一恢复原始画面。
    resetZoom();
    video.playbackRate = 1;
    message('单击后输入文字；按住并拖动记录轨迹，松开后输入。');
}
$('cancel').onclick = cancel;

document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
        cancel();
    }
});
// Enter 发送，Shift + Enter 换行；中文输入法选字时不触发发送。
let textComposing = false;
$('text').addEventListener('compositionstart', () => { textComposing = true; });
$('text').addEventListener('compositionend', () => { textComposing = false; });
$('text').addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.shiftKey || e.isComposing || textComposing || e.keyCode === 229) return;
    e.preventDefault();
    if (e.repeat || $('submit-note').disabled || !$('text').value.trim()) return;
    $('editor').requestSubmit($('submit-note'));
});

$('editor').onsubmit = async e => {
    e.preventDefault();
    const text = $('text').value.trim();
    if (!text || !draft || $('submit-note').disabled) return;
    const submittedDraft = draft;
    // 标注使用绘制时的视频时间，输入花费的时间不改变轨迹时间戳。
    const start = draft.start;
    const end = noteEndTime({ start, path : draft.path, text });
    const path = draft.path.map(p => ({
        x : p.x,
        y : p.y,
        t : p.t
    }));

    // 网络超时重试沿用同一 ID，防止一次发送生成两条记录。
    submittedDraft.noteId ||= crypto.randomUUID();
    const note = {
        coordinateSpace : draft.coordinateSpace,
        id : submittedDraft.noteId,
        text,
        observedStart : draft.start,
        start,
        end,
        path
    };
    $('submit-note').disabled = true;
    window.EACVisibleCode?.setSubmitState('saving', submittedDraft);
    try {
        const result = await apiRequest('POST', note);
        notes = notes.filter(existing => existing.id !== result.note.id);
        notes.push(result.note);
        persist();
        window.EACVisibleCode?.setSubmitState('saved', submittedDraft);
        syncStatus('');
    } catch (error) {
        window.EACVisibleCode?.setSubmitState('failed — text retained', submittedDraft);
        syncStatus('SAVE FAILED — Your text is retained. Please try TAKE NOTE again.');
        console.error('Note submission failed:', error);
        return;
    } finally {
        $('submit-note').disabled = false;
    }
    // 请求期间若已取消或打开新标注，不改变当前输入状态。
    if (draft !== submittedDraft) return;
    cancel();

    // 发送后提前 2 秒播放，让事件发生时再同步出现文字和轨迹。
    seek(Math.max(0, start - 2));
    pause(false);
    renderNotes();
    window.EACNoteControls?.select(notes.find(saved => saved.id === note.id));
};

// ========================================
// 8. 标注位置与画面显示
// ========================================

function pathSegment(path, t) {
    let low = 1, high = path.length - 1;
    while (low < high) {
        const middle = (low + high) >> 1;
        if (path[middle].t < t) low = middle + 1;
        else high = middle;
    }
    return low;
}

function position(n, t, motion) {
    const path = n.path;
    if (path.length === 1 || t >= path.at(-1).t) {
        if (motion) Object.assign(motion, { mode: path.length === 1 ? 'static' : 'endpoint' });
        return path.at(-1);
    }
    const index = pathSegment(path, t);
    const a = path[index - 1], b = path[index];
    const f = Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t || 1)));
    const p = { x : a.x + (b.x - a.x) * f, y : a.y + (b.y - a.y) * f };
    if (motion) Object.assign(motion, { mode: 'interpolate', index, fraction: f, x: p.x, y: p.y });
    return p;
}

// 用轨迹切线计算任意角度，按画面宽高换算，避免斜线角度失真。
function noteHeading(note, t, b) {
    const path = note.path;
    const segment = path.length > 1 ? pathSegment(path, t) : 0;

    for (let i = segment; i > 0; i--) {
        const dx = (path[i].x - path[i - 1].x) * b.w;
        const dy = (path[i].y - path[i - 1].y) * b.h;
        const length = Math.hypot(dx, dy);
        if (length > 0.01) return { x : dx / length, y : dy / length };
    }
    return { x : 1, y : 0 };
}

// 文字框的追赶状态只用于显示，不写入浏览器保存的数据。
const noteFollowers = new WeakMap();
const NOTE_FOLLOW_DISTANCE = 40;
const NOTE_FOLLOW_RATE = 0.1; // 60Hz 下每帧追赶剩余距离的 10%。

function followNote(note, t, b, targetX, targetY, heading, now) {
    let state = noteFollowers.get(note);
    const view = [b.x, b.y, b.w, b.h].join(',');
    // 回退、跳转或缩放后重新定位，避免从旧画面飞过来。
    if (!state || t < state.t || t - state.t > 0.5
        || now - state.now > 250 || state.view !== view) {
        state = {
            x : targetX - heading.x * NOTE_FOLLOW_DISTANCE,
            y : targetY - heading.y * NOTE_FOLLOW_DISTANCE,
            now,
            t,
            view
        };
    }

    const dx = targetX - state.x;
    const dy = targetY - state.y;
    const distance = Math.hypot(dx, dy);
    const direction = distance > 0.01
        ? { x : dx / distance, y : dy / distance }
        : heading;
    // 用实际帧间隔换算，60Hz 和高刷新率屏幕保持相同拖曳感。
    const elapsed = Math.max(0, Math.min(100, now - state.now));
    const amount = 1 - Math.pow(1 - NOTE_FOLLOW_RATE, elapsed / (1000 / 60));
    state.x += (dx - direction.x * NOTE_FOLLOW_DISTANCE) * amount;
    state.y += (dy - direction.y * NOTE_FOLLOW_DISTANCE) * amount;
    state.now = now;
    state.t = t;
    state.view = view;
    noteFollowers.set(note, state);
    return { x : state.x, y : state.y, direction, elapsed, amount };
}

// 按标注 ID 缓存元素，显示期间只更新属性，不重新创建节点。
const noteElements = new Map();
let trailElement = null;
let dotElement = null;
const labelSizes = new WeakMap();
const labelResizeObserver = new ResizeObserver(entries => {
    for (const entry of entries) labelSizes.delete(entry.target);
});

function getNoteElements(note) {
    let elements = noteElements.get(note.id);
    if (!elements) {
        const label = document.createElement('pre');
        label.className = 'note note-code';
        label.dataset.noteId = note.id;
        label.setAttribute('aria-label', '标注内容及当前显示状态的代码示意');
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'note-leader');
        $('notes').append(label);
        labelResizeObserver.observe(label);
        $('lines').append(line);
        elements = { label, line, code: label, note };
        noteElements.set(note.id, elements);
    }
    window.EACVisibleCode?.renderNote(elements.label, note,
        elements.label.style.transform || 'translate(0px, 0px)', current(), noteEndTime(note));
    return elements;
}

// 从文字框角点连接到当前轨迹点，方向支持完整 360 度。
function drawLeader(line, x1, y1, x2, y2, angle) {
    line.setAttribute('data-angle', angle);
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
}

function renderNotes() {
    const t = current();
    const now = performance.now();
    const visibleIds = new Set();
    for (const n of notes) {
        if (window.EACObservationTour?.active && window.EACObservationTour.noteId !== n.id) continue;
        const editingTime = window.EACNoteControls?.editingTime(n.id);
        const t = editingTime ?? current();
        // 参数编辑期间保留标注，并以点击时的轨迹位置展示。
        if (editingTime === undefined && (t < n.start || t >= noteEndTime(n))) {
            noteFollowers.delete(n);
            continue;
        }
        const b = bounds(n.coordinateSpace);
        visibleIds.add(n.id);
        const { label, line, code } = getNoteElements(n);
        const motion = {};
        const p = position(n, t, motion);
        const heading = noteHeading(n, t, b);
        const anchorX = b.x + p.x * b.w;
        const anchorY = b.y + p.y * b.h;
        const follower = followNote(n, t, b, anchorX, anchorY, heading, now);
        motion.follow = follower;
        const direction = follower.direction;
        const angle = Math.atan2(direction.y, direction.x) * 180 / Math.PI;
        label.dataset.angle = angle;

        // 根据方向选择四角，指示线始终从角点出发。
        const connectRight = direction.x >= -0.000001;
        const connectBottom = direction.y > 0.000001;
        const edgeX = follower.x;
        const edgeY = follower.y;
        let box = labelSizes.get(label);
        if (!box) {
            box = { width : label.offsetWidth, height : label.offsetHeight };
            labelSizes.set(label, box);
        }
        let labelX = Math.round(Math.max(0, Math.min(edgeX - (connectRight ? box.width : 0), stageRect.width - box.width)) * 10) / 10;
        let labelY = Math.round(Math.max(0, Math.min(edgeY - (connectBottom ? box.height : 0), stageRect.height - box.height)) * 10) / 10;
        const layout = window.EACNoteControls?.layout(n, label, labelX, labelY, box, anchorX, anchorY);
        if (layout) {
            labelX = layout.x;
            labelY = layout.y;
            label.style.opacity = String(layout.opacity);
            line.style.opacity = String(layout.opacity);
        }
        label.style.transform = `translate(${labelX}px, ${labelY}px)`;
        window.EACVisibleCode?.renderNote(code, n, label.style.transform, t, noteEndTime(n), motion);
        label.dataset.corner = (connectBottom ? 'bottom-' : 'top-')
            + (connectRight ? 'right' : 'left');
        drawLeader(line, labelX + (connectRight ? box.width : 0), labelY + (connectBottom ? box.height : 0), anchorX, anchorY, angle);
    }
    // 已结束或被移除的标注释放节点，回退后按需重新创建。
    for (const [id, elements] of noteElements) {
        if (!visibleIds.has(id)) {
            window.EACVisibleCode?.showDeparture(elements.label, elements.note, t, noteEndTime(elements.note));
            labelResizeObserver.unobserve(elements.label);
            elements.label.remove();
            elements.line.remove();

            noteElements.delete(id);
        }
    }
    // 拖动期间和输入期间显示轨迹，保存或取消后自动清除。
    const trace = active || draft;
    if (trace) {
        const b = bounds(trace.coordinateSpace);
        drawTrail(trace.path, b);
        dot(draft ? position(draft, Math.max(draft.start, t)) : trace.path.at(- 1), b);
    } else {
        trailElement?.remove();
        dotElement?.remove();
        trailElement = null;
        dotElement = null;
    }
}

function drawTrail(path, b) {
    if (path.length < 2) {
        trailElement?.remove();
        trailElement = null;
        return;
    }
    if (!trailElement) {
        trailElement = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
        trailElement.setAttribute('class', 'drag-trail');
        $('lines').append(trailElement);
    }
    const trail = trailElement;
    const base = bounds((active || draft)?.coordinateSpace || 'stage', false);
    const size = `${base.x},${base.y},${base.w},${base.h}`;
    if (trail.path !== path || trail.pathSize !== size || trail.points.numberOfItems > path.length) {
        trail.points.clear();
        trail.path = path;
        trail.pathSize = size;
    }
    for (let i = trail.points.numberOfItems; i < path.length; i++) {
        const point = $('lines').createSVGPoint();
        point.x = base.x + path[i].x * base.w;
        point.y = base.y + path[i].y * base.h;
        trail.points.appendItem(point);
    }
    const transform = `translate(${camera.x} ${camera.y}) scale(${camera.scale})`;
    if (trail.getAttribute('transform') !== transform) trail.setAttribute('transform', transform);
    trail.setAttribute('vector-effect', 'non-scaling-stroke');

}

function dot(p, b) {
    if (!dotElement) {
        dotElement = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        $('lines').append(dotElement);
    }
    const c = dotElement;
    c.setAttribute('cx', b.x + p.x * b.w);
    c.setAttribute('cy', b.y + p.y * b.h);
    c.setAttribute('r', 6);
    c.setAttribute('fill', 'none');
    c.setAttribute('stroke', 'white');
}

// ========================================
// 9. 按视频时间更新标注
// ========================================

// 视频循环播放绘制片段，镜头使用同一个视频时间跟随轨迹。
function previewDraft() {
    if (!draft) return;

    const t = current();
    // 等待本次跳转完成，避免连续发起 seek 导致视频卡住。
    if (!video.seeking && (t >= draft.previewEnd || t < draft.start - 0.05)) {
        seek(draft.start);
        if (video.paused) pause(false);
    }
    const p = position(draft, Math.max(draft.start, current()));
    zoomAt(p, false);
}

function tick() {
    previewDraft();
    const displayClock = clock(current()).slice(0,5);
    if ($('clock').textContent !== displayClock) $('clock').textContent = displayClock;
    renderNotes();
    requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ========================================
// 10. ABOUT 与记录弹窗
// ========================================

for (const [button, dialog] of [['about', 'information'], ['history', 'archive']]) $(button).onclick = () => {
    if (button === 'history') {
        buildHistory();
        $('information').close();
    }
    $(dialog).showModal();
};
document.querySelectorAll('.close').forEach(b => b.onclick = () => b.closest('dialog').close());

// Figma 左下角：回退 10 秒，取消正在输入的标注并继续播放。
$('rewind').onclick = () => {
    const before = current();
    window.EACVisibleCode?.beginRewind(before);
    cancel();
    seek(before - 10);
    pause(false);
    window.EACVisibleCode?.rewindApplied();
};

// ========================================
// 11. 固定视频加载与自动重试
// ========================================

video.addEventListener('error', () => {
    message('视频暂时无法加载，正在重试连接。');
    clearTimeout(videoRetry);
    videoRetry = setTimeout(() => loadVideoSource(true), 15000);
});

video.addEventListener('loadeddata', () => {
    clearTimeout(videoRetry);
    message('单击后输入文字；按住并拖动记录轨迹，松开后输入。');
    if (!draft) pause(false);
});

// 禁用右键菜单中的浏览器原生播放选项。
video.addEventListener('contextmenu', e => e.preventDefault());
// 从后端获取私有 R2 的临时链接；普通模式继续使用配置地址。
async function loadVideoSource(restoreTime = false) {
    const resumeAt = restoreTime ? current() : 0;
    try {
        const response = window.EAC_MEDIA_CONFIG?.staticMode ? null : await fetch('/api/media', { cache : 'no-store' });
        let source = window.EACMediaLoader ? await window.EACMediaLoader.prepare(VIDEO_URL) : VIDEO_URL;
        if (response?.ok) {
            const media = await response.json();
            source = media.url || VIDEO_URL;
        } else if (response && response.status !== 404) {
            throw new Error('Media service unavailable');
        }
        // Pixel sampling requires a same-origin video until R2 CORS is configured.
        if ($('ascii-video') && !source.startsWith('blob:')) {
            const pixelSource = new URL(VIDEO_URL, location.href);
            if (pixelSource.origin === location.origin) source = pixelSource.href;
        }
        if (resumeAt > 0) {
            video.addEventListener('loadedmetadata', () => seek(resumeAt), { once : true });
        }
        video.src = source;
        video.load();
    } catch (error) {
        message('视频服务连接失败，将自动重试。');
        clearTimeout(videoRetry);
        videoRetry = setTimeout(() => loadVideoSource(restoreTime), 15000);
    }
}
loadVideoSource();

// ========================================
// 12. 导出标注
// ========================================

$('export').onclick = () => {
    const blob = new Blob([JSON.stringify({
        version : 1,
        media : mediaKey,
        notes
    }, null, 2)], {
        type : 'application/json'
    }),
    url = URL.createObjectURL(blob),
    a = document.createElement('a');
    a.href = url;
    a.download = 'observations.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

// ========================================
// 13. 历史记录与时间定位
// ========================================

function buildHistory() {
    $('list').replaceChildren();
    if (!notes.length) {
        $('list').textContent = '还没有观察记录。';
        return;
    }
    notes.forEach(n => {
        const li = document.createElement('li'),
        button = document.createElement('button');
        button.textContent = clock(n.start) + ' — ' + n.text;
        button.onclick = () => {
            seek(n.start);
            $('archive').close();
            // 查看历史观察后继续播放，无需手动恢复。
            pause(false);
        };
        li.append(button);
        $('list').append(li);
    });
}
