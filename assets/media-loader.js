(() => {
    if (!window.EAC_MEDIA_CONFIG?.staticMode) return;
    let owner = window;
    try { if (window.top.location.origin === location.origin) owner = window.top; } catch {}
    const downloads = owner.__eacCompleteVideos || (owner.__eacCompleteVideos = new Map());
    window.EACMediaLoader = {
        prepare(source) {
            const url = new URL(source, location.href).href;
            if (!downloads.has(url)) {
                const download = owner.fetch(url, { cache: 'force-cache' }).then(response => {
                    if (!response.ok) throw Error('Unable to download video');
                    return response.blob();
                }).then(blob => owner.URL.createObjectURL(blob)).catch(error => {
                    downloads.delete(url);
                    throw error;
                });
                downloads.set(url, download);
            }
            return downloads.get(url);
        }
    };
})();
