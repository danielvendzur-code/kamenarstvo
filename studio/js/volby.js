import {profileIcon} from './ikony.js';
const inks={zlata:'#b18b49',strieborna:'#b4b9bb',biela:'#f5f2e9',cierna:'#202122',piesokovana:'#a59a8a'};
export const families={cinzel:'Cinzel',manrope:'Manrope',playfair:'Playfair','great-vibes':'GreatVibes'};

export function choiceSet(container,ids,t,kind){
  const name=container.id;
  container.classList.add('cards',kind);
  function fill(values){
    const previous=container.querySelector(':checked')?.value;
    container.replaceChildren(...values.map((id,i)=>{
      const label=document.createElement('label'),input=document.createElement('input'),caption=document.createElement('span');
      input.type='radio';input.name=name;input.value=id;input.checked=values.includes(previous)?id===previous:i===0;
      caption.textContent=t[id];label.append(input);
      if(name==='profile')label.append(profileIcon(id));
      if(name==='product'||name==='cover'){
        const folder=name==='product'?'vyhotovenia':'dosky';
        const image=document.createElement('img');image.alt='';image.src=new URL('../assets/'+folder+'/'+id+'.webp',import.meta.url).href;
        label.append(image);
      }
      if(kind==='fonts'){
        const demo=document.createElement('i');demo.style.fontFamily=families[id];demo.textContent=t.sampleName;label.append(demo);
      }
      if(kind==='inks'){
        const chip=document.createElement('i');chip.style.backgroundColor=inks[id];label.append(chip);
      }
      label.append(caption);return label;
    }));
  }
  fill(ids??[]);
  return {
    get value(){return container.querySelector('input:checked')?.value??'';},
    select(id){for(const input of container.querySelectorAll('input'))input.checked=input.value===id;},
    fill,container
  };
}
