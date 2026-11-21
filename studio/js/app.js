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
  document.documentElement.style.setProperty('--radius',tema.zaoblenie+'px');
  document.title=t.title+' · '+firma.nazov;
  el('load-logo').src=base+firma.logo;
  const progress=document.querySelector('progress');progress.value=2;progress.setAttribute('aria-label',t.loading);
  el('brand').textContent=firma.nazov;el('logo').src=base+firma.logo;
  for(const node of document.querySelectorAll('[data-t]'))node.textContent=t[node.dataset.t];
  for(const node of document.querySelectorAll('[data-label],[data-view]')){
    node.setAttribute('aria-label',t[node.dataset.label??node.dataset.t]);
  }
  const types=[...katalog.pomniky,...(katalog.dosky??[])];
  const definition=id=>catalog.pomniky[id]??catalog.dosky[id];
  function options(select,items){
    select.replaceChildren(...items.map(id=>new Option(t[id],id)));
  }
  const product=el('product'),profile=el('profile'),cover=el('cover');
  options(product,types);
  options(cover,katalog.krycieDosky??['cela']);
  let stoneId=katalog.kamene[0];
  function profiles(){
    const current=profile.value, plaque=katalog.dosky?.includes(product.value);
    const items=katalog.tvary.filter(id=>!plaque||['rovny','obluk'].includes(id));
    options(profile,items);
    if(items.includes(current))profile.value=current;
    el('cover-field').hidden=plaque;
  }
  profiles();
  function describe(){
    const m=definition(product.value);
    el('type').textContent=t[product.value];
    el('stone').textContent=catalog.kamene[stoneId].nazov;
    const dims=product.value==='pamatna'?[m.sirka,m.vyskaStely,m.dlzka]:[m.sirka,m.dlzka];
    el('size').textContent=dims.map(x=>Math.round(x*100)).join(' × ')+' '+t.unit;
    el('edge').textContent='4 '+t.unitEdge;
    for(const b of el('samples').children)b.setAttribute('aria-pressed',String(b.value===stoneId));
  }
  const handle=el('handle'),layout=document.querySelector('.layout');
  function fold(closed){
    layout.classList.toggle('folded',closed);handle.setAttribute('aria-expanded',String(!closed));
    el('sheet-content').inert=closed;
  }
  handle.onclick=()=>fold(!layout.classList.contains('folded'));
  let y=0;
  handle.onpointerdown=e=>{y=e.clientY;handle.setPointerCapture(e.pointerId);};
  handle.onpointerup=e=>{if(Math.abs(e.clientY-y)>24){fold(e.clientY>y);handle.addEventListener('click',e=>e.stopImmediatePropagation(),{capture:true,once:true});}};
  matchMedia('(max-width:760px)').addEventListener('change',()=>fold(false));
  const viewer=scena(el('viewport'),definition(product.value),catalog.kamene[stoneId],()=>mark(null));
  viewer.canvas.setAttribute('aria-label',t.canvas);
  for(const button of views)button.onclick=()=>{viewer.view(button.dataset.view);mark(button.dataset.view);};
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
    for(const button of group.children)button.setAttribute('aria-pressed',String(button.value===id));
  }
  for(const id of allowed){
    const button=document.createElement('button');
    button.type='button';button.value=id;button.textContent=t[id];button.setAttribute('aria-label',t[id]);
    button.onclick=()=>choose(id).catch(error=>{console.error(error);el('error').hidden=false;});
    group.append(button);
  }
  function apply(){
    viewer.change({type:product.value,shape:profile.value,cover:cover.value},definition(product.value),catalog.kamene[stoneId]);
    describe();
  }
  product.onchange=()=>{profiles();apply();mark('angle');};
  profile.onchange=cover.onchange=apply;
  for(const id of katalog.kamene){
    const button=document.createElement('button'),img=document.createElement('img');
    button.type='button';button.value=id;button.title=catalog.kamene[id].nazov;button.setAttribute('aria-label',button.title);
    img.alt='';img.src=viewer.sample(catalog.kamene[id]);button.append(img);el('samples').append(button);
    button.onclick=()=>{if(stoneId!==id){stoneId=id;apply();}};
  }
  describe();progress.value=3;
  await choose(initial);
  if(product.value!=='jednohrob'||profile.value!=='rovny'||cover.value!=='cela')apply();
  progress.value=4;el('loader').hidden=true;
  mark('angle');
}
start().catch(error=>{console.error(error);el('error').hidden=false;});
