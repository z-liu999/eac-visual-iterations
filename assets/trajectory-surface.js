(() => {
    if(!new URLSearchParams(location.search).has('embedded'))return;
    const sheet=document.createElement('canvas');
    sheet.id='video-surface-plane';sheet.setAttribute('aria-hidden','true');
    Object.assign(sheet.style,{position:'absolute',left:'0',top:'0',transformOrigin:'0 0',pointerEvents:'none',border:'1px solid #9b9b9b',opacity:'0',backfaceVisibility:'visible'});
    document.body.append(sheet);
    const paint=sheet.getContext('2d',{alpha:false});
    const trails=document.getElementById('trajectories');
    Object.assign(trails.style,{position:'absolute',inset:'0',zIndex:'2'});
    let width=0,height=0,lastPaint=-Infinity,visible=false,enabled=false,deepInside=false;
    function update({w,h,depth,focal,yaw,pitch,centerX,centerY}){
        const angle=Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)));
        const start=(deepInside?25:5)*Math.PI/180;
        const end=(deepInside?40:12)*Math.PI/180;
        const amount=Math.max(0,Math.min(1,(angle-start)/(end-start)));
        const opacity=enabled?.88*amount*amount*(3-2*amount):0;
        visible=opacity>.001;
        sheet.style.opacity=opacity;
        sheet.style.width=w+'px';sheet.style.height=h+'px';
        sheet.style.zIndex=Math.cos(yaw)>=0?'3':'1';
        sheet.style.transform=`translate(${centerX}px,${centerY}px) perspective(${focal}px) rotateX(${pitch}rad) rotateY(${yaw}rad) translateZ(${depth/2}px) translate(${-w/2}px,${-h/2}px)`;
        width=w;height=h;
        draw(performance.now());
    }
    function draw(now){
        if(!visible||now-lastPaint<1000/12)return;
        const frame=parent.document.getElementById('surface-frame');
        const doc=frame?.contentDocument,video=doc?.getElementById('video');
        if(!video||video.readyState<2||!width||!height)return;
        lastPaint=now;
        window.EACSurfaceTexture?.paint(sheet,frame,{width,height});
    }
    window.EACTrajectorySurface={update,setEnabled(value,deep=false){const changed=enabled!==Boolean(value)||deepInside!==Boolean(deep);enabled=Boolean(value);deepInside=Boolean(deep);if(!enabled){visible=false;sheet.style.opacity=0;}return changed;}};
})();
