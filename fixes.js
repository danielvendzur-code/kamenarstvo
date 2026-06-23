// photo preview v7: real image files, no generated render, no base64.
(function(){
  const main = document.getElementById('mainImg');
  const text = document.getElementById('insc');
  const cfg = document.getElementById('configView');
  if(!main || !text || !cfg || typeof st === 'undefined') return;

  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]});}
  function graveSrc(){return `assets/images/graves/${st.size}-${st.shape}-${st.stone}.webp?v=assets7`;}
  function splitName(name){
    name = (name || 'Rodina Nováková').replace(/\s+/g,' ').trim();
    const words = name.split(' ');
    if(name.length <= 12 || words.length < 2) return esc(name);
    let best = 1, bestDiff = 999;
    for(let i=1;i<words.length;i++){
      const a = words.slice(0,i).join(' ').length;
      const b = words.slice(i).join(' ').length;
      const diff = Math.abs(a-b);
      if(diff < bestDiff){best=i;bestDiff=diff;}
    }
    return esc(words.slice(0,best).join(' ')) + '<br>' + esc(words.slice(best).join(' '));
  }
  function calcFont(name){
    const l = (name || '').length;
    const base = st.size === 'double' ? 15.4 : 13.6;
    const penalty = Math.max(0, l - 15) * .32;
    return Math.max(8.2, Math.min(15.8, base - penalty));
  }
  function pos(){
    const key = `${st.size}-${st.shape}`;
    const map = {
      'single-rect':[50,22,23,104],
      'single-arch':[50,24,25,112],
      'single-book':[50,21,28,122],
      'double-rect':[50,21,34,150],
      'double-arch':[50,22,34,152],
      'double-book':[50,21,36,158]
    };
    return map[key] || [50,22,28,128];
  }
  function clearGenerated(){
    document.querySelectorAll('.graveRender').forEach(function(el){el.remove();});
  }
  function forceImageCss(){
    clearGenerated();
    main.style.display = 'block';
    main.style.objectFit = 'contain';
    main.style.objectPosition = 'center center';
    main.style.transform = 'none';
    main.style.background = '#111';
  }
  function applyPhotoFast(next){
    forceImageCss();
    if(main.getAttribute('src') === next) return;
    main.classList.add('is-changing');
    const img = new Image();
    img.onload = function(){
      main.src = next;
      forceImageCss();
      requestAnimationFrame(function(){ main.classList.remove('is-changing'); });
    };
    img.onerror = function(){ main.src = next; forceImageCss(); main.classList.remove('is-changing'); };
    img.src = next;
  }
  updatePhoto = window.updatePhoto = function(){
    cfg.dataset.step = String(st.step);
    applyPhotoFast(graveSrc());
    const p = pos();
    const name = (st.name || 'Rodina Nováková').trim();
    text.style.display = 'flex';
    text.style.left = p[0] + '%';
    text.style.top = p[1] + '%';
    text.style.width = p[2] + '%';
    text.style.maxWidth = p[3] + 'px';
    text.style.fontSize = calcFont(name) + 'px';
    text.style.color = ({gold:'#e4c15f',silver:'#f0f2f4',white:'#fff8ee'}[st.letter] || '#e4c15f');
    text.style.fontFamily = st.font === 'modern' ? 'Inter, system-ui, sans-serif' : 'Georgia, serif';
    text.style.letterSpacing = st.font === 'modern' ? '.005em' : '.025em';
    text.innerHTML = '<span>' + splitName(name) + '</span><small>' + esc(st.dates || '† 1948 – 2024') + '</small>';
  };
  setVal = window.setVal = function(group,value){
    if(st[group] === value) return;
    st[group] = value;
    render();
  };
  const baseRender = render;
  render = window.render = function(){
    baseRender();
    cfg.dataset.step = String(st.step);
    updatePhoto();
    const stepEl = document.getElementById('step');
    if(stepEl){ stepEl.style.overflowY = 'auto'; stepEl.style.minHeight = '0'; }
    if(st.step === 3){
      const h2 = document.querySelector('#step h2');
      if(h2) h2.textContent = 'Vyberte písmo na pomník';
      const p = document.querySelector('#step p');
      if(p) p.textContent = 'Hore je živý náhľad mena priamo na kameni. Farba aj štýl sa menia okamžite.';
    }
  };
  showChat = window.showChat = function(){
    chatView.classList.add('active');
    configView.classList.remove('active');
    if(window.msgs && !msgs.children.length){
      bot('Dobrý deň, pomôžem vám vyskladať pomník a pripraviť dopyt.');
      bot('Môžete spustiť konfigurátor alebo sa opýtať na kameň, písmo či montáž.');
    }
  };
  render();
})();
