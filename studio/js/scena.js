import * as T from 'three';
import {garden,parkSky} from './prostredie.js';
import {Reflector} from '../vendor/Reflector.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {vytvorZulu,vzorka} from './kamen.js';
import {jednohrob} from './tvary.js';

function surface(w,h){
  const canvas=document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  return canvas.getContext('2d');
}

function landscape(random){
  const ctx=surface(2048,1024);
  const sky=ctx.createLinearGradient(0,0,0,1024);
  for(const [stop,color] of [[0,'#aaaeb2'],[0.40,'#f2f3f4'],[0.49,'#ffffff'],
                            [0.53,'#a3a4a5'],[0.65,'#424446'],[1,'#242526']]){
    sky.addColorStop(stop,color);
  }
  ctx.fillStyle=sky;ctx.fillRect(0,0,2048,1024);
  // Different heights and distances break the horizon into sky, crowns and trunks.
  for(let i=0;i<56;i++){
    const x=(i+0.2+0.6*random())*2048/56, foot=535+random()*85;
    const height=186+random()*152;
    const shade=Math.round(42+random()*63);
    const tree=surface(230,300);
    tree.lineCap='round';
    function branch(px,py,length,angle,width,level){
      const ex=px+length*Math.sin(angle),ey=py-length*Math.cos(angle);
      tree.strokeStyle='rgb('+shade+' '+shade+' '+shade+')';
      tree.lineWidth=width;
      tree.beginPath();tree.moveTo(px,py);tree.lineTo(ex,ey);tree.stroke();
      if(level>0){
        for(const sign of [-1,1]){
          branch(ex,ey,length*(0.58+random()*0.16),angle+sign*(0.18+random()*0.49),
            width*0.61,level-1);
        }
      }else{
        for(let k=0;k<22;k++){
          const radius=1+random()*2.6,value=shade+Math.round(random()*34);
          tree.fillStyle='rgb('+value+' '+value+' '+value+')';
          tree.beginPath();tree.arc(ex+(random()-0.5)*20,ey+(random()-0.5)*15,radius,0,2*Math.PI);tree.fill();
        }
      }
    }
    branch(115,299,87,random()*0.14-0.07,7,6);
    for(const dx of [-2048,0,2048]){
      ctx.drawImage(tree.canvas,x+dx-height*0.38,foot-height,height*0.76,height);
    }
  }
  const tex=new T.CanvasTexture(ctx.canvas);
  tex.colorSpace=T.SRGBColorSpace; tex.mapping=T.EquirectangularReflectionMapping;
  return tex;
}

function gravel(random){
  const ctx=surface(512,512);
  ctx.fillStyle='#c6bfac';ctx.fillRect(0,0,512,512);
  for(let i=0;i<43000;i++){
    const tone=Math.floor(144+random()*78);
    ctx.fillStyle='rgb('+tone+','+(tone-4)+','+(tone-15)+')';
    ctx.fillRect(random()*512,random()*512,1+random()*3,1+random()*2);
  }
  const tex=new T.CanvasTexture(ctx.canvas);
  tex.colorSpace=T.SRGBColorSpace;tex.wrapS=tex.wrapT=T.RepeatWrapping;
  tex.repeat.set(160,160);tex.anisotropy=4;
  return tex;
}

