(() => {
    const sharedNotes=new URLSearchParams(location.search).has('notes');
    if(sharedNotes){const script=document.createElement('script');script.src='video-depth-retained.js?v=original-video-126';document.body.append(script);return;}
    const withNotes=false;
    let noteFrame=null;
    if(sharedNotes){
        noteFrame=document.createElement('iframe');noteFrame.src='trajectories.html?embedded=1&videoSlices=1&v=shared-line-scale-51';noteFrame.title='Code time trajectories';Object.assign(noteFrame.style,{position:'absolute',inset:'0',width:'100%',height:'100%',border:'0',background:'transparent',pointerEvents:'none'});document.body.append(noteFrame);
    }
    const fadeFrames=new URLSearchParams(location.search).get('fade')!=='0';
    const canvas=document.getElementById('frames'),video=document.getElementById('video'),status=document.getElementById('status');
    if(window.EACMediaLoader){window.EACMediaLoader.prepare(video.dataset.src).then(source=>{video.src=source;video.load();}).catch(()=>{status.textContent='Unable to load video. Please refresh to retry.';});}else{video.src=video.dataset.src;video.load();}
    const gl=canvas.getContext('webgl',{alpha:false,antialias:true});
    if(!gl){status.textContent='WebGL is required to view video frames in depth.';return;}
    function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s;}
    const program=gl.createProgram();
    gl.attachShader(program,shader(gl.VERTEX_SHADER,`attribute vec2 position; varying vec2 uv; uniform float yaw, depth, zoom, aspect, travel;uniform vec4 rect; void main(){uv=vec2(position.x+.5,.5-position.y);vec3 p=vec3((position.x*rect.z+rect.x)*1.65,(position.y*rect.w+rect.y)*.928125,depth);float c=cos(yaw),s=sin(yaw);vec3 r=vec3(p.x*c+p.z*s,p.y,-p.x*s+p.z*c);r.z+=travel;float camera=5.1;gl_Position=vec4(r.x*zoom/aspect,r.y*zoom,(camera-r.z)*.4-1.0,camera-r.z);}`));
    gl.attachShader(program,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying vec2 uv;uniform sampler2D frame;uniform float opacity;void main(){vec4 color=texture2D(frame,uv);gl_FragColor=vec4(color.rgb,color.a*opacity);}`));
    gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-.5,-.5,.5,-.5,-.5,.5,.5,.5]),gl.STATIC_DRAW);
    const pos=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
    const uniforms={};for(const name of ['yaw','depth','zoom','aspect','opacity','travel','rect'])uniforms[name]=gl.getUniformLocation(program,name);
    gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(1,1,1,1);
    const sample=document.createElement('canvas');sample.width=480;sample.height=270;const paint=sample.getContext('2d');
    const slices=[];let yaw=0,travel=0,zoom=5.7,drag=null,lastCapture=-Infinity,lastTime=0,lastRender=0,dirty=true,stopped=false;
    let noteData=[];
    if(withNotes)fetch('trajectories-data.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(d=>{noteData=d.entries;dirty=true;}).catch(()=>status.textContent='Unable to load annotations.');
    const labelCache=new Map();
    function labelTexture(note,point){
        const old=labelCache.get(note.id);
        const key=[Math.round(point[0]*1920),Math.round(point[1]*1080),point[2].toFixed(1)].join(':');
        if(old?.key===key)return old.texture;
        const image=document.createElement('canvas');image.width=600;image.height=180;const c=image.getContext('2d');c.scale(2,2);c.font='12px "Courier New",monospace';c.textBaseline='top';
        const rows=[['note.text = ',JSON.stringify(note.text)+';','#ce9178'],['note.x = ',Math.round(point[0]*1920)+'; note.y = '+Math.round(point[1]*1080)+';','#b5cea8'],['note.z = ',point[2].toFixed(2)+'; // seconds','#b5cea8']];
        let y=0;for(const [prefix,value,color]of rows){c.fillStyle='#9cdcfe';c.fillText(prefix,0,y);let x=c.measureText(prefix).width;c.fillStyle=color;for(const char of value){if(x>280){x=0;y+=15;}if(y>75)break;c.fillText(char,x,y);x+=c.measureText(char).width;}y+=15;}
        const texture=old?.texture||gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);labelCache.set(note.id,{texture,key});return texture;
    }
    let lineProgram,lineBuffer,linePosition,lineAlpha;
    if(withNotes){
        lineProgram=gl.createProgram();gl.attachShader(lineProgram,shader(gl.VERTEX_SHADER,`attribute vec3 point;attribute float alpha;varying float fade;uniform float yaw,zoom,aspect,travel;void main(){float c=cos(yaw),s=sin(yaw);vec3 r=vec3(point.x*c+point.z*s,point.y,-point.x*s+point.z*c);r.z+=travel;float d=5.1-r.z;gl_Position=vec4(r.x*zoom/aspect,r.y*zoom,d*.4-1.,d);gl_PointSize=3.;fade=alpha;}`));gl.attachShader(lineProgram,shader(gl.FRAGMENT_SHADER,`precision mediump float;varying float fade;void main(){gl_FragColor=vec4(0.,0.,0.,fade);}`));gl.linkProgram(lineProgram);lineBuffer=gl.createBuffer();linePosition=gl.getAttribLocation(lineProgram,'point');lineAlpha=gl.getAttribLocation(lineProgram,'alpha');
    }
    function clear(){for(const s of slices)gl.deleteTexture(s.texture);slices.length=0;lastCapture=-Infinity;}
    function capture(){
        const t=video.currentTime;if(t<lastTime-.5)clear();lastTime=t;
        if(video.readyState<2||Math.floor((t+1e-6)*10)<=lastCapture)return;
        lastCapture=Math.floor((t+1e-6)*10);paint.drawImage(video,0,0,480,270);
        const texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGB,gl.RGB,gl.UNSIGNED_BYTE,sample);
        slices.push({texture,time:t});
        if(slices.length>360){for(let i=88;i>=0;i-=2){gl.deleteTexture(slices[i].texture);slices.splice(i,1);}}
        dirty=true;status.textContent=`${slices.length} FRAMES · Z = TIME · ${t.toFixed(1)} s`;
    }
    function retainedOpacity(age){
        if(!fadeFrames)return 1;
        if(age<=5)return 1;
        if(age<6.5){const t=(age-5)/1.5;return 1-.8*(t*t*(3-2*t));}
        return .2-.1*Math.min(1,(age-6.5)/53.5);
    }
    function resize(){const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(innerWidth*dpr);canvas.height=Math.round(innerHeight*dpr);gl.viewport(0,0,canvas.width,canvas.height);dirty=true;}
    function render(now){requestAnimationFrame(render);if(document.hidden||now-lastRender<30)return;lastRender=now;capture();if(!video.paused)dirty=true;if(!dirty)return;dirty=false;gl.useProgram(program);gl.depthMask(true);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.uniform1f(uniforms.yaw,yaw);gl.uniform1f(uniforms.travel,travel);gl.uniform1f(uniforms.zoom,zoom);gl.uniform1f(uniforms.aspect,innerWidth/innerHeight);
        const first=slices[0]?.time||0,latest=slices.at(-1)?.time||0;
        const back=Math.exp((first-latest)/12),range=Math.max(1-back,1e-6);
        const fill=Math.min(1,(latest-first)/12);
        const sliceDepth=time=>sharedNotes?(time/Math.max(30,video.currentTime)-.5)*4.25:((Math.exp((time-latest)/12)-back)/range*fill-.5)*4.25;
        gl.useProgram(program);
        const commands=slices.map(s=>({...s,z:sliceDepth(s.time),rect:[0,0,1,1],opacity:retainedOpacity(Math.max(0,video.currentTime-s.time))}));
        const c=Math.cos(yaw),s=Math.sin(yaw),cameraDepth=(x,z)=>-x*s+z*c+travel;
        let annotationCount=0;
        if(withNotes){
            const world=p=>[(p[0]-.5)*1.65,(.5-p[1])*.928125,sliceDepth(p[2])];
            for(const note of noteData){
                if(note.start>video.currentTime||note.start<first)continue;
                let point=note.path[0];const alpha=retainedOpacity(video.currentTime-note.start);
                if(note.moving){for(let i=1;i<note.path.length;i++){
                    const a=note.path[i-1],b=note.path[i];if(a[2]>video.currentTime)break;
                    const f=Math.min(1,Math.max(0,(video.currentTime-a[2])/(b[2]-a[2]||1)));point=a.map((v,j)=>v+(b[j]-v)*f);
                    const start=world(a),end=world(point);commands.push({line:[start,end],opacity:alpha,order:cameraDepth((start[0]+end[0])/2,(start[2]+end[2])/2)});if(f<1)break;
                }}else{const p=world(point);commands.push({dot:p,opacity:alpha,order:cameraDepth(p[0],p[2])});}
                const age=video.currentTime-note.start,z=sliceDepth(point[2]),x=point[0]-.5+.01+.1875;
                commands.push({texture:labelTexture(note,point),z,rect:[x,.5-point[1]-.01-.05625,.375,.1125],opacity:age<6.5?alpha:.2-.05*Math.min(1,(age-6.5)/53.5),order:cameraDepth(x*1.65,z)+.001});annotationCount++;
            }
        }
        for(const item of commands)if(item.order===undefined)item.order=cameraDepth(0,item.z);
        commands.sort((a,b)=>a.order-b.order);
        function projected(p){const d=5.1-cameraDepth(p[0],p[2]);return {x:(p[0]*c+p[2]*s)*zoom/(innerWidth/innerHeight)/d,y:p[1]*zoom/d,d};}
        function offset(p,dx,dy,alpha){const d=projected(p).d,rx=dx*d*(innerWidth/innerHeight)/zoom;return [p[0]+rx*c,p[1]+dy*d/zoom,p[2]+rx*s,alpha];}
        const opaque=commands.filter(item=>item.opacity>=.999999),transparent=commands.filter(item=>item.opacity<.999999);
        for(const item of [...opaque,...transparent]){
            gl.depthMask(item.opacity>=.999999);
            if(item.line||item.dot){
                gl.useProgram(lineProgram);for(const [name,value]of Object.entries({yaw,zoom,aspect:innerWidth/innerHeight,travel}))gl.uniform1f(gl.getUniformLocation(lineProgram,name),value);
                let vertices;if(item.line){const [a,b]=item.line,pa=projected(a),pb=projected(b),dx=(pb.x-pa.x)*innerWidth,dy=(pb.y-pa.y)*innerHeight,len=Math.hypot(dx,dy);if(len<.001)continue;const nx=-dy/len*3/innerWidth,ny=dx/len*3/innerHeight,a1=offset(a,nx,ny,item.opacity),a2=offset(a,-nx,-ny,item.opacity),b1=offset(b,nx,ny,item.opacity),b2=offset(b,-nx,-ny,item.opacity);vertices=[...a1,...a2,...b1,...b1,...a2,...b2];}else vertices=[...item.dot,item.opacity];
                gl.bindBuffer(gl.ARRAY_BUFFER,lineBuffer);gl.enableVertexAttribArray(linePosition);gl.enableVertexAttribArray(lineAlpha);gl.vertexAttribPointer(linePosition,3,gl.FLOAT,false,16,0);gl.vertexAttribPointer(lineAlpha,1,gl.FLOAT,false,16,12);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(vertices),gl.DYNAMIC_DRAW);gl.drawArrays(item.line?gl.TRIANGLES:gl.POINTS,0,vertices.length/4);gl.disableVertexAttribArray(lineAlpha);
            }else{
                gl.useProgram(program);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);gl.uniform4fv(uniforms.rect,item.rect);gl.uniform1f(uniforms.opacity,item.opacity);gl.uniform1f(uniforms.depth,item.z);gl.bindTexture(gl.TEXTURE_2D,item.texture);gl.drawArrays(gl.TRIANGLE_STRIP,0,4);
            }
        }
        gl.useProgram(program);canvas.dataset.annotations=annotationCount;
        if(noteFrame?.contentWindow){
            noteFrame.contentWindow.postMessage({type:'eac:slice-view',yaw,zoom,travel},location.origin);
            noteFrame.contentWindow.postMessage({type:'eac:clock',time:video.currentTime,paused:video.paused,visible:true,surfaceVisible:false},location.origin);
        }
        canvas.dataset.occlusion='opaque-depth-transparent-sorted';canvas.dataset.travel=travel;canvas.dataset.sampleInterval='0.1';canvas.dataset.oldestOpacity=slices.length?retainedOpacity(video.currentTime-slices[0].time):1;canvas.dataset.frames=slices.length;canvas.dataset.yaw=yaw;canvas.dataset.earliest=first;canvas.dataset.latest=slices.at(-1)?.time||0;
    }
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;drag={x:e.clientX,yaw};canvas.setPointerCapture(e.pointerId);video.play().catch(()=>{});});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw=drag.yaw+(e.clientX-drag.x)*.006;dirty=true;});
    for(const event of ['pointerup','pointercancel'])canvas.addEventListener(event,()=>drag=null);
    canvas.addEventListener('wheel',e=>{
        e.preventDefault();
        const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;
        if(e.shiftKey||Math.abs(e.deltaX)>Math.abs(e.deltaY)){
            const delta=e.shiftKey?(Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY):e.deltaX;
            travel=Math.max(-12,Math.min(4,travel-delta*unit*.006));
        }else zoom=Math.max(1,Math.min(5.7*4,zoom*Math.exp(-e.deltaY*unit*.001)));
        dirty=true;
    },{passive:false});
    canvas.addEventListener('dblclick',()=>{yaw=0;travel=0;zoom=5.7;dirty=true;});
    video.addEventListener('error',()=>status.textContent='Unable to load video.');
    video.addEventListener('loadeddata',()=>{video.play().then(()=>{stopped=false;}).catch(()=>{stopped=true;status.textContent='CLICK TO PLAY';});});
    canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();status.textContent='Graphics paused. Refresh to resume.';});
    window.EACVideoDepthView={set(value){if(Number.isFinite(value.yaw))yaw=value.yaw;if(Number.isFinite(value.zoom))zoom=Math.max(1,Math.min(22.8,value.zoom));if(Number.isFinite(value.travel))travel=value.travel;dirty=true;},get(){return {yaw,zoom,travel};}};
    addEventListener('resize',resize);resize();requestAnimationFrame(render);
})();
