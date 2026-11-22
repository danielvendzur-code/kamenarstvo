import * as T from 'three';

// A single closed perimeter avoids coincident end faces and seams at the corners.
function blockGeometry(w, h, d, bevel, openTop) {
  const x=w/2, z=d/2, b=bevel;
  const rim=[[-x+b,-z],[x-b,-z],[x,-z+b],[x,z-b],
             [x-b,z],[-x+b,z],[-x,z-b],[-x,-z+b]];
  const corners=[[-x+b,-z+b],[x-b,-z+b],[x-b,z-b],[-x+b,z-b]];
  const end=[0,1,1,2,2,3,3,0].map(i=>corners[i]);
  const ring=(points,y)=>points.map(([px,pz])=>new T.Vector3(px,y,pz));
  const rings=[ring(end,-h/2),ring(rim,-h/2+b),ring(rim,h/2-b),ring(end,h/2)];
  const positions=[];
  function triangle(a,b,c){
    const n=new T.Vector3().subVectors(b,a).cross(new T.Vector3().subVectors(c,a));
    if(n.lengthSq()<1e-20)return;
    // All faces of this convex body point away from its centre.
    const face=n.dot(a)>0?[a,b,c]:[a,c,b];
    for(const point of face)positions.push(point.x,point.y,point.z);
  }
  for(let layer=0;layer<3;layer++){
    for(let i=0;i<8;i++){
      const j=(i+1)%8, lower=rings[layer], upper=rings[layer+1];
      triangle(lower[i],lower[j],upper[j]);
      triangle(lower[i],upper[j],upper[i]);
    }
  }
  for(const y of openTop?[-h/2]:[-h/2,h/2]){
    const [a,b,c,d]=ring(corners,y);
    triangle(a,b,c);triangle(a,c,d);
  }
  const geometry=new T.BufferGeometry();
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.computeVertexNormals();
  return geometry;
}

function outline(w,h,profile){
  const path=new T.Shape(),x=w/2;
  path.moveTo(-x,0);path.lineTo(x,0);
  if(profile==='obluk'){
    path.lineTo(x,h*.86);path.bezierCurveTo(x*.52,h*1.045,-x*.52,h*1.045,-x,h*.86);
  }else if(profile==='vlna'){
    path.lineTo(x,h*.80);path.bezierCurveTo(x*.20,h*.65,-x*.19,h*1.10,-x,h*.94);
  }else{
    path.lineTo(x,h);path.lineTo(-x,h);
  }
  path.closePath();return path;
}

