import {choiceSet,families as fonts} from './volby.js';
const el=id=>document.getElementById(id);
export function editor(config,t,product,viewer,detail){
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
  font.container.onchange=finish.container.onchange=()=>{detail();update();};
  const second=document.createElement('fieldset'),legend=document.createElement('legend');
  legend.textContent=t.second;second.append(legend);
  for(const parent of [letters,second]){
    const person={};people.push(person);
    for(const key of ['first','last','birth','death']){
      const input=document.createElement('input');input.maxLength=key==='first'||key==='last'?80:32;
      field(parent,key,input);person[key]=input;input.oninput=()=>{detail();update();};
    }
  }
  letters.append(second);
  const epitaph=field(letters,'epitaph',document.createElement('textarea'));
  epitaph.maxLength=240;epitaph.rows=2;
  epitaph.oninput=()=>{epitaph.value=epitaph.value.split(/\r?\n/).slice(0,2).join('\n');detail();update();};
  const example=document.createElement('button');
  example.type='button';example.className='example';example.textContent=t.insertSample;
  if(config.vzorNapisu){
    letters.prepend(example);
    example.onclick=()=>{
      people.forEach((person,i)=>{
        if(i===1&&product.value!=='dvojhrob')return;
        if(Object.values(person).every(input=>!input.value))
          for(const [key,input] of Object.entries(person))input.value=config.vzorNapisu.osoby?.[i]?.[key]??'';
      });
      if(!epitaph.value)epitaph.value=config.vzorNapisu.epitaf??'';detail();update();
    };
  }
  const photoBox=document.createElement('div'),input=document.createElement('input'),reset=document.createElement('button'),error=document.createElement('small');
  input.type='file';input.accept='image/jpeg,image/png,image/webp';
  field(photoBox,'portrait',input);reset.type='button';reset.textContent=t.clearPhoto;reset.hidden=true;
  error.setAttribute('role','status');photoBox.append(reset,error);photoBox.hidden=true;
  reset.onclick=()=>{photoVersion++;photo=null;input.value='';reset.hidden=true;error.textContent='';update();};
  input.onchange=async()=>{
    const file=input.files[0],revision=++photoVersion;if(!file)return;
    try{
      const bitmap=await createImageBitmap(file);
      if(revision!==photoVersion){bitmap.close();return;}
      const canvas=document.createElement('canvas'),ratio=Math.min(1,768/Math.max(bitmap.width,bitmap.height));
      canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
      canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
      photo=canvas;reset.hidden=false;error.textContent='';update();
    }catch{if(revision===photoVersion){error.textContent=t.badPhoto;input.value='';}}
  };
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
  function sync(){second.hidden=product.value!=='dvojhrob';sampleVisibility();}
  async function update(){
    sampleVisibility();
    const id=++version,family=fonts[font.value]??'Cormorant';
    await document.fonts.load('24px '+family);
    await new Promise(requestAnimationFrame);if(id!==version)return;
    viewer.decorate({font:family,finish:finish.value,extras:selected,photo,epitaph:epitaph.value,
      people:people.map(person=>Object.fromEntries(Object.entries(person).map(([k,input])=>[k,input.value.trim()])))});
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
  sync();return sync;
}
