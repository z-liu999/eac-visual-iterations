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
            return {box,line,i,get reading(){return reading;},x:0,y:0,placed:false};
        });
        const video=document.getElementById('video'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
        function paint(){
            const w=layer.clientWidth,h=layer.clientHeight,t=reduced.matches?0:video.currentTime;
            for(const item of items){
                const {box,line,i}=item,bw=box.offsetWidth,bh=box.offsetHeight;
                if(!item.reading||!item.placed){
                    const center=[.18,.50,.82][i],height=[.20,.36,.23][i];
                    item.x=Math.max(6,Math.min(w-bw-6,w*(center+.012*Math.sin(t*.16+i))-bw/2));
                    item.y=Math.max(62,Math.min(h-bh-70,h*(height+.018*Math.sin(t*.13+i*2))));item.placed=true;
                }
                box.style.transform=`translate(${item.x}px,${item.y}px)`;
                const right=i!==2,anchorX=Math.max(0,Math.min(w,item.x+(right?bw+24:-24)+12*Math.sin(t*.11+i)));
                const anchorY=Math.min(h-12,item.y+bh+30);
                line.setAttribute('x1',item.x+(right?bw:0));line.setAttribute('y1',item.y+bh);
                line.setAttribute('x2',anchorX);line.setAttribute('y2',anchorY);
            }
            requestAnimationFrame(paint);
        }
        requestAnimationFrame(paint);
    }).catch(error=>{const message=document.createElement('p');message.textContent='Unable to load writing drafts. Please reload.';message.style.cssText='color:white;background:#000c;padding:8px';layer.append(message);console.error(error);});
})();
