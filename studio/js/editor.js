import {choiceSet,families as fonts} from './volby.js';
const el=id=>document.getElementById(id);
export function editor(config,t,product,viewer,detail,changed,shape){
  const letters=el('letters'),extras=el('extras'),people=[],selected=new Set();
  let photo=null,photoVersion=0,version=0;
  function field(parent,key,input){
    const label=document.createElement('label'),caption=document.createElement('span');
    caption.textContent=t[key];label.append(caption,input);parent.append(label);return input;
  }
  function cards(key,ids,kind){
    const group=document.createElement('fieldset'),legend=document.createElement('legend'),choices=document.createElement('div');
    legend.textContent=t[key];choices.id='letter-'+key;group.className='letter-choice';
    group.append(legend,choices);letters.append(group);
    return choiceSet(choices,ids,t,kind);
  }
  const font=cards('font',config.pisma,'fonts'),finish=cards('finish',config.farbyPisma,'inks');
  font.container.onchange=finish.container.onchange=()=>{update();};
  const parts={},tabs={},toolbar=el('letter-tools');
  let active='first';
  function part(key){
    const panel=document.createElement('div'),button=document.createElement('button');
    panel.className='letter-part';letters.append(panel);parts[key]=panel;
    button.type='button';button.textContent=t.letterTabs[key];button.onclick=()=>open(key);toolbar.append(button);tabs[key]=button;
    return panel;
  }
  function open(key){
    active=key;
    for(const id of Object.keys(parts)){
      parts[id].hidden=id!==key;tabs[id].setAttribute('aria-pressed',String(id===key));
    }
  }
  const first=part('first'),second=part('second');
  for(const parent of [first,second]){
    const person={};people.push(person);
    for(const key of ['first','last','birth','death']){
      const input=document.createElement('input');input.maxLength=key==='first'||key==='last'?80:32;
      field(parent,key,input);person[key]=input;input.oninput=()=>{detail(locations[active==='epitaph'?'verseAt':'nameAt'].select.value);update();};
    }
  }
  const epitaph=field(part('epitaph'),'epitaph',document.createElement('textarea'));
  part('style').append(font.container.closest('fieldset'));
  part('color').append(finish.container.closest('fieldset'));
  const locations={};
  function placement(parent,key){
    const select=document.createElement('select');select.dataset.placement=key;
    const label=field(parent,'surface',select).parentElement;label.className='placement';
    locations[key]={select,label};
    select.onchange=()=>{detail(select.value,true);update();};
  }
  placement(first,'nameAt');placement(parts.epitaph,'verseAt');
  function syncPlacements(){
    const grave=['jednohrob','dvojhrob'].includes(product.value);
    const leaves=shape()==='kniha'&&product.value!=='dvojhrob';
    for(const [key,{select,label}] of Object.entries(locations)){
      const ids=leaves?['leftPage','rightPage']:['face'];
      if(grave)ids.push('slab');
      const preferred=key==='verseAt'&&leaves?'rightPage':ids[0];
      const old=select.value;select.replaceChildren(...ids.map(id=>new Option(t[id],id)));
      select.value=ids.includes(old)?old:preferred;label.hidden=ids.length===1;
    }
  }
  open('first');
  epitaph.maxLength=240;epitaph.rows=2;
  epitaph.oninput=()=>{epitaph.value=epitaph.value.split(/\r?\n/).slice(0,2).join('\n');detail(locations[active==='epitaph'?'verseAt':'nameAt'].select.value);update();};
  const example=document.createElement('button');
  example.type='button';example.className='example';example.textContent=t.insertSample;
  if(config.vzorNapisu){
    first.append(example);
    example.onclick=()=>{
      people.forEach((person,i)=>{
        if(i===1&&product.value!=='dvojhrob')return;
        if(Object.values(person).every(input=>!input.value))
          for(const [key,input] of Object.entries(person))input.value=config.vzorNapisu.osoby?.[i]?.[key]??'';
      });
      if(!epitaph.value)epitaph.value=config.vzorNapisu.epitaf??'';detail(locations[active==='epitaph'?'verseAt':'nameAt'].select.value);update();
    };
  }
  const photoBox=document.createElement('div'),input=document.createElement('input'),reset=document.createElement('button'),error=document.createElement('small');
  input.type='file';input.accept='image/jpeg,image/png,image/webp';
  input.className='visually-hidden';input.id='portrait-file';
  const picker=document.createElement('button'),filename=document.createElement('span');
  picker.type='button';picker.textContent=t.choosePhoto;picker.onclick=()=>input.click();
  input.tabIndex=-1;input.setAttribute('aria-label',t.portrait);
  filename.textContent=t.noPhoto;filename.setAttribute('role','status');photoBox.append(picker,input,filename);reset.type='button';reset.textContent=t.clearPhoto;reset.hidden=true;
  error.setAttribute('role','status');photoBox.append(reset,error);photoBox.hidden=true;
  reset.onclick=()=>{photoVersion++;photo=null;input.value='';filename.textContent=t.noPhoto;reset.hidden=true;error.textContent='';update();};
  let pendingPhoto;
  async function loadPhoto(){
    const file=input.files[0],revision=++photoVersion;if(!file)return;
    try{
      const bitmap=await createImageBitmap(file);
      if(revision!==photoVersion){bitmap.close();return;}
      const canvas=document.createElement('canvas'),ratio=Math.min(1,192/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      const data=canvas.toDataURL('image/jpeg',.72);
      const image=new Image();image.src=data;await image.decode();if(revision!==photoVersion)return;
      photo=image;filename.textContent=file.name;reset.hidden=false;error.textContent='';update();
    }catch{if(revision===photoVersion){error.textContent=t.badPhoto;input.value='';}}
  };
  input.onchange=()=>pendingPhoto=loadPhoto();
  for(const id of config.doplnky??[]){
    const check=document.createElement('input');check.type='checkbox';check.value=id;field(extras,id,check);
    check.onchange=()=>{if(check.checked)selected.add(id);else selected.delete(id);photoBox.hidden=!selected.has('fotokeramika');update();};
  }
  extras.append(photoBox);
  el('letter-panel').hidden=!font.value||!finish.value;el('extra-panel').hidden=!config.doplnky?.length;
  function sampleVisibility(){
    const activePeople=product.value==='dvojhrob'?people:people.slice(0,1);
    example.hidden=activePeople.every(person=>Object.values(person).some(input=>input.value));
  }
  function sync(){
    syncPlacements();
    const double=product.value==='dvojhrob';tabs.second.hidden=!double;
    tabs.first.textContent=double?t.firstPerson:t.letterTabs.first;
    if(!double&&active==='second')open('first');refreshPreview();
  }
  function refreshPreview(){
    sampleVisibility();
    const hasText=people.slice(0,product.value==='dvojhrob'?2:1).some(p=>Object.values(p).some(input=>input.value.trim()))||Boolean(epitaph.value.trim());
    tabs.style.disabled=tabs.color.disabled=!hasText;
    if(!hasText&&['style','color'].includes(active))open('first');
    const person=people.slice(0,product.value==='dvojhrob'?2:1).find(p=>p.first.value.trim()||p.last.value.trim());
    const dates=people.slice(0,product.value==='dvojhrob'?2:1).flatMap(p=>[p.birth.value,p.death.value]).filter(Boolean);
    const sample=person?[person.first.value,person.last.value].filter(Boolean).join(' '):epitaph.value.trim()||dates.join(' – ')||t.sampleName;
    for(const demo of font.container.querySelectorAll('i')){demo.textContent=sample;demo.title=sample;}
  }
  async function update(){
    refreshPreview();
    const id=++version,family=fonts[font.value]??'Playfair';
    await document.fonts.load('24px '+family);
    await new Promise(requestAnimationFrame);if(id!==version)return;
    viewer.decorate({nameAt:locations.nameAt.select.value,verseAt:locations.verseAt.select.value,font:family,finish:finish.value,extras:selected,photo,epitaph:epitaph.value.normalize('NFC'),
      people:people.map(person=>Object.fromEntries(Object.entries(person).map(([k,input])=>[k,input.value.trim().normalize('NFC')])))});
    changed();
  }
  let chosen=false;
  finish.container.addEventListener('change',()=>{chosen=true;});
  const recommendation=document.createElement('small');
  finish.container.after(recommendation);
  sync.recommend=id=>{
    recommendation.textContent=config.farbyPisma?.includes(id)?t.recommended+' · '+t[id]:'';
    for(const input of finish.container.querySelectorAll('input')){
      input.parentElement.title=t[input.value]+(input.value===id?' · '+t.recommended:'');
      input.parentElement.toggleAttribute('data-recommended',input.value===id);
    }
    if(!chosen&&config.farbyPisma?.includes(id)){finish.select(id);update();}
  };
  sync.flush=async()=>{await pendingPhoto;await update();};
  sync.state=()=>({
    nameAt:locations.nameAt.select.value,verseAt:locations.verseAt.select.value,font:font.value,finish:finish.value,customFinish:chosen,
    people:people.map(person=>Object.fromEntries(Object.entries(person).map(([key,e])=>[key,e.value]))),
    epitaph:epitaph.value,extras:[...selected].sort()
  });
  sync.restore=async d=>{
    const family=d.font==='cormorant'?'playfair':d.font;
    if(config.pisma.includes(family))font.select(family);
    if(config.farbyPisma.includes(d.finish))finish.select(d.finish);
    chosen=d.customFinish===true;
    people.forEach((person,i)=>{for(const [key,e] of Object.entries(person)){
      const value=d.people?.[i]?.[key];e.value=typeof value==='string'?value.slice(0,e.maxLength):'';
    }});
    epitaph.value=typeof d.epitaph==='string'?d.epitaph.slice(0,240).split(/\r?\n/).slice(0,2).join('\n'):'';
    for(const check of extras.querySelectorAll('input[type=checkbox]')){
      check.checked=Array.isArray(d.extras)&&d.extras.includes(check.value);
      if(check.checked)selected.add(check.value);
    }
    photoBox.hidden=!selected.has('fotokeramika');
    sync();
    for(const [key,{select}] of Object.entries(locations))if([...select.options].some(o=>o.value===d[key]))select.value=d[key];
    await update();
  };
  sync.pick=place=>{
    if(!['first','second','epitaph'].includes(active))return;
    const {select}=locations[active==='epitaph'?'verseAt':'nameAt'];
    if(![...select.options].some(o=>o.value===place)||select.value===place)return;
    select.value=place;select.dispatchEvent(new Event('change'));
  };
  sync.focus=()=>locations[active==='epitaph'?'verseAt':'nameAt'].select.value;
  tabs.style.disabled=true;sync();return sync;
}

