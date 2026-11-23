import {outline,bookLeaf} from './profily.js';
// Monoline symbols for the five editing tools. Visible labels carry their meaning.
const strokes={
  model:'M4 19h16M6 16h12v3H6zM8 16V8a4 4 0 0 1 8 0v8',
  profil:'M3 19h18M5 16V8c4-5 9 4 14-1v9z',
  kamen:'m3 9 6-5h7l5 5-9 11zm0 0h18M9 4 7 9l5 11 5-11-1-5',
  napis:'M3 19h13M6 15 10 4h2l4 11M8 11h6m2 6 4-6 2 1-4 6-3 2z',
  doplnky:'M8 4h8l-2 4c0 3 4 6 4 9 0 2-3 3-6 3s-6-1-6-3c0-3 4-6 4-9z',
  vysledok:'M4 12h15m-6-6 6 6-6 6',
  svetlo:'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0'
};
export function icon(key){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','symbol');
  path.setAttribute('d',strokes[key]);svg.append(path);return svg;
}
export function profileIcon(id,{width,height}){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('aria-hidden','true');svg.setAttribute('class','silhouette');
  svg.setAttribute('viewBox',[-width/2,-height,width,height].join(' '));
  function add(shape,dx=0,scaleX=1,dy=0){
    const path=document.createElementNS(ns,'path');
    const coords=shape.getPoints(32).map(p=>(dx+p.x*scaleX)+','+(dy-p.y));
    path.setAttribute('d','M'+coords.join(' L')+' Z');svg.append(path);
  }
  if(id==='kniha'){
    for(const sign of [-1,1])add(bookLeaf(width*.494,height,sign),sign*.005,Math.cos(.095),.03);
  }else add(outline(width-.008,height-.008,id));
  return svg;
}
