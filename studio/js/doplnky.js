import * as T from 'three';
import {bookLeaf} from './profily.js';
import {blockGeometry} from './tvary.js';

// Accessories added in the second catalogue. Each builder returns a group whose
// origin sits on the supporting surface, facing +z (towards the visitor).

const gold=()=>new T.MeshStandardMaterial({color:0xc2a468,metalness:.72,roughness:.3});

function mesh(geometry,material,x=0,y=0,z=0){
  const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;return m;
}

// Same mitred block as the monument: polished caps and arrises, satin sides.
function stoneBox(w,h,d,faces,x=0,y=0,z=0){
  const bevel=Math.min(.006,w/6,h/6,d/6);
  return mesh(blockGeometry(w,h,d,bevel,false),faces,x,y+h/2,z);
}

function extrude(shape,depth,bevel=.003,segments=40){
  return new T.ExtrudeGeometry(shape,{depth:Math.max(.0005,depth-2*bevel),bevelSize:bevel,bevelThickness:bevel,
    bevelSegments:2,steps:1,curveSegments:segments});
}

function heartShape(width,height){
  const s=new T.Shape(),x=width/2,h=height;
  s.moveTo(0,0);
  s.bezierCurveTo(-x*.30,h*.20,-x,h*.42,-x,h*.70);
  s.bezierCurveTo(-x,h*.92,-x*.70,h*1.02,-x*.47,h);
  s.bezierCurveTo(-x*.22,h*.98,-x*.05,h*.88,0,h*.76);
  s.bezierCurveTo(x*.05,h*.88,x*.22,h*.98,x*.47,h);
  s.bezierCurveTo(x*.70,h*1.02,x,h*.92,x,h*.70);
  s.bezierCurveTo(x,h*.42,x*.30,h*.20,0,0);
  return s;
}

// A dove in flight, facing left, drawn in a unit box and scaled to `size`.
function doveShape(size){
  const s=new T.Shape(),k=size/2;
  const p=(x,y)=>[x*k,y*k];
  s.moveTo(...p(-1,.16));
  s.quadraticCurveTo(...p(-.92,.30),...p(-.76,.31));
  s.quadraticCurveTo(...p(-.62,.31),...p(-.54,.20));
  s.bezierCurveTo(...p(-.44,.42),...p(-.30,.80),...p(-.02,1.02));
  s.bezierCurveTo(...p(-.04,.70),...p(.02,.46),...p(.12,.30));
  s.bezierCurveTo(...p(.26,.56),...p(.44,.74),...p(.70,.82));
  s.bezierCurveTo(...p(.58,.56),...p(.46,.34),...p(.40,.18));
  s.quadraticCurveTo(...p(.62,.14),...p(.80,.22));
  s.lineTo(...p(1,.30));s.lineTo(...p(.98,.06));s.lineTo(...p(1,-.12));
  s.quadraticCurveTo(...p(.70,-.10),...p(.50,-.06));
  s.bezierCurveTo(...p(.20,-.30),...p(-.30,-.26),...p(-.56,.02));
  s.quadraticCurveTo(...p(-.70,.10),...p(-.84,.10));
  s.closePath();
  return s;
}

export function holubica(size){
  const g=new T.Group(),metal=gold();
  const body=mesh(extrude(doveShape(size),.0045,.0012,28),metal);
  // An engraved eye catches the light like a punched detail.
  const eye=mesh(new T.CircleGeometry(size*.022,16),new T.MeshStandardMaterial({color:0x2a2116,roughness:.6}),-size*.38,size*.13,.0046);
  g.add(body,eye);return g;
}

// A wheat ear: curved stem, alternating grains and fine awns.
export function klas(height,mirror=1){
  const g=new T.Group(),metal=gold();
  const stem=new T.CatmullRomCurve3([[0,0],[.06,.35],[.10,.68],[.08,1]].map(([x,y])=>new T.Vector3(mirror*x*height*.4,y*height,0)));
  g.add(mesh(new T.TubeGeometry(stem,20,height*.012,6,false),metal));
  const grain=new T.SphereGeometry(1,10,8);
  for(let i=0;i<9;i++){
    const t=.48+i*.058,point=stem.getPointAt(Math.min(1,t)),tangent=stem.getTangentAt(Math.min(1,t));
    for(const side of [-1,1]){
      if(i===8&&side>0)continue;
      const seed=mesh(grain,metal,point.x+side*height*.032,point.y+height*.012,0.002);
      seed.scale.set(height*.026,height*.052,height*.011);
      seed.rotation.z=Math.atan2(tangent.y,tangent.x)-Math.PI/2+side*.55;
      g.add(seed);
      const awn=new T.CatmullRomCurve3([
        new T.Vector3(seed.position.x,seed.position.y+height*.04,0),
        new T.Vector3(seed.position.x+side*height*.07,seed.position.y+height*.16,0)]);
      g.add(mesh(new T.TubeGeometry(awn,3,height*.0035,4,false),metal));
    }
  }
  return g;
}

export function srdce(faces){
  const g=new T.Group();
  const width=.20,height=.18,depth=.05;
  const heart=mesh(extrude(heartShape(width,height),depth,.004),faces,0,.028,-.016);
  heart.rotation.x=-.30;
  g.add(stoneBox(.17,.03,.10,faces,0,0,-.012),heart);
  g.userData.footprint=[.11,.08];return g;
}

