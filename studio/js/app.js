import {openConfig} from './sukromna-ukazka.js';
import {setStudioProfile,tabletSize} from './profily.js';
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
  const brandedHost=/^([a-z0-9-]+)\.mojchatbot\.sk$/.exec(location.hostname);
  const slug=brandedHost?.[1]??new URLSearchParams(location.search).get('k')??'vzor';
  if(!/^[a-z0-9-]+$/.test(slug))throw new Error('slug');
  const base='./klienti/'+slug+'/';
  let config;
  try {
    config=await openConfig(await json(base+'config.json'));
  } catch (error) {
    if(error.message!=='private-preview')throw error;
    el('loader').hidden=true;el('error').textContent=t.privateAccess;el('error').hidden=false;
    return;
  }
  const {firma,tema,katalog,prostredia,dopyt,ukazka}=config;
  if(ukazka){
    document.documentElement.dataset.controls=ukazka.ovladanie;
    setStudioProfile(ukazka.profil);
    t.atelierovy=ukazka.profil.nazov;
    document.documentElement.classList.add('client-preview');
  }
  const catalog=await json('./katalog/'+encodeURIComponent(katalog.zaklad)+'.json');
  for(const [key,value] of Object.entries(tema)){
    document.documentElement.style.setProperty('--'+key,value);
  }
  document.documentElement.style.setProperty('--radius',tema.zaoblenie+'px');
  document.title=t.title;
  el('brand').textContent=firma.nazov;
  if(firma.logo){
    const logo=firma.logo.startsWith('data:image/webp;base64,')?firma.logo:base+firma.logo;
    el('logo').src=logo;
    if(ukazka){
      el('logo').alt=firma.nazov;
      el('load-logo').src=logo;el('load-logo').alt=firma.nazov;
      if(ukazka.slovnaZnacka){
        el('brand').textContent=ukazka.slovnaZnacka;el('brand').classList.add('wordmark');
      }else el('brand').classList.add('visually-hidden');
    }
  }
  else el('logo').hidden=true;
  const progress=document.querySelector('progress');progress.value=2;progress.setAttribute('aria-label',t.loading);
  for(const node of document.querySelectorAll('[data-t]'))node.textContent=t[node.dataset.t];
  for(const node of document.querySelectorAll('[data-label],[data-view]')){
    node.setAttribute('aria-label',t[node.dataset.label??node.dataset.t]);
    if(node.matches('button'))node.title=node.getAttribute('aria-label');
  }
  if(ukazka){
    document.title=firma.nazov+' · '+t.title;
    el('private-intro').textContent=t.privateFor.replace('{firma}',firma.nazov);
    el('private-intro').hidden=false;
  }
  const types=[...katalog.pomniky,...(katalog.dosky??[])];
  const definition=id=>catalog.pomniky[id]??catalog.dosky[id];
  if(ukazka?.materialy)Object.assign(catalog.kamene,ukazka.materialy);
  if(ukazka?.zostava){
    definition('jednohrob').zostava=ukazka.zostava;
    const accent=catalog.kamene[ukazka.zostava.kamenStely];
    if(accent){await loadStone(accent);definition('jednohrob').kamenStely=accent;}
  }
  if(ukazka)Object.assign(definition('jednohrob'),ukazka.rozmery,{detailStely:ukazka.detailStely});
  const product=choiceSet(el('product'),types,t,'profiles');
  for(const label of product.container.children){
    const model=definition(label.querySelector('input').value),dim=document.createElement('small');
    dim.textContent=[model.sirka,label.querySelector('input').value==='pamatna'?model.vyskaStely:model.dlzka].map(v=>Math.round(v*100)).join(' × ')+' '+t.unit;label.append(dim);
  }
  if(ukazka?.nahlad){
    const initialCard=product.container.querySelector('input[value="jednohrob"]').closest('label');
    initialCard.querySelector('img').src=ukazka.nahlad;
    if(ukazka.zostava)initialCard.querySelector('span').textContent=ukazka.profil.nazov;
  }
  const profile=choiceSet(el('profile'),[],t,'profiles');
  const cover=choiceSet(el('cover'),katalog.krycieDosky??['cela'],t,'profiles');
  const restored=readDesign();
  if(types.includes(restored?.type))product.select(restored.type);
  let stoneId=katalog.kamene.includes(restored?.stone)?restored.stone:katalog.kamene[0];
  function shapeHeading(){
    const isCover=el('profile-field').hidden;
    el('step-title').textContent=isCover?t.cover:t.stepTitles[1];
  }
  function showShapePart(part){
    el('profile-field').hidden=part!=='profile';el('cover-field').hidden=part!=='cover';
    if(!el('shape-tools').closest('[data-step]').hidden)shapeHeading();
    for(const button of el('shape-tools').children)button.setAttribute('aria-pressed',String(button.dataset.shapePart===part));
  }
  for(const button of el('shape-tools').children)button.onclick=()=>{showShapePart(button.dataset.shapePart);};
  function profiles(){
    const available=ukazka?.zostava && product.value!=='jednohrob'?katalog.tvary.filter(id=>id!=='atelierovy'):katalog.tvary;
    profile.fill(available,tabletSize(definition(product.value),product.value));
    showShapePart('profile');
    if(ukazka?.nahladyDosiek){
      for(const label of cover.container.children){
        const id=label.querySelector('input').value;
        label.querySelector('img').src=(product.value==='jednohrob' && ukazka.nahladyDosiek[id]) || './assets/dosky/'+id+'.webp';
      }
    }
    el('shape-tools').hidden=katalog.dosky?.includes(product.value);
  }
  profiles();
  if([...profile.container.querySelectorAll('input')].some(input=>input.value===restored?.shape))profile.select(restored.shape);
  if(katalog.krycieDosky?.includes(restored?.cover))cover.select(restored.cover);
  function describe(){
    if(ukazka)document.querySelector('.studio').textContent=catalog.kamene[stoneId].nazov;
    const m=definition(product.value);

    const dims=product.value==='pamatna'?[m.sirka,m.vyskaStely,m.dlzka]:[m.sirka,m.dlzka];
    el('size').textContent=dims.map(x=>Math.round(x*100)).join(' × ')+' '+t.unit;
    el('edge').parentElement.hidden=m.zrazenie==null;
    el('edge').textContent=Math.round((m.zrazenie??0)*1000)+' '+t.unitEdge;
    for(const b of el('samples').children)b.setAttribute('aria-pressed',String(b.value===stoneId));
  }
  const layout=document.querySelector('.layout');
  await loadStone(catalog.kamene[stoneId]);
  const viewer=scena(el('viewport'),definition(product.value),catalog.kamene[stoneId],()=>mark(null));
  viewer.canvas.setAttribute('aria-label',t.canvas);
  let typed=false;
  function detail(place,force=false){if(force||!typed){typed=true;viewer.view(place==='slab'?'slab':'detail');mark(place==='slab'?null:'detail');}}
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
  const showResult=resultPanel(t,dopyt,catalog,i=>{
    go(i);
    const visible=selector=>[...panels[i].querySelectorAll(selector)].find(node=>node.getClientRects().length);
    const target=visible('[aria-pressed="true"],input:checked')??visible('button,input')??el('step-title');
    target.focus({preventScroll:true});
  });
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
  function recommendedInk(){
    const material=profile.value==='atelierovy' && syncEditor.state().nameAt!=='slab' && definition(product.value).kamenStely;
    return (material||catalog.kamene[stoneId]).odporucanePismo;
  }
  const syncEditor=editor(katalog,t,product,viewer,detail,persist,()=>profile.value);

  product.container.onchange=()=>{profiles();syncEditor();syncEditor.recommend(recommendedInk());apply();syncEditor.flush();mark('angle');};
  profile.container.onchange=()=>{syncEditor();syncEditor.recommend(recommendedInk());apply();syncEditor.flush();};
  el('letters').addEventListener('change',event=>{
    if(event.target.matches('[data-placement=nameAt]'))syncEditor.recommend(recommendedInk());
  });
  cover.container.onchange=apply;
  let materialRequest=0,requestedStone=stoneId;
  for(const id of katalog.kamene){
    const button=document.createElement('button'),img=document.createElement('img');
    button.type='button';button.value=id;button.title=catalog.kamene[id].nazov;button.setAttribute('aria-label',button.title);
    img.alt='';img.src=vzorka(catalog.kamene[id]);const name=document.createElement('span');name.textContent=button.title;button.append(img,name);el('samples').append(button);
    async function selectStone(){
      requestedStone=id;
      const job=++materialRequest;
      if(stoneId===id)return;
      try{await loadStone(catalog.kamene[id]);}
      catch(error){if(job===materialRequest){requestedStone=stoneId;console.error(error);el('error').hidden=false;}return;}
      if(job!==materialRequest)return;
      stoneId=id;syncEditor.recommend(recommendedInk());apply();
    }
    button.onclick=()=>pendingStone=selectStone();
  }
  let step=0,resultVersion=0;
  for(const [group,options] of [[el('profile'),profile],[el('cover'),cover],[el('samples'),null]]){
    let start,swiped=false;
    group.addEventListener('pointerdown',e=>{start=e.isPrimary?[e.clientX,e.clientY]:null;swiped=false;});
    group.addEventListener('pointercancel',()=>{start=null;});
    group.addEventListener('pointerup',e=>{
      if(!start)return;
      const dx=e.clientX-start[0],dy=e.clientY-start[1];start=null;
      if(Math.abs(dx)<40||Math.abs(dx)<Math.abs(dy)*1.4)return;
      const items=[...group.querySelectorAll(options?'input':'button')];
      const index=items.findIndex(item=>item.value===(options?options.value:requestedStone));
      items[(index+(dx<0?1:-1)+items.length)%items.length].click();swiped=true;
    });
    group.addEventListener('click',e=>{if(swiped&&e.isTrusted){e.preventDefault();e.stopImmediatePropagation();swiped=false;}},true);
  }
  const frame=el('print');
  let printAspect=0,resizeTimer;
  function refreshPrint(){
    el('rendered').src=viewer.frontImage();
    printAspect=frame.parentElement.clientWidth/frame.parentElement.clientHeight;
  }
  new ResizeObserver(()=>{
    clearTimeout(resizeTimer);
    if(step!==5||frame.hidden)return;
    resizeTimer=setTimeout(()=>{
      if(step===5&&!frame.hidden&&printAspect!==frame.clientWidth/frame.clientHeight)refreshPrint();
    },100);
  }).observe(frame.parentElement);
  async function renderResult(){
    const revision=++resultVersion;
    await Promise.all([pendingStone,pendingEnvironment]);
    await syncEditor.flush();
    if(step!==5||revision!==resultVersion)return;
    const design=state();showResult(design,designLink(design));
    refreshPrint();frame.hidden=false;
  }
  const panels=[...document.querySelectorAll('[data-step]')];
  const stepViews=['angle','angle','angle','angle','angle','front'];
  const tabs=t.editTabs.map((label,i)=>{
    const button=document.createElement('button');button.type='button';
    button.textContent=label;
    button.onclick=()=>go(i);el('step-track').append(button);return button;
  });
  el('review').onclick=()=>go(5);
  el('next').onclick=()=>go(step+1);el('back').onclick=()=>go(step-1);
  function go(i,move=true){
    el('step-track').style.setProperty('--step',i);
    step=i;panels.forEach((panel,j)=>panel.hidden=i!==j);
    tabs.forEach((tab,j)=>tab.setAttribute('aria-pressed',String(j===i)));
    el('step-title').textContent=t.stepTitles[i];
    if(i===1)shapeHeading();
    el('back').hidden=i===0;el('next').hidden=i===5;document.querySelector('.step-actions').hidden=i===5;
    tabs.forEach((tab,j)=>j===i?tab.setAttribute('aria-current','step'):tab.removeAttribute('aria-current'));
    el('step-scroll').scrollTop=0;
    layout.classList.toggle('show-result',i===5);
    if(i===5)renderResult().catch(()=>{el('error').hidden=false;});
    else{resultVersion++;el('print').hidden=true;}
    if(move){const view=i===3&&syncEditor.focus()==='slab'?'slab':stepViews[i];viewer.view(view);mark(view);}
  }
  const inquiryDialog=el('inquiry-dialog');
  el('to-inquiry').onclick=()=>{inquiryDialog.showModal();el('inquiry').elements.name.focus();};
  el('close-inquiry').onclick=()=>inquiryDialog.close();
  go(0,false);
  syncEditor.recommend(recommendedInk());describe();progress.value=3;
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
