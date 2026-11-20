import * as THREE from 'three';

// Dimensions are in metres. Small planar chamfers catch the grazing sky light.
export function jednohrob({sirka:w, dlzka:d, vyskaStely:h}, material) {
  const group = new THREE.Group();
  function block(width, height, depth, x, bottom, z, bevel = 0.003) {
    const a = width/2-bevel, b = height/2-bevel;
    const outline = new THREE.Shape();
    outline.moveTo(-a,-b); outline.lineTo(a,-b); outline.lineTo(a,b);
    outline.lineTo(-a,b); outline.closePath();
    const geometry = new THREE.ExtrudeGeometry(outline,{
      depth:depth-2*bevel, bevelEnabled:true, bevelSegments:1,
      bevelThickness:bevel, bevelSize:bevel, steps:1
    });
    geometry.center();
    const mesh = new THREE.Mesh(geometry,material);
    mesh.position.set(x,bottom+height/2,z);
    mesh.castShadow = mesh.receiveShadow = true;
    group.add(mesh);
  }
  block(w-0.06,0.045,d-0.06,0,0,0);
  const rail=0.10;
  for(const sign of [-1,1]){
    block(w,0.14,rail,0,0.045,sign*(d-rail)/2);
    block(rail,0.14,d-2*rail,sign*(w-rail)/2,0.045,0);
  }
  block(w+0.014,0.058,d+0.014,0,0.185,0);
  block(w*0.89,0.085,0.32,0,0.243,-d/2+0.195);
  block(w*0.78,h,0.125,0,0.328,-d/2+0.195,0.005);
  return group;
}
