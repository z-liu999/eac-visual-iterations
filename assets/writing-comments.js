// Present the author's three drafts as simulated comments, not stored user annotations.
(() => {
    if (!window.EAC_NO_ANNOTATIONS || !new URLSearchParams(location.search).has('surface')) return;
    const base = new URL('.', document.currentScript.src);
    const style = document.createElement('style');
    style.textContent = `
      #writing-comments{position:absolute;inset:0;z-index:6;pointer-events:none;overflow:hidden}
      .writing-comment{position:absolute;box-sizing:border-box;width:clamp(220px,24vw,340px);max-height:54vh;overflow:auto;background:rgba(0,0,0,.8);color:white;padding:6px 8px;font:14px/1.35 Arial,sans-serif;pointer-events:auto;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-color:#aaa transparent}
      .writing-comment h2{font:inherit;font-weight:bold;margin:0 0 10px}
      .writing-comment p{margin:0 0 12px;white-space:normal}
      .writing-comment p:last-child{margin-bottom:0}
      #writing-leaders{position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none}
      #writing-leaders line{stroke:rgba(0,0,0,.5);stroke-width:2}
      @media(max-width:760px){.writing-comment{width:30vw;min-width:0;max-height:64vh;font-size:12px;padding:5px}}
    `;
    document.head.append(style);
    const layer = document.createElement('section');
    layer.id = 'writing-comments';layer.setAttribute('aria-label','Three writing drafts');
    const svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
    svg.id='writing-leaders';svg.setAttribute('aria-hidden','true');layer.append(svg);
    document.getElementById('stage').append(layer);
    fetch(new URL('writing-drafts.json?v=writing-131',base)).then(r=>{if(!r.ok)throw Error('Unable to load writing drafts');return r.json();}).then(drafts=>{
        const items=drafts.map((draft,i)=>{
            const box=document.createElement('article');box.className='writing-comment';box.tabIndex=0;
            box.setAttribute('aria-label',draft.title);box.dataset.draft=String(i+1);
            const heading=document.createElement('h2');heading.textContent=draft.title;box.append(heading);
            for(const text of draft.paragraphs){const p=document.createElement('p');p.textContent=text;box.append(p);}
            const line=document.createElementNS(svg.namespaceURI,'line');svg.append(line);layer.append(box);
            let reading=false;for(const type of ['pointerenter','focusin'])box.addEventListener(type,()=>reading=true);
            for(const type of ['pointerleave','focusout'])box.addEventListener(type,()=>reading=false);
            for(const type of ['wheel','pointerdown','keydown','gesturestart','gesturechange'])box.addEventListener(type,e=>e.stopPropagation());
            return {box,line,i,get reading(){return reading;},x:0,y:0,vx:0,vy:0,turnIn:0,placed:false};
        });
        const reduced=matchMedia('(prefers-reduced-motion: reduce)');
        let lastTime=0;
        function chooseDirection(item){
            const angle=Math.random()*Math.PI*2,speed=90+Math.random()*70;
            item.vx=Math.cos(angle)*speed;item.vy=Math.sin(angle)*speed;
            item.turnIn=.8+Math.random()*1.6;
        }
        function paint(now){
            const dt=lastTime?Math.min(.05,(now-lastTime)/1000):0;lastTime=now;
            const w=layer.clientWidth,h=layer.clientHeight;
            for(const item of items){
                const {box,line,i}=item,bw=box.offsetWidth,bh=box.offsetHeight;
                const minX=6,maxX=Math.max(minX,w-bw-6),minY=62,maxY=Math.max(minY,h-bh-65);
                if(!item.placed){
                    item.x=Math.max(minX,Math.min(maxX,w*[.18,.50,.82][i]-bw/2));
                    item.y=minY+Math.random()*(maxY-minY);item.placed=true;chooseDirection(item);
                }
                if(!item.reading&&!reduced.matches){
                    item.turnIn-=dt;if(item.turnIn<=0)chooseDirection(item);
                    item.x+=item.vx*dt;item.y+=item.vy*dt;
                    if(item.x<=minX||item.x>=maxX)item.vx=(item.x<=minX?1:-1)*Math.abs(item.vx);
                    if(item.y<=minY||item.y>=maxY)item.vy=(item.y<=minY?1:-1)*Math.abs(item.vy);
                }
                item.x=Math.max(minX,Math.min(maxX,item.x));item.y=Math.max(minY,Math.min(maxY,item.y));
                box.style.transform=`translate(${item.x}px,${item.y}px)`;
                const right=item.vx>=0;
                line.setAttribute('x1',item.x+(right?bw:0));line.setAttribute('y1',item.y+bh);
                line.setAttribute('x2',Math.max(0,Math.min(w,item.x+(right?bw+30:-30))));
                line.setAttribute('y2',Math.min(h-12,item.y+bh+30));
            }
            requestAnimationFrame(paint);
        }
        requestAnimationFrame(paint);
    }).catch(error=>{const message=document.createElement('p');message.textContent='Unable to load writing drafts. Please reload.';message.style.cssText='color:white;background:#000c;padding:8px';layer.append(message);console.error(error);});
})();
