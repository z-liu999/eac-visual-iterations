let chain=Promise.resolve();
const supported=typeof OffscreenCanvas!=='undefined'&&typeof OffscreenCanvas.prototype.convertToBlob==='function';
postMessage({type:'ready',supported});
const surface=supported?new OffscreenCanvas(1280,720):null;
const paint=surface?.getContext('2d',{alpha:false});
onmessage=event=>{
    const {id,bitmap}=event.data;
    chain=chain.then(async()=>{
        try{
            if(!paint)throw Error('Background encoder unavailable');
            paint.drawImage(bitmap,0,0,surface.width,surface.height);
            const blob=await surface.convertToBlob({type:'image/jpeg',quality:.92});
            bitmap.close();postMessage({type:'encoded',id,blob});
        }catch{postMessage({type:'fallback',id,bitmap},[bitmap]);}
    });
};
