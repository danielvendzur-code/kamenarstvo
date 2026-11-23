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
const profiles={
  ramena:'M5 38V16Q15 16 19 12Q40 -3 61 12Q65 16 75 16V38Z',
  stit:'M5 38V18L40 4L75 18V38Z',
  rovny:'M5 38V7Q5 5 7 5H73Q75 5 75 7V38Z',
  obluk:'M5 38V16Q40 -5 75 16V38Z',
  vlna:'M5 38V11C29 -4 47 23 75 11V38Z',
  kniha:'M4 38V9Q21 2 40 11Q58 2 76 9V38Q58 31 40 38Q20 32 4 38Z'
};
export function profileIcon(id){
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 80 42');svg.setAttribute('aria-hidden','true');svg.setAttribute('class','silhouette');
  path.setAttribute('d',profiles[id]??profiles.rovny);svg.append(path);
  if(id==='kniha'){
    const line=document.createElementNS(ns,'path');line.setAttribute('d','M40 11v26');line.setAttribute('class','spine');svg.append(line);
  }
  return svg;
}
