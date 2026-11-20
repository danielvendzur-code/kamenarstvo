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
  const renderer=new T.WebGLRenderer({antialias:true,powerPreference:mobile?'low-power':'high-performance'});
  renderer.setPixelRatio(Math.min(devicePixelRatio,mobile?1.25:2));
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=T.PCFSoftShadowMap;
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
  scene.fog=new T.FogExp2(0xd7d7d7,0.055);
  function coverFace(width,depth){
    const size=mobile?512:1024;
    const face=new Reflector(new T.PlaneGeometry(width,depth),{
      textureWidth:size,textureHeight:size,clipBias:0,multisample:0
    });
    const captureMaterial=face.material;
    face.material=vytvorZulu(stone,{mirror:captureMaterial.uniforms});
    captureMaterial.dispose();
    const capture=face.onBeforeRender;
    face.onBeforeRender=(renderer,scene,camera)=>{
      const backgroundBlur=scene.backgroundBlurriness;
      scene.backgroundBlurriness=0;
      try{capture(renderer,scene,camera);}
      finally{scene.backgroundBlurriness=backgroundBlur;}
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
    new T.MeshBasicMaterial({map:new T.CanvasTexture(ctx.canvas),transparent:true,depthWrite:false}));
  contact.rotation.x=-Math.PI/2;contact.position.y=0.001;scene.add(contact);
  scene.add(new T.HemisphereLight(0xffffff,0x909090,0.6));
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
  const receivers=new Set([ground.material]);
  monument.traverse(mesh=>{
    if(mesh.isMesh)for(const mat of [mesh.material].flat())receivers.add(mat);
  });
  for(const mat of receivers){
    const compile=mat.onBeforeCompile.bind(mat);
    mat.onBeforeCompile=(shader,renderer)=>{
      compile(shader,renderer);
      shader.fragmentShader=shader.fragmentShader.replace('#include <shadowmap_pars_fragment>',shadowChunk);
    };
  }
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
