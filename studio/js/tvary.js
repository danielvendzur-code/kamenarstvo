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

export function jednohrob({sirka:w,dlzka:d,vyskaStely:h},polished,satin,makeCoverFace){
  const group=new T.Group();
  function block(width,height,depth,bottom,z,material,bevel=0.002,openTop=false){
    const mesh=new T.Mesh(blockGeometry(width,height,depth,bevel,openTop),material);
    mesh.position.set(0,bottom+height/2,z);
    mesh.castShadow=mesh.receiveShadow=true;
    group.add(mesh);
    return mesh;
  }
  block(w-0.06,0.045,d-0.06,0,0,satin);
  block(w,0.14,d,0.045,0,satin);
  const coverHeight=0.185+0.058, bevel=0.002;
  block(w+0.014,0.058,d+0.014,0.185,0,satin,bevel,true);
  const face=makeCoverFace(w+0.014-2*bevel,d+0.014-2*bevel);
  face.rotation.x=-Math.PI/2;
  face.position.y=coverHeight;
  group.add(face);
  block(w*0.89,0.085,0.32,coverHeight,-d/2+0.195,polished);
  const stela=block(w*0.78,h,0.125,coverHeight+0.085,-d/2+0.195,[polished,satin],0.004);
  stela.rotation.x=-0.065;
  stela.position.y-=0.004;
  // Keep the broad inscription faces polished and the narrow return faces satin.
  const normals=stela.geometry.getAttribute('normal');
  let start=0,previous=-1;
  for(let i=0;i<normals.count;i+=3){
    const index=Math.abs(normals.getZ(i))>0.999?0:1;
    if(i && index!==previous){stela.geometry.addGroup(start,i-start,previous);start=i;}
    previous=index;
  }
  stela.geometry.addGroup(start,normals.count-start,previous);
  return group;
}
