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
  el('brand').textContent=firma.nazov;el('logo').src=base+firma.logo;
  for(const node of document.querySelectorAll('[data-t]'))node.textContent=t[node.dataset.t];
  for(const node of document.querySelectorAll('[data-label],[data-view]')){
    node.setAttribute('aria-label',t[node.dataset.label??node.dataset.t]);
  }
  const type=katalog.pomniky[0],model=catalog.pomniky[type],stone=catalog.kamene[katalog.kamene[0]];
  el('type').textContent=t[type];el('stone').textContent=stone.nazov;
  el('shape').textContent=t[katalog.tvary[0]];
  el('size').textContent=[model.sirka,model.dlzka].map(x=>Math.round(x*100)).join(' × ')+' '+t.unit;
  const viewer=scena(el('viewport'),model,stone,()=>mark(null));
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
  await choose(initial);
  mark('angle');
}
start().catch(error=>{console.error(error);el('error').hidden=false;});
