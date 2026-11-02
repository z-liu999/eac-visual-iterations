(() => {
    const overlay=document.getElementById('loading'),front=document.getElementById('surface-frame');
    const label=document.getElementById('loading-label'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
    let leaderRaf=0,leaderSample=null,velocity={x:0,y:0};
    let motion=null,motionTimer=0,motionActive=false,motionTicket=0,position={x:0,y:0};
    function limits(){const margin=innerWidth<600?76:112;return {min:margin,x:Math.max(margin,innerWidth-label.offsetWidth-margin),y:Math.max(margin,innerHeight-label.offsetHeight-margin)};}
    function followLeader(now){
        if(!motionActive||overlay.hidden)return;
        const rect=label.getBoundingClientRect();
        if(leaderSample){
            const dt=Math.max(.001,Math.min(.1,(now-leaderSample.time)/1000)),mix=1-Math.exp(-dt/.065);
            velocity.x+=((rect.x-leaderSample.x)/dt-velocity.x)*mix;velocity.y+=((rect.y-leaderSample.y)/dt-velocity.y)*mix;
            const speed=Math.hypot(velocity.x,velocity.y);
            if(speed>3){
                const right=velocity.x>=0,bottom=velocity.y>0;
                label.style.setProperty('--leader-x',right?'100%':'0%');label.style.setProperty('--leader-y',bottom?'100%':'0%');
                label.style.setProperty('--leader-angle',Math.atan2(velocity.y,velocity.x)*180/Math.PI+'deg');
                label.dataset.corner=(bottom?'bottom-':'top-')+(right?'right':'left');
            }
            const length=12+Math.min(innerWidth<600?52:84,speed*.24);
            label.style.setProperty('--leader-length',length.toFixed(1)+'px');label.dataset.speed=speed.toFixed(1);
        }
        leaderSample={x:rect.x,y:rect.y,time:now};leaderRaf=requestAnimationFrame(followLeader);
    }
    function stopMotion(){cancelAnimationFrame(leaderRaf);leaderSample=null;velocity={x:0,y:0};motionActive=false;motionTicket++;clearTimeout(motionTimer);motionTimer=0;motion?.cancel();motion=null;}
    function wander(){
        if(!motionActive||overlay.hidden)return;
        const bound=limits(),previous={...position};
        position={x:Math.max(bound.min,Math.min(bound.x,previous.x+(Math.random()-.5)*Math.min(600,innerWidth*.65))),y:Math.max(bound.min,Math.min(bound.y,previous.y+(Math.random()-.5)*Math.min(400,innerHeight*.6)))};
        const distance=Math.hypot(position.x-previous.x,position.y-previous.y),ticket=motionTicket;
        motion=label.animate([{transform:`translate(${previous.x}px,${previous.y}px)`},{transform:`translate(${position.x}px,${position.y}px)`}],{duration:Math.max(1100,Math.min(2900,distance*8)),easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'});
        motion.onfinish=()=>{if(!motionActive||ticket!==motionTicket)return;label.style.transform=`translate(${position.x}px,${position.y}px)`;motion.cancel();motion=null;motionTimer=setTimeout(wander,150+Math.random()*450);};
    }
    function startMotion(){
        if(motionActive)return;motionActive=true;motionTicket++;
        const bound=limits();position={x:Math.min(bound.x,Math.max(bound.min,(innerWidth-label.offsetWidth)/2)),y:Math.min(bound.y,Math.max(bound.min,(innerHeight-label.offsetHeight)/2))};
        label.style.transform=`translate(${position.x}px,${position.y}px)`;
        if(!reduced.matches){leaderRaf=requestAnimationFrame(followLeader);wander();}
    }
    addEventListener('resize',()=>{if(!overlay.hidden){stopMotion();startMotion();}});
    reduced.addEventListener('change',()=>{if(!overlay.hidden){stopMotion();startMotion();}});
    let video=null,shownOnce=false,lastTime=-1,lastAdvance=performance.now(),state='buffering',resumeTime=0,ownsPause=false,checking=false;
    function show(){overlay.hidden=false;startMotion();document.body.setAttribute('aria-busy','true');}
    function hide(){overlay.hidden=true;if(motionActive)stopMotion();document.body.setAttribute('aria-busy','false');shownOnce=true;state='visible';}
    function bufferedAhead(){
        if(!video)return 0;
        for(let i=0;i<video.buffered.length;i++)if(video.buffered.start(i)<=video.currentTime+.05&&video.buffered.end(i)>video.currentTime)return video.buffered.end(i)-video.currentTime;
        return 0;
    }
    function pendingView(){
        try{if(Number(document.body.dataset.zoom||0)>=.12)return !document.getElementById('trails-frame').contentDocument?.getElementById('trajectories')?.dataset.total;}catch{}
        return false;
    }
    function enterBuffer(){
        state='buffering';show();
        if(video&&(!video.paused||!shownOnce)){ownsPause=true;video.pause();}
    }
    function inspect(){
        if(checking)return;checking=true;
        try{
            if(!video){show();return;}
            const now=performance.now(),time=video.currentTime,ahead=bufferedAhead();
            if(Math.abs(time-lastTime)>.001){lastTime=time;lastAdvance=now;}
            overlay.dataset.bufferedAhead=ahead.toFixed(2);overlay.dataset.phase=state;
            const waiting=video.seeking||video.readyState<3||(!video.paused&&!video.ended&&now-lastAdvance>1000);
            if(state==='visible'){
                if((!video.paused&&waiting)||pendingView())enterBuffer();
                return;
            }
            show();
            if(state==='confirming'){
                if(waiting){enterBuffer();return;}
                if(video.paused&&!ownsPause){hide();return;}
                if(time-resumeTime>=.6&&!pendingView()){hide();return;}
                return;
            }
            const remaining=Number.isFinite(video.duration)?Math.max(.1,video.duration-time-.05):Infinity;
            const required=Math.min(shownOnce?1.5:2,remaining);
            if(video.readyState>=3&&!video.seeking&&ahead>=required&&!pendingView()){
                if(video.paused&&!ownsPause&&shownOnce){hide();return;}
                state='confirming';resumeTime=time;lastAdvance=now;ownsPause=false;
                video.play().catch(()=>{if(state==='confirming'){state='buffering';ownsPause=true;}});
            }else if(!video.paused){ownsPause=true;video.pause();}
        }finally{checking=false;}
    }
    function bind(){
        const next=front.contentDocument?.getElementById('video');
        if(!next||next===video)return;
        video=next;shownOnce=false;state='buffering';ownsPause=true;lastTime=video.currentTime;lastAdvance=performance.now();show();
        for(const type of ['waiting','seeking','emptied','error'])video.addEventListener(type,()=>{if(!video.paused||!shownOnce)enterBuffer();inspect();});
        for(const type of ['playing','seeked','canplay','progress','loadedmetadata','pause','play'])video.addEventListener(type,inspect);
        inspect();
    }
    front.addEventListener('load',bind);bind();setInterval(()=>{if(!video)bind();inspect();},150);
    show();
})();
