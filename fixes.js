// hard override v6: generated consistent monument preview, no base64, scrollable steps.
(function(){
  const main = document.getElementById('mainImg');
  const text = document.getElementById('insc');
  const cfg = document.getElementById('configView');
  const photo = document.querySelector('.photo');
  if(!photo || !cfg || typeof st === 'undefined') return;

  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]});}
  function splitName(name){
    name = (name || 'Rodina Nováková').replace(/\s+/g,' ').trim();
    const words = name.split(' ');
    if(name.length <= 12 || words.length < 2) return [esc(name)];
    let best = 1, bestDiff = 999;
    for(let i=1;i<words.length;i++){
      const a = words.slice(0,i).join(' ').length;
      const b = words.slice(i).join(' ').length;
      const diff = Math.abs(a-b);
      if(diff < bestDiff){best=i;bestDiff=diff;}
    }
    return [esc(words.slice(0,best).join(' ')), esc(words.slice(best).join(' '))];
  }
  function stonePalette(){
    if(st.stone === 'gray') return {a:'#d1cec4', b:'#817f78', c:'#f4f1e8', d:'#5f5e5a', grain:'#ffffff'};
    if(st.stone === 'red') return {a:'#a84c38', b:'#57271f', c:'#c8785e', d:'#3b1b16', grain:'#ffd2c4'};
    return {a:'#262626', b:'#050505', c:'#55534d', d:'#000000', grain:'#ffffff'};
  }
  function textColor(){ return ({gold:'#e4c15f',silver:'#eef1f4',white:'#fff8ee'}[st.letter] || '#e4c15f'); }
  function fontFamily(){ return st.font === 'modern' ? 'Inter, Arial, sans-serif' : (st.font === 'script' ? 'Georgia, serif' : 'Georgia, serif'); }
  function labelFontSize(){
    const len = (st.name || 'Rodina Nováková').length;
    return Math.max(25, Math.min(39, 36 - Math.max(0, len - 15) * .7));
  }
  function shapePath(w, h){
    if(st.shape === 'arch') return `M ${-w/2} ${h/2} L ${-w/2} ${-h/2+46} Q ${-w/2} ${-h/2} 0 ${-h/2} Q ${w/2} ${-h/2} ${w/2} ${-h/2+46} L ${w/2} ${h/2} Z`;
    if(st.shape === 'book') return `M ${-w/2} ${h/2} L ${-w/2+16} ${-h/2+12} Q ${-w/4} ${-h/2-8} 0 ${-h/2+22} Q ${w/4} ${-h/2-8} ${w/2-16} ${-h/2+12} L ${w/2} ${h/2} Q 0 ${h/2+14} ${-w/2} ${h/2} Z`;
    return `M ${-w/2} ${h/2} L ${-w/2} ${-h/2} Q ${-w/2} ${-h/2-8} ${-w/2+8} ${-h/2-8} L ${w/2-8} ${-h/2-8} Q ${w/2} ${-h/2-8} ${w/2} ${-h/2} L ${w/2} ${h/2} Z`;
  }
  function renderGrave(){
    cfg.dataset.step = String(st.step);
    const pal = stonePalette();
    const wide = st.size === 'double';
    const stoneW = wide ? 420 : 282;
    const stoneH = st.shape === 'book' ? 224 : 260;
    const slabW = wide ? 620 : 430;
    const nameLines = splitName(st.name);
    const fs = labelFontSize();
    const line1Y = nameLines.length > 1 ? 266 : 280;
    const line2Y = 300;
    const datesY = nameLines.length > 1 ? 329 : 315;
    const family = fontFamily();
    const fill = textColor();
    const rect = shapePath(stoneW, stoneH);
    let nameSvg = `<text x="600" y="${line1Y}" text-anchor="middle" font-size="${fs}" font-weight="700" font-family="${family}" fill="${fill}" stroke="rgba(0,0,0,.55)" stroke-width="1.15" paint-order="stroke fill" letter-spacing="1.5">${nameLines[0]}</text>`;
    if(nameLines[1]) nameSvg += `<text x="600" y="${line2Y}" text-anchor="middle" font-size="${Math.max(23,fs-3)}" font-weight="700" font-family="${family}" fill="${fill}" stroke="rgba(0,0,0,.55)" stroke-width="1.15" paint-order="stroke fill" letter-spacing="1.5">${nameLines[1]}</text>`;
    const dates = esc(st.dates || '† 1948 – 2024');
    const svg = `<svg viewBox="0 0 1200 760" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Náhľad pomníka"><defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbf6ec"/><stop offset="1" stop-color="#eadfce"/></linearGradient><radialGradient id="glow" cx="50%" cy="18%" r="65%"><stop offset="0" stop-color="#fffdf8" stop-opacity=".9"/><stop offset="1" stop-color="#eadfce" stop-opacity="0"/></radialGradient><linearGradient id="stone" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.c}"/><stop offset=".42" stop-color="${pal.a}"/><stop offset="1" stop-color="${pal.b}"/></linearGradient><linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${pal.a}"/><stop offset="1" stop-color="${pal.d}"/></linearGradient><filter id="grain" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncA type="table" tableValues="0 .18"/></feComponentTransfer></filter><filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feDropShadow dx="0" dy="18" stdDeviation="18" flood-color="#1c130d" flood-opacity=".28"/></filter></defs><rect width="1200" height="760" fill="url(#sky)"/><rect width="1200" height="760" fill="url(#glow)"/><ellipse cx="600" cy="610" rx="390" ry="52" fill="#8a765f" opacity=".24"/><g transform="translate(600 450)" filter="url(#shadow)"><path d="M ${-slabW/2} 78 L ${slabW/2} 78 L ${slabW/2-70} 155 L ${-slabW/2+70} 155 Z" fill="url(#edge)"/><path d="M ${-slabW/2+34} 26 L ${slabW/2-34} 26 L ${slabW/2} 78 L ${-slabW/2} 78 Z" fill="url(#stone)"/><path d="M ${-slabW/2+85} 40 L ${slabW/2-85} 40 L ${slabW/2-48} 70 L ${-slabW/2+48} 70 Z" fill="rgba(255,255,255,.10)"/></g><g transform="translate(600 294)" filter="url(#shadow)"><path d="${rect}" fill="url(#stone)" stroke="rgba(255,255,255,.28)" stroke-width="3"/><path d="${rect}" fill="${pal.grain}" opacity=".25" filter="url(#grain)"/><path d="M ${-stoneW/2+18} ${-stoneH/2+16} L ${stoneW/2-18} ${-stoneH/2+16}" stroke="rgba(255,255,255,.28)" stroke-width="2" opacity=".55"/><path d="M ${stoneW/2-18} ${-stoneH/2+20} L ${stoneW/2-18} ${stoneH/2-10}" stroke="rgba(0,0,0,.28)" stroke-width="5" opacity=".28"/></g><g>${nameSvg}<text x="600" y="${datesY}" text-anchor="middle" font-size="18" font-weight="600" font-family="Georgia,serif" fill="${fill}" opacity=".96" stroke="rgba(0,0,0,.55)" stroke-width=".7" paint-order="stroke fill">${dates}</text></g><g opacity=".54"><path d="M160 635c90-42 177-34 252-8 92 32 165 30 260-4 120-42 231-31 368 28" fill="none" stroke="#bca98e" stroke-width="6" stroke-linecap="round"/><circle cx="240" cy="610" r="8" fill="#d1b889"/><circle cx="910" cy="612" r="7" fill="#d1b889"/><circle cx="985" cy="638" r="10" fill="#caa872"/></g></svg>`;
    let wrap = photo.querySelector('.graveRender');
    if(!wrap){ wrap = document.createElement('div'); wrap.className = 'graveRender'; photo.insertBefore(wrap, photo.firstChild); }
    wrap.innerHTML = svg;
  }
  updatePhoto = window.updatePhoto = renderGrave;
  setVal = window.setVal = function(group,value){ if(st[group] === value) return; st[group] = value; render(); };
  const baseRender = render;
  render = window.render = function(){
    baseRender();
    cfg.dataset.step = String(st.step);
    renderGrave();
    const stepEl = document.getElementById('step');
    if(stepEl){ stepEl.style.overflowY = 'auto'; stepEl.style.minHeight = '0'; }
    if(st.step === 3){
      const h2 = document.querySelector('#step h2');
      if(h2) h2.textContent = 'Vyberte písmo na pomník';
      const p = document.querySelector('#step p');
      if(p) p.textContent = 'Hore je presný živý náhľad mena priamo na pomníku. Farba aj štýl sa menia okamžite.';
    }
  };
  showChat = window.showChat = function(){
    chatView.classList.add('active');
    configView.classList.remove('active');
    if(window.msgs && !msgs.children.length){ bot('Dobrý deň, pomôžem vám vyskladať pomník a pripraviť dopyt.'); bot('Môžete spustiť konfigurátor alebo sa opýtať na kameň, písmo či montáž.'); }
  };
  render();
})();
