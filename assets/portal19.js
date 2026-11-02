(() => {
    if(new URLSearchParams(location.search).get('variant')!=='19')return;
    const front=document.getElementById('surface-frame'),trails=document.getElementById('trails-frame');
    const panel=document.createElement('iframe');panel.title='Hold Space video time space';panel.allow='autoplay';
    Object.assign(panel.style,{position:'fixed',inset:'0',width:'100%',height:'100%',border:'0',zIndex:'30',visibility:'hidden',background:'white'});
    panel.src='video-depth.html?notes=1&host19=1&v=single-video-116';document.body.append(panel);
    const burst=document.createElement('div');Object.assign(burst.style,{position:'fixed',inset:'0',zIndex:'31',pointerEvents:'none',perspective:'1000px',transformStyle:'preserve-3d',overflow:'hidden',visibility:'hidden'});document.body.append(burst);
    const curtain=document.createElement('canvas');Object.assign(curtain.style,{position:'absolute',left:'50%',top:'50%',width:'100%',height:'100%',transformOrigin:'50% 50%',willChange:'transform,opacity'});burst.append(curtain);
    const sheets=Array.from({length:5},()=>{const sheet=document.createElement('canvas');Object.assign(sheet.style,{position:'absolute',left:'50%',top:'50%',width:'100%',height:'100%',transformOrigin:'50% 50%',willChange:'transform,opacity'});burst.append(sheet);return sheet;});
    let lastPaint=0;
    const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*t*(t*(t*6-15)+10);};
    function refreshBurst(frame){
        if(!window.EACSurfaceTexture?.paint(curtain,frame,{width:innerWidth,height:innerHeight,outWidth:Math.min(1280,innerWidth)}))return;
        for(const sheet of sheets){if(sheet.width!==curtain.width||sheet.height!==curtain.height){sheet.width=curtain.width;sheet.height=curtain.height;}sheet.getContext('2d').drawImage(curtain,0,0);}
    }
    function prepareBurst(){burst.style.display='block';refreshBurst(front);lastPaint=performance.now();paintBurst(0);burst.style.visibility='visible';}
    function paintBurst(p){
        const now=performance.now();
        if(now-lastPaint>50){refreshBurst(front);lastPaint=now;}
        const state=view()?.get()||{yaw:0,zoom:5.7,travel:0},f=innerHeight*state.zoom/2,k=f/2.975,camera=5.1-state.travel;
        burst.style.perspective=f+'px';
        const transform=z=>`translateZ(${f-camera*k}px) rotateY(${state.yaw}rad) translateZ(${z*k}px) translate(-50%,-50%)`;
        curtain.style.transform=transform(2.125);curtain.style.opacity=String(1-smooth(p/.45));curtain.style.visibility=p>=.45?'hidden':'visible';
        for(let i=0;i<sheets.length;i++){
            const t=Math.max(0,Math.min(1,(p-i*.045)/(1-i*.045))),ease=smooth(t);
            sheets[i].style.transform=transform(2.125+ease*(2.30-i*.14));
            sheets[i].style.opacity=String(.78*smooth(t/.09)*(1-smooth((t-.62)/.38)));
            sheets[i].style.visibility=t<=0||t>=1?'hidden':'visible';
        }
        burst.style.visibility=p>=1?'hidden':'visible';
    }

    let held=false,active=false,progress=0,previous=0,returnView=null;
    const sourceVideo=()=>front.contentDocument?.getElementById('video');
    const innerVideo=()=>view()?.getVideo?.();
    const view=()=>panel.contentWindow?.EACVideoDepthView;
    function press(event){
        if(event.code!=='Space'||event.metaKey||event.ctrlKey||event.altKey||event.target?.closest?.('textarea,input,[contenteditable="true"]'))return;
        event.preventDefault();event.stopImmediatePropagation();if(event.repeat||held)return;
        if(!active&&(Number(document.body.dataset.zoom||0)>.001||!document.getElementById('loading')?.hidden))return;
        if(!view()||!innerVideo()||innerVideo().readyState<2)return;
        held=true;view()?.setPresented?.(true);
        if(!active){active=true;progress=0;returnView=null;prepareBurst();window.dispatchEvent(new CustomEvent('eac:portal19-reset'));const outer=sourceVideo(),inner=innerVideo();if(outer&&Math.abs(inner.currentTime-outer.currentTime)>.3)inner.currentTime=outer.currentTime;if(outer!==inner)outer?.pause();inner.play().catch(()=>{});view().set({yaw:0,zoom:5.7,travel:0});panel.style.visibility='visible';panel.contentWindow.focus();}
        else innerVideo()?.play().catch(()=>{});
        document.body.dataset.spaceMode='opening';
    }
    function release(event){if(event&&event.code!=='Space'&&event.key!=='Escape')return;if(!active||!held)return;event?.preventDefault();held=false;burst.style.display='none';returnView={...view()?.get(),progress};innerVideo()?.pause();document.body.dataset.spaceMode='returning';}
    function bind(win){win.addEventListener('blur',()=>setTimeout(()=>{if(active&&!document.hasFocus())release();},80));win.addEventListener('keydown',press,true);win.addEventListener('keyup',release,true);win.addEventListener('keydown',e=>{if(e.key==='Escape')release(e);},true);}
    bind(window);for(const frame of [front,trails]){frame.addEventListener('load',()=>{try{bind(frame.contentWindow);}catch{}});try{bind(frame.contentWindow);}catch{}}
    addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==panel.contentWindow)return;if(e.data?.type==='eac:space19')e.data.held?press({code:'Space',preventDefault(){},stopImmediatePropagation(){}}):release();if(e.data?.type==='eac:return19')release();});
    document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
    function tick(now){const dt=Math.min(.04,(now-(previous||now))/1000);previous=now;
        if(active){const old=progress;progress=Math.max(0,Math.min(1,progress+(held?1:-1)*dt/1));
            if(progress!==old){
                if(held){view()?.set({travel:0,yaw:-.72*smooth(progress),zoom:5.7*(1-.18*smooth(progress))});}
                else if(returnView){const ratio=smooth(progress)/Math.max(.00001,smooth(returnView.progress));view()?.set({travel:returnView.travel*ratio,yaw:returnView.yaw*ratio,zoom:5.7+(returnView.zoom-5.7)*ratio});}
                if(held){burst.style.display=progress>=1?'none':'block';paintBurst(progress);}else burst.style.display='none';
            }
            if(!held&&progress===0){const inner=innerVideo(),outer=sourceVideo();panel.style.visibility='hidden';burst.style.visibility='hidden';active=false;view()?.setPresented?.(false);if(outer&&inner){if(outer!==inner)outer.currentTime=inner.currentTime;outer.play().catch(()=>{});inner.play().catch(()=>{});}view()?.set({yaw:0,zoom:5.7,travel:0});document.body.dataset.spaceMode='surface';front.contentWindow.focus();}
        }
        requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);window.EACPortal19={onZoom(){return active;}};
})();
