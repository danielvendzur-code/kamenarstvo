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
  const relief=document.documentElement.classList.contains('client-preview');
  const depthX=relief ? width*.09 : 0;
  const depthY=relief ? -height*.055 : 0;
  svg.setAttribute('viewBox',[-width/2-.01,-height+depthY-.02,width+depthX+.02,height-depthY+.05].join(' '));
  function polygon(points){return 'M'+points.map(([x,y])=>x+','+y).join(' L')+' Z';}
  function surface(path,tone){
    const face=document.createElementNS(ns,'path');
    face.setAttribute('d',path);
    if(tone)face.setAttribute('fill',tone);
    svg.append(face);
  }
  function add(shape,dx=0,scaleX=1,dy=0){
    const points=shape.getPoints(32).map(p=>[dx+p.x*scaleX,dy-p.y]);
    if(relief){
      const back=points.map(([x,y])=>[x+depthX,y+depthY]);
      surface(polygon(back),'#5c6267');
      const facets=new Map();
      for(let i=1;i<points.length;i++){
        const [x,y]=points[i-1], [nextX,nextY]=points[i];
        const length=Math.hypot(nextX-x,nextY-y);
        if(!length)continue;
        const level=112+8*Math.round(7*Math.abs(nextX-x)/length);
        const quad=polygon([points[i-1],back[i-1],back[i],points[i]]);
        facets.set(level,(facets.get(level)??'')+quad);
      }
      for(const [level,path] of facets)surface(path,'rgb('+[level,level+3,level+5].join(',')+')');
    }
    surface(polygon(points),relief?'var(--profile-face, #333a40)':null);
  }
  if(id==='kniha'){
    for(const sign of [-1,1])add(bookLeaf(width*.494,height,sign),sign*.005,Math.cos(.095),.03);
  }else add(outline(width-.008,height-.008,id));
  return svg;
}

// Monoline pictograms for accessories, scene controls and result actions.
const pictograms={
  vaza:'M9 3h6M10 3v3c0 2-3 3.5-3 8 0 3.5 2 7 5 7s5-3.5 5-7c0-4.5-3-6-3-8V3',
  lampas:'M9 4h6l1 3H8zM8 7h8v11H8zM7 18h10v2H7zM12 10c1 1.2 1 2.4 0 3.4-1-1-1-2.2 0-3.4z',
  fotokeramika:'M12 3c4 0 6.5 3.6 6.5 9S16 21 12 21s-6.5-3.6-6.5-9S8 3 12 3zM9 17c.6-2 1.7-3 3-3s2.4 1 3 3M12 13.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
  kriz:'M12 3v18M7 8h10',
  'ornament-ruza':'M12 21v-7M12 14c-3 0-5-2-5-5 2 0 3 .5 5 2 2-1.5 3-2 5-2 0 3-2 5-5 5zM12 11c-1.5-1-2-2.5-1.5-4 1 .2 1.6.7 1.5 1.5.4-1 1.2-1.6 2-1.5.4 1.6-.4 3-2 4zM12 18l-3-2M12 17l3-2',
  holubica:'M3 12c3-1 5 0 7 1l2-6c1.5 2 2 4 1.5 6 2-1 4.5-1 7.5 0-1.5 1.5-3 2-5 2-1 2-3.5 3.5-6.5 3.5H7l3-2c-2.5 0-5-1.5-7-4.5z',
  klasy:'M12 21V9M12 9c-1.5-1-2-2.5-1.5-4.5C12 5 12.6 6.5 12 9zm0 0c1.5-1 2-2.5 1.5-4.5C12 5 11.4 6.5 12 9zM12 13c-2 0-3.2-1-3.5-3 2 0 3.2 1 3.5 3zm0 0c2 0 3.2-1 3.5-3-2 0-3.2 1-3.5 3zM12 17c-2 0-3.2-1-3.5-3 2 0 3.2 1 3.5 3zm0 0c2 0 3.2-1 3.5-3-2 0-3.2 1-3.5 3z',
  'kamenne-srdce':'M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10z',
  'kamenna-kniha':'M3 6c3-1 6-1 9 1v13c-3-2-6-2-9-1zM21 6c-3-1-6-1-9 1v13c3-2 6-2 9-1z',
  kahance:'M8 9h8v11H8zM9 6h6v3H9zM12 11c1 1 1 2.2 0 3-1-.8-1-2 0-3zM10 17h4',
  zardiniera:'M4 14h16l-1.5 6h-13zM8 14c0-3 1-5 4-6M12 14c0-2.5 1.5-4.5 4-5M7 11a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M16.5 9.5a1.6 1.6 0 1 0 0-3.2 1.6 1.6 0 0 0 0 3.2M12 8a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 12 8',
  'kamenny-lampas':'M12 3l6 5H6zM7 8h10v10H7zM5 18h14v3H5zM10 11h4v5h-4z',
  lavicka:'M3 10h18v3H3zM6 13v6M18 13v6M5 19h2M17 19h2',
  angle:'M12 3l8 4.5v9L12 21l-8-4.5v-9zM12 12l8-4.5M12 12v9M12 12 4 7.5',
  front:'M6 4h12v16H6zM9 8h6M9 11h6',
  detail:'M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM15.5 15.5 21 21M8 10.5h5M10.5 8v5',
  side:'M4 18h16M7 18V7c0-2 1-3 3-3s3 1 3 3v11M15 18v-4h4v4',
  minus:'M5 12h14',plus:'M12 5v14M5 12h14',
  rano:'M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  podvecer:'M3 18h18M5 21h14M7.5 18a4.5 4.5 0 0 1 9 0M12 4v3M5.6 9.6l1.4 1.4M18.4 9.6 17 11M2 14h2M20 14h2',
  atelier:'M4 4h10l-3 7H7zM9 11v9M6 20h6M17 7l3-1.5M17 10h3.5M17 13l3 1.5',
  send:'M4 12 20 4l-4 16-4-6zM12 14l8-10',
  link:'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7L11.5 6.8M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.5-1.5',
  download:'M12 4v11M7 10l5 5 5-5M5 20h14',
  edit:'M4 20h4L19 9l-4-4L4 16zM13.5 6.5l4 4',
  next:'M5 12h14M13 6l6 6-6 6',back:'M19 12H5M11 6l-6 6 6 6',
  check:'M5 12.5l4.2 4.2L19 7',close:'M6 6l12 12M18 6 6 18'
};
export function pictogram(key,className='pictogram'){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');svg.setAttribute('class',className);
  path.setAttribute('d',pictograms[key]??pictograms.check);svg.append(path);return svg;
}
export function extraIcon(id){return pictogram(id,'extra-icon');}
