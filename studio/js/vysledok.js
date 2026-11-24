const byId=id=>document.getElementById(id);

export function readDesign(){
  if(!location.hash.startsWith('#navrh='))return null;
  try{
    const payload=location.hash.slice(7).split('&',1)[0];
    if(payload.length>200000)return null;
    const d=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(payload.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0))));
    if(d?.v===1)return d;
    if(d?.v!==2)return null;
    return {type:d.t,shape:d.s,cover:d.c,stone:d.k,environment:d.e,font:d.f,
      finish:d.i,customFinish:d.u===1,people:d.p,epitaph:d.n,extras:d.x,nameAt:d.a,verseAt:d.b};
  }catch{return null;}
}

export function designLink(state){
  const people=state.people.map(person=>Object.fromEntries(
    ['first','last','birth','death'].filter(key=>person[key]).map(key=>[key,person[key]])));
  const payload={v:2,t:state.type,s:state.shape,c:state.cover||undefined,k:state.stone,
    e:state.environment,f:state.font,i:state.finish,u:state.customFinish?1:undefined,
    p:people.some(person=>Object.keys(person).length)?people:undefined,
    a:state.nameAt,b:state.verseAt,n:state.epitaph||undefined,x:state.extras.length?state.extras:undefined};
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  let binary='';
  for(const byte of bytes)binary+=String.fromCharCode(byte);
  const url=new URL(location.href);
  url.hash='navrh='+btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
  const key=new URLSearchParams(location.hash.slice(1)).get('ukazka');
  if(key && /^[\w-]{43}$/.test(key))url.hash+='&ukazka='+key;
  return url.href;
}

export function resultPanel(t,settings,catalog,edit){
  const summary=byId('summary'),link=byId('design-link'),form=byId('inquiry');
  const confirmation=byId('confirmation'),copy=byId('copy'),policy=byId('policy');
  let current;
  if(settings?.gdprUrl&&settings.gdprUrl!=='#'){
    const url=new URL(settings.gdprUrl,location.href);
    if(['http:','https:'].includes(url.protocol)){policy.href=url.href;policy.hidden=false;}
  }
  if(!settings?.emailjs)byId('simulation').hidden=false;
  function show(state,url){
    const people=state.type==='dvojhrob'?state.people:state.people.slice(0,1);
    const rows=[[t.product,t[state.type]],[t.profile,t[state.shape]]];
    if(state.cover)rows.push([t.cover,t[state.cover]]);
    rows.push([t.stone,catalog.kamene[state.stone].nazov],[t.font,t[state.font]],[t.finish,t[state.finish]]);
    for(const p of people){
      const name=[p.first,p.last].filter(Boolean).join(' ');
      const dates=[p.birth&&'* '+p.birth,p.death&&'† '+p.death].filter(Boolean).join('   ');
      if(name||dates)rows.push([t.person,[name,dates].filter(Boolean).join('\n')]);
    }
    if(state.people.some(p=>Object.values(p).some(Boolean)))rows.push([t.locationName,t[state.nameAt]]);
    if(state.epitaph)rows.push([t.surface,t[state.verseAt]]);
    if(state.epitaph)rows.push([t.epitaph,state.epitaph]);
    rows.push([t.accessories,state.extras.map(id=>t[id]).join(', ')||t.none],[t.prostredia,t[state.environment]]);
    byId('step-title').textContent=t[state.type]+' · '+catalog.kamene[state.stone].nazov;
    const names=people.map(p=>[p.first,p.last,[p.birth,p.death].filter(Boolean).join(' – ')].filter(Boolean).join(' ')).filter(Boolean);
    const inscription=[...names,state.epitaph].filter(Boolean).join(' · ')||t.emptyInscription;
    const groups=[[t.product,t[state.type]],[t.profile,[t[state.shape],t[state.cover]].filter(Boolean).join(' · ')],[t.stone,catalog.kamene[state.stone].nazov],[t.person,inscription],[t.accessories,state.extras.map(id=>t[id]).join(', ')||t.none]];
    summary.replaceChildren(...groups.map(([key,value],index)=>{
      const row=document.createElement('div'),dt=document.createElement('dt'),dd=document.createElement('dd'),button=document.createElement('button');
      dt.textContent=key;dd.textContent=value;dd.title=value;button.textContent=t.edit;button.type='button';button.setAttribute('aria-label',t.edit+' · '+key);button.onclick=()=>edit(index);
      if(index===3&&(names.length||state.epitaph)){
        const details=document.createElement('details'),toggle=document.createElement('summary');
        const preview=document.createElement('span'),full=document.createElement('p');
        preview.textContent=inscription;toggle.append(preview);
        full.textContent=[...names,state.epitaph].filter(Boolean).join('\n');
        toggle.setAttribute('aria-label',t.fullInscription);
        details.ontoggle=()=>{preview.textContent=details.open?t.collapseInscription:inscription;};
        details.append(toggle,full);dd.replaceChildren(details);
      }
      row.append(dt,dd,button);return row;
    }));
    if(current?.url!==url){confirmation.textContent='';copy.textContent=t.copyLink;}
    const lines=rows.map(([k,v])=>k+' — '+v);
    if(state.extras.includes('fotokeramika'))lines.push(t.photoLater);
    current={url,summary:lines.join('\n')};
    link.value=url;link.hidden=true;
  }
  copy.onclick=async()=>{
    try{await navigator.clipboard.writeText(link.value);copy.textContent=t.copied;}
    catch{link.hidden=false;link.focus();link.select();const copied=document.execCommand('copy');link.hidden=copied;copy.textContent=copied?t.copied:t.copyManual;if(copied)copy.focus();}
  };
  form.onsubmit=async event=>{
    event.preventDefault();
    const button=form.querySelector('button');
    if(button.disabled||!current||!form.reportValidity())return;
    button.disabled=true;confirmation.textContent='';
    const payload={...Object.fromEntries(new FormData(form)),summary:current.summary,design_url:current.url};
    try{
      const cfg=settings?.emailjs;
      if(cfg){
        const {serviceId,templateId,publicKey}=cfg;
        if(!serviceId||!templateId||!publicKey)throw Error();
        const response=await fetch('https://api.emailjs.com/api/v1.0/email/send',{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({service_id:serviceId,template_id:templateId,user_id:publicKey,template_params:payload})
        });
        if(!response.ok)throw Error();
      }
      confirmation.textContent=cfg?t.thanks:t.simulatedThanks;form.reset();
    }catch{confirmation.textContent=t.sendError;}
    finally{button.disabled=false;}
  };
  return show;
}

