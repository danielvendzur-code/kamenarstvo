import {choiceSet} from './volby.js';
import {loadStone,vzorka} from './kamen.js';
import {readDesign,designLink,resultPanel} from './vysledok.js';
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
  const {firma,tema,katalog,prostredia,dopyt}=await json(base+'config.json');
  const catalog=await json('./katalog/'+encodeURIComponent(katalog.zaklad)+'.json');
  for(const [key,value] of Object.entries(tema)){
    document.documentElement.style.setProperty('--'+key,value);
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
  const restored=readDesign();
  if(types.includes(restored?.type))product.select(restored.type);
  let stoneId=katalog.kamene.includes(restored?.stone)?restored.stone:katalog.kamene[0];
  function showShapePart(part){
    el('profile-field').hidden=part!=='profile';el('cover-field').hidden=part!=='cover';
    for(const button of el('shape-tools').children)button.setAttribute('aria-pressed',String(button.dataset.shapePart===part));
  }
  for(const button of el('shape-tools').children)button.onclick=()=>showShapePart(button.dataset.shapePart);
  function profiles(){
    profile.fill(katalog.tvary);
    showShapePart('profile');
    el('shape-tools').hidden=katalog.dosky?.includes(product.value);
  }
  profiles();
  if(katalog.tvary.includes(restored?.shape))profile.select(restored.shape);
  if(katalog.krycieDosky?.includes(restored?.cover))cover.select(restored.cover);
  function describe(){
    const m=definition(product.value);

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
    button.title=t[button.dataset.t];
    button.onclick=()=>{viewer.view(button.dataset.view);mark(button.dataset.view);};
  }
  for(const button of document.querySelectorAll('[data-action]'))button.onclick=()=>{
    if(button.dataset.action==='reset'){viewer.view('angle');mark('angle');}
    else{viewer.zoom(button.dataset.action==='plus'?1/1.18:1.18);mark(null);}
  };
  const supported=['rano','podvecer','atelier'];
  const allowed=[...new Set(prostredia?.povolene??['atelier'])].filter(id=>supported.includes(id));
  if(!allowed.length)allowed.push('atelier');
  const requested=new URLSearchParams(location.search).get('svetlo')??prostredia?.predvolene;
  const initial=allowed.includes(requested)?requested:allowed[0];
  const group=el('environments');
  let last=0,environmentId=initial,ready=false,pendingStone,pendingEnvironment;
  const showResult=resultPanel(t,dopyt,catalog);
  function state(){
    const inscription=syncEditor.state();
    if(product.value!=='dvojhrob')inscription.people=inscription.people.slice(0,1);
    return {v:1,type:product.value,shape:profile.value,cover:katalog.dosky?.includes(product.value)?null:cover.value,
      stone:stoneId,environment:environmentId,...inscription};
  }
  let saveTimer;
  function persist(){
    if(!ready)return;
    clearTimeout(saveTimer);saveTimer=setTimeout(()=>{const url=designLink(state());if(url!==location.href)history.replaceState(null,'',url);},160);
  }
  async function choose(id){
    const turn=++last;
    await viewer.environment(id);
    if(turn!==last)return;
    environmentId=id;persist();el('error').hidden=true;
    for(const button of group.children)button.setAttribute('aria-pressed',String(button.value===id));
  }
  for(const id of allowed){
    const button=document.createElement('button');
    button.type='button';button.value=id;button.textContent=t[id];button.setAttribute('aria-label',t[id]);
    button.title=t[id];
    button.onclick=()=>pendingEnvironment=choose(id).catch(error=>{console.error(error);el('error').hidden=false;});
    group.append(button);
  }
  function apply(){
    viewer.change({type:product.value,shape:profile.value,cover:cover.value},definition(product.value),catalog.kamene[stoneId]);
    describe();persist();
  }
  const syncEditor=editor(katalog,t,product,viewer,detail,persist);
  product.container.onchange=()=>{profiles();syncEditor();apply();mark('angle');};
  profile.container.onchange=cover.container.onchange=apply;
  let materialRequest=0;
  for(const id of katalog.kamene){
    const button=document.createElement('button'),img=document.createElement('img');
    button.type='button';button.value=id;button.title=catalog.kamene[id].nazov;button.setAttribute('aria-label',button.title);
    img.alt='';img.src=vzorka(catalog.kamene[id]);const name=document.createElement('span');name.textContent=button.title;button.append(img,name);el('samples').append(button);
    async function selectStone(){
      const job=++materialRequest;
      if(stoneId===id)return;
      try{await loadStone(catalog.kamene[id]);}
      catch(error){console.error(error);el('error').hidden=false;return;}
      if(job!==materialRequest)return;
      stoneId=id;syncEditor.recommend(catalog.kamene[id].odporucanePismo);apply();
    }
    button.onclick=()=>pendingStone=selectStone();
  }
  let step=0,resultVersion=0;
  async function renderResult(){
    const revision=++resultVersion;
    await Promise.all([pendingStone,pendingEnvironment]);
    await syncEditor.flush();
    if(step!==5||revision!==resultVersion)return;
    const design=state();showResult(design,designLink(design));
    el('rendered').src=viewer.frontImage();el('print').hidden=false;
  }
  const panels=[...document.querySelectorAll('[data-step]')];
  const stepViews=['angle','angle','angle','detail','angle','front'];
  const tabs=t.editTabs.map((label,i)=>{
    const button=document.createElement('button');button.type='button';
    const number=document.createElement('span');number.textContent=i+1;
    button.append(number,document.createTextNode(label));
    button.onclick=()=>go(i);el('step-track').append(button);return button;
  });
  el('next').onclick=()=>go(step+1);el('back').onclick=()=>go(step-1);
  el('review').onclick=()=>go(5);
  function go(i,move=true){
    if(matchMedia('(max-width:760px)').matches){
      if(move&&tier===0)sheet(1);
    }
    step=i;panels.forEach((panel,j)=>panel.hidden=i!==j);
    tabs.forEach((tab,j)=>tab.setAttribute('aria-pressed',String(j===i)));
    el('review').setAttribute('aria-pressed',String(i===5));
    el('step-title').textContent=t.stepTitles[i];
    el('step-hint').textContent=t.stepHints[i];el('step-progress').value=i+1;
    el('back').hidden=i===0;el('next').hidden=i===5;el('to-inquiry').hidden=i!==5;
    tabs.forEach((tab,j)=>j===i?tab.setAttribute('aria-current','step'):tab.removeAttribute('aria-current'));
    el('step-scroll').scrollTop=0;
    layout.classList.toggle('show-result',i===5);
    if(i===5)renderResult().catch(()=>{el('error').hidden=false;});
    else{resultVersion++;el('print').hidden=true;}
    if(move){viewer.view(stepViews[i]);mark(stepViews[i]);}
  }
  const inquiryDialog=el('inquiry-dialog');
  el('to-inquiry').onclick=()=>{inquiryDialog.showModal();el('inquiry').elements.name.focus();};
  el('close-inquiry').onclick=()=>inquiryDialog.close();
  go(0,false);
  syncEditor.recommend(catalog.kamene[stoneId].odporucanePismo);describe();progress.value=3;
  try{await choose(allowed.includes(restored?.environment)?restored.environment:initial);}catch{
    await choose('atelier');el('error').textContent=t.retryEnv;el('error').hidden=false;
  }
  if(product.value!=='jednohrob'||profile.value!=='rovny'||cover.value!=='cela')apply();
  if(restored)await syncEditor.restore(restored);
  ready=true;
  if(restored){history.replaceState(null,'',designLink(state()));go(5);}
  window.addEventListener('hashchange',()=>location.reload());
  progress.value=4;await document.fonts.ready;el('loader').hidden=true;
  mark(restored?'front':'angle');
}
start().catch(error=>{console.error(error);el('error').hidden=false;});
