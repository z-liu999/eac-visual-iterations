(() => {
    const version=Number(new URLSearchParams(location.search).get('iteration'));
    if(!Number.isInteger(version)||version<1||version>12)return;
    document.body.classList.add('iteration-preview');document.body.dataset.iteration=version;
    const style=document.createElement('style');style.textContent=`
.iteration-preview #location-header,.iteration-preview #ascii-toggle,.iteration-preview #trajectories-open,.iteration-preview #observation-tour-start{display:none!important}
.iteration-preview #code-float,.iteration-preview #video-code,.iteration-preview #clock-code,.iteration-preview #editor-code,.iteration-preview #submit-result-code,.iteration-preview #action-code,.iteration-preview #rewind-code,.iteration-preview .code-departure{display:none!important}
.iteration-preview #editor #text{flex:1}
.iteration-preview[data-iteration="12"] #observation-tour{display:none!important}
.iteration-preview[data-iteration="11"] #notes,.iteration-preview[data-iteration="11"] #lines{display:none!important}
`;document.head.append(style);
    const codeVersion=[5,6,7].includes(version);
    if(!codeVersion){
        window.EACVisibleCode.renderNote=(target,note)=>{if(target.dataset.archiveText!==note.text){target.textContent=note.text;target.dataset.archiveText=note.text;}};
        const plain=document.createElement('style');plain.textContent='.iteration-preview #notes .note-code{font:14px/1.3 Arial,sans-serif;color:white;background:#000d;padding:6px 8px;max-width:260px;box-shadow:none;pointer-events:none}';document.head.append(plain);
    }
    window.EACVisibleCode.showDeparture=()=>{};
    window.EACVideoStyle.setMode([5,8,9].includes(version)?'binary':version===6?'box':version===10?'local':'original');
    if(version<=2){followNote=(note,t,b,x,y,heading)=>({x:x-40,y:y-20,direction:{x:1,y:0},amount:1});}
    if(version===1){const originalPosition=position;position=(note,t,motion)=>originalPosition(note,note.start,motion);}
    if(version<=3){zoomAt=()=>{};}
    if(version===12){document.getElementById('observation-tour-start').click();}
    if([8,9].includes(version))window.EACVideoStyle.setFrameRate(30);
    if([8,9,11].includes(version))startCanvasExperiment(version);
    video.addEventListener('loadedmetadata',()=>{video.currentTime=version===11?3.284:30;},{once:true});
    function startCanvasExperiment(mode){
        const overlay=document.createElement('canvas');overlay.id='iteration-canvas';Object.assign(overlay.style,{position:'absolute',inset:'0',width:'100%',height:'100%',pointerEvents:'none',transformOrigin:'0 0'});stage.insertBefore(overlay,document.getElementById('lines'));
        const ctx=overlay.getContext('2d');
        let last=0,tiles=[];
        const revealMask=document.createElement('canvas'),maskPaint=revealMask.getContext('2d');
        const revealUnion=document.createElement('canvas'),unionPaint=revealUnion.getContext('2d');
        function prepareReveal(w){
            const baseWidth=Math.max(72,Math.min(120,w*.08));
            const width=Math.round(baseWidth*1.65),height=width*2;
            if(revealMask.width!==width||revealMask.height!==height){
                revealMask.width=width;revealMask.height=height;
                const horizontal=maskPaint.createLinearGradient(0,0,width,0),vertical=maskPaint.createLinearGradient(0,0,0,height);
                for(let i=0;i<=80;i++){
                    const p=i/80,alpha=Math.pow(Math.sin(Math.PI*p),2);
                    horizontal.addColorStop(p,`rgba(255,255,255,${alpha})`);vertical.addColorStop(p,`rgba(255,255,255,${alpha})`);
                }
                maskPaint.globalCompositeOperation='source-over';maskPaint.fillStyle=horizontal;maskPaint.fillRect(0,0,width,height);
                maskPaint.globalCompositeOperation='destination-in';maskPaint.fillStyle=vertical;maskPaint.fillRect(0,0,width,height);
                maskPaint.globalCompositeOperation='source-over';
            }
            overlay.dataset.revealWidth=width;overlay.dataset.revealHeight=height;overlay.dataset.revealExpansion='1.65';
            return {width,height};
        }
        if(mode===11)fetch('assets/50-simultaneous.json').then(r=>r.json()).then(value=>tiles=value.notes);
        function frame(now){if(mode===11)requestAnimationFrame(frame);if(document.hidden||(mode===11&&now-last<83)||video.readyState<2)return;last=now;
            const w=stage.clientWidth,h=stage.clientHeight;if(overlay.width!==w||overlay.height!==h){overlay.width=w;overlay.height=h;}
            overlay.style.transform=video.style.transform;ctx.clearRect(0,0,w,h);const vw=video.videoWidth,vh=video.videoHeight,ratio=Math.max(w/vw,h/vh),sx=(vw-w/ratio)/2,sy=(vh-h/ratio)/2;
            const raw=()=>ctx.drawImage(video,sx,sy,w/ratio,h/ratio,0,0,w,h);
            if(mode===11){
                const cw=w/10,ch=h/5;
                tiles.slice(0,50).forEach((note,i)=>{const p=position(note,video.currentTime),cx=p.x*vw,cy=p.y*vh;ctx.drawImage(video,Math.max(0,Math.min(vw-vw*.16,cx-vw*.08)),Math.max(0,Math.min(vh-vh*.22,cy-vh*.11)),vw*.16,vh*.22,(i%10)*cw,Math.floor(i/10)*ch,cw-2,ch-2);ctx.fillStyle='#000b';ctx.fillRect(i%10*cw,Math.floor(i/10)*ch+ch-26,cw-2,24);ctx.fillStyle='white';ctx.font='9px Arial';ctx.fillText(note.text.slice(0,32),i%10*cw+5,Math.floor(i/10)*ch+ch-10);});return;
            }
            const activeNotes=notes.filter(n=>video.currentTime>=n.start&&video.currentTime<noteEndTime(n));
            {
                const {width:pw,height:ph}=prepareReveal(w);
                const mw=Math.max(1,Math.round(w*.5)),mh=Math.max(1,Math.round(h*.5));
                if(revealUnion.width!==mw||revealUnion.height!==mh){revealUnion.width=mw;revealUnion.height=mh;}
                const mx=mw/w,my=mh/h;unionPaint.setTransform(mx,0,0,my,0,0);unionPaint.clearRect(0,0,w,h);
                const areas=new Map();let visible=0;
                for(const note of activeNotes){
                    const p=position(note,video.currentTime),space=note.coordinateSpace||'video';
                    if(!areas.has(space))areas.set(space,bounds(space,false));
                    const area=areas.get(space),x=area.x+p.x*area.w-pw/2,y=area.y+p.y*area.h-ph/2;
                    if(x>=w||y>=h||x+pw<=0||y+ph<=0)continue;
                    unionPaint.drawImage(revealMask,x,y);visible++;
                }
                if(mode===8||visible){
                    ctx.globalCompositeOperation='source-over';raw();
                    if(visible){
                        ctx.globalCompositeOperation=mode===8?'destination-out':'destination-in';
                        ctx.imageSmoothingEnabled=true;ctx.drawImage(revealUnion,0,0,w,h);
                    }
                    ctx.globalCompositeOperation='source-over';
                }
                overlay.dataset.binarySource='iteration-02-shared';
                overlay.dataset.videoDraws=(mode===8||visible)?'1':'0';
                overlay.dataset.regions=visible;
                overlay.dataset.revealMode=mode===8?'binary-on-video':'video-on-binary';
            }
        }
        if(mode!==11){document.getElementById('ascii-video').addEventListener('eac:frame',()=>frame(performance.now()));frame(performance.now());}
        else requestAnimationFrame(frame);
    }
})();
