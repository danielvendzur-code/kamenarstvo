import * as T from 'three';
import {garden,parkSky} from './prostredie.js';
import {Reflector} from '../vendor/Reflector.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {vytvorZulu} from './kamen.js';
import {personalizuj,odstran} from './pismo.js';
import {pomnik} from './tvary.js';

function surface(w,h){
  const canvas=document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  return canvas.getContext('2d');
}

function studioReflection(){
  const ctx=surface(1024,512);
  const gradient=ctx.createLinearGradient(0,0,0,512);
  for(const [position,color] of [[0,'#eee9dc'],[.42,'#c8c3b8'],[.59,'#777773'],[1,'#585853']])
    gradient.addColorStop(position,color);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,1024,512);
  // Long diffuse windows give each polished plane a different reflection.
  for(const [x,y,w,h] of [[70,80,176,204],[612,36,248,164],[922,125,54,224]]){
    ctx.filter='blur(14px)';ctx.fillStyle='#fffcf3';ctx.fillRect(x,y,w,h);
  }
  const map=new T.CanvasTexture(ctx.canvas);
  map.colorSpace=T.SRGBColorSpace;map.mapping=T.EquirectangularReflectionMapping;return map;
}

export function scena(host,model,stone,onOrbit){
  let selection={type:'jednohrob',shape:'rovny',cover:'cela'};
  const mobile=matchMedia('(max-width:760px)').matches;
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:mobile?'low-power':'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.5:2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  renderer.domElement.style.visibility='hidden';
  host.append(renderer.domElement);
  const scene=new T.Scene(),panorama=studioReflection();
  renderer.toneMappingExposure=1.09;
  const generator=new T.PMREMGenerator(renderer);
  scene.environment=generator.fromEquirectangular(panorama).texture;
  generator.dispose();
  scene.background=panorama;scene.backgroundBlurriness=0.17;
  scene.fog=new T.FogExp2(0xeee8dc,.12);
  let fastMotion=false;
  function coverFace(geometry){
    const size=mobile?512:1024;
    const face=new Reflector(geometry,{
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
      if(fastMotion && now-lastCapture<180)return;
      lastCapture=now;
      const backgroundBlur=scene.backgroundBlurriness, originalSky=scene.background;
      const baked=fastMotion && grounds?.visible && skies.get(active);
      if(baked){grounds.visible=false;scene.background=baked;}
      scene.backgroundBlurriness=0;
      try{capture(renderer,scene,camera);}
      finally{scene.backgroundBlurriness=backgroundBlur;scene.background=originalSky;if(baked)grounds.visible=true;}
    };
    face.receiveShadow=true;
    return face;
  }
  let monument=pomnik(model,vytvorZulu(stone),vytvorZulu(stone,{satin:true}),coverFace);
  scene.add(monument);
  const ground=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({
    color:0xe5dece,roughness:.94
  }));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // A footprint-shaped falloff anchors the rails between directional shadows.
  const ctx=surface(256,512);
  ctx.filter='blur(11px)';ctx.fillStyle='rgba(31,29,25,.54)';ctx.fillRect(24,29,208,454);
  const contact=new T.Mesh(new T.PlaneGeometry(model.sirka*1.28,model.dlzka*1.20),
    new T.MeshBasicMaterial({color:0x000000,map:new T.CanvasTexture(ctx.canvas),transparent:true,opacity:.36,depthWrite:false,fog:false,toneMapped:false}));
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
  const fill=new T.DirectionalLight(0xfffaf2,.55);
  fill.position.set(-2,3.6,4.8);scene.add(fill);
  const rim=new T.DirectionalLight(0xffeed7,.64);
  rim.position.set(-2.4,2.8,-1.8);scene.add(rim);
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
     float radius=min(0.008,separation*0.09);
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
  const directions={angle:[1.65,1.13,2.22],front:[0,0.48,3],side:[3,0.8,0]};
  function distance(){
    const plaque=selection.type==='urna'||selection.type==='pamatna';
    const fit=plaque?(selection.type==='urna'?.34:.43):1+.30*(model.sirka-1);
    return Math.max(4.72,4.74/camera.aspect)*fit;
  }
  let flight=0;
  function view(key,duration=640){
    const detail=key==='detail', outside=active&&active!=='atelier';
    const plaque=['urna','pamatna'].includes(selection.type);
    const bounds=new T.Box3();
    monument.traverse(mesh=>{if(mesh.userData.face)bounds.expandByObject(mesh);});
    const focus=detail?bounds.getCenter(new T.Vector3()):target;
    const size=bounds.getSize(new T.Vector3());
    const direction=detail?(selection.type==='urna'?[0,2,.8]:[0,.025,1]):outside&&key==='angle'?[1.57,.54,2.55]:directions[key];
    const available=Math.max(1,host.clientWidth-24);
    const tangent=Math.tan(T.MathUtils.degToRad(camera.fov/2));
    const detailDistance=.5*1.26*Math.max(size.x/(available/host.clientHeight),size.y,size.z)/tangent+size.z*.4;
    const end=new T.Vector3().fromArray(direction).normalize().multiplyScalar(detail?detailDistance:distance());
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
  let motionDpr=Math.min(.80,fullDpr);
  let orbiting=false;
  function motionDetail(low){
    fastMotion=low;
    if(grounds){
      // Nearby blades disappear into the photographed turf at subpixel size.
      grounds.children[1].visible=!low;
    }
  }
  function motion(){
    if(!mobile){
      if(!orbiting||selection.type!=='pamatna')return;
      const now=performance.now();
      if(lastMove&&now-lastMove>36)slowFrames++;
      else slowFrames=0;
      lastMove=now;
      if(!moving&&slowFrames>=2){
        moving=true;renderer.setPixelRatio(Math.min(1,fullDpr*.85));motionDetail(true);
      }
      return;
    }
    const now=performance.now(),elapsed=now-lastMove;
    if(moving&&elapsed>32&&elapsed<250)slowFrames++;
    lastMove=now;
    if(slowFrames>=2&&motionDpr>.42){
      motionDpr=Math.max(.42,motionDpr-.14);
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
  controls.addEventListener('start',()=>{orbiting=true;lastMove=0;slowFrames=0;cancelAnimationFrame(flight);onOrbit();});
  controls.addEventListener('end',()=>{
    orbiting=false;
    if(!mobile&&moving){moving=false;motionDetail(false);renderer.setPixelRatio(fullDpr);invalidate();}
  });
  function zoom(factor){
    cancelAnimationFrame(flight);
    const offset=camera.position.clone().sub(controls.target);
    camera.position.copy(offset.setLength(T.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance))).add(controls.target);
    controls.update();invalidate();
  }
  let previousAspect;
  function resize(){
    const aspect=host.clientWidth/host.clientHeight;
    if(mobile&&previousAspect&&aspect!==previousAspect){
      // Keep the stone's horizontal framing as the sheet changes the canvas height.
      const offset=camera.position.clone().sub(controls.target);
      offset.multiplyScalar(Math.min(previousAspect,1)/Math.min(aspect,1));
      camera.position.copy(controls.target).add(offset);controls.update();
    }
    previousAspect=aspect;camera.aspect=aspect;
    camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth,host.clientHeight,false);invalidate();
  }
  const studioEnv=scene.environment, studioFog=scene.fog;
  const skies=new Map(), probes=new Map();
  let grounds, groundsPending, active, revision=0, fade;
  function snapshot(){
    const old=host.querySelector('.scene-fade');
    if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
      renderer.render(scene,camera);
      const overlay=document.createElement('canvas');
      overlay.width=renderer.domElement.width;overlay.height=renderer.domElement.height;
      overlay.className='scene-fade';overlay.setAttribute('aria-hidden','true');
      const ctx=overlay.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
      if(old){ctx.globalAlpha=Number(getComputedStyle(old).opacity);ctx.drawImage(old,0,0);}
      fade?.cancel();old?.remove();host.append(overlay);
    }
  }
  async function environment(name){
    const request=++revision;
    if(name===active)return;
    if(name!=='atelier'){
      groundsPending??=garden(mobile).catch(error=>{groundsPending=null;throw error;});
      if(!skies.has(name))skies.set(name,parkSky(name).catch(error=>{skies.delete(name);throw error;}));
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
    if(!first)snapshot();
    const studio=name==='atelier', dusk=name==='podvecer';
    ground.visible=studio;
    if(grounds)grounds.visible=!studio;
    scene.background=studio?new T.Color(0xeee8dc):skies.get(name);
    scene.backgroundBlurriness=studio?.17:0;
    scene.backgroundIntensity=studio?1:dusk?.98:1.16;
    scene.fog=studio?studioFog:new T.FogExp2(dusk?0xd9b99d:0xcbd5cd,dusk?.026:.020);
    hemi.color.set(studio?0xffffff:dusk?0xffe8d6:0xd7e7ff);
    hemi.groundColor.set(studio?0x909090:0x77786c);
    hemi.intensity=studio?1.16:1.05;
    sun.color.set(studio?0xffffff:dusk?0xffc08a:0xffe0ba);
    sun.intensity=studio?1.35:dusk?1.62:1.78;
    if(studio)sun.position.set(-3,6,3.5);
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
    monument.traverse(mesh=>{
      if(mesh.userData.face)mesh.material[0].envMapIntensity=studio?1:1.24;
    });
    if(first){camera.position.set(3,2.05,4.4);controls.target.copy(target);controls.update();view('angle',1600);}
    renderer.render(scene,camera);
    renderer.domElement.style.visibility='visible';
    reveal();
  }
  function reveal(){
    const overlay=host.querySelector('.scene-fade');
    if(overlay){
      fade=overlay.animate([{opacity:1},{opacity:0}],{duration:300,easing:'ease-out',fill:'forwards'});
      fade.onfinish=()=>overlay.remove();
    }
  }
  let design,decoration,shadowExtras;
  function decorate(next){
    design=next;odstran(decoration);
    decoration=personalizuj(monument,design,selection,model,Math.min(8,renderer.capabilities.getMaxAnisotropy()),mobile?1024:1536);
    const extras=[...next.extras].sort().join(',');
    if(extras!==shadowExtras)renderer.shadowMap.needsUpdate=true;
    shadowExtras=extras;invalidate();
  }
  function change(next,newModel,newStone){
    snapshot();
    const typeChanged=selection.type!==next.type;
    selection={...next};model=newModel;stone=newStone;
    odstran(decoration);decoration=null;
    const previous=monument;
    monument=pomnik(model,vytvorZulu(stone),vytvorZulu(stone,{satin:true}),coverFace,selection);
    scene.remove(previous);scene.add(monument);
    const oldMaterials=new Set();
    previous.traverse(mesh=>{
      if(!mesh.isMesh)return;
      mesh.geometry.dispose();mesh.getRenderTarget?.().dispose();
      for(const mat of [mesh.material].flat())oldMaterials.add(mat);
    });
    for(const mat of oldMaterials){receivers.delete(mat);mat.dispose();}
    const fresh=new Set();
    monument.traverse(mesh=>{if(mesh.isMesh)for(const mat of [mesh.material].flat())fresh.add(mat);});
    softShadows(fresh);
    for(const mat of fresh){
      receivers.add(mat);
      if(mat.isMeshPhysicalMaterial)mat.envMapIntensity=active==='atelier'?1:1.24;
    }
    const plaque=['urna','pamatna'].includes(next.type);
    controls.minDistance=plaque?.65:1.65;
    target.set(0,next.type==='urna'?.13:next.type==='pamatna'?.99:.39,plaque?0:.03);
    contact.scale.set(next.type==='pamatna'?.76:model.sirka,next.type==='pamatna'?.09:model.dlzka/2,1);
    renderer.shadowMap.needsUpdate=true;
    if(typeChanged)view('angle');
    if(design)decorate(design);
    renderer.render(scene,camera);reveal();invalidate();
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
  function frontImage(){
    // An independent camera keeps the user's orbit and the canvas layout intact.
    const bounds=new T.Box3().setFromObject(monument),center=bounds.getCenter(new T.Vector3());
    const shot=camera.clone();shot.clearViewOffset();shot.aspect=host.parentElement.clientWidth/host.parentElement.clientHeight;shot.fov=32;
    const facing=selection.type==='urna'?new T.Vector3(0,1.25,1):new T.Vector3(0,.30,1);
    shot.position.copy(center).add(facing.normalize());shot.lookAt(center);shot.updateMatrixWorld();
    const right=new T.Vector3().setFromMatrixColumn(shot.matrixWorld,0);
    const up=new T.Vector3().setFromMatrixColumn(shot.matrixWorld,1),tan=Math.tan(T.MathUtils.degToRad(shot.fov/2));
    let distance=0;
    for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z]){
      const point=new T.Vector3(x,y,z).sub(center);
      distance=Math.max(distance,point.dot(facing)+1.13*Math.max(Math.abs(point.dot(right))/shot.aspect,Math.abs(point.dot(up)))/tan);
    }
    shot.position.copy(center).addScaledVector(facing,distance);shot.updateProjectionMatrix();
    const size=renderer.getSize(new T.Vector2()),ratio=renderer.getPixelRatio();
    try{
      renderer.setPixelRatio(1);renderer.setSize(Math.round(1280*Math.min(1,shot.aspect)),Math.round(1280*Math.min(1,1/shot.aspect)),false);renderer.render(scene,shot);
      return canvas.toDataURL('image/jpeg',.92);
    }finally{renderer.setPixelRatio(ratio);renderer.setSize(size.x,size.y,false);invalidate();}
  }
  return {view,zoom,canvas,environment,change,decorate,frontImage};
}

