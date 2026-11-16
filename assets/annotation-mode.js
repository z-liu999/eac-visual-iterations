// Iteration 20 suppresses annotations in every same-origin child frame.
(() => {
    let owner = window;
    window.EAC_NO_ANNOTATIONS = false;
    try {
        while (true) {
            if (new URLSearchParams(owner.location.search).get('variant') === '20') {
                window.EAC_NO_ANNOTATIONS = true;
                break;
            }
            if (owner === owner.parent) break;
            owner = owner.parent;
        }
    } catch {}
    if (!window.EAC_NO_ANNOTATIONS) return;
    document.documentElement.dataset.annotations = 'off';
    const style = document.createElement('style');
    style.textContent = '#notes,#lines,#hint,#editor,#code-float,#action-code,#rewind-code{display:none!important}';
    document.head.append(style);
})();