export function scena(host,model,stone,onOrbit){
  const mobile=matchMedia('(max-width:760px)').matches;
  const renderer=new T.WebGLRenderer({antialias:!mobile,powerPreference:mobile?'low-power':'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.style.visibility='hidden';
  host.append(renderer.domElement);
  let seed=2701;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const scene=new T.Scene(), panorama=landscape(random);
  const generator=new T.PMREMGenerator(renderer);
  scene.environment=generator.fromEquirectangular(panorama).texture;
  generator.dispose();
  scene.background=panorama;scene.backgroundBlurriness=0.17;
  scene.fog=new T.FogExp2(0xd7d7d7,0.055);
  let fastMotion=false;
  function coverFace(width,depth){
    const size=mobile?192:1024;
    const face=new Reflector(new T.PlaneGeometry(width,depth),{
      textureWidth:size,textureHeight:size,clipBias:0,multisample:0
    });
    const captureMaterial=face.material;
    face.material=vytvorZulu(stone,{mirror:captureMaterial.uniforms});
    captureMaterial.dispose();
    const capture=face.onBeforeRender;
    let lastCapture=0;
    face.onBeforeRender=(renderer,scene,camera)=>{
      // Reuse the most recent planar capture during short low-tier drags.
      // Its original projective matrix keeps it registered to the cover.
      const now=performance.now();
      if(fastMotion && now-lastCapture<90)return;
      lastCapture=now;
      const backgroundBlur=scene.backgroundBlurriness, originalSky=scene.background;
      const baked=mobile && grounds?.visible && probes.get(active);
      if(baked){grounds.visible=false;scene.background=baked.texture;}
      scene.backgroundBlurriness=0;
      try{capture(renderer,scene,camera);}
      finally{scene.backgroundBlurriness=backgroundBlur;scene.background=originalSky;if(baked)grounds.visible=true;}
    };
    face.receiveShadow=true;
    return face;
  }
  const monument=jednohrob(model,vytvorZulu(stone),vytvorZulu(stone,{satin:true}),coverFace);
  scene.add(monument);
  const ground=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({
    map:gravel(random),roughness:1
  }));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // A footprint-shaped falloff anchors the rails between directional shadows.
  const ctx=surface(256,512);
  ctx.filter='blur(11px)';ctx.fillStyle='rgba(31,29,25,.54)';ctx.fillRect(24,29,208,454);
  const contact=new T.Mesh(new T.PlaneGeometry(model.sirka*1.28,model.dlzka*1.20),
    new T.MeshBasicMaterial({color:0x000000,map:new T.CanvasTexture(ctx.canvas),transparent:true,opacity:.70,depthWrite:false,fog:false,toneMapped:false}));
  contact.renderOrder=1;contact.rotation.x=-Math.PI/2;contact.position.y=0.001;scene.add(contact);
  const hemi=new T.HemisphereLight(0xffffff,0x909090,0.6);
  scene.add(hemi);
  const sun=new T.DirectionalLight(0xffffff,1.35);
  sun.position.set(-2,7,-1.4);sun.castShadow=true;
  sun.shadow.mapSize.setScalar(mobile?1024:2048);
  Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:1,far:12});
  sun.shadow.normalBias=0.0012;
  sun.shadow.bias=-0.00007;
  scene.add(sun);
  // Expand the PCF footprint with blocker distance for this orthographic light.
  // Near the contact line keep the built-in sub-texel PCFSoft filter.
  const shadowChunk=T.ShaderChunk.shadowmap_pars_fragment.replace(
    '#elif defined( SHADOWMAP_TYPE_VSM )',
    `float blockerDepth=unpackRGBAToDepth(texture2D(shadowMap,shadowCoord.xy));
     float separation=max(0.0,shadowCoord.z-blockerDepth);
     // Look just inside the silhouette as well, so the penumbra extends outside.
     for(int i=0;i<6;i++){
       float angle=float(i)*1.04719755;
       vec2 offset=vec2(cos(angle),sin(angle))*0.0025;
       float sampleDepth=unpackRGBAToDepth(texture2D(shadowMap,shadowCoord.xy+offset));
       separation=max(separation,shadowCoord.z-sampleDepth);
     }
     float radius=min(0.005,separation*0.065);
     if(radius>texelSize.x){
       float visibility=0.0;
       for(int i=0;i<16;i++){
         float n=float(i)+0.5;
         vec2 disk=vec2(cos(n*2.399963),sin(n*2.399963))*sqrt(n/16.0);
         visibility+=texture2DCompare(shadowMap,shadowCoord.xy+disk*radius,shadowCoord.z);
       }
       shadow=mix(shadow,visibility/16.0,smoothstep(texelSize.x,2.0*texelSize.x,radius));
     }
     #elif defined( SHADOWMAP_TYPE_VSM )`
  );
  function softShadows(materials){
    if(mobile)return;
    for(const mat of materials){
      const compile=mat.onBeforeCompile.bind(mat);
      mat.onBeforeCompile=(shader,renderer)=>{
        compile(shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',shadowChunk);
      };
    }
  }
  const receivers=new Set([ground.material]);
  monument.traverse(mesh=>{
    if(mesh.isMesh)for(const mat of [mesh.material].flat())receivers.add(mat);
  });
  softShadows(receivers);
  const camera=new T.PerspectiveCamera(33,1,0.05,180);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.minDistance=1.65;controls.maxDistance=7;
  controls.minPolarAngle=0.14;controls.maxPolarAngle=Math.PI*.49;
  const target=new T.Vector3(0,0.39,0.03);
  const directions={angle:[1.65,1.13,2.22],front:[0,0.8,3],side:[3,0.8,0]};
  function distance(){
    return Math.max(4.35,4.48/camera.aspect);
  }
  let flight=0;
  function view(key,duration=640){
    const detail=key==='detail', outside=active&&active!=='atelier';
    const focus=detail?new T.Vector3(0,.68,-.805):target;
    const direction=detail?[-.29,.03,1]:outside&&key==='angle'?[1.57,.51,2.55]:directions[key];
    const end=new T.Vector3().fromArray(direction).normalize().multiplyScalar(detail?2.02:distance()*(outside&&!mobile?.94:1));
    const fromFocus=controls.target.clone(), from=new T.Spherical().setFromVector3(camera.position.clone().sub(fromFocus));
    const to=new T.Spherical().setFromVector3(end);
    const delta=Math.atan2(Math.sin(to.theta-from.theta),Math.cos(to.theta-from.theta));
    cancelAnimationFrame(flight);
    if(matchMedia('(prefers-reduced-motion:reduce)').matches)duration=0;
    const start=performance.now();
    function step(now){
      const t=duration?Math.min(1,(now-start)/duration):1, u=1-(1-t)**3;
      const spherical=new T.Spherical(T.MathUtils.lerp(from.radius,to.radius,u),
        T.MathUtils.lerp(from.phi,to.phi,u),from.theta+delta*u);
      controls.target.lerpVectors(fromFocus,focus,u);
      camera.position.setFromSpherical(spherical).add(controls.target);
      controls.update();invalidate();
      if(t<1)flight=requestAnimationFrame(step);
    }
    step(start);
  }
  let frame=0,settleTimer;
  const fullDpr=renderer.getPixelRatio();
  let moving=false, lastMove=0, slowFrames=0;
  let motionDpr=Math.min(.9,fullDpr);
  function motionDetail(low){
    fastMotion=low;
    if(grounds){
      // Nearby blades disappear into the photographed turf at subpixel size.
      grounds.children[1].visible=!low;
    }
  }
  function motion(){
    if(!mobile)return;
    const now=performance.now(),elapsed=now-lastMove;
    if(moving&&elapsed>36&&elapsed<250)slowFrames++;
    lastMove=now;
    if(slowFrames>=2&&motionDpr>.54){
      motionDpr=Math.max(.54,motionDpr-.18);
      renderer.setPixelRatio(motionDpr);motionDetail(true);slowFrames=0;
    }
    clearTimeout(settleTimer);
    if(!moving){
      moving=true;renderer.setPixelRatio(motionDpr);motionDetail(motionDpr<.75);
    }
    settleTimer=setTimeout(()=>{
      moving=false;motionDetail(false);renderer.setPixelRatio(fullDpr);invalidate();
    },200);
  }
  function invalidate(){
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});
  }
  controls.addEventListener('change',()=>{motion();invalidate();});
  controls.addEventListener('start',()=>{cancelAnimationFrame(flight);onOrbit();});
  function zoom(factor){
    cancelAnimationFrame(flight);
    const offset=camera.position.clone().sub(controls.target);
    camera.position.copy(offset.setLength(T.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance))).add(controls.target);
    controls.update();invalidate();
  }
  function resize(){
    camera.aspect=host.clientWidth/host.clientHeight;
    const offset=host.clientWidth>760?(document.querySelector('aside').offsetWidth+28)*.48:0;
    camera.setViewOffset(host.clientWidth,host.clientHeight,offset,0,host.clientWidth,host.clientHeight);
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth,host.clientHeight,false);invalidate();
  }
  const studioEnv=scene.environment, studioFog=scene.fog;
  const skies=new Map(), probes=new Map();
  let grounds, groundsPending, active, revision=0, fade;
  async function environment(name){
    const request=++revision;
    if(name===active)return;
    if(name!=='atelier'){
      groundsPending??=garden(mobile);
      if(!skies.has(name))skies.set(name,parkSky(name));
      const [park,sky]=await Promise.all([groundsPending,skies.get(name)]);
      if(request!==revision)return;
      if(!grounds){
        grounds=park;grounds.visible=false;scene.add(grounds);
        softShadows([grounds.children[0].material,grounds.children[2].material]);
      }
      skies.set(name,sky);
    }
    if(request!==revision)return;
    const first=!active;
    const old=host.querySelector('.scene-fade');
    if(!first&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      renderer.render(scene,camera);
      const overlay=document.createElement('canvas');
      overlay.width=renderer.domElement.width;overlay.height=renderer.domElement.height;
      overlay.className='scene-fade';overlay.setAttribute('aria-hidden','true');
      const ctx=overlay.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
      if(old){ctx.globalAlpha=Number(getComputedStyle(old).opacity);ctx.drawImage(old,0,0);}
      fade?.cancel();old?.remove();host.append(overlay);
    }
    const studio=name==='atelier', dusk=name==='podvecer';
    ground.visible=studio;
    if(grounds)grounds.visible=!studio;
    scene.background=studio?panorama:skies.get(name);
    scene.backgroundBlurriness=studio?.17:0;
    scene.backgroundIntensity=studio?1:dusk?.93:1.12;
    scene.fog=studio?studioFog:new T.FogExp2(dusk?0xd9b99d:0xcbd5cd,dusk?.026:.020);
    hemi.color.set(studio?0xffffff:dusk?0xffe8d6:0xd7e7ff);
    hemi.groundColor.set(studio?0x909090:0x77786c);
    hemi.intensity=studio?.60:.92;
    sun.color.set(studio?0xffffff:dusk?0xffc08a:0xffe0ba);
    sun.intensity=studio?1.35:dusk?2.0:2.15;
    if(studio)sun.position.set(-2,7,-1.4);
    else if(dusk)sun.position.set(-6.8,1.65,-4.6);
    else sun.position.set(5.5,3.4,-3.1);
    const extent=studio?2:6.8;
    Object.assign(sun.shadow.camera,{left:-extent,right:extent,top:extent,bottom:-extent,far:studio?12:20});
    sun.shadow.camera.updateProjectionMatrix();
    if(!studio&&!probes.has(name)){
      // Capture all six directions at the stela in the actual garden, once per light setup.
      const target=new T.WebGLCubeRenderTarget(mobile?128:256,{type:T.HalfFloatType});
      const probe=new T.CubeCamera(.06,90,target);
      probe.position.set(0,.85,-.72);
      const pmrem=new T.PMREMGenerator(renderer);
      scene.environment=null;monument.visible=false;
      renderer.shadowMap.needsUpdate=true;
      try{probe.update(renderer,scene);probes.set(name,pmrem.fromCubemap(target.texture));}
      finally{monument.visible=true;target.dispose();pmrem.dispose();}
    }
    scene.environment=studio?studioEnv:probes.get(name).texture;
    for(const material of receivers){
      if(material.isMeshPhysicalMaterial)material.envMapIntensity=studio?1:1.24;
    }
    renderer.shadowMap.needsUpdate=true;
    active=name;
    if(first){camera.position.set(3,2.05,4.4);controls.target.copy(target);controls.update();view('angle',1600);}
    renderer.render(scene,camera);
    renderer.domElement.style.visibility='visible';
    const overlay=host.querySelector('.scene-fade');
    if(overlay){
      fade=overlay.animate([{opacity:1},{opacity:0}],{duration:300,easing:'ease-out',fill:'forwards'});
      fade.onfinish=()=>overlay.remove();
    }
  }
  resize();view('angle',0);
  new ResizeObserver(resize).observe(host);
  const canvas=renderer.domElement;
  canvas.tabIndex=0;
  canvas.addEventListener('keydown',event=>{
    if(['+','=','-'].includes(event.key)) zoom(event.key==='-'?1.15:1/1.15);
    else if(event.key.startsWith('Arrow')){
      const s=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      if(event.key==='ArrowLeft') s.theta-=0.12;
      if(event.key==='ArrowRight') s.theta+=0.12;
      if(event.key==='ArrowUp') s.phi-=0.09;
      if(event.key==='ArrowDown') s.phi+=0.09;
      s.phi=T.MathUtils.clamp(s.phi,controls.minPolarAngle,controls.maxPolarAngle);
      camera.position.setFromSpherical(s).add(controls.target);controls.update();onOrbit();
    }else return;
    event.preventDefault();
  });
  return {view,zoom,canvas,environment,sample:stone=>vzorka(renderer,stone,studioEnv)};
}
