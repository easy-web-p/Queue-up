import { readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
const CHROME='/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const font='node_modules/bootstrap-icons/font/fonts/bootstrap-icons.woff2';
writeFileSync('.vr/.d.html', `<!doctype html><meta charset="utf-8">
<style>@font-face{font-family:"probe";src:url("${pathToFileURL(font).href}") format("woff2");}</style>
<canvas id="c" width="64" height="64"></canvas>`);
const b=await chromium.launch({executablePath:CHROME});
const p=await b.newPage();
await p.goto(pathToFileURL('.vr/.d.html').href,{waitUntil:'load'});
await p.evaluate(()=>document.fonts.ready);
const r=await p.evaluate(()=>{
  const c=document.getElementById('c'), x=c.getContext('2d',{willReadFrequently:true});
  const ink=(cp)=>{ x.clearRect(0,0,64,64); x.font='48px probe'; x.textBaseline='top';
    x.fillText(String.fromCodePoint(cp),8,8);
    const d=x.getImageData(0,0,64,64).data; let n=0;
    for(let i=3;i<d.length;i+=4) if(d[i]>0) n++;
    return n; };
  return { loaded: document.fonts.check('48px probe'),
           cart: ink(0xF242), storm: ink(0xF64A), blank: ink(0x20) };
});
console.log(JSON.stringify(r,null,2));
await b.close();
