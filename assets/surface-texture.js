window.EACSurfaceTexture={paint(sheet,frame,{width,height,outWidth=960}){
    const doc=frame?.contentDocument,video=doc?.getElementById('video');
    if(!video||video.readyState<2||!width||!height)return false;
    const paint=sheet.getContext('2d',{alpha:false});
        const outHeight=Math.max(1,Math.round(outWidth*height/width));
        if(sheet.width!==outWidth||sheet.height!==outHeight){sheet.width=outWidth;sheet.height=outHeight;}
        const vw=video.videoWidth,vh=video.videoHeight,ratio=Math.max(outWidth/vw,outHeight/vh);
        paint.drawImage(video,(outWidth-vw*ratio)/2,(outHeight-vh*ratio)/2,vw*ratio,vh*ratio);
        const sx=outWidth/frame.contentWindow.innerWidth,sy=outHeight/frame.contentWindow.innerHeight;
        paint.save();paint.scale(sx,sy);paint.font='14px Arial';paint.textBaseline='top';
        for(const label of doc.querySelectorAll('#notes .note')){
            if(label.style.display==='none'||label.hidden)continue;
            const box=label.getBoundingClientRect();
            if(!box.width||!box.height||box.bottom<0||box.top>frame.contentWindow.innerHeight)continue;
            paint.fillStyle='#000c';paint.fillRect(box.left,box.top,box.width,box.height);
            paint.fillStyle='#fff';
            const words=label.textContent.split(/\s+/);let line='',y=box.top+6;
            for(const word of words){if(line&&paint.measureText(line+' '+word).width>box.width-12){paint.fillText(line,box.left+6,y);line=word;y+=18;}else line+=(line?' ':'')+word;}
            if(line)paint.fillText(line,box.left+6,y);
        }
        const brand=doc.querySelector('#location-header .iteration-brand-title');
        if(brand){
            const box=brand.getBoundingClientRect();paint.fillStyle='#121212';paint.fillRect(box.left,box.top,box.width,box.height);
            paint.font='11px "Courier New",Courier,monospace';paint.fillStyle='white';paint.fillText(doc.querySelector('.iteration-brand-heading').textContent,box.left+8,box.top+7);
            paint.font='10px "Courier New",Courier,monospace';paint.fillStyle='#b1b1b1';paint.fillText(doc.querySelector('.iteration-brand-state').textContent,box.left+86,box.top+7);
            paint.fillStyle='#121212';
            for(const bar of doc.querySelectorAll('#location-header .iteration-bar')){const rect=bar.getBoundingClientRect();paint.save();paint.globalAlpha=Number(frame.contentWindow.getComputedStyle(bar).opacity);paint.fillRect(rect.left,rect.top,rect.width,rect.height);paint.restore();}
        }
        const clock=doc.getElementById('clock');
        if(clock){paint.font='30px Arial';paint.fillStyle='#000c';paint.fillRect(frame.contentWindow.innerWidth-112,frame.contentWindow.innerHeight-60,92,40);paint.fillStyle='white';paint.fillText(clock.textContent,frame.contentWindow.innerWidth-105,frame.contentWindow.innerHeight-55);}
        const logo=doc.querySelector('#about img');if(logo?.complete)paint.drawImage(logo,frame.contentWindow.innerWidth-80,20,55,32);
        paint.restore();
return true;
}};
