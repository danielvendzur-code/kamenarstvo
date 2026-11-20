import * as T from 'three';

const root=new URL('../assets/prostredie/',import.meta.url);
const loader=new T.TextureLoader();
export const outdoor=['rano','podvecer'];

function randomSource(){
  let seed=31549;
  return ()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
}

async function texture(name){
  const map=await loader.loadAsync(new URL(name+'.webp',root).href);
  map.colorSpace=T.SRGBColorSpace;
  return map;
}

function instanced(geometry,material,instances){
  const mesh=new T.InstancedMesh(geometry,material,instances.length);
  const dummy=new T.Object3D();
  instances.forEach(({position,scale,angle=0,color},i)=>{
    dummy.position.set(...position);dummy.scale.set(...scale);dummy.rotation.y=angle;
    dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    if(color)mesh.setColorAt(i,color);
  });
  return mesh;
}

// Continuous clipped faces; the profile curves gently into the crown and root.
function hedgeGeometry(length,random){
  const profile=[[-.38,0],[-.49,.18],[-.48,.70],[-.42,.90],[-.29,.99],
    [0,1.02],[.29,.99],[.43,.90],[.49,.71],[.50,.18],[.39,0]];
  const positions=[],uv=[],indices=[],colors=[];
  let arc=0;
  const distances=profile.map(([z,y],i)=>{
    if(i)arc+=Math.hypot(z-profile[i-1][0],y-profile[i-1][1]);
    return arc/.70;
  });
  const segments=Math.ceil(length*12);
  for(let i=0;i<=segments;i++){
    const x=(i/segments-.5)*length, slope=Math.sin(x*.75)*.052;
    const edge=Math.min(1,.65+Math.min(i,segments-i)*.07);
    profile.forEach(([z,y],j)=>{
      const relief=(.013*random()+.027*Math.sin(x*9.3+y*4.1))*edge;
      positions.push(x,(.91+slope)*y+relief*y,z*edge+relief+.06*Math.sin(x*.93));
      uv.push(x/.85+.08*Math.sin(y*2+x*.3),distances[j]);
      const v=.64+.32*y+.06*Math.sin(2.7*x+y)+.05*random();
      colors.push(v*.96,v,v*.94);
      if(i&&j){
        const d=i*profile.length+j,c=d-1,b=d-profile.length,a=b-1;
        indices.push(a,b,c,b,d,c);
      }
    });
  }
  const geo=new T.BufferGeometry();
  geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
  geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  geo.setIndex(indices);geo.computeVertexNormals();return geo;
}

function lawnMaterial(map){
  const mat=new T.MeshLambertMaterial({map,transparent:true});
  mat.onBeforeCompile=shader=>{
    shader.vertexShader='varying vec2 lawnXZ;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nlawnXZ=position.xy;');
    shader.fragmentShader='varying vec2 lawnXZ;\n'+shader.fragmentShader.replace('#include <map_fragment>',`
      vec2 p=lawnXZ;
      vec2 bend=vec2(sin(p.y*.67+p.x*.27),cos(p.x*.85-p.y*.21))*.085;
      vec3 a=texture2D(map,p*.58+bend).rgb;
      vec3 b=texture2D(map,mat2(.8,-.6,.6,.8)*p*.89-bend).rgb;
      float turf=dot(mix(a,b,.27),vec3(.25,.57,.18));
      float shade=.94+.06*sin(p.x*1.5+sin(p.y*.33))+.06*cos(p.y*2.3+p.x*.8);
      float dapple=smoothstep(-.6,.65,sin(p.x*2.43+p.y*.85)+cos(p.y*2.95+p.x*.5)*.58+sin(p.y*6.17-p.x*4.5)*.27);
      diffuseColor.rgb*=vec3(.67,.96,.46)*(turf*1.29+.026)*shade*mix(.84,1.20,dapple);
      diffuseColor.a*=1.0-smoothstep(11.0,25.0,length(p));
    `);
  };
  return mat;
}

function grassBlades(random,mobile){
  const geo=new T.BufferGeometry();
  // Three leaning blades per tuft in a single instanced draw.
  geo.setAttribute('position',new T.Float32BufferAttribute([
    -.006,0,0,.006,0,0,.009,.037,.006,
    -.013,0,.008,-.005,0,.011,-.023,.027,.018,
    .006,0,-.01,.015,0,-.008,.024,.03,-.019
  ],3));
  geo.computeVertexNormals();
  const patches=[];
  for(let i=0;i<(mobile?5000:18000);i++){
    const x=(random()-.5)*8,z=(random()-.5)*7;
    if((Math.abs(x)<.51&&Math.abs(z)<1.01)||(z>1.28&&z<2.52))continue;
    const s=.22+random()*.34;
    patches.push({position:[x,0,z],scale:[s,s,s],angle:random()*6.28,
      color:new T.Color().setHSL(.21+random()*.025,.22+random()*.15,.245+random()*.082,T.SRGBColorSpace)});
  }
  // Tighter tufts in the uncut strip along the kerb and the dressed stone.
  for(let i=0;i<(mobile?750:1800);i++){
    const sign=random()<.5?-1:1, gap=.008+random()*.055;
    const x=i%3===0?(random()-.5)*4.8:i%3===1?sign*(.50+gap):(random()-.5);
    const z=i%3===0?1.273-gap:i%3===1?(random()-.5)*2:sign*(1+gap);
    const s=.38+random()*.45;
    patches.push({position:[x,.001,z],scale:[s,s,s],angle:random()*6.28,
      color:new T.Color().setHSL(.22,.3,.27+random()*.055,T.SRGBColorSpace)});
  }
  const mat=new T.MeshBasicMaterial({side:T.DoubleSide});
  const blades=instanced(geo,mat,patches);
  blades.receiveShadow=true;
  const lod=new T.LOD();
  lod.addLevel(blades,0);lod.addLevel(new T.Group(),mobile?5.7:6.6,.10);
  return lod;
}

