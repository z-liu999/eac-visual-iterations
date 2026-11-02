(() => {
    if (!window.EAC_MEDIA_CONFIG?.staticMode) return;
    const root = new URL('../', document.currentScript.src);
    const key = 'eac:fixed:observation-video.webm';
    let seed;
    function local() {
        try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value : []; }
        catch { return []; }
    }
    function revision() { return localStorage.getItem(key) || ''; }
    function category(text) {
        if (/^[\s\d\W_]+$/.test(text)) return 1;
        let hash = 0;
        for (const char of text) hash = ((hash * 31) + char.codePointAt(0)) >>> 0;
        return 1 + hash % 4;
    }
    window.EACStaticStore = {
        revision,
        async request(method, note, from, to) {
            if (method === 'POST') {
                const notes = local().filter(item => item.id !== note.id);
                notes.push(note);
                localStorage.setItem(key, JSON.stringify(notes));
                return { note };
            }
            if (!seed) {
                seed = fetch(new URL('assets/notes.json', root)).then(response => {
                    if (!response.ok) throw Error('Unable to load annotations');
                    return response.json();
                }).catch(error => { seed = null; throw error; });
            }
            const notes = new Map((await seed).map(item => [item.id, item]));
            for (const item of local()) notes.set(item.id, item);
            return { notes: [...notes.values()].filter(item => item.end >= from && item.start <= to) };
        },
        trajectories(value) {
            const entries = new Map(value.entries.map(entry => [entry.id, entry]));
            for (const note of local()) {
                if (!note.path?.length) continue;
                const first = note.path[0];
                entries.set(note.id, {
                    id: note.id, start: note.start, end: note.end, text: note.text,
                    category: entries.get(note.id)?.category || category(note.text || ''),
                    moving: note.path.some(point => point.x !== first.x || point.y !== first.y),
                    path: note.path.map(point => [point.x, point.y, point.t])
                });
            }
            const result = { ...value, entries: [...entries.values()], updatedAt: value.updatedAt + revision() };
            result.total = result.entries.length;
            result.tracks = result.entries.filter(entry => entry.moving).length;
            result.dots = result.total - result.tracks;
            return result;
        }
    };
})();
