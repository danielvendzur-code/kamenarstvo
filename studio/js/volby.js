const ns='http://www.w3.org/2000/svg';
const icons={
  jednohrob:'M5 23 28 27 43 18 20 15Z M5 23v3l23 4 15-9v-3 M21 15V5l12 2v10',
  dvojhrob:'M2 22 27 28 46 18 20 13Z M2 22v3l25 6 19-10v-3 M16 14V4l22 4v10',
  urna:'M11 22 30 26 39 21 20 17Z M12 19l6-14 20 4-7 14Z',
  pamatna:'M9 5h29v22H9Z M12 8h23v16H12Z',
  rovny:'M7 26V6h34v20 M4 27h40v3H4Z',
  obluk:'M7 26V10Q24 -1 41 10v16 M4 27h40v3H4Z',
  vlna:'M7 26V7c13-7 21 10 34 4v15 M4 27h40v3H4Z',
  kniha:'M4 7q10-4 20 1 10-5 20-1v18q-10-4-20 0-10-4-20 0Z M24 8v17',
  cela:'M4 21 21 6l23 4-17 16Z M4 21v3l23 5 17-16v-3',
  delena:'M4 21 21 6l23 4-17 16Z M4 21v3l23 5 17-16v-3 M15 23 32 8',
  kvety:'M4 21 21 6l23 4-17 16Z M4 21v3l23 5 17-16v-3 M14 19l6-5 14 3-6 5Z',
  rano:'M3 24h42 M14 23a10 10 0 0 1 20 0 M24 4v5 M7 11l4 4 M41 11l-4 4',
  podvecer:'M3 22h42 M16 22a8 8 0 0 1 16 0 M8 27h20 M33 27h6',
  atelier:'M6 26V7h23 M6 15l10-8 M28 7l8 5-9 12-8-5Z M32 23l7 6',
  angle:'M6 12l16-7 19 6-16 8Z M6 12v12l19 5 16-7V11 M25 19v10',
  front:'M8 25V7h31v18Z M4 28h39',side:'M18 25V7l9-2v21Z M14 28h17',
  detail:'M28 18l12 9 M29 13a9 9 0 1 1-18 0 9 9 0 1 1 18 0'
};
export function pictogram(id){
  const svg=document.createElementNS(ns,'svg'),path=document.createElementNS(ns,'path');
  svg.setAttribute('viewBox','0 0 48 32');svg.setAttribute('aria-hidden','true');
  path.setAttribute('d',icons[id]??'');svg.append(path);return svg;
}
const inks={zlata:'#b18b49',strieborna:'#b4b9bb',biela:'#f5f2e9',cierna:'#202122',piesokovana:'#a59a8a'};
export const families={cinzel:'Cinzel',cormorant:'Cormorant',playfair:'Playfair','great-vibes':'GreatVibes'};

export function choiceSet(container,ids,t,kind){
  const name=container.id;
  container.classList.add('cards',kind);
  function fill(values){
    const previous=container.querySelector(':checked')?.value;
    container.replaceChildren(...values.map((id,i)=>{
      const label=document.createElement('label'),input=document.createElement('input'),caption=document.createElement('span');
      input.type='radio';input.name=name;input.value=id;input.checked=values.includes(previous)?id===previous:i===0;
      caption.textContent=t[id];label.append(input);
      if(kind==='profiles')label.append(pictogram(id));
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
