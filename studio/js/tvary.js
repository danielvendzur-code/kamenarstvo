import * as T from 'three';
import {vytvorZulu} from './kamen.js';
import {outline,tabletSize,bookLeaf,layered} from './profily.js';

// A single closed perimeter avoids coincident end faces and seams at the corners.
export function blockGeometry(w, h, d, bevel, openTop) {
  const x=w/2, z=d/2, b=bevel;
  const rim=[[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],
             [x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]];
  const corners=[[-x+b,-z+b],[x-b,-z+b],[x-b,z-b],[-x+b,z-b]];
  const end=[0,1,1,2,2,3,3,0].map(i=>corners[i]);
  const ring=(points,y)=>points.map(([px,pz])=>new T.Vector3(px,y,pz));
  const rings=[ring(end,-h/2),ring(rim,-h/2+b),ring(rim,h/2-b),ring(end,h/2)];
  const positions=[],groups=[];
  function triangle(a,b,c){
    const n=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));
    if(n.lengthSq()<1e-20)return;
    // All faces of this convex body point away from its centre.
    const face=n.dot(a)>0?[a,b,c]:[a,c,b];
    for(const point of face)positions.push(point.x,point.y,point.z);
  }
  for(let layer=0;layer<3;layer++){
    const start=positions.length/3;
    for(let i=0;i<8;i++){
      const j=(i+1)%8, lower=rings[layer], upper=rings[layer+1];
      triangle(lower[i],lower[j],upper[j]);
      triangle(lower[i],upper[j],upper[i]);
    }
    groups.push([start,positions.length/3-start,layer===1?1:0]);
  }
  const capStart=positions.length/3;
  for(const y of openTop?[-h/2]:[-h/2,h/2]){
    const [a,b,c,d]=ring(corners,y);
    triangle(a,b,c);triangle(a,c,d);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  groups.push([capStart,positions.length/3-capStart,0]);
  groups.forEach(g=>geometry.addGroup(...g));
  geometry.computeVertexNormals();
  return geometry;
}

function sheet(shape,depth,b){
  return new T.ExtrudeGeometry(shape,{depth:depth-2*b,bevelSize:b,bevelThickness:b,
    bevelSegments:2,steps:1,curveSegments:40});
}

function rectangle(x0,y0,x1,y1){
  const shape=new T.Shape();
  shape.moveTo(x0,y0);shape.lineTo(x1,y0);shape.lineTo(x1,y1);shape.lineTo(x0,y1);shape.closePath();
  return shape;
}

function recess(w,d,grow=0){
  const opening=rectangle(-w*.29-grow,-d*.35-grow,w*.29+grow,-d*.08+grow);
  return opening;
}

// Subdivide the cap before bending it so highlights roll across each leaf.
function bookSurface(geometry,width,sign){
  const pos=geometry.attributes.position,norm=geometry.attributes.normal;
  const xyz=[],directions=[],groups=[];
  // Cut every triangle at the same stations so the cap and its bevel share a seam.
  function clip(points,x,keepLeft){
    const polygon=[];
    for(let i=0;i<points.length;i++){
      const a=points[i],b=points[(i+1)%points.length];
      if(keepLeft?a.x<=x:a.x>=x)polygon.push(a);
      if((a.x<x&&b.x>x)||(a.x>x&&b.x<x))
        polygon.push(a.clone().lerp(b,(x-a.x)/(b.x-a.x)));
    }
    return polygon;
  }
  function emit(vertices,n){
    const stations=12,step=width/stations;
    const low=Math.floor(Math.min(...vertices.map(v=>v.x))/step);
    const high=Math.max(low,Math.ceil(Math.max(...vertices.map(v=>v.x))/step)-1);
    for(let j=low;j<=high;j++){
      const polygon=clip(clip(vertices,j*step,false),(j+1)*step,true);
      for(let i=1;i<polygon.length-1;i++)for(const v of [polygon[0],polygon[i],polygon[i+1]]){
        const u=T.MathUtils.clamp(sign*v.x/width,0,1),lift=.014*Math.sin(Math.PI*u);
        const slope=.014*Math.PI*sign*Math.cos(Math.PI*u)/width;
        const normal=new T.Vector3(n.x-slope*n.z,n.y,n.z).normalize();
        xyz.push(v.x,v.y,v.z+lift);directions.push(normal.x,normal.y,normal.z);
      }
    }
  }
  for(const g of geometry.groups){
    const first=xyz.length/3;
    for(let i=g.start;i<g.start+g.count;i+=3){
      const vertices=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,i+k));
      emit(vertices,new T.Vector3().fromBufferAttribute(norm,i));
    }
    groups.push([first,xyz.length/3-first,g.materialIndex]);
  }
  const result=new T.BufferGeometry();
  result.setAttribute('position',new T.Float32BufferAttribute(xyz,3));
  result.setAttribute('normal',new T.Float32BufferAttribute(directions,3));
  groups.forEach(g=>result.addGroup(...g));geometry.dispose();return result;
}

