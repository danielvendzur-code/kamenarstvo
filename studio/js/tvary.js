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
    path.lineTo(x,h*.76);path.bezierCurveTo(x*.68,h*1.08,-x*.68,h*1.08,-x,h*.76);
  }else if(profile==='vlna'){
    path.lineTo(x,h*.80);path.bezierCurveTo(x*.29,h*.66,-x*.24,h*1.10,-x,h*.94);
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

function flowerHole(w,d,extra=0){
  const hole=new T.Path();
  hole.absellipse(0,-d*.21,w*.286+extra,d*.138+extra,0,Math.PI*2,true);
  return hole;
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
    return add(blockGeometry(width,height,depth,.002,false),mat,0,bottom+height/2,z);
  }
  function profileFace(path,depth,base,z){
    return add(sheet(path,depth,.004),faces,0,base+.004,z-depth/2+.004);
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
  const bevel=.002, top=.243;
  block(w-.06,.045,d-.06,0,0,satin);
  if(cover==='kvety'){
    const rail=rectangle(-w/2+.002,-d/2+.002,w/2-.002,d/2-.002);
    rail.holes.push(flowerHole(w,d,.012));
    const base=add(sheet(rail,.14,bevel),satin,0,.045+bevel,0);
    base.rotation.x=-Math.PI/2;
    const soil=new T.MeshStandardMaterial({color:0x3c3026,roughness:1});
    block(w-.08,.035,d-.08,.045,0,soil);
  }else block(w,.14,d,.045,0,satin);
  const halfW=w/2+.005,halfD=d/2+.005;
  const covers=cover==='delena'
    ?[rectangle(-halfW,-halfD,-.006,halfD),rectangle(.006,-halfD,halfW,halfD)]
    :[rectangle(-halfW,-halfD,halfW,halfD)];
  if(cover==='kvety')covers[0].holes.push(flowerHole(w,d));
  for(const path of covers){
    const body=sheet(path,.058,bevel);
    // The reflector is the only upward cap, including around the flower cut-out.
    const normals=body.attributes.normal,indices=[];
    for(let i=0;i<normals.count;i+=3)if(normals.getZ(i)<.999)indices.push(i,i+1,i+2);
    body.clearGroups();body.setIndex(indices);
    add(body,satin,0,.185+bevel,0).rotation.x=-Math.PI/2;
  }
  const face=makeCoverFace(new T.ShapeGeometry(covers,28));
  face.rotation.x=-Math.PI/2;face.position.y=top;group.add(face);
  const z=-d/2+.195,sw=w*.78;
  block(w*.89,.085,.32,top,z,polished);
  if(shape==='kniha'){
    // Two carved leaves meet at the recessed spine. Their faces have distinct normals.
    for(const sign of [-1,1]){
      const leaf=new T.Shape(),width=sw*.494;
      leaf.moveTo(0,.03);leaf.quadraticCurveTo(sign*width*.48,.085,sign*width,.045);
      leaf.lineTo(sign*width,h*.90);leaf.quadraticCurveTo(sign*width*.50,h*1.046,0,h*.89);
      leaf.closePath();
      const mesh=profileFace(leaf,.095,top+.064,z+.012);
      mesh.position.x=sign*.005;mesh.rotation.y=-sign*.12;
    }
    block(.021,h*.84,.105,top+.085,z+.005,polished);
  }else{
    const stela=profileFace(outline(sw-.008,h-.008,shape),.125,top+.085,z);
    stela.rotation.x=-.065;
  }
  return group;
}
