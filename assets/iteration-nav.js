(() => {
    const base=new URL('.',document.currentScript.src),file=name=>new URL(name,base).href;
    const query=new URLSearchParams(location.search);
    const archive=location.pathname.endsWith('/iterations.html'),portal=location.pathname.endsWith('/zoom-space.html');
    const entries=window.EAC_ITERATIONS||[],count=entries.length;
    const version=portal?entries.findIndex(entry=>entry[2]===(query.get('variant')==='19'?25:20))+1:archive?Math.max(1,Math.min(count,Number(query.get('version'))||1)):entries.findIndex(entry=>entry[2]===Number(query.get('iteration')))+1;
    const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href=file('iteration-navigation.css?v=selected-line-34');document.head.append(sheet);
    let host=document.getElementById('location-header');
    if(!host&&(archive||portal)){host=document.createElement('div');host.id='iteration-brand';document.body.append(host);}
    if(!host)return;
    if(portal){document.getElementById('surface').append(host);host.classList.add('surface-brand-host');}
    host.replaceChildren();host.style.setProperty('--iteration-count',count);host.classList.add('iteration-brand-host');host.setAttribute('aria-label','Visual iterations');
    const brand=document.createElement('div');brand.className='iteration-brand';
    const title=document.createElement('button');title.type='button';title.className='iteration-brand-title';title.setAttribute('aria-label','打开视觉迭代版本列表');title.setAttribute('aria-expanded','false');title.setAttribute('aria-controls','iteration-list');
    const heading=document.createElement('span');heading.className='iteration-brand-heading';heading.textContent='ITERATIONS';
    const state=document.createElement('span');state.className='iteration-brand-state';state.textContent=version?String(version).padStart(2,'0')+' / '+count:'01—'+count;
    const chevron=document.createElement('span');chevron.className='iteration-chevron';chevron.setAttribute('aria-hidden','true');chevron.textContent='⌄';title.append(heading,state,chevron);
    const code=document.createElement('nav');code.className='iteration-brand-code iteration-barcode-picker';code.setAttribute('aria-label','按时间顺序选择第 1 至 '+count+' 次迭代');
    brand.append(title,code);host.append(brand);
    const preview=document.createElement('div');preview.className='iteration-preview-card';preview.hidden=true;preview.setAttribute('aria-hidden','true');
    const previewNumber=document.createElement('span');previewNumber.className='iteration-preview-number';
    const previewName=document.createElement('strong');
    const previewImages=document.createElement('div');previewImages.className='iteration-preview-images';
    const previewCaption=document.createElement('div');previewCaption.className='iteration-preview-caption';previewCaption.append(previewNumber,previewName);preview.append(previewImages,previewCaption);host.append(preview);
    const panel=document.createElement('section');panel.id='iteration-list';panel.className='iteration-list';panel.hidden=true;panel.setAttribute('aria-label','全部视觉迭代');
    const panelHeading=document.createElement('div');panelHeading.className='iteration-list-heading';panelHeading.textContent='VISUAL ITERATIONS · 01—'+count;
    const grid=document.createElement('nav');grid.className='iteration-list-grid';grid.setAttribute('aria-label','第 1 次至第 '+count+' 次');
    const footer=document.createElement('a');footer.className='iteration-current-link';footer.href=file('zoom-space.html');footer.target='_top';footer.textContent='CURRENT VIEW ↗';if(!version)footer.setAttribute('aria-current','page');
    panel.append(panelHeading,grid,footer);host.append(panel);
    const links=[];
    function setOpen(open){if(open)for(const image of grid.querySelectorAll('img[data-src]')){image.src=image.dataset.src;delete image.dataset.src;}panel.hidden=!open;title.setAttribute('aria-expanded',String(open));host.classList.toggle('is-open',open);hidePreview();}
    let previewTimer=0,hideTimer=0,previewRequest=0,firstDeadline=0,displayedIndex=-1,cardAnimation=null,closingPreview=false;
    const thumbnailCache=new Map(),imageAnimations=new Map();
    function hidePreview(){
        clearTimeout(previewTimer);clearTimeout(hideTimer);previewRequest++;firstDeadline=0;displayedIndex=-1;preview.hidden=true;cardAnimation?.cancel();cardAnimation=null;closingPreview=false;
        for(const animation of imageAnimations.values())animation.cancel();
        imageAnimations.clear();previewImages.replaceChildren();
    }
    function revealCard(){
        if(matchMedia('(prefers-reduced-motion: reduce)').matches){closingPreview=false;return;}
        const style=getComputedStyle(preview),opacity=cardAnimation?style.opacity:'0',transform=cardAnimation?style.transform:'translateY(4px)';cardAnimation?.cancel();closingPreview=false;
        cardAnimation=preview.animate([{opacity,transform},{opacity:1,transform:'translateY(0)'}],{duration:180,easing:'cubic-bezier(.16,1,.3,1)',fill:'forwards'});
    }
    function dismissPreview(){
        clearTimeout(previewTimer);previewRequest++;firstDeadline=0;
        if(preview.hidden)return;
        if(matchMedia('(prefers-reduced-motion: reduce)').matches){hidePreview();return;}
        const style=getComputedStyle(preview),opacity=style.opacity,transform=style.transform;cardAnimation?.cancel();closingPreview=true;
        cardAnimation=preview.animate([{opacity,transform},{opacity:0,transform:'translateY(3px)'}],{duration:120,easing:'ease-out',fill:'forwards'});
        cardAnimation.onfinish=()=>{if(closingPreview)hidePreview();};
    }
    function thumbnail(index){
        if(!thumbnailCache.has(index))thumbnailCache.set(index,new Promise((resolve,reject)=>{
            const image=new Image(240,135);image.alt='';image.decoding='async';
            image.onload=async()=>{
                try{await image.decode();}catch{}
                preview.dataset.readyCount=String(Number(preview.dataset.readyCount||0)+1);resolve(image);
            };
            image.onerror=()=>{thumbnailCache.delete(index);reject();};
            image.src=file('iteration-previews/'+String(entries[index][2]).padStart(2,'0')+'.jpg');
        }));
        return thumbnailCache.get(index);
    }
    function fadeImage(image,to){
        const from=Number(getComputedStyle(image).opacity);
        imageAnimations.get(image)?.cancel();
        if(matchMedia('(prefers-reduced-motion: reduce)').matches){image.style.opacity=String(to);if(!to)image.remove();else if(image===previewImages.lastElementChild)for(const old of [...previewImages.children])if(old!==image)old.remove();return;}
        const animation=image.animate([{opacity:from},{opacity:to}],{duration:140,easing:'cubic-bezier(.2,.7,.2,1)',fill:'forwards'});
        imageAnimations.set(image,animation);
        animation.onfinish=()=>{
            if(imageAnimations.get(image)!==animation)return;
            image.style.opacity=String(to);animation.cancel();imageAnimations.delete(image);if(!to)image.remove();else if(image===previewImages.lastElementChild)for(const old of [...previewImages.children])if(old!==image)old.remove();
        };
    }
    function showPreview(index,immediate=false){
        if(!panel.hidden)return;
        clearTimeout(previewTimer);clearTimeout(hideTimer);
        const request=++previewRequest;
        if(preview.hidden&&!firstDeadline)firstDeadline=performance.now()+80;
        const delay=immediate||!preview.hidden?0:Math.max(0,firstDeadline-performance.now());
        const ready=thumbnail(index);ready.catch(()=>{});
        const display=async()=>{
            try{
                const image=await ready;if(request!==previewRequest||!panel.hidden)return;
                if(index===displayedIndex&&!preview.hidden&&!closingPreview)return;
                const first=preview.hidden;
                previewNumber.textContent=String(index+1).padStart(2,'0');previewName.textContent=entries[index][0];
                preview.dataset.version=String(index+1);preview.hidden=false;displayedIndex=index;
                if(first||closingPreview)revealCard();
                if(image.parentElement!==previewImages)image.style.opacity=first?'1':'0';
                previewImages.append(image);
                for(const previous of [...previewImages.children])if(previous!==image){const opacity=getComputedStyle(previous).opacity;imageAnimations.get(previous)?.cancel();imageAnimations.delete(previous);previous.style.opacity=opacity;}
                fadeImage(image,1);highlightTile(index);
            }catch{}
        };
        if(delay)previewTimer=setTimeout(display,delay);else display();
    }
    function makeLink(index,full){
        const n=index+1,[name]=entries[index],link=document.createElement('a');link.href=file(entries[index][2]===25?'zoom-space.html?variant=19&v=program-audit-113':entries[index][2]===20?'zoom-space.html?v=20261028-full-space-29':'iterations.html?version='+n);link.target='_top';
        link.setAttribute('aria-label','第 '+n+' 次 · '+name);if(n===version)link.setAttribute('aria-current','page');
        if(full){
            const image=document.createElement('img');image.dataset.src=file('iteration-previews/'+String(entries[index][2]).padStart(2,'0')+'.jpg');image.alt='';image.width=128;image.height=72;image.loading='lazy';image.decoding='async';
            const caption=document.createElement('span');caption.className='iteration-tile-caption';
            const number=document.createElement('span');number.textContent=String(n).padStart(2,'0');const label=document.createElement('span');label.textContent=name;caption.append(number,label);link.append(image,caption);
        }
        else{const line=document.createElement('span');line.className='iteration-bar';line.setAttribute('aria-hidden','true');link.append(line);}
        link.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();window.top.location.assign(link.href);});
        return link;
    }
    entries.forEach((_,index)=>{
        const link=makeLink(index,false);links.push(link);code.append(link);grid.append(makeLink(index,true));
        link.addEventListener('pointerenter',()=>showPreview(index));
        link.addEventListener('focus',()=>{showPreview(index,true);track(index);});link.addEventListener('blur',()=>{hideTimer=setTimeout(dismissPreview,80);if(!pointerTracking)track(null);});
        link.addEventListener('keydown',event=>{
            let next=index;if(event.key==='ArrowRight')next=(index+1)%count;else if(event.key==='ArrowLeft')next=(index+count-1)%count;else if(event.key==='Home')next=0;else if(event.key==='End')next=count-1;else return;
            event.preventDefault();event.stopPropagation();links[next].focus();
        });
    });
    let pointerTracking=false,motionFrame=0,lastMotionTime=0,followX=0,targetX=0,followVelocity=0,strength=0,targetStrength=0;
    const bars=links.map(link=>link.querySelector('.iteration-bar'));
    function track(index){
        if(index===null)targetStrength=0;
        else{targetX=index;if(!strength)followX=index;targetStrength=1;}
        if(!motionFrame){lastMotionTime=performance.now();motionFrame=requestAnimationFrame(animateTracking);}
    }
    function animateTracking(now){
        motionFrame=0;
        const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
        const dt=Math.min(.032,(now-lastMotionTime)/1000);lastMotionTime=now;
        if(reduced){followX=targetX;followVelocity=0;strength=targetStrength;}
        else{
            const omega=30,error=followX-targetX,decay=Math.exp(-omega*dt),term=followVelocity+omega*error;
            followX=targetX+(error+term*dt)*decay;followVelocity=(followVelocity-omega*term*dt)*decay;
            strength+=(targetStrength-strength)*(1-Math.exp(-dt/.065));
        }
        bars.forEach((bar,i)=>{
            const distance=(i-followX)/.62,weight=Math.exp(-distance*distance/2)*strength;
            const base=i===version-1?1+(1-strength)/3:1;
            const baseWidth=i===version-1?1+.5*(1-strength):1;
            bar.style.transform=`scale(${baseWidth+(1.5-baseWidth)*weight},${base+(13/9-base)*weight})`;
        });
        const moving=Math.abs(followX-targetX)>.001||Math.abs(followVelocity)>.01||Math.abs(strength-targetStrength)>.001;
        code.classList.toggle('is-tracking',moving||Boolean(targetStrength));
        if(moving)motionFrame=requestAnimationFrame(animateTracking);
    }
    code.addEventListener('pointermove',event=>{
        if(event.pointerType==='touch')return;
        const box=code.getBoundingClientRect();pointerTracking=true;
        track(Math.max(0,Math.min(count-1,(event.clientX-box.left)/box.width*count-.5)));
    });
    code.addEventListener('pointerleave',()=>{pointerTracking=false;track(null);hideTimer=setTimeout(dismissPreview,80);});
    function highlightTile(index){grid.querySelectorAll('a').forEach((link,i)=>link.classList.toggle('is-highlighted',i===index));}
    const stripTools=document.createElement('div');stripTools.className='iteration-strip-tools';
    for(const [label,delta]of [['←',-320],['→',320]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',delta<0?'向前浏览版本':'向后浏览版本');button.onclick=()=>grid.scrollBy({left:delta,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});stripTools.append(button);}
    panelHeading.append(stripTools);
    grid.addEventListener('wheel',event=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.preventDefault();grid.scrollLeft+=event.deltaY;}event.stopPropagation();},{passive:false});
    grid.querySelectorAll('a').forEach((link,index)=>link.addEventListener('keydown',event=>{if(event.key==='ArrowRight'||event.key==='ArrowLeft'){event.preventDefault();event.stopPropagation();grid.children[(index+(event.key==='ArrowRight'?1:count-1))%count].focus();}}));
    title.addEventListener('click',()=>{setOpen(panel.hidden);if(!panel.hidden)(grid.querySelector('a[aria-current]')||grid.querySelector('a'))?.scrollIntoView({block:'nearest',inline:'nearest'});});
    title.addEventListener('keydown',event=>{if(event.key==='ArrowDown'){event.preventDefault();event.stopPropagation();setOpen(true);(grid.querySelector('a[aria-current]')||grid.querySelector('a'))?.focus();}});
    host.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();setOpen(false);hidePreview();title.focus();}else if(['ArrowLeft','ArrowRight','Home','End'].includes(event.key))event.stopPropagation();});
    document.addEventListener('pointerdown',event=>{if(!host.contains(event.target)){setOpen(false);hidePreview();}});
    host.addEventListener('wheel',event=>event.stopPropagation(),{passive:true});
    if(portal)new MutationObserver(()=>{if(document.getElementById('surface').style.opacity==='0'){setOpen(false);hidePreview();if(host.contains(document.activeElement))document.activeElement.blur();}}).observe(document.getElementById('surface'),{attributes:true,attributeFilter:['style']});
})();
