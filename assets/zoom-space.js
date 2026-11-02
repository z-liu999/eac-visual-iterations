(() => {
    const surface=document.getElementById('surface');
    const inside=document.getElementById('inside');
    const front=document.getElementById('surface-frame');
    const trails=document.getElementById('trails-frame');
    const space=document.getElementById('space');
    const ENTERED_PHASE=.8;
    let target=0,progress=0,raf=0,clock=null,insideActive=false,lastInnerZoom=1,innerYaw=0,surfaceReady=false,passedSurface=false;
    function clockToTrails(){
        if(clock)trails.contentWindow.postMessage({...clock,type:'eac:clock',visible:insideActive,surfaceVisible:surfaceReady,deepInside:passedSurface},location.origin);
    }
    function paint(){
        raf=0;
        progress+=(target-progress)*.13;
        if(Math.abs(target-progress)<.0005)progress=target;
        const phase=Math.min(1,progress);
        const innerZoom=Math.pow(4,Math.max(0,progress-1));
        if(innerZoom!==lastInnerZoom){lastInnerZoom=innerZoom;trails.contentWindow.postMessage({type:'eac:space-zoom',zoom:innerZoom},location.origin);}
        const previousDepth=passedSurface;
        const facing=Math.abs(Math.atan2(Math.sin(innerYaw),Math.cos(innerYaw)))<=5*Math.PI/180;
        if(innerZoom<=1.2)passedSurface=false;
        else if(innerZoom>=1.6&&facing)passedSurface=true;
        if(previousDepth!==passedSurface)clockToTrails();
        const entered=phase>ENTERED_PHASE;
        const ready=progress>=.12;
        if(ready!==surfaceReady){surfaceReady=ready;clockToTrails();}
        const opacity=phase<.12?1:0;
        space.style.transform=`translateZ(${phase*850}px)`;
        front.style.opacity=opacity;
        surface.style.opacity=opacity;
        front.style.pointerEvents=progress<.12?'auto':'none';
        surface.style.pointerEvents=progress<.12?'auto':'none';
        trails.style.opacity=Math.min(1,progress*5);
        inside.style.pointerEvents=progress>=.12?'auto':'none';
        document.querySelectorAll('.edge').forEach(edge=>edge.style.opacity=0);
        document.getElementById('surface-border').style.opacity=0;
        const active=progress>.06;
        if(active!==insideActive){insideActive=active;clockToTrails();}
        document.body.dataset.zoom=progress.toFixed(3);
        document.body.dataset.passedSurface=String(passedSurface);
        if(progress!==target)raf=requestAnimationFrame(paint);
    }
    function zoom(delta){
        if(window.EACPortal19?.onZoom(delta))return;
        if(!Number.isFinite(delta))return;
        const facing=Math.abs(Math.atan2(Math.sin(innerYaw),Math.cos(innerYaw)))<=5*Math.PI/180;
        const minimum=(target>=1||progress>ENTERED_PHASE)&&!facing?1:0;
        const next=Math.max(minimum,Math.min(2,target-delta*.0014));
        target=target<1&&next>=1?1:next;
        if(!raf)raf=requestAnimationFrame(paint);
    }
    addEventListener('wheel',event=>{event.preventDefault();zoom(event.deltaY*(event.deltaMode===1?16:event.deltaMode===2?innerHeight:1));},{passive:false});
    let pinchScale=1;
    addEventListener('gesturestart',event=>{event.preventDefault();pinchScale=event.scale||1;},{passive:false});
    addEventListener('gesturechange',event=>{event.preventDefault();const scale=event.scale||1;zoom(-Math.log(scale/pinchScale)*700);pinchScale=scale;},{passive:false});
    addEventListener('message',event=>{
        if(event.origin!==location.origin)return;
        if(event.source===front.contentWindow&&event.data?.type==='eac:surface-clock'){
            clock={time:event.data.time,paused:event.data.paused};clockToTrails();
        }
        if(event.source===trails.contentWindow&&event.data?.type==='eac:orientation'&&Number.isFinite(event.data.yaw)){innerYaw=event.data.yaw;if(!raf)raf=requestAnimationFrame(paint);}
        if([front.contentWindow,trails.contentWindow].includes(event.source)&&event.data?.type==='eac:zoom'){
            if(event.source===trails.contentWindow&&Number.isFinite(event.data.yaw))innerYaw=event.data.yaw;
            zoom(event.data.delta);
        }
        if(event.source===trails.contentWindow&&event.data?.type==='eac:return')returnToVideo();
        if(event.source===trails.contentWindow&&event.data?.type==='eac:reset-depth'){target=1;if(!raf)raf=requestAnimationFrame(paint);}
    });
    function returnToVideo(){target=0;if(!raf)raf=requestAnimationFrame(paint);}
    addEventListener('eac:portal19-reset',()=>{target=progress=0;innerYaw=0;lastInnerZoom=1;passedSurface=false;trails.contentWindow.postMessage({type:'eac:reset-view'},location.origin);paint();});
    addEventListener('keydown',event=>{if(event.key==='Escape')returnToVideo();});
    trails.addEventListener('load',()=>{clockToTrails();trails.contentWindow.postMessage({type:'eac:space-zoom',zoom:lastInnerZoom},location.origin);});
    paint();
})();
