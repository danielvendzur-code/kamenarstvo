import {choiceSet,pictogram} from './volby.js';
import {loadStone,vzorka} from './kamen.js';
import {editor} from './editor.js';
import {scena} from './scena.js';

async function json(path){
  const response=await fetch(path);
  if(!response.ok)throw new Error(path);
  return response.json();
}
const el=id=>document.getElementById(id);
const views=[...document.querySelectorAll('[data-view]')];
function mark(view){
  for(const button of views)button.setAttribute('aria-pressed',String(button.dataset.view===view));
}

async function start(){
  const t=await json('./i18n/sk.json');
  el('error').textContent=t.error;
  const slug=new URLSearchParams(location.search).get('k')??'vzor';
  if(!/^[a-z0-9-]+$/.test(slug))throw new Error('slug');
  const base='./klienti/'+slug+'/';
  const {firma,tema,katalog,prostredia}=await json(base+'config.json');
  const catalog=await json('./katalog/'+encodeURIComponent(katalog.zaklad)+'.json');
  for(const [key,value] of Object.entries(tema)){
    document.documentElement.style.setProperty('--'+key,value);
  }
  // Pair the display face with a sturdier wordmark at small header sizes.
  if(!tema.pismoZnacky&&tema.pismoNadpis==='Cormorant'){
    document.documentElement.style.setProperty('--pismoZnacky','Playfair');
  }
  document.documentElement.style.setProperty('--radius',tema.zaoblenie+'px');
  document.title=t.title+' · '+firma.nazov;
  el('load-logo').src=base+firma.logo;
  const progress=document.querySelector('progress');progress.value=2;progress.setAttribute('aria-label',t.loading);
  el('brand').textContent=firma.nazov.normalize('NFC');el('logo').src=base+firma.logo;
  for(const node of document.querySelectorAll('[data-t]'))node.textContent=t[node.dataset.t];
  for(const node of document.querySelectorAll('[data-label],[data-view]')){
    node.setAttribute('aria-label',t[node.dataset.label??node.dataset.t]);
    if(node.matches('button'))node.title=node.getAttribute('aria-label');
  }
  const types=[...katalog.pomniky,...(katalog.dosky??[])];
  const definition=id=>catalog.pomniky[id]??catalog.dosky[id];
  const product=choiceSet(el('product'),types,t,'profiles');
  const profile=choiceSet(el('profile'),[],t,'profiles');
  const cover=choiceSet(el('cover'),katalog.krycieDosky??['cela'],t,'profiles');
  let stoneId=katalog.kamene[0];
  function profiles(){
    profile.fill(katalog.tvary);
    el('cover-field').hidden=katalog.dosky?.includes(product.value);
  }
  profiles();
  function describe(){
    const m=definition(product.value);
    el('type').textContent=t[product.value];
    el('stone').textContent=catalog.kamene[stoneId].nazov;
    const dims=product.value==='pamatna'?[m.sirka,m.vyskaStely,m.dlzka]:[m.sirka,m.dlzka];
    el('size').textContent=dims.map(x=>Math.round(x*100)).join(' × ')+' '+t.unit;
    el('edge').parentElement.hidden=m.zrazenie==null;
    el('edge').textContent=Math.round((m.zrazenie??0)*1000)+' '+t.unitEdge;
    for(const b of el('samples').children)b.setAttribute('aria-pressed',String(b.value===stoneId));
  }
  const handle=el('handle'),layout=document.querySelector('.layout');
  let tier=1,startY,dragged=false;
  function sheet(value){
    tier=Math.max(0,Math.min(2,value));layout.dataset.sheet=tier;
    layout.classList.toggle('folded',tier===0);handle.setAttribute('aria-expanded',String(tier>0));
    el('sheet-content').inert=tier===0;
    if(tier===0)handle.closest('aside').scrollTop=0;
    handle.title=t.sheetLevels[tier];handle.setAttribute('aria-label',handle.title);
  }
  handle.onclick=()=>{if(!dragged)sheet((tier+1)%3);dragged=false;};
  handle.onpointerdown=e=>{dragged=false;startY=e.clientY;handle.setPointerCapture(e.pointerId);};
  handle.onpointerup=e=>{const dy=e.clientY-startY;if(Math.abs(dy)>24){dragged=true;sheet(tier-Math.sign(dy));}};
  handle.onkeydown=e=>{if(['ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();sheet(tier+(e.key==='ArrowUp'?1:-1));}};
  matchMedia('(max-width:760px)').addEventListener('change',()=>sheet(1));sheet(1);
  await loadStone(catalog.kamene[stoneId]);
  const viewer=scena(el('viewport'),definition(product.value),catalog.kamene[stoneId],()=>mark(null));
  viewer.canvas.setAttribute('aria-label',t.canvas);
  let typed=false;
  function detail(){if(!typed){typed=true;viewer.view('detail');mark('detail');}}
  for(const button of views){
    button.prepend(pictogram(button.dataset.view));button.title=t[button.dataset.t];
    button.onclick=()=>{viewer.view(button.dataset.view);mark(button.dataset.view);};
  }
  for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>{
    if(button.dataset.action==='reset'){viewer.view('angle');mark('angle');}
    else viewer.zoom(button.dataset.action==='plus'?1/1.18:1.18);
  };
  const supported=['rano','podvecer','atelier'];
  const allowed=[...new Set(prostredia?.povolene??['atelier'])].filter(id=>supported.includes(id));
  if(!allowed.length)allowed.push('atelier');
  const initial=allowed.includes(prostredia?.predvolene)?prostredia.predvolene:allowed[0];
  const group=el('environments');
  let last=0;
  async function choose(id){
    const turn=++last;
    await viewer.environment(id);
    if(turn!==last)return;
    el('error').hidden=true;
    for(const button of group.children)button.setAttribute('aria-pressed',String(button.value===id));
  }
  for(const id of allowed){
    const button=document.createElement('button');
    button.type='button';button.value=id;button.textContent=t[id];button.setAttribute('aria-label',t[id]);
    button.prepend(pictogram(id));button.title=t[id];
    button.onclick=()=>choose(id).catch(error=>{console.error(error);el('error').hidden=false;});
    group.append(button);
  }
  function apply(){
    viewer.change({type:product.value,shape:profile.value,cover:cover.value},definition(product.value),catalog.kamene[stoneId]);
    describe();
  }
  const syncEditor=editor(katalog,t,product,viewer,detail);
  product.container.onchange=()=>{profiles();syncEditor();apply();mark('angle');};
  profile.container.onchange=cover.container.onchange=apply;
  let materialRequest=0;
  for(const id of katalog.kamene){
    const button=document.createElement('button'),img=document.createElement('img');
    button.type='button';button.value=id;button.title=catalog.kamene[id].nazov;button.setAttribute('aria-label',button.title);
    img.alt='';img.src=vzorka(catalog.kamene[id]);button.append(img);el('samples').append(button);
    button.onclick=async()=>{
      const job=++materialRequest;
      if(stoneId===id)return;
      try{await loadStone(catalog.kamene[id]);}
      catch(error){console.error(error);el('error').hidden=false;return;}
      if(job!==materialRequest)return;
      stoneId=id;syncEditor.recommend(catalog.kamene[id].odporucanePismo);apply();
    };
  }
  syncEditor.recommend(catalog.kamene[stoneId].odporucanePismo);describe();progress.value=3;
  try{await choose(initial);}catch{
    await choose('atelier');el('error').textContent=t.retryEnv;el('error').hidden=false;
  }
  if(product.value!=='jednohrob'||profile.value!=='rovny'||cover.value!=='cela')apply();
  progress.value=4;await document.fonts.ready;el('loader').hidden=true;
  mark('angle');
}
start().catch(error=>{console.error(error);el('error').hidden=false;});
