import * as T from 'three';
import {Reflector} from '../vendor/Reflector.js';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {vytvorZulu} from './kamen.js';
import {jednohrob} from './tvary.js';

function surface(w,h){
  const canvas=document.createElement('canvas');
  canvas.width=w; canvas.height=h;
  return canvas.getContext('2d');
}

function landscape(random){
  const ctx=surface(2048,1024);
  const sky=ctx.createLinearGradient(0,0,0,1024);
  for(const [stop,color] of [[0,'#869fb1'],[0.39,'#e2e4df'],[0.49,'#fff2da'],[0.53,'#95937b'],[1,'#777665']]) sky.addColorStop(stop,color);
  ctx.fillStyle=sky; ctx.fillRect(0,0,2048,1024);
  const light=ctx.createRadialGradient(470,382,0,470,382,210);
  light.addColorStop(0,'#fff9e8'); light.addColorStop(1,'#fff9e800');
  ctx.fillStyle=light; ctx.fillRect(0,0,2048,560);
  for(let i=0;i<480;i++){
    const x=random()*2048, a=x/2048*Math.PI*2;
    const height=95+44*Math.sin(4*a)+26*Math.cos(7*a)+random()*24+88*Math.pow(Math.cos(a),4);
    const width=6+random()*17;
    const tone=Math.floor(59+random()*36);
    ctx.fillStyle='rgb('+tone+','+(tone+6)+','+(tone-8)+')';
    for(const shift of [-2048,0,2048]){
      ctx.beginPath();ctx.ellipse(x+shift,525-height/2,width,height/2,0,0,Math.PI*2);ctx.fill();
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
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:mobile?'low-power':'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.VSMShadowMap;
  renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
  renderer.toneMapping=T.ACESFilmicToneMapping;
  host.append(renderer.domElement);
  let seed=2701;
  const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const scene=new T.Scene(), panorama=landscape(random);
  const generator=new T.PMREMGenerator(renderer);
  scene.environment=generator.fromEquirectangular(panorama).texture;
  generator.dispose();
  scene.background=panorama;scene.backgroundBlurriness=0.17;
  scene.fog=new T.FogExp2(0xdad6c8,0.072);
  const monument=jednohrob(model,vytvorZulu(stone));scene.add(monument);
  // Local reflection adds the stela and its plinth to the polished cover.
  const mirrorSize=mobile?256:512;
  const reflection=new Reflector(new T.PlaneGeometry(model.sirka+0.006,model.dlzka+0.006),{
    textureWidth:mirrorSize,textureHeight:mirrorSize,multisample:0,clipBias:0.002
  });
  reflection.rotation.x=-Math.PI/2;reflection.position.y=0.2432;
  reflection.material.transparent=true;reflection.material.depthWrite=false;
  reflection.material.fragmentShader=reflection.material.fragmentShader.replace(
    'vec4( blendOverlay( base.rgb, color ), 1.0 )','vec4(base.rgb,0.23)');
  scene.add(reflection);
  const ground=new T.Mesh(new T.PlaneGeometry(140,140),new T.MeshStandardMaterial({
    map:gravel(random),roughness:1
  }));
  ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  // A footprint-shaped falloff anchors the rails between directional shadows.
  const ctx=surface(256,512);
  ctx.filter='blur(11px)';ctx.fillStyle='rgba(31,29,25,.54)';ctx.fillRect(24,29,208,454);
  const contact=new T.Mesh(new T.PlaneGeometry(model.sirka*1.28,model.dlzka*1.20),
    new T.MeshBasicMaterial({map:new T.CanvasTexture(ctx.canvas),transparent:true,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.y=0.001;scene.add(contact);
  scene.add(new T.HemisphereLight(0xfff4dc,0xa6a79a,0.78));
  const sun=new T.DirectionalLight(0xfff0d6,1.55);
  sun.position.set(-2,7,-1.4);sun.castShadow=true;
  sun.shadow.mapSize.setScalar(mobile?1024:2048);
  Object.assign(sun.shadow.camera,{left:-2,right:2,top:2,bottom:-2,near:1,far:12});
  sun.shadow.radius=9;sun.shadow.blurSamples=8;sun.shadow.normalBias=0.003;sun.shadow.bias=-0.00015;scene.add(sun);
  const camera=new T.PerspectiveCamera(33,1,0.05,180);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enablePan=false;controls.minDistance=1.65;controls.maxDistance=7;
  controls.minPolarAngle=0.14;controls.maxPolarAngle=Math.PI*0.48;
  const target=new T.Vector3(0,0.39,0.03);
  const directions={angle:[1.65,1.13,2.22],front:[0,0.8,3],side:[3,0.8,0]};
  function distance(){
    return Math.max(4.35,4.48/camera.aspect);
  }
  function view(key){
    camera.position.fromArray(directions[key]).normalize().multiplyScalar(distance()).add(target);
    controls.target.copy(target);controls.update();invalidate();
  }
  let frame=0;
  function invalidate(){
    if(!frame)frame=requestAnimationFrame(()=>{frame=0;renderer.render(scene,camera);});
  }
  controls.addEventListener('change',invalidate);
  controls.addEventListener('start',onOrbit);
  function zoom(factor){
    const offset=camera.position.clone().sub(controls.target);
    camera.position.copy(offset.setLength(T.MathUtils.clamp(offset.length()*factor,controls.minDistance,controls.maxDistance))).add(controls.target);
    controls.update();invalidate();
  }
  function resize(){
    camera.aspect=host.clientWidth/host.clientHeight;camera.updateProjectionMatrix();
    renderer.setSize(host.clientWidth,host.clientHeight,false);invalidate();
  }
  resize();view('angle');
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
  return {view,zoom,canvas};
}
