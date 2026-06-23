// Final UX fixes: fast photo switching, centered inscription, letter step as live text preview.
(function(){
  const main = document.getElementById('mainImg');
  const text = document.getElementById('insc');
  const cfg = document.getElementById('configView');
  if(!main || !text || !cfg || typeof st === 'undefined') return;

  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]});}
  function graveSrc(){return `assets/images/graves/${st.size}-${st.shape}-${st.stone}.webp`;}
  function splitName(name){
    name = (name || 'Rodina Nováková').replace(/\s+/g,' ').trim();
    if(name.length <= 15) return esc(name);
    const words = name.split(' ');
    if(words.length === 1) return esc(name);
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
    const base = st.size === 'double' ? 18 : 16;
    const penalty = Math.max(0, l - 14) * .42;
    const fontBoost = st.font === 'script' ? 1.2 : 0;
    return Math.max(8.5, Math.min(19, base - penalty + fontBoost));
  }
  function pos(){
    const map = {
      single:{rect:[50,42,25,120],arch:[50,44,24,115],book:[50,48,31,130]},
      double:{rect:[50,43,31,145],arch:[50,45,30,140],book:[50,49,38,155]}
    };
    return (map[st.size] && map[st.size][st.shape]) || [50,43,28,130];
  }
  const oldUpdate = updatePhoto;
  updatePhoto = window.updatePhoto = function(){
    cfg.dataset.step = String(st.step);
    const next = graveSrc();
    if(main.getAttribute('src') !== next){
      main.classList.add('is-changing');
      const img = new Image();
      img.onload = function(){
        main.src = next;
        requestAnimationFrame(function(){ main.classList.remove('is-changing'); });
      };
      img.onerror = function(){ main.src = next; main.classList.remove('is-changing'); };
      img.src = next;
    }
    const p = pos();
    const name = (st.name || 'Rodina Nováková').trim();
    text.style.left = p[0] + '%';
    text.style.top = p[1] + '%';
    text.style.width = p[2] + '%';
    text.style.maxWidth = p[3] + 'px';
    text.style.fontSize = calcFont(name) + 'px';
    text.style.color = ({gold:'#e4c15f',silver:'#f0f2f4',white:'#fff8ee'}[st.letter] || '#e4c15f');
    text.style.fontFamily = st.font === 'modern' ? 'Inter, system-ui, sans-serif' : (st.font === 'script' ? 'Georgia, serif' : 'Georgia, serif');
    text.style.letterSpacing = st.font === 'modern' ? '.005em' : '.025em';
    text.innerHTML = '<span>' + splitName(name) + '</span><small>' + esc(st.dates || '† 1948 – 2024') + '</small>';
  };

  const oldSet = setVal;
  setVal = window.setVal = function(group,value){
    if(st[group] === value) return;
    st[group] = value;
    render();
  };

  const oldRender = render;
  render = window.render = function(){
    oldRender();
    cfg.dataset.step = String(st.step);
    updatePhoto();
    if(st.step === 3){
      const h2 = document.querySelector('#step h2');
      if(h2) h2.textContent = 'Vyberte písmo na pomník';
      const p = document.querySelector('#step p');
      if(p) p.textContent = 'Hore je živý náhľad mena priamo na pomníku. Farbu a štýl písma vidíte hneď pri prekliku.';
    }
  };

  function preload(){
    ['single','double'].forEach(function(size){
      ['rect','arch','book'].forEach(function(shape){
        ['black','gray','red'].forEach(function(stone){
          const i = new Image();
          i.src = `assets/images/graves/${size}-${shape}-${stone}.webp`;
        });
      });
    });
  }
  preload();
  render();
})();
