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
  function addTablet(sw,h,depth,bottom,z,tilt){
    if(shape==='kniha'){
      // Two carved leaves meet at the recessed spine. Their faces have distinct normals.
      const pivot=new T.Group();pivot.position.set(0,bottom,z);pivot.rotation.x=tilt;group.add(pivot);
      for(const sign of [-1,1]){
        const leaf=new T.Shape(),width=sw*.494;
        leaf.moveTo(0,.03);leaf.quadraticCurveTo(sign*width*.48,.072,sign*width*.95,.045);
        leaf.quadraticCurveTo(sign*width,.043,sign*width,.062);
        leaf.lineTo(sign*width,h*.86);leaf.quadraticCurveTo(sign*width,h*.90,sign*width*.95,h*.91);leaf.quadraticCurveTo(sign*width*.48,h*1.046,0,h*.89);
        leaf.closePath();
        const mesh=profileFace(leaf,depth,-.03,0);
        mesh.geometry=bookSurface(mesh.geometry,width,sign);mesh.userData.face.curveWidth=width;
        mesh.position.x=sign*.005;mesh.rotation.y=-sign*.095;pivot.add(mesh);
      }
      const spine=block(.024,h*.85,depth*.88,0,0,polished);
      pivot.add(spine);
    }else{
      const stela=profileFace(outline(sw-.008,h-.008,shape),depth,bottom,z);
      stela.rotation.x=tilt;
    }
  }
  if(type==='urna'||type==='pamatna'){
    if(type==='urna'){
      block(w+.15,.058,.58,0,0,faces);
      // The wedge supports the entire sloped face, including the book binding.
      const wedge=new T.Shape();
      wedge.moveTo(-.123,0);wedge.lineTo(.123,0);wedge.lineTo(.123,.118);
      wedge.lineTo(-.123,.028);wedge.closePath();
      const support=add(sheet(wedge,w*.68,.003),faces,-w*.34+.003,.061,-.015);
      support.rotation.y=Math.PI/2;
      addTablet(w,d,.042,.070,.172,-1.22);
    }else{
      // Stacked courses and a projecting shelf form a columbarium pier.
      const stonework=new T.MeshStandardMaterial({color:0xb8aa92,roughness:.88});
      for(let row=0;row<5;row++)block(w+.24,.268,.40,row*.272,-.218,stonework);
      block(w+.28,.055,.44,1.36,-.218,stonework);
      block(w+.24,.045,.32,.710,-.014,faces);
      block(w*.68,h*.70,.030,.82,-.008,satin);
      addTablet(w,h,.042,.78,.020,0);

    }
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
  function markSlabs(geometry){
    if(cover==='delena'){
      const pos=geometry.attributes.position;
      geometry.setAttribute('slabCut',new T.Float32BufferAttribute(
        Float32Array.from({length:pos.count},(_,i)=>Number(pos.getX(i)>0)),1));
    }
    return geometry;
  }
  for(const path of covers){
    const body=sheet(path,model.hrubkaDosky,bevel),normals=body.attributes.normal,indices=[];
    // Keep the vertical band in satin and its chamfer polished.
    body.clearGroups();let slot=-1;
    for(let i=0;i<normals.count;i+=3){
      const nz=normals.getZ(i);
      if(nz>.999 && normals.getZ(i+1)>.999 && normals.getZ(i+2)>.999)continue;
      const next=Math.abs(nz)>.12?0:1;
      if(next!==slot){body.addGroup(indices.length,0,next);slot=next;}
      body.groups.at(-1).count+=3;indices.push(i,i+1,i+2);
    }
    body.setIndex(indices);add(markSlabs(body),faces,0,shoulder+bevel,0).rotation.x=-Math.PI/2;
  }
  const face=makeCoverFace(markSlabs(new T.ShapeGeometry(covers,28)));
  face.rotation.x=-Math.PI/2;face.position.y=top;group.add(face);
  const z=-d/2+.195,sw=w*.78,baseHeight=model.vyskaPodstavca;
  block(w*.89,baseHeight,.32,top,z,faces);
  addTablet(sw,h,model.hrubkaStely,top+baseHeight,z,shape==='kniha'?-.018:0);
  return group;
}
