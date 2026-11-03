(() => {
    const host19=new URLSearchParams(location.search).has('host19');
    function return19(event){if(!host19||event.key!=='Escape')return;event.preventDefault();event.stopImmediatePropagation();parent.postMessage({type:'eac:return19',time:video.currentTime},location.origin);}
    if(host19){addEventListener('keydown',return19,true);const space=e=>{if(e.code!=='Space'||e.target?.closest?.('input,textarea,[contenteditable="true"]'))return;e.preventDefault();e.stopImmediatePropagation();if(!e.repeat)parent.postMessage({type:'eac:space19',held:e.type==='keydown'},location.origin);};addEventListener('keydown',space,true);addEventListener('keyup',space,true);window.EACBindHold19=doc=>{doc.addEventListener('keydown',space,true);doc.addEventListener('keyup',space,true);};}
    let hostPresented=!host19;
    const opaqueFrames=new URLSearchParams(location.search).get('opaque')==='1';
    const canvas=document.getElementById('frames'),status=document.getElementById('status');
    let video=document.getElementById('video');
    const gl=canvas.getContext('webgl',{alpha:false,antialias:false}),inst=gl?.getExtension('ANGLE_instanced_arrays');
    if(!inst){status.textContent='Instanced WebGL is required for this view.';return;}
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec2 position;attribute vec3 slice;uniform float yaw,zoom,aspect,travel,time,opaqueFrames;uniform vec2 cell,plane;varying vec2 uv;varying vec3 worldPoint;varying float opacity;void main(){uv=slice.yz+(vec2(position.x+.5,.5-position.y)*cell);float z=2.125-(time-slice.x)*.6;float c=cos(yaw),s=sin(yaw);vec3 p=vec3(position.x*plane.x,position.y*plane.y,z);worldPoint=p;vec3 r=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);float d=5.1-r.z-travel;gl_Position=vec4(r.x*zoom/aspect,r.y*zoom,d-.12,d);float age=max(0.,time-slice.x);opacity=opaqueFrames>.5?1.:(age<=5.?1.:age<6.5?1.-.8*smoothstep(5.,6.5,age):.2-.1*clamp((age-6.5)/53.5,0.,1.));}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision highp float;
    uniform sampler2D image,thumbnail;uniform float detailBlend,yaw,travel,densityCompensation,backTransparency;
    uniform vec4 thumbnailRect;uniform vec2 plane,layerRange;
    varying vec2 uv;varying vec3 worldPoint;varying float opacity;
    void main(){
        vec3 color=texture2D(image,uv).rgb;
        if(detailBlend>=0.)color=mix(texture2D(thumbnail,thumbnailRect.xy+uv*thumbnailRect.zw).rgb,color,detailBlend);
        float backAmount=smoothstep(0.,.8,worldPoint.z-(5.1-travel)*cos(yaw));
        color=clamp((color-.5)*(1.+.25*backAmount)+.5,0.,1.);
        float alpha=opacity;
        if(densityCompensation>.5&&alpha<.999999&&layerRange.y>layerRange.x){
            float camera=5.1-travel;vec3 eye=vec3(-camera*sin(yaw),0.,camera*cos(yaw));
            vec3 ray=worldPoint-eye;vec3 safeRay=mix(vec3(.000001),ray,step(vec3(.000001),abs(ray)));
            vec3 a=(vec3(-plane*.5,layerRange.x)-eye)/safeRay,b=(vec3(plane*.5,layerRange.y)-eye)/safeRay;
            vec3 lower=min(a,b),upper=max(a,b);
            float lo=max(0.,max(lower.x,max(lower.y,lower.z))),hi=min(upper.x,min(upper.y,upper.z));
            float layers=hi>lo?abs((hi-lo)*ray.z)/.06+1.:1.;
            float density=max(1.,layers/6.);
            alpha=1.-pow(max(.000001,1.-alpha),1./density);
        }
        gl_FragColor=vec4(color,alpha*(1.-backTransparency*backAmount));
    }`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const vertex=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),gl.STATIC_DRAW);
    const position=gl.getAttribLocation(program,'position'),slice=gl.getAttribLocation(program,'slice'),u={};
    for(const name of ['yaw','zoom','aspect','travel','time','cell','plane','detailBlend','thumbnailRect','layerRange','densityCompensation','backTransparency','opaqueFrames'])u[name]=gl.getUniformLocation(program,name);
    gl.enableVertexAttribArray(position);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);gl.enableVertexAttribArray(slice);inst.vertexAttribDivisorANGLE(slice,1);
    gl.uniform1f(u.backTransparency,host19?0.05:0);gl.uniform1f(u.opaqueFrames,opaqueFrames?1:0);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.uniform1i(gl.getUniformLocation(program,'image'),0);gl.uniform1i(gl.getUniformLocation(program,'thumbnail'),1);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(1,1,1,1);
    const atlas=opaqueFrames?{tileW:480,tileH:270,columns:4,rows:7,width:1920,height:1890}:{tileW:32,tileH:18,columns:32,rows:56,width:1024,height:1008};
    const frame=document.createElement('canvas');frame.width=opaqueFrames?480:1280;frame.height=opaqueFrames?270:720;const paint=frame.getContext('2d');
    const tile=document.createElement('canvas');tile.width=atlas.tileW;tile.height=atlas.tileH;const tilePaint=tile.getContext('2d');
    const pages=[],records=[],detail=new Map(),pending=new Set(),fallback=new Map(),decodedQueue=[];
    let selectedBackDetails=new Set(),desiredDetails=new Set(),lastDetailUpload=-Infinity,lastCaptureWall=-Infinity;
    let yaw=0,zoom=5.7,travel=0,drag=null,lastBucket=-1,lastTime=0,lastRender=0,dirty=true,session=0,persistenceError=false,detailStamp=0,drawCalls=0,interactionUntil=0,displayScale=0;
    let snapTarget=null,snapVelocity=0;
    const frontTurn=()=>Math.round(yaw/(Math.PI*2))*Math.PI*2;
    const magneticZoom=()=>opaqueFrames||zoom>5.7*1.01;
    function beginDrag(x){snapTarget=null;snapVelocity=0;drag={x};}
    function moveDrag(x){
        if(!drag)return;let delta=(x-drag.x)*.006;drag.x=x;
        if(magneticZoom()){
            const offset=yaw-frontTurn(),distance=Math.abs(offset),band=.24;
            if(distance<band){const t=distance/band,smooth=t*t*(3-2*t);delta*=offset*delta<0?.25+.75*smooth:.6+.4*smooth;}
        }
        yaw+=delta;interactionUntil=performance.now()+180;dirty=true;
    }
    function endDrag(){
        if(!drag)return;drag=null;const target=frontTurn();
        if(magneticZoom()&&Math.abs(yaw-target)<.24){snapTarget=target;snapVelocity=0;}
        dirty=true;
    }
    function animateSnap(dt){
        if(snapTarget===null||drag)return;
        const error=yaw-snapTarget,omega=16,decay=Math.exp(-omega*dt),term=snapVelocity+omega*error;
        yaw=snapTarget+(error+term*dt)*decay;snapVelocity=(snapVelocity-omega*term*dt)*decay;dirty=true;
        if(Math.abs(yaw-snapTarget)<.00004&&Math.abs(snapVelocity)<.001){yaw=snapTarget;snapTarget=null;snapVelocity=0;interactionUntil=performance.now()+80;}
    }
    const livePlane=document.createElement('div'),liveSurface=document.createElement('iframe');
    Object.assign(livePlane.style,{position:'absolute',left:'50%',top:'50%',transformStyle:'preserve-3d',transformOrigin:'0 0',pointerEvents:'auto',backfaceVisibility:'hidden'});
    liveSurface.src=host19?'about:blank':'../?surface=1&iteration='+(opaqueFrames?24:23)+'&v=complete-video-125';liveSurface.title='Original video surface';liveSurface.allow='autoplay';
    Object.assign(liveSurface.style,{width:innerWidth+'px',height:innerHeight+'px',border:'0',display:'block',transformOrigin:'0 0',pointerEvents:'auto'});
    livePlane.append(liveSurface);document.body.append(livePlane);
    liveSurface.addEventListener('load',()=>{
        if(host19)return;
        const source=liveSurface.contentDocument?.getElementById('video');if(!source)return;
        const css=liveSurface.contentDocument.createElement('style');css.textContent='body.surface-view #location-header{visibility:visible}';liveSurface.contentDocument.head.append(css);
        const doc=liveSurface.contentDocument;
        if(host19){doc.addEventListener('keydown',return19,true);window.EACBindHold19(doc);}
        doc.addEventListener('pointerdown',e=>{if(e.target.closest('button,a,input,textarea'))return;beginDrag(e.screenX);livePlane.style.visibility='hidden';e.preventDefault();e.stopImmediatePropagation();doc.documentElement.setPointerCapture(e.pointerId);},true);
        doc.addEventListener('pointermove',e=>{if(!drag)return;moveDrag(e.screenX);e.stopImmediatePropagation();},true);
        for(const name of ['pointerup','pointercancel','lostpointercapture'])doc.addEventListener(name,e=>{if(!drag)return;endDrag();e.stopImmediatePropagation();},true);
        const outerHeader=parent.document.querySelector('.iteration-brand-host');if(outerHeader&&!host19)outerHeader.style.display='none';
        video.pause();video.removeAttribute('src');video.load();video=source;
        clear();lastTime=0;dirty=true;
        if(host19){const start=Math.max(0,Number(new URLSearchParams(location.search).get('start'))||0);const seek=()=>{video.currentTime=Math.min(start,Math.max(0,video.duration-.1));};if(video.readyState>=1)seek();else video.addEventListener('loadedmetadata',seek,{once:true});}
        video.play().catch(()=>{});
        if(host19){video.addEventListener('seeking',()=>{clear();lastTime=video.currentTime;dirty=true;});}
    });
    const sharedSurface=host19?parent.document.getElementById('surface-frame'):null;
    function attachSharedVideo(){
        const source=sharedSurface?.contentDocument?.getElementById('video');
        if(!source){setTimeout(attachSharedVideo,100);return;}
        if(video===source)return;
        video=source;clear();lastTime=video.currentTime;dirty=true;
        video.addEventListener('seeking',()=>{clear();lastTime=video.currentTime;dirty=true;});
        video.addEventListener('seeked',()=>{dirty=true;});
        canvas.dataset.videoSource='shared-surface';
    }
    if(host19){sharedSurface?.addEventListener('load',attachSharedVideo);setTimeout(attachSharedVideo,0);}
    const noteFrame=document.createElement('iframe');noteFrame.src='trajectories.html?embedded=1&videoSlices=1&v=viewport-cull-87';noteFrame.title='Code time trajectories';Object.assign(noteFrame.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',background:'transparent',pointerEvents:'none'});document.body.append(noteFrame);
    const dbReady=new Promise(resolve=>{const req=indexedDB.open('eac-video-slices',1);req.onupgradeneeded=()=>req.result.createObjectStore('frames');req.onsuccess=()=>resolve(req.result);req.onerror=()=>{persistenceError=true;resolve(null);};});
    window.EACVideoDepthView={getVideo(){return video;},setPresented(value){if(!host19)return;hostPresented=Boolean(value);dirty=true;if(!hostPresented){const retained=[...detail.entries()].sort((a,b)=>b[1].used-a[1].used);for(const [key,item]of retained.slice(12)){gl.deleteTexture(item.texture);detail.delete(key);}livePlane.style.visibility='hidden';}},set(value){if(Number.isFinite(value.yaw))yaw=value.yaw;if(Number.isFinite(value.zoom))zoom=Math.max(1,Math.min(22.8,value.zoom));if(Number.isFinite(value.travel))travel=value.travel;dirty=true;},get(){return {yaw,zoom,travel};}};
    const run=Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
    let encoder=null,encoderReady=false,encodeSequence=0;const encodingJobs=new Map();
    function fallbackEncode(record,bitmap){
        const source=document.createElement('canvas');source.width=1280;source.height=720;source.getContext('2d').drawImage(bitmap,0,0);bitmap.close();source.toBlob(blob=>store(record,blob),'image/jpeg',.92);
    }
    try{
        if(opaqueFrames)throw Error('Uniform slices do not require an encoder');
        encoder=new Worker('slice-encoder-worker.js?v=background-84');
        encoder.onmessage=event=>{
            const message=event.data;
            if(message.type==='ready'){encoderReady=message.supported;return;}
            const record=encodingJobs.get(message.id);encodingJobs.delete(message.id);
            if(!record){message.bitmap?.close();return;}
            if(message.type==='encoded')store(record,message.blob);else if(message.bitmap)fallbackEncode(record,message.bitmap);
        };
        encoder.onerror=()=>{encoderReady=false;};
    }catch{encoderReady=false;}
    function encodeFrame(record){
        if(!encoderReady||encodingJobs.size>=3){frame.toBlob(blob=>store(record,blob),'image/jpeg',.92);return;}
        const id=++encodeSequence;encodingJobs.set(id,record);
        createImageBitmap(frame).then(bitmap=>{try{encoder.postMessage({id,bitmap},[bitmap]);}catch{encodingJobs.delete(id);fallbackEncode(record,bitmap);}}).catch(()=>{encodingJobs.delete(id);frame.toBlob(blob=>store(record,blob),'image/jpeg',.92);});
    }
    function texture(image){const t=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,t);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);if(image)gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,image);return t;}
    function newPage(){const t=texture();gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,atlas.width,atlas.height,0,gl.RGB,gl.UNSIGNED_BYTE,null);const p={texture:t,buffer:gl.createBuffer(),records:[],retired:0,normal:null,reverse:null,uploaded:0};pages.push(p);return p;}
    async function store(record,blob){
        if(!blob||record.generation!==session||record.time<(records[0]?.time??Infinity))return;
        if(host19){fallback.set(record.key,blob);dirty=true;return;}
        const db=await dbReady;
        if(record.generation!==session||record.time<(records[0]?.time??Infinity))return;
        if(!db){fallback.set(record.key,blob);return;}
        try{const tx=db.transaction('frames','readwrite');tx.objectStore('frames').put(blob,record.key);tx.onerror=()=>{fallback.set(record.key,blob);persistenceError=true;};}
        catch{fallback.set(record.key,blob);persistenceError=true;}
    }
    async function load(record){if(fallback.has(record.key))return fallback.get(record.key);if(host19)return null;const db=await dbReady;if(!db)return null;return new Promise(resolve=>{try{const req=db.transaction('frames').objectStore('frames').get(record.key);req.onsuccess=()=>resolve(req.result);req.onerror=()=>resolve(null);}catch{resolve(null);}});}
    function clear(){
        const oldKeys=records.map(r=>r.key);
        for(const p of pages){gl.deleteTexture(p.texture);gl.deleteBuffer(p.buffer);}
        for(const value of detail.values())gl.deleteTexture(value.texture);
        for(const job of decodedQueue)job.bitmap.close();decodedQueue.length=0;
        pages.length=records.length=0;detail.clear();fallback.clear();desiredDetails.clear();pending.clear();session++;lastBucket=-1;
        if(oldKeys.length)dbReady.then(db=>{if(db)try{const store=db.transaction('frames','readwrite').objectStore('frames');for(const key of oldKeys)store.delete(key);}catch{}});
    }
    function capture(){
        const t=video.currentTime;if(t<lastTime-.5)clear();lastTime=t;
        const bucket=Math.floor((t+1e-6)*10);if(video.readyState<2||bucket<=lastBucket)return;lastBucket=bucket;
        paint.drawImage(video,0,0,frame.width,frame.height);tilePaint.drawImage(frame,0,0,atlas.tileW,atlas.tileH);
        const p=pages.at(-1)?.records.length<atlas.columns*atlas.rows?pages.at(-1):newPage(),index=p.records.length;
        const x=index%atlas.columns*atlas.tileW,y=Math.floor(index/atlas.columns)*atlas.tileH;
        gl.bindTexture(gl.TEXTURE_2D,p.texture);gl.texSubImage2D(gl.TEXTURE_2D,0,x,y,gl.RGB,gl.UNSIGNED_BYTE,tile);
        const record={generation:session,page:p,time:t,key:run+':'+session+':'+bucket,x:x/atlas.width,y:y/atlas.height};records.push(record);p.records.push(record);p.normal=null;p.reverse=null;
        if(!opaqueFrames&&hostPresented)detail.set(record.key,{texture:texture(frame),record,used:performance.now(),quality:1,target:1});
        trimHistory();
        if(!opaqueFrames)encodeFrame(record);
        dirty=true;
    }
    function trimHistory(){
        while(records.length>600){
            const old=records.shift(),page=old.page;page.retired++;page.normal=page.reverse=null;
            const high=detail.get(old.key);if(high){gl.deleteTexture(high.texture);detail.delete(old.key);}fallback.delete(old.key);
            dbReady.then(db=>{if(db)try{db.transaction('frames','readwrite').objectStore('frames').delete(old.key);}catch{}});
        }
        while(pages.length>1&&pages[0].retired>=pages[0].records.length){const old=pages.shift();gl.deleteTexture(old.texture);gl.deleteBuffer(old.buffer);}
    }
    function buffers(p,reverse){
        if(!p.normal){
            p.liveRecords=p.records.slice(p.retired);p.reversedRecords=p.liveRecords.slice().reverse();
            const n=p.liveRecords.length;p.normal=new Float32Array(n*3);p.reverse=new Float32Array(n*3);
            for(let i=0;i<n;i++){const a=p.liveRecords[i],b=p.reversedRecords[i],j=i*3;p.normal[j]=a.time;p.normal[j+1]=a.x;p.normal[j+2]=a.y;p.reverse[j]=b.time;p.reverse[j+1]=b.x;p.reverse[j+2]=b.y;}
            p.uploaded=0;
        }
        const direction=reverse?-1:1;if(p.uploaded!==direction*p.liveRecords.length){gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);gl.bufferData(gl.ARRAY_BUFFER,reverse?p.reverse:p.normal,gl.DYNAMIC_DRAW);p.uploaded=direction*p.liveRecords.length;}
    }
    async function requestDetail(record){
        if(detail.has(record.key)||pending.has(record.key))return;
        pending.add(record.key);const generation=session;let queued=false;
        try{const blob=await load(record);if(blob&&generation===session){const bitmap=await createImageBitmap(blob);if(generation===session){decodedQueue.push({record,bitmap,generation});queued=true;dirty=true;}else bitmap.close();}}
        finally{if(!queued)pending.delete(record.key);}
    }
    function uploadDetails(now){
        if(!decodedQueue.length||now-lastCaptureWall<(host19?20:40)||now-lastDetailUpload<(host19?(drag?80:25):(drag?120:35)))return;
        const job=decodedQueue.shift();pending.delete(job.record.key);
        if(job.generation===session&&desiredDetails.has(job.record.key)&&!detail.has(job.record.key)){
            detail.set(job.record.key,{record:job.record,texture:texture(job.bitmap),used:now,quality:0,target:1});lastDetailUpload=now;dirty=true;
        }
        job.bitmap.close();
    }

    const detailBuffer=gl.createBuffer();
    const surfaceImage=document.createElement('canvas');let surfaceTexture=null,lastSurfacePaint=-Infinity;
    function drawSurface(now){
        const nearFront=Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))<.15;
        const surfaceInterval=1000/(nearFront?60:12);
        if(now-lastSurfacePaint>surfaceInterval&&window.EACSurfaceTexture?.paint(surfaceImage,host19?sharedSurface:liveSurface,{width:innerWidth,height:innerHeight,outWidth:host19&&Math.cos(yaw)<0?Math.min(1920,innerWidth*(devicePixelRatio||1)):960})){
            lastSurfacePaint=now;
            if(!surfaceTexture)surfaceTexture=texture(surfaceImage);
            else{gl.bindTexture(gl.TEXTURE_2D,surfaceTexture);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,surfaceImage);}
        }
        if(!surfaceTexture)return;
        gl.uniform1f(u.densityCompensation,0);gl.uniform1f(u.detailBlend,-1);gl.bindTexture(gl.TEXTURE_2D,surfaceTexture);gl.uniform2f(u.cell,1,1);gl.bindBuffer(gl.ARRAY_BUFFER,detailBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([video.currentTime,0,0]),gl.STREAM_DRAW);gl.vertexAttribPointer(slice,3,gl.FLOAT,false,12,0);inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,1);drawCalls++;
    }
    function refreshDetails(now){
        if(opaqueFrames)return;
        const moving=!!drag||snapTarget!==null||now<interactionUntil;
        if(now-detailStamp<(host19?(moving?180:120):(moving?400:200)))return;detailStamp=now;
        const candidates=[],c=Math.cos(yaw),s=Math.sin(yaw),camera=5.1-travel,cameraZ=camera*c,plane=planeSize(),visible=[],backKeys=new Set();
        for(const r of records){
            const z=2.125-(video.currentTime-r.time)*.6,backFacing=cameraZ<z;
            if(!backFacing&&zoom<=8&&travel<=1)continue;
            const corners=[];let nearest=Infinity;
            for(const x of [-plane.w/2,plane.w/2])for(const y of [-plane.h/2,plane.h/2]){
                const distance=5.1-(-x*s+z*c)-travel;
                if(distance>.06){nearest=Math.min(nearest,distance);corners.push({x:(x*c+z*s)*zoom/(innerWidth/innerHeight)/distance,y:y*zoom/distance});}
            }
            if(!corners.length||corners.every(p=>p.x < -1)||corners.every(p=>p.x>1)||corners.every(p=>p.y < -1)||corners.every(p=>p.y>1))continue;
            visible.push({r,score:nearest,backFacing});
        }
        visible.sort((a,b)=>Number(b.backFacing)-Number(a.backFacing)||a.score-b.score);
        for(const item of visible.slice(0,host19?20:12)){candidates.push(item.r);if(item.backFacing)backKeys.add(item.r.key);}
        selectedBackDetails=backKeys;canvas.dataset.backDetailCandidates=String(backKeys.size);canvas.dataset.detailRule='visible-back-face';
        candidates.push(...records.slice(-20));
        const keep=new Set(candidates.map(r=>r.key));desiredDetails=keep;
        for(const r of candidates){const item=detail.get(r.key);if(item)item.used=now;else if(pending.size<(host19?2:(moving?1:2)))requestDetail(r);}
        for(const [key,item]of detail){
            const age=video.currentTime-item.record.time,recent=Math.max(0,Math.min(1,(2-age)/1));
            item.target=keep.has(key)?Math.max(recent,backKeys.has(key)?1:0):0;
            if(!keep.has(key)&&item.quality<.005&&(now-item.used>2000||detail.size>40)){gl.deleteTexture(item.texture);detail.delete(key);}
        }
    }
    let opacityPrefix=new Float64Array(0),opaquePrefix=new Uint32Array(0),occlusionStamp=-1,rayContext=null;
    function prepareOcclusion(){
        const camera=5.1-travel;rayContext={cam:camera,c:Math.cos(yaw),s:Math.sin(yaw),plane:planeSize()};
        const stamp=Math.floor(video.currentTime*10);if(stamp===occlusionStamp&&opacityPrefix.length===records.length+1)return;occlusionStamp=stamp;
        opacityPrefix=new Float64Array(records.length+1);opaquePrefix=new Uint32Array(records.length+1);
        for(let i=0;i<records.length;i++){const age=video.currentTime-records[i].time;let a=1;if(!opaqueFrames&&age>5){if(age<6.5){const t=(age-5)/1.5;a=1-.8*t*t*(3-2*t);}else a=.2-.1*Math.min(1,(age-6.5)/53.5);}opacityPrefix[i+1]=opacityPrefix[i]+Math.log(Math.max(1e-12,1-a));opaquePrefix[i+1]=opaquePrefix[i]+(a>.999999?1:0);}
    }
    const planeSize=()=>({w:2*2.975*(innerWidth/innerHeight)/5.7,h:2*2.975/5.7});
    function lowerBound(time){let l=0,r=records.length;while(l<r){const m=(l+r)>>1;if(records[m].time<time)l=m+1;else r=m;}return l;}
    window.EACSliceOcclusion=(x,y,time)=>{
        const {cam,c,s,plane}=rayContext||{cam:5.1-travel,c:Math.cos(yaw),s:Math.sin(yaw),plane:planeSize()},cx=-cam*s,cz=cam*c;
        const px=(x-.5)*plane.w,py=(.5-y)*plane.h,pz=2.125-(video.currentTime-time)*.6;
        const distance=cam-(-px*s+pz*c);
        if(distance<=.06)return 0;
        let lo=.06/distance,hi=1-1e-5;
        for(const [origin,delta,half]of [[cx,px-cx,plane.w/2],[0,py,plane.h/2]]){
            if(Math.abs(delta)<1e-8){if(Math.abs(origin)>half)return 1;continue;}
            let a=(-half-origin)/delta,b=(half-origin)/delta;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);
        }
        if(lo>=hi)return 1;
        const a=cz+(pz-cz)*lo,b=cz+(pz-cz)*hi;
        if(2.125>=Math.min(a,b)&&2.125<=Math.max(a,b))return 0;
        const left=lowerBound(video.currentTime+(Math.min(a,b)-2.125)/.6),right=lowerBound(video.currentTime+(Math.max(a,b)-2.125)/.6);
        if(right<=left)return 1;if(opaquePrefix[right]>opaquePrefix[left])return 0;
        const lowZ=2.125-(video.currentTime-(records[0]?.time||0))*.6,highZ=-.875;
        let start=0,end=Infinity;
        if(highZ>lowZ){
            for(const [origin,delta,min,max]of [[cx,px-cx,-plane.w/2,plane.w/2],[0,py,-plane.h/2,plane.h/2],[cz,pz-cz,lowZ,highZ]]){
                if(Math.abs(delta)<1e-8){if(origin<min||origin>max){end=-1;break;}continue;}
                let a=(min-origin)/delta,b=(max-origin)/delta;if(a>b)[a,b]=[b,a];start=Math.max(start,a);end=Math.min(end,b);
            }
        }else end=-1;
        const layers=end>start?Math.abs((end-start)*(pz-cz))/.06+1:1,density=Math.max(1,layers/6);
        const sidePosition=Math.max(0,Math.min(1,(.8-Math.abs(c))/.3));
        const sideWeight=sidePosition*sidePosition*(3-2*sidePosition);
        const exponent=(1-sideWeight)/density+sideWeight;
        return Math.exp((opacityPrefix[right]-opacityPrefix[left])*exponent);
    };
    window.EACSliceFrameOpacity=(x,y,time)=>{
        const age=Math.max(0,video.currentTime-time);
        let alpha=age<=5?1:age<6.5?1-.8*((age-5)/1.5)**2*(3-2*((age-5)/1.5)):.2-.1*Math.min(1,(age-6.5)/53.5);
        if(alpha>=.999999)return alpha;
        const {cam,c,s,plane}=rayContext,cx=-cam*s,cz=cam*c;
        const px=(x-.5)*plane.w,py=(.5-y)*plane.h,pz=2.125-(video.currentTime-time)*.6;
        const lowZ=2.125-(video.currentTime-(records[0]?.time||0))*.6,highZ=-.875;
        let lo=0,hi=Infinity;
        if(highZ<=lowZ)return alpha;
        for(const [origin,delta,min,max]of [[cx,px-cx,-plane.w/2,plane.w/2],[0,py,-plane.h/2,plane.h/2],[cz,pz-cz,lowZ,highZ]]){
            if(Math.abs(delta)<1e-8){if(origin<min||origin>max)return alpha;continue;}
            let a=(min-origin)/delta,b=(max-origin)/delta;if(a>b)[a,b]=[b,a];lo=Math.max(lo,a);hi=Math.min(hi,b);
        }
        const layers=hi>lo?Math.abs((hi-lo)*(pz-cz))/.06+1:1,density=Math.max(1,layers/6);
        return 1-Math.pow(Math.max(.000001,1-alpha),1/density);
    };
    function resize(){
        const interacting=!!drag||snapTarget!==null||performance.now()<interactionUntil;
        const backInView=host19&&records.some(r=>2.125-(video.currentTime-r.time)*.6>(5.1-travel)*Math.cos(yaw));
        const dpr=opaqueFrames?Math.min(1.5,devicePixelRatio||1):interacting?(backInView?Math.min(1.25,devicePixelRatio||1):.65):Math.min(1.5,devicePixelRatio||1);
        if(displayScale===dpr&&canvas.width===Math.round(innerWidth*dpr)&&canvas.height===Math.round(innerHeight*dpr))return;
        displayScale=dpr;canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);gl.viewport(0,0,canvas.width,canvas.height);dirty=true;
    }
    function draw(now){requestAnimationFrame(draw);if(document.hidden||now-lastRender<((drag||snapTarget!==null||now<interactionUntil)?15:33))return;const elapsed=Math.min(.1,(now-lastRender)/1000);lastRender=now;animateSnap(elapsed);if(!drag&&snapTarget===null&&now>interactionUntil){const front=Math.round(yaw/(Math.PI*2))*Math.PI*2;if(Math.abs(yaw-front)<.026)yaw=front;}capture();if(host19&&!hostPresented)return;prepareOcclusion();resize();refreshDetails(now);uploadDetails(now);for(const item of detail.values()){const next=item.quality+(item.target-item.quality)*(1-Math.exp(-elapsed/.22));if(Math.abs(next-item.quality)>.0001){item.quality=next;dirty=true;}}if(!video.paused)dirty=true;if(!dirty)return;dirty=false;
        const start=performance.now();gl.useProgram(program);const plane=planeSize();gl.uniform2f(u.plane,plane.w,plane.h);gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);for(const [name,value]of Object.entries({yaw,zoom,aspect:innerWidth/innerHeight,travel,time:video.currentTime}))gl.uniform1f(u[name],value);
        const reverse=opaqueFrames?Math.cos(yaw)>=0:Math.cos(yaw)<0,ordered=reverse?[...pages].reverse():pages;drawCalls=0;
        gl.enable(gl.POLYGON_OFFSET_FILL);gl.polygonOffset(-1,-2);
        drawSurface(now);
        gl.disable(gl.POLYGON_OFFSET_FILL);
        gl.uniform1f(u.densityCompensation,1);gl.uniform2f(u.layerRange,2.125-(video.currentTime-(records[0]?.time||0))*.6,-.875);
        gl.depthMask(false);
        for(const p of ordered){
            buffers(p,reverse);
            // Draw atlas ranges in one call; substitute resident full-resolution frames without drawing duplicates.
            const rows=reverse?p.reversedRecords:p.liveRecords;let begin=0;
            const batch=end=>{if(end<=begin)return;gl.depthMask(opaqueFrames||(rows[begin].time>=video.currentTime-5&&rows[end-1].time>=video.currentTime-5));gl.uniform1f(u.detailBlend,-1);gl.bindTexture(gl.TEXTURE_2D,p.texture);gl.uniform2f(u.cell,atlas.tileW/atlas.width,atlas.tileH/atlas.height);gl.bindBuffer(gl.ARRAY_BUFFER,p.buffer);gl.vertexAttribPointer(slice,3,gl.FLOAT,false,12,begin*12);inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,end-begin);drawCalls++;};
            for(let i=0;i<rows.length;i++){const item=detail.get(rows[i].key);if(!item||item.quality<.005)continue;batch(i);gl.depthMask(opaqueFrames||rows[i].time>=video.currentTime-5);gl.uniform1f(u.detailBlend,item.quality);gl.uniform4f(u.thumbnailRect,rows[i].x,rows[i].y,atlas.tileW/atlas.width,atlas.tileH/atlas.height);gl.activeTexture(gl.TEXTURE1);gl.bindTexture(gl.TEXTURE_2D,p.texture);gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,item.texture);gl.uniform2f(u.cell,1,1);gl.bindBuffer(gl.ARRAY_BUFFER,detailBuffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([rows[i].time,0,0]),gl.STREAM_DRAW);gl.vertexAttribPointer(slice,3,gl.FLOAT,false,12,0);inst.drawArraysInstancedANGLE(gl.TRIANGLE_STRIP,0,4,1);drawCalls++;begin=i+1;}batch(rows.length);
        }

        const camera=5.1-travel,unit=innerHeight*zoom/(2*Math.max(.15,camera)),frontZ=2.125;
        livePlane.style.width=(plane.w*unit)+'px';livePlane.style.height=(plane.h*unit)+'px';liveSurface.style.width=innerWidth+'px';liveSurface.style.height=innerHeight+'px';
        livePlane.style.transform=`perspective(${Math.max(1,camera*unit)}px) rotateY(${yaw}rad) translateZ(${frontZ*unit}px) translate(-50%,-50%)`;
        liveSurface.style.transform=`scale(${plane.w*unit/innerWidth})`;
        const frontAngle=Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)));
        livePlane.style.visibility=!host19&&camera-frontZ>.06&&!drag&&snapTarget===null&&now>interactionUntil&&frontAngle<.0001?'visible':'hidden';
        const sharedView={type:'eac:slice-view',yaw,zoom,travel,quality:displayScale,planeWidth:plane.w,planeHeight:plane.h,depthPerSecond:.6,minTime:records[0]?.time||0,interacting:!!drag||snapTarget!==null||now<interactionUntil},clock={time:video.currentTime,paused:video.paused};
        if(typeof noteFrame.contentWindow?.EACSliceRender==='function')noteFrame.contentWindow.EACSliceRender(sharedView,clock);
        else{noteFrame.contentWindow?.postMessage(sharedView,location.origin);noteFrame.contentWindow?.postMessage({...clock,type:'eac:clock',visible:true,surfaceVisible:false},location.origin);}

        Object.assign(canvas.dataset,{captureRun:run,captureSession:String(session),compressedFrames:String(fallback.size),backDetailFrames:String([...selectedBackDetails].filter(key=>(detail.get(key)?.quality||0)>.8).length),frames:String(records.length),earliest:String(records[0]?.time||0),latest:String(records.at(-1)?.time||0),drawCalls:String(drawCalls),atlasPages:String(pages.length),detailFrames:String(detail.size),queuedUploads:String(decodedQueue.length),encoder:opaqueFrames?'uniform-atlas':encoderReady?'worker':'browser',encodingJobs:String(encodingJobs.size),sourceResolution:frame.width+'x'+frame.height,qualityMode:opaqueFrames?'uniform-medium':'adaptive',renderMs:(performance.now()-start).toFixed(1),frontMode:livePlane.style.visibility==='visible'?'native-video':'spatial',surfaceRefresh:Math.abs(Math.atan2(Math.sin(yaw),Math.cos(yaw)))<.15?'60':'12',displayScale:String(displayScale),retention:'latest-600',opaqueFrames:String(opaqueFrames),frontSnap:snapTarget===null?'idle':'settling',surfaceOcclusion:'per-pixel-depth',transparencyMode:'overlap-compensated',sliceGap:'0.06',sampleInterval:'0.1'});
        status.textContent=`${records.length} FRAMES · Z = TIME · ${video.currentTime.toFixed(1)} s${persistenceError?' · LOCAL IMAGE STORAGE UNAVAILABLE':''}`;
    }
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;beginDrag(e.screenX);livePlane.style.visibility='hidden';canvas.setPointerCapture(e.pointerId);video.play().catch(()=>{});});canvas.addEventListener('pointermove',e=>{if(!drag)return;moveDrag(e.screenX);});for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,endDrag);
    canvas.addEventListener('wheel',e=>{e.preventDefault();interactionUntil=performance.now()+180;livePlane.style.visibility='hidden';const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){const d=e.shiftKey?(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY):e.deltaX;travel=Math.max(-Math.max(12,video.currentTime*.6+5),Math.min(4,travel-d*unit*.006));}else zoom=Math.max(1,Math.min(22.8,zoom*Math.exp(-e.deltaY*unit*.001)));dirty=true;},{passive:false});canvas.addEventListener('dblclick',()=>{snapTarget=null;snapVelocity=0;yaw=0;travel=0;zoom=5.7;dirty=true;});
    addEventListener('message',event=>{if(event.origin!==location.origin||event.source!==liveSurface.contentWindow)return;if(event.data?.type==='eac:zoom'){interactionUntil=performance.now()+180;livePlane.style.visibility='hidden';zoom=Math.max(1,Math.min(22.8,zoom*Math.exp(-event.data.delta*.001)));dirty=true;}});
    video.addEventListener('loadeddata',()=>video.play().catch(()=>status.textContent='CLICK TO PLAY'));video.addEventListener('error',()=>status.textContent='Unable to load video.');addEventListener('resize',resize);resize();requestAnimationFrame(draw);
})();
