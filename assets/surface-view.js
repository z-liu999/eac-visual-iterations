(() => {
    if(!new URLSearchParams(location.search).has('surface'))return;
    document.body.classList.add('surface-view');
    window.EACVideoStyle?.setMode('original');
    if(window.EACVisibleCode){
        window.EACVisibleCode.renderNote=(target,note)=>{
            if(target.dataset.surfaceText!==note.text){target.textContent=note.text;target.dataset.surfaceText=note.text;}
        };
        window.EACVisibleCode.showDeparture=()=>{};
    }
    const video=document.getElementById('video');
    function sendClock(){parent.postMessage({type:'eac:surface-clock',time:video.currentTime,paused:video.paused},location.origin);}
    for(const event of ['timeupdate','seeked','play','pause','loadedmetadata'])video.addEventListener(event,sendClock);
    setInterval(sendClock,250);
    addEventListener('wheel',event=>{
        if(event.target.closest('textarea,input,dialog')||document.body.classList.contains('note-input'))return;
        event.preventDefault();
        parent.postMessage({type:'eac:zoom',delta:event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1)},location.origin);
    },{passive:false});
    let pinchScale=1;
    addEventListener('gesturestart',event=>{event.preventDefault();pinchScale=event.scale||1;},{passive:false});
    addEventListener('gesturechange',event=>{event.preventDefault();const scale=event.scale||1;parent.postMessage({type:'eac:zoom',delta:-Math.log(scale/pinchScale)*700},location.origin);pinchScale=scale;},{passive:false});
    sendClock();
})();