export async function garden(mobile){
  const random=randomSource();
  const [grass,gravel,cedar,crowns,limestone]=await Promise.all(['travnik','strk','tuja','koruny','mur'].map(texture));
  for(const map of [grass,gravel,cedar]){
    map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=mobile?2:4;
  }
  const group=new T.Group();
  const lawn=new T.Mesh(new T.PlaneGeometry(72,72),lawnMaterial(grass));
  lawn.renderOrder=-3;lawn.rotation.x=-Math.PI/2;lawn.receiveShadow=true;group.add(lawn,grassBlades(random,mobile));
  const path=new T.Mesh(new T.PlaneGeometry(45,1.12),new T.MeshStandardMaterial({
    map:gravel,bumpMap:gravel,bumpScale:.012,color:0xbdc3c5,roughness:.99
  }));
  gravel.repeat.set(40,1.05);
  path.rotation.x=-Math.PI/2;path.position.set(0,.009,1.9);path.receiveShadow=true;
  group.add(path);
  const blocks=[];
  for(const z of [1.31,2.49]){
    for(let x=-16;x<16;x+=.78)blocks.push({
      position:[x,.015,z],scale:[.777,.050,.067],
      color:new T.Color().setScalar(.44+random()*.075)
    });
  }
  // Dressed limestone in staggered courses, with a slightly overhanging coping.
  for(const side of [-1,1]){
    for(let row=0;row<4;row++){
      let z=-10;
      while(z<10-.002){
        const cap=row===3,h=cap?.092:.19;
        const length=Math.min(10-z,(cap?.85:.49)+random()*.48);
        blocks.push({position:[side*6.7+(random()-.5)*.018,cap?.615:.095+row*.19,z+length/2],
          scale:[(cap?.43:.345)+random()*.018,h-.006,length-.006],
          angle:(random()-.5)*.013,color:new T.Color().setHSL(.105,.09,.50+random()*.12,T.SRGBColorSpace)});
        z+=length;
      }
    }
    for(const end of [-10,10]){
      blocks.push({position:[side*6.7,.34,end],scale:[.49,.68,.5]},
        {position:[side*6.7,.72,end],scale:[.54,.09,.56]});
    }
  }
  const stones=instanced(new T.BoxGeometry(),new T.MeshStandardMaterial({map:limestone,bumpMap:limestone,bumpScale:.016,roughness:.94}),blocks);
  stones.castShadow=stones.receiveShadow=true;group.add(stones);
  const hedgeMat=new T.MeshStandardMaterial({
    map:cedar,bumpMap:cedar,bumpScale:.009,roughness:1,vertexColors:true,side:T.DoubleSide
  });
  const hedge=instanced(hedgeGeometry(8.7,random),hedgeMat,[
    {position:[-.6,0,-3.85],scale:[1,1,1],angle:.045},
    {position:[-1.8,0,7],scale:[.68,1.25,1],angle:-.16},
    {position:[4.7,0,-5.8],scale:[.45,.88,.90],angle:-.64}
  ]);
  hedge.castShadow=hedge.receiveShadow=true;group.add(hedge);
  // Three photographic crown silhouettes at different depths. The hedge conceals
  // their lower edges; yaw stays fixed so reflected parallax matches the view.
  const trees=[
    [-5,-7,6.8,4.1,.40,0],[2,-9,7.3,4.5,-.08,2],[7,-7,6,4.1,-.65,1],
    [-8,0,5.3,4.2,1.5,1],[-5,5,6.1,4.4,2.2,2],[4,8,7.5,4.7,-2.6,0],
    [8,2,5.9,4.5,-1.7,2]
  ];
  crowns.generateMipmaps=true;crowns.minFilter=T.LinearMipmapLinearFilter;
  const treeMat=new T.MeshBasicMaterial({map:crowns,transparent:true,alphaTest:.025,
    depthWrite:false,premultipliedAlpha:true,side:T.DoubleSide,fog:true});
  treeMat.forceSinglePass=true;
  for(const [x,z,w,h,angle,tile] of trees){
    const geometry=new T.PlaneGeometry(w,h),uv=geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setX(i,(tile+.002+.996*uv.getX(i))/3);
    const tree=new T.Mesh(geometry,treeMat);
    tree.renderOrder=-2;tree.position.set(x,h/2-.22,z);tree.rotation.y=angle;group.add(tree);
  }
  return group;
}

export async function parkSky(name){
  const sky=await texture(name);
  if(name==='podvecer'){
    // Keep the trees and horizon of the same site, with sunset sky above them.
    const morning=await texture('rano');
    const canvas=document.createElement('canvas');canvas.width=2048;canvas.height=1024;
    const ctx=canvas.getContext('2d');
    ctx.drawImage(morning.image,0,0);ctx.fillStyle='rgba(164,121,62,.10)';ctx.fillRect(0,0,2048,1024);
    const layer=document.createElement('canvas');layer.width=2048;layer.height=1024;
    const l=layer.getContext('2d');l.drawImage(sky.image,0,0);
    const g=l.createLinearGradient(0,325,0,473);g.addColorStop(0,'white');g.addColorStop(1,'transparent');
    l.globalCompositeOperation='destination-in';l.fillStyle=g;l.fillRect(0,0,2048,1024);
    ctx.drawImage(layer,0,0);sky.image=canvas;sky.needsUpdate=true;morning.dispose();
  }
  sky.mapping=T.EquirectangularReflectionMapping;
  return sky;
}