export function pomnik(model,polished,satin,makeCoverFace,selection={}){
  const {sirka:w,dlzka:d,vyskaStely:h}=model;
  const {type='jednohrob',shape='rovny',cover='cela'}=selection;
  const group=new T.Group(),faces=[polished,satin];
  const assembly=type==='jednohrob'?model.zostava:null;
  const signature=shape==='atelierovy'?assembly:null;
  const tabletFaces=signature && model.kamenStely
    ? [vytvorZulu(model.kamenStely),vytvorZulu(model.kamenStely,{satin:true})] : faces;
  function add(geo,mat,x,y,z){
    const mesh=new T.Mesh(geo,mat);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    return mesh;
  }
  function block(width,height,depth,bottom,z,mat){
    const mesh=add(blockGeometry(width,height,depth,.004,false),mat,0,bottom+height/2,z);
    if(mat===faces||mat===satin||mat===polished)mesh.userData.part='stone';
    return mesh;
  }
  function profileFace(path,depth,base,z){
    const mesh=add(sheet(path,depth,.004),tabletFaces,0,base+.004,z-depth/2+.004);
    const bounds=path.getPoints(64);
    const xs=bounds.map(p=>p.x),ys=bounds.map(p=>p.y);
    mesh.userData.face={left:Math.min(...xs),right:Math.max(...xs),height:Math.max(...ys),z:depth-.004};
    return mesh;
  }
  function addTablet(depth,bottom,z,tilt){
    const {width:sw,height:h}=tabletSize(model,type);
    if(shape==='kniha'){
      // Two carved leaves meet at the recessed spine. Their faces have distinct normals.
      const pivot=new T.Group();pivot.position.set(0,bottom,z);pivot.rotation.x=tilt;group.add(pivot);
      for(const sign of [-1,1]){
        const width=sw*.494,leaf=bookLeaf(width,h,sign);
        const mesh=profileFace(leaf,depth,-.03,0);
        mesh.geometry=bookSurface(mesh.geometry,width,sign);mesh.userData.face.curveWidth=width;
        mesh.position.x=sign*.005;mesh.rotation.y=-sign*.095;pivot.add(mesh);
      }
      const spine=block(.024,h*.85,depth*.88,0,0,polished);
      pivot.add(spine);
    }else{
      const path=outline(sw-.008,h-.008,shape);
      const stela=profileFace(path,depth,bottom,z);
      if(signature?.intarzia){
        const cross=new T.MeshStandardMaterial({color:0xb6b8b4,roughness:.48,metalness:.28});
        const stem=add(new T.BoxGeometry(.032,h-.012,.002),cross,0,bottom+h/2,z+depth/2+.001);
        stem.position.x=-sw*.245;
        const bar=add(new T.BoxGeometry(sw*.24,.032,.002),cross,0,bottom+h*.71,z+depth/2+.0012);
        bar.position.x=stem.position.x;
        stela.userData.face.left=-sw*.10;
      }
      if(signature?.pilier){
        const pillar=signature.pilier;
        stela.position.x=w*pillar.posunStely;
        const jamb=block(w*pillar.sirka,h*pillar.vyska,depth+.012,bottom,z,faces);
        jamb.position.x=w*pillar.x;
      }
      const layers=signature?.vrstvy??layered[shape];
      if(layers){
        for(let i=1;i<=layers;i++){
          const layer=add(sheet(path,.024,.004),tabletFaces,-i*.022,bottom+.004+i*.018,z-depth/2-i*.026+.004);
          layer.userData.part='stone';
        }
      }
      stela.userData.face.contour=path.getPoints(40);
      stela.rotation.x=tilt;
    }
  }
  if(type==='urna'||type==='pamatna'){
    if(type==='urna'){
      block(w+.15,.058,.58,0,0,faces);
      // Keep the back edge below the shoulders and the wedge inside curved sides.
      const wedge=new T.Shape();
      const rear=shape==='kniha'?.123:.066, supportWidth=w*(shape==='kniha'?.68:.50);
      wedge.moveTo(-.123,0);wedge.lineTo(rear,0);wedge.lineTo(rear,.028+(rear+.123)*.09/.246);
      wedge.lineTo(-.123,.028);wedge.closePath();
      const support=add(sheet(wedge,supportWidth,.003),faces,-supportWidth/2+.003,.061,-.015);
      support.rotation.y=Math.PI/2;
      addTablet(.042,.070,.172,-1.22);
    }else{
      // Stacked courses and a projecting shelf form a columbarium pier.
      const stonework=new T.MeshStandardMaterial({color:0xb8aa92,roughness:.88});
      for(let row=0;row<5;row++)block(w+.24,.268,.40,row*.272,-.218,stonework);
      block(w+.28,.055,.44,1.36,-.218,stonework);
      // End the shelf at the pier's front face. The old block extended into
      // the pier with coplanar side faces, which flickered during orbit.
      const pierFront=-.218+.40/2, shelfFront=.146;
      block(w+.24,.045,shelfFront-pierFront,.710,(pierFront+shelfFront)/2,faces);
      block(w*.50,h*.53,.030,.82,-.008,satin);
      addTablet(.042,.78,.020,0);

    }
    return group;
  }
  const bevel=model.zrazenie, footing=.035, shoulder=footing+model.vyskaObruby;
  const top=shoulder+model.hrubkaDosky;
  // Mitre the plinth, border and lid together so no square corners protrude.
  function perimeter(x,z,inset=0){
    if(assembly?.oblukCela && cover==='cela'){
      const bow=assembly.oblukCela;
      const path=new T.Shape();
      path.moveTo(-x,z);path.lineTo(x,z);path.lineTo(x,-z+bow);
      path.quadraticCurveTo(0,-z-bow,-x,-z+bow);path.closePath();
      return path;
    }
    if(cover!=='skosene-celo')return rectangle(-x,-z,x,z);
    const cut=Math.min(w*.22,d*.13)-(2-Math.SQRT2)*inset;
    const path=new T.Shape();
    path.moveTo(-x+cut,-z);path.lineTo(x-cut,-z);path.lineTo(x,-z+cut);
    path.lineTo(x,z);path.lineTo(-x,z);path.lineTo(-x,-z+cut);path.closePath();
    return path;
  }
  if(assembly?.listovanie && cover==='cela'){
    const course=assembly.listovanie;
    block(w+.012,course,d+.012,shoulder-course,0,faces);
  }
  if(cover==='skosene-celo'){
    add(sheet(perimeter(w/2-.029,d/2-.029,.029),footing,.004),satin,0,.004,0).rotation.x=-Math.PI/2;
  }else if(assembly?.sokel){
    const lip=assembly.sokel;
    block(w+lip,footing,d+lip,0,0,faces);
  }else block(w-.05,footing,d-.05,0,0,satin);
  const ring=perimeter(w/2-bevel,d/2-bevel,bevel);
  const rail=model.sirkaObruby;
  ring.holes.push(perimeter(w/2-rail,d/2-rail,rail));
  const railMesh=add(sheet(ring,model.vyskaObruby,bevel),satin,0,footing+bevel,0);
  railMesh.rotation.x=-Math.PI/2;railMesh.userData.part='stone';
  const overhang=assembly?.presah??.005;
  const halfW=w/2+overhang,halfD=d/2+overhang,gap=.0025+bevel;
  const crossSeam=d*.09;
  let covers=[perimeter(halfW,halfD)];
  // Gravel covers keep a head slab under the pedestal and fill the rest with chippings.
  const gravelBed=cover==='strk'||cover==='polovicna';
  const pedestalReach=overhang+.195+(assembly?.hlbkaPodstavca??.32)/2;
  const slabDepth=cover==='strk'?pedestalReach+.07:Math.max(pedestalReach+.07,halfD);
  if(gravelBed){
    covers=[rectangle(-halfW,halfD-slabDepth,halfW,halfD)];
    const x=w/2-rail,z0=-halfD+slabDepth-.012,z1=d/2-rail;
    const bedMat=new T.MeshStandardMaterial({color:0x8f8a80,roughness:1});
    const bed=add(new T.PlaneGeometry(2*x,z1-z0),bedMat,0,shoulder-.012,(z0+z1)/2);
    bed.rotation.x=-Math.PI/2;bed.castShadow=false;
    const chips=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
      new T.MeshStandardMaterial({roughness:.58}),Math.round(2*x*(z1-z0)*2300));
    const chip=new T.Object3D(),tone=new T.Color();
    let seed=9157;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<chips.count;i++){
      const r=.0075+random()*.0075;
      chip.position.set((random()*2-1)*(x-.006),shoulder-.006+random()*.011,z0+.006+random()*(z1-z0-.012));
      chip.rotation.set(random()*3,random()*3,random()*3);chip.scale.set(r,r*.62,r*.86);
      chip.updateMatrix();chips.setMatrixAt(i,chip.matrix);
      const light=.70+random()*.24;tone.setRGB(light,light*.985,light*.95);chips.setColorAt(i,tone);
    }
    chips.receiveShadow=true;group.add(chips);
  }
  if(cover==='delena'){
    covers=[rectangle(-halfW,-halfD,-gap,halfD),rectangle(gap,-halfD,halfW,halfD)];
  }else if(cover==='priecne-delena'){
    covers=[rectangle(-halfW,-halfD,halfW,crossSeam-gap),rectangle(-halfW,crossSeam+gap,halfW,halfD)];
  }
  const sideBed=cover==='bocny-zahon';
  function opening(grow){
    if(!sideBed)return recess(w,d,grow);
    const path=new T.Shape();
    path.absellipse(w*.24,-d*.055,w*.145+grow,d*.31+grow,0,2*Math.PI,false,0);
    return path;
  }
  if(cover==='kvety'||sideBed){
    covers[0].holes.push(opening(bevel));
    const lip=opening(.022);
    lip.holes.push(opening(-bevel));
    add(sheet(lip,.024,.003),polished,0,top+.003,0).rotation.x=-Math.PI/2;
    const soil=new T.MeshStandardMaterial({color:0x362c21,roughness:1});
    const bed=add(new T.ShapeGeometry(opening(.012)),soil,0,shoulder-.023,0);
    bed.rotation.x=-Math.PI/2;
    const gravel=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
      new T.MeshStandardMaterial({roughness:.95}),Math.round(1100*w));
    const pebble=new T.Object3D(),tone=new T.Color();
    let seed=4711;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<gravel.count;i++){
      const r=.004+random()*.007;
      if(sideBed){
        const angle=random()*Math.PI*2,radius=Math.sqrt(random())*.98;
        pebble.position.set(w*(.24+.145*radius*Math.cos(angle)),bed.position.y+.001,d*(.055+.31*radius*Math.sin(angle)));
      }else pebble.position.set((random()-.5)*w*.58,bed.position.y+.001,d*(.08+random()*.27));
      pebble.rotation.set(random()*2,random()*3,random()*2);pebble.scale.set(r,r*.5,r*.85);
      pebble.updateMatrix();gravel.setMatrixAt(i,pebble.matrix);
      tone.setScalar(.045+random()*.11);gravel.setColorAt(i,tone);
    }
    gravel.receiveShadow=true;group.add(gravel);
  }
  function markSlabs(geometry){
    if(cover==='delena'||cover==='priecne-delena'){
      const pos=geometry.attributes.position;
      geometry.setAttribute('slabCut',new T.Float32BufferAttribute(
        Float32Array.from({length:pos.count},(_,i)=>Number(cover==='delena'?pos.getX(i)>0:pos.getY(i)>crossSeam)),1));
    }
    return geometry;
  }
  // The narrow chamfer often projects to less than one pixel in side view.
  // A wider specular lobe keeps its highlight continuous across those pixels.
  const chamfer=polished.clone();
  chamfer.onBeforeCompile=polished.onBeforeCompile;
  chamfer.customProgramCacheKey=polished.customProgramCacheKey;
  chamfer.roughness=.24;chamfer.clearcoatRoughness=.22;
  const capPositions=[];
  for(const path of covers){
    const body=sheet(path,model.hrubkaDosky,bevel),normals=body.attributes.normal,indices=[];
    // Keep the vertical band in satin and its chamfer polished.
    const positions=body.attributes.position;
    body.clearGroups();let slot=-1;
    for(let i=0;i<normals.count;i+=3){
      const nz=normals.getZ(i);
      if(nz>.999 && normals.getZ(i+1)>.999 && normals.getZ(i+2)>.999){
        for(let j=i;j<i+3;j++)capPositions.push(positions.getX(j),positions.getY(j),0);
        continue;
      }
      const next=Math.abs(nz)>.12?0:1;
      if(next!==slot){body.addGroup(indices.length,0,next);slot=next;}
      body.groups.at(-1).count+=3;indices.push(i,i+1,i+2);
    }
    body.setIndex(indices);const edge=add(markSlabs(body),[chamfer,satin],0,shoulder+bevel,0);
    edge.rotation.x=-Math.PI/2;edge.userData.part='cover';
  }
  // Reuse the body's cap triangles so even the curved flower opening shares
  // the exact boundary vertices of the bevel and a single reflective plane.
  const cap=new T.BufferGeometry();
  cap.setAttribute('position',new T.Float32BufferAttribute(capPositions,3));
  cap.computeVertexNormals();
  const face=makeCoverFace(markSlabs(cap));
  face.userData.part='cover';
  // Reserve a continuous engraving field away from the split, flower bed and footing.
  const fieldWidth=w*(cover==='delena'?.44:sideBed?.49:.82),cx=cover==='delena'?-w*.25:sideBed?-w*.20:0;
  let fieldHeight=d*(cover==='kvety'?.31:.50),cy=cover==='kvety'?d*.12:cover==='priecne-delena'?-d*.20:0;
  if(gravelBed){
    // Only the part of the head slab in front of the pedestal can carry lettering.
    const low=halfD-slabDepth+.035,high=halfD-pedestalReach-.035;
    fieldHeight=high-low;cy=(low+high)/2;
  }
  if(!gravelBed||fieldHeight>.2)
    face.userData.coverField={left:cx-fieldWidth/2,right:cx+fieldWidth/2,height:fieldHeight,bottom:cy-fieldHeight/2};
  face.rotation.x=-Math.PI/2;face.position.y=top;group.add(face);
  const z=-d/2+.195,baseHeight=model.vyskaPodstavca;
  block(w*(assembly?.podstavec??.89),baseHeight,assembly?.hlbkaPodstavca??.32,top,z,signature?.tmavyPodstavec?tabletFaces:faces);
  if(assembly?.stredovaDoska && cover==='cela'){
    const inset=rectangle(-w*.37,-d*.325,w*.37,d*.325);
    const panel=add(sheet(inset,.028,.003),faces,0,top+.003,d*.045);
    panel.rotation.x=-Math.PI/2;
    panel.userData.coverField={left:-w*.31,right:w*.31,height:d*.47,bottom:-d*.235};
    if(assembly.druhyStupen){
      const upper=add(sheet(rectangle(-w*.34,-d*.16,w*.34,d*.16),.032,.003),faces,0,top+.031,-d*.10);
      upper.rotation.x=-Math.PI/2;
      upper.userData.coverField={left:-w*.29,right:w*.29,height:d*.26,bottom:-d*.13};
      delete panel.userData.coverField;
    }
    delete face.userData.coverField;
  }
  if(shape==='atelierovy' && model.detailStely){
    const detail=model.detailStely;
    // The narrow reveal separates the writing tablet from its recessed backing.
    const depth=model.hrubkaStely*.60;
    const back=block(w*detail.sirka,h*detail.vyska,depth,top+baseHeight,z-model.hrubkaStely/2-depth/2,satin);
    back.position.x=w*detail.posun;
  }
  addTablet(model.hrubkaStely,top+baseHeight,z,shape==='kniha'?-.018:0);
  // Decorations read the free surfaces of the grave from here.
  group.userData.surface={top,pedestalFront:z+(assembly?.hlbkaPodstavca??.32)/2,
    gravelFrom:gravelBed?-halfD+slabDepth:null,gravelTop:shoulder+.004,
    recess:cover==='kvety'?{x0:-w*.29,x1:w*.29,z0:d*.08,z1:d*.35}
      :sideBed?{x0:w*.095,x1:w*.385,z0:-d*.255,z1:d*.365}:null};
  return group;
}