export function kniha(faces){
  const g=new T.Group(),pivot=new T.Group();
  pivot.position.set(0,.032,-.03);pivot.rotation.x=-.72;g.add(pivot);
  for(const sign of [-1,1]){
    const leaf=mesh(extrude(bookLeaf(.15,.22,sign),.024,.003),faces,sign*.004,0,0);
    leaf.rotation.y=-sign*.16;pivot.add(leaf);
  }
  g.add(stoneBox(.30,.032,.20,faces,0,0,0));
  g.userData.footprint=[.16,.12];return g;
}

function candle(glassColor,x){
  const g=new T.Group();g.position.x=x;
  const glass=new T.MeshPhysicalMaterial({color:glassColor,transparent:true,opacity:.62,roughness:.14,clearcoat:.6,
    emissive:glassColor,emissiveIntensity:.32,depthWrite:false});
  const shell=mesh(new T.CylinderGeometry(.033,.03,.115,28,1,true),glass,0,.0575,0);
  shell.castShadow=false;
  const floor=mesh(new T.CircleGeometry(.03,24),glass,0,.002,0);floor.rotation.x=-Math.PI/2;
  const wax=mesh(new T.CylinderGeometry(.024,.024,.045,20),new T.MeshStandardMaterial({color:0xf1e7d3,roughness:.7,emissive:0xffb35c,emissiveIntensity:.18}),0,.025,0);
  const flame=mesh(new T.SphereGeometry(1,12,10),new T.MeshBasicMaterial({color:0xffd58a}),0,.062,0);
  flame.scale.set(.0065,.016,.0065);flame.castShadow=false;
  const lid=mesh(new T.CylinderGeometry(.03,.035,.022,28),gold(),0,.126,0);
  const vent=mesh(new T.TorusGeometry(.018,.003,8,24),gold(),0,.138,0);vent.rotation.x=Math.PI/2;
  g.add(floor,wax,flame,shell,lid,vent);
  return g;
}

export function kahance(){
  const g=new T.Group();
  g.add(candle(0xa4121b,-.042),candle(0xc8761f,.044));
  g.userData.footprint=[.09,.05];return g;
}

export function zardiniera(faces){
  const g=new T.Group(),length=.46,depth=.15,height=.12,wall=.018;
  g.add(stoneBox(length,height,depth,faces,0,0,0));
  const soil=mesh(new T.PlaneGeometry(length-2*wall,depth-2*wall),new T.MeshStandardMaterial({color:0x2f261d,roughness:1}),0,height+.0015,0);
  soil.rotation.x=-Math.PI/2;g.add(soil);
  let seed=2741;const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const leaves=new T.InstancedMesh(new T.SphereGeometry(1,8,6),new T.MeshStandardMaterial({color:0xffffff,roughness:.75}),70);
  const blooms=new T.InstancedMesh(new T.IcosahedronGeometry(1,1),new T.MeshStandardMaterial({color:0xffffff,roughness:.62}),46);
  const o=new T.Object3D(),tone=new T.Color();
  const palette=[0xf3efe6,0xf6f1e8,0xb3162a,0xd65a7a,0x8d3c86,0xf2c14e];
  for(let i=0;i<leaves.count;i++){
    o.position.set((random()-.5)*(length-.05),height+.012+random()*.035,(random()-.5)*(depth-.04));
    o.rotation.set(random()*3,random()*3,random()*3);o.scale.set(.016,.0045,.009);o.updateMatrix();
    leaves.setMatrixAt(i,o.matrix);tone.setHSL(.27+random()*.06,.48,.20+random()*.10);leaves.setColorAt(i,tone);
  }
  for(let i=0;i<blooms.count;i++){
    const r=.010+random()*.008;
    o.position.set((random()-.5)*(length-.07),height+.035+random()*.045,(random()-.5)*(depth-.05));
    o.rotation.set(random()*3,random()*3,random()*3);o.scale.set(r,r*.8,r);o.updateMatrix();
    blooms.setMatrixAt(i,o.matrix);tone.setHex(palette[Math.floor(random()*palette.length)]);blooms.setColorAt(i,tone);
  }
  leaves.castShadow=blooms.castShadow=true;g.add(leaves,blooms);
  g.userData.footprint=[.25,.09];return g;
}

export function kamennyLampas(faces){
  const g=new T.Group();
  g.add(stoneBox(.13,.03,.13,faces,0,0,0));
  // Four corner posts frame a lit glass window on every side.
  for(const x of [-.044,.044])for(const z of [-.044,.044])g.add(stoneBox(.022,.15,.022,faces,x,.03,z));
  const glass=new T.MeshPhysicalMaterial({color:0xffe2a8,transparent:true,opacity:.42,roughness:.1,emissive:0xffb45a,emissiveIntensity:.55,depthWrite:false});
  const box=mesh(new T.BoxGeometry(.075,.14,.075),glass,0,.105,0);box.castShadow=false;g.add(box);
  const flame=mesh(new T.SphereGeometry(1,12,10),new T.MeshBasicMaterial({color:0xffd27a}),0,.095,0);
  flame.scale.set(.008,.02,.008);g.add(flame);
  g.add(stoneBox(.12,.02,.12,faces,0,.18,0));
  const roof=mesh(new T.ConeGeometry(.098,.075,4,1),faces[0],0,.2375,0);roof.rotation.y=Math.PI/4;g.add(roof);
  g.add(mesh(new T.SphereGeometry(.012,16,12),faces[0],0,.282,0));
  g.userData.footprint=[.08,.08];return g;
}

export function lavicka(faces){
  const g=new T.Group(),length=1.02,seat=.065,width=.34,height=.44;
  for(const z of [-.36,.36])g.add(stoneBox(.30,height-seat,.085,faces,0,0,z));
  const top=stoneBox(width,seat,length,faces,0,height-seat,0);
  g.add(top);
  return g;
}