function sheet(shape,depth,b){
  return new T.ExtrudeGeometry(shape,{depth:depth-2*b,bevelSize:b,bevelThickness:b,
    bevelSegments:1,steps:1,curveSegments:28});
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
  function emit(a,b,c,n,depth){
    if(depth){
      const ab=a.clone().lerp(b,.5),bc=b.clone().lerp(c,.5),ca=c.clone().lerp(a,.5);
      emit(a,ab,ca,n,depth-1);emit(ab,b,bc,n,depth-1);emit(ca,bc,c,n,depth-1);emit(ab,bc,ca,n,depth-1);return;
    }
    for(const v of [a,b,c]){
      const u=Math.max(0,Math.min(1,sign*v.x/width)),lift=.011*Math.sin(Math.PI*u);
      const tangent=.011*Math.PI*sign*Math.cos(Math.PI*u)/width;
      const normal=new T.Vector3(n.x-tangent*n.z,n.y,n.z).normalize();
      xyz.push(v.x,v.y,v.z+lift);directions.push(normal.x,normal.y,normal.z);
    }
  }
  for(const g of geometry.groups){
    const first=xyz.length/3;
    for(let i=g.start;i<g.start+g.count;i+=3){
      const vertices=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(pos,i+k));
      emit(...vertices,new T.Vector3().fromBufferAttribute(norm,i),3);
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
  function add(geo,mat,x,y,z){
    const mesh=new T.Mesh(geo,mat);
    mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;group.add(mesh);
    return mesh;
  }
  function block(width,height,depth,bottom,z,mat){
    return add(blockGeometry(width,height,depth,.004,false),mat,0,bottom+height/2,z);
  }
  function profileFace(path,depth,base,z){
    const mesh=add(sheet(path,depth,.004),faces,0,base+.004,z-depth/2+.004);
    const bounds=path.getPoints(64);
    const xs=bounds.map(p=>p.x),ys=bounds.map(p=>p.y);
    mesh.userData.face={left:Math.min(...xs),right:Math.max(...xs),height:Math.max(...ys),z:depth-.004};
    return mesh;
  }
  if(type==='urna'){
    block(.32,.052,.32,0,0,satin);
    const pad=block(.26,.105,.21,.052,-.042,satin);pad.rotation.x=-.28;
    const plaque=profileFace(outline(w-.008,d-.008,shape),.049,.073,.17);
    plaque.rotation.x=-1.22;
    return group;
  }
  if(type==='pamatna'){
    // A freestanding masonry sample represents the wall mounting in the viewer.
    const backing=new T.MeshStandardMaterial({color:0xaba497,roughness:1});
    block(.76,.61,.18,0,-.124,backing);
    profileFace(outline(w-.008,h-.008,shape),.042,.105,-.012);
    return group;
  }
  const bevel=model.zrazenie, footing=.035, shoulder=footing+model.vyskaObruby;
  const top=shoulder+model.hrubkaDosky;
  block(w-.05,footing,d-.05,0,0,satin);
  const ring=rectangle(-w/2+bevel,-d/2+bevel,w/2-bevel,d/2-bevel);
  const rail=model.sirkaObruby;
  ring.holes.push(rectangle(-w/2+rail,-d/2+rail,w/2-rail,d/2-rail));
  add(sheet(ring,model.vyskaObruby,bevel),satin,0,footing+bevel,0).rotation.x=-Math.PI/2;
  const halfW=w/2+.005,halfD=d/2+.005,gap=.0025+bevel;
  const covers=cover==='delena'
    ?[rectangle(-halfW,-halfD,-gap,halfD),rectangle(gap,-halfD,halfW,halfD)]
    :[rectangle(-halfW,-halfD,halfW,halfD)];
  if(cover==='kvety'){
    covers[0].holes.push(recess(w,d,bevel));
    const lip=recess(w,d,.022);
    lip.holes.push(recess(w,d,-bevel));
    add(sheet(lip,.024,.003),polished,0,top+.003,0).rotation.x=-Math.PI/2;
    const soil=new T.MeshStandardMaterial({color:0x362c21,roughness:1});
    const bed=add(new T.ShapeGeometry(recess(w,d,.012)),soil,0,shoulder-.023,0);
    bed.rotation.x=-Math.PI/2;
    const gravel=new T.InstancedMesh(new T.IcosahedronGeometry(1,0),
      new T.MeshStandardMaterial({roughness:.95}),Math.round(1100*w));
    const pebble=new T.Object3D(),tone=new T.Color();
    let seed=4711;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
    for(let i=0;i<gravel.count;i++){
      const r=.004+random()*.007;
      pebble.position.set((random()-.5)*w*.58,bed.position.y+.001,d*(.08+random()*.27));
      pebble.rotation.set(random()*2,random()*3,random()*2);pebble.scale.set(r,r*.5,r*.85);
      pebble.updateMatrix();gravel.setMatrixAt(i,pebble.matrix);
      tone.setScalar(.045+random()*.11);gravel.setColorAt(i,tone);
    }
    gravel.receiveShadow=true;group.add(gravel);
  }
  for(const path of covers){
    const body=sheet(path,model.hrubkaDosky,bevel),normals=body.attributes.normal,indices=[];
    // Keep the vertical band in satin and its chamfer polished.
    body.clearGroups();let slot=-1;
    for(let i=0;i<normals.count;i+=3){
      const nz=normals.getZ(i);
      if(nz>.999)continue;
      const next=Math.abs(nz)>.12?0:1;
      if(next!==slot){body.addGroup(indices.length,0,next);slot=next;}
      body.groups.at(-1).count+=3;indices.push(i,i+1,i+2);
    }
    body.setIndex(indices);add(body,faces,0,shoulder+bevel,0).rotation.x=-Math.PI/2;
  }
  const face=makeCoverFace(new T.ShapeGeometry(covers,28));
  face.rotation.x=-Math.PI/2;face.position.y=top;group.add(face);
  const z=-d/2+.195,sw=w*.78,baseHeight=model.vyskaPodstavca;
  block(w*.89,baseHeight,.32,top,z,polished);
  if(shape==='kniha'){
    // Two carved leaves meet at the recessed spine. Their faces have distinct normals.
    for(const sign of [-1,1]){
      const leaf=new T.Shape(),width=sw*.494;
      leaf.moveTo(0,.03);leaf.quadraticCurveTo(sign*width*.48,.085,sign*width,.045);
      leaf.lineTo(sign*width,h*.86);leaf.quadraticCurveTo(sign*width,h*.90,sign*width*.95,h*.91);leaf.quadraticCurveTo(sign*width*.48,h*1.046,0,h*.89);
      leaf.closePath();
      const mesh=profileFace(leaf,model.hrubkaStely,top+baseHeight-.03,z+.012);
      mesh.geometry=bookSurface(mesh.geometry,width,sign);mesh.userData.face.curveWidth=width;
      mesh.position.x=sign*.005;mesh.rotation.set(-.07,-sign*.095,0);
    }
    const spine=block(.018,h*.84,.084,top+baseHeight,z+.005-h*.42*Math.sin(.07),polished);
    spine.rotation.x=-.07;
  }else{
    const stela=profileFace(outline(sw-.008,h-.008,shape),model.hrubkaStely,top+baseHeight,z);
    stela.rotation.x=-.065;
  }
  return group;
}
