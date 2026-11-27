import * as T from 'three';
import {holubica,klas,srdce,kniha,kahance,zardiniera,kamennyLampas,lavicka} from './doplnky.js';

const finishes={
  zlata:[0xf4d79b,.32,.34],strieborna:[0xd3d7d9,.60,.32],
  cierna:[0x161819,.05,.55],biela:[0xe4dfd2,.03,.75],piesokovana:[0xb5ab98,0,.93]
};

// Intersect the lettering column with the flat stone at the top and bottom
// of the glyph band, including every change of direction between those heights.
function fitColumn(contour,low,high,left,right){
  let start=left,end=right;
  const levels=[low,high,...contour.map(p=>p.y).filter(y=>y>low&&y<high)];
  for(const y of levels){
    let min=Infinity,max=-Infinity;
    for(let i=1;i<contour.length;i++){
      const a=contour[i-1],b=contour[i];
      if(a.y===b.y||y<Math.min(a.y,b.y)||y>Math.max(a.y,b.y))continue;
      const x=a.x+(y-a.y)*(b.x-a.x)/(b.y-a.y);
      min=Math.min(min,x);max=Math.max(max,x);
    }
    start=Math.max(start,min);end=Math.min(end,max);
  }
  return [start,end];
}

// Both canvases use the same glyph outlines. Successively narrower strokes
// lower the middle of each cut, leaving a sloping polished lip.
function engraving(mesh,lines,font,finish,anisotropy,resolution){
  const {left,right,height:h}=(mesh.userData.coverField??mesh.userData.face),w=right-left;
  const mask=document.createElement('canvas'),height=document.createElement('canvas');
  mask.width=height.width=Math.max(256,Math.round(resolution*Math.min(1,w/h)));
  mask.height=height.height=Math.max(256,Math.round(resolution*Math.min(1,h/w)));
  const ctx=mask.getContext('2d'),cut=height.getContext('2d');
  cut.fillStyle='white';cut.fillRect(0,0,height.width,height.height);
  for(const [text,y,size,center,span] of lines){
    if(!text)continue;
    let px=size*.72*mask.height;
    ctx.font=px+'px '+font;
    const metrics=ctx.measureText(text);
    let x=mask.width*center,available=mask.width*span;
    if(mesh.userData.face?.contour){
      const middle=(1-.20-y*.72)*h,halfBand=(px*.66+3)*h/mask.height;
      const [a,b]=fitColumn(mesh.userData.face.contour,middle-halfBand,middle+halfBand,
        left+w*(center-span/2),left+w*(center+span/2));
      available=(b-a)*mask.width/w;
      if(available<=0)continue;
      x=((a+b)/2-left)*mask.width/w;
    }
    px*=Math.min(1,available*.82/Math.max(metrics.width,metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight,1));
    for(const c of [ctx,cut]){c.font=px+'px '+font;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';}
    const baseline=(.20+y*.72)*mask.height;
    ctx.strokeStyle='rgb(0,0,0)';ctx.lineWidth=6;ctx.strokeText(text,x,baseline);
    ctx.fillStyle='white';ctx.fillText(text,x,baseline);
    ctx.strokeStyle='white';ctx.lineWidth=2.8;ctx.strokeText(text,x,baseline);
    cut.fillStyle='#999';cut.fillText(text,x,baseline);
    for(const [width,tone] of [[5,220],[3,182],[1,145]]){
      cut.strokeStyle='rgb('+tone+' '+tone+' '+tone+')';cut.lineWidth=width;cut.strokeText(text,x,baseline);
    }
  }
  function texture(canvas){
    const map=new T.CanvasTexture(canvas);map.anisotropy=anisotropy;return map;
  }
  const [color,metalness,roughness]=finishes[finish]??finishes.zlata;
  const original=mesh.material,base=Array.isArray(original)?original[0]:original,material=base.clone();
  const maps=[texture(mask),texture(height)];
  material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-engraved';
  material.onBeforeCompile=(shader,renderer)=>{
    base.onBeforeCompile(shader,renderer);
    Object.assign(shader.uniforms,{
      inscription:{value:maps[0]},cutDepth:{value:maps[1]},letterColor:{value:new T.Color(color)},
      faceBox:{value:new T.Vector4(left,w,h,mesh.userData.coverField?.bottom??0)},finishMetal:{value:metalness},finishRough:{value:roughness}
    });
    shader.vertexShader='varying float faceNormalZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfaceNormalZ=normal.z;');
    shader.fragmentShader='varying float faceNormalZ;uniform sampler2D inscription,cutDepth;uniform vec4 faceBox;uniform vec3 letterColor;uniform float finishMetal,finishRough;\n'+shader.fragmentShader
      .replace('#include <roughnessmap_fragment>',`
        vec2 letterUV=vec2((vStone.x-faceBox.x)/faceBox.y,(vStone.y-faceBox.w)/faceBox.z);
        vec4 glyph=texture2D(inscription,letterUV);
        float ink=glyph.a*step(.95,faceNormalZ);
        vec3 infill=finishRough>.90?mix(diffuseColor.rgb,letterColor,.66):letterColor;
        float stoneLight=smoothstep(.18,.55,dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)));
        float lip=smoothstep(.61,.89,texture2D(cutDepth,letterUV).r);
        infill*=mix(.15,1.,glyph.r);
        infill*=1.0-stoneLight*(.39*finishMetal+.54*lip);
        diffuseColor.rgb=mix(diffuseColor.rgb,infill,ink);
        #include <roughnessmap_fragment>
        roughnessFactor=mix(roughnessFactor,finishRough,ink);`)
      .replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\nmetalnessFactor=mix(metalnessFactor,finishMetal,ink);')
      .replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        float depth=texture2D(cutDepth,letterUV).r*.0011;
        vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
        vec3 r1=cross(sy,normal),r2=cross(normal,sx);
        float determinant=dot(sx,r1);
        normal=normalize(normal-sign(determinant)*(dFdx(depth)*r1+dFdy(depth)*r2)*ink/max(abs(determinant),1e-12));`);
  };
  mesh.material=Array.isArray(original)?[material,original[1]]:material;
  return ()=>{mesh.material=original;maps.forEach(map=>map.dispose());material.dispose();};
}

function ovalPortrait(source){
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=336;
  const c=canvas.getContext('2d');c.fillStyle='#dcd5c7';c.fillRect(0,0,256,336);
  if(source){
    const scale=Math.max(256/source.width,336/source.height),w=source.width*scale,h=source.height*scale;
    c.drawImage(source,(256-w)/2,(336-h)/2,w,h);
  }else{
    const wash=c.createRadialGradient(101,91,4,128,167,185);
    wash.addColorStop(0,'#f5f0e2');wash.addColorStop(1,'#b2a997');c.fillStyle=wash;c.fillRect(0,0,256,336);
    // An anonymous profile, modelled after a cut-paper portrait.
    const profile=new Path2D('M 0 336 L 0 299 Q 22 261 77 241 Q 109 229 104 198 Q 99 182 83 163 Q 66 146 67 110 C 65 65 94 41 133 44 C 169 46 183 71 181 99 Q 179 108 185 119 L 194 139 Q 196 144 184 147 L 183 155 Q 187 159 181 162 Q 184 167 180 172 Q 178 177 177 185 Q 175 196 154 196 L 149 209 Q 151 228 174 238 Q 224 250 256 300 L 256 336 Z');
    c.fillStyle='#626059';c.fill(profile);
    c.strokeStyle='#999286';c.lineWidth=2;c.beginPath();c.moveTo(78,241);c.quadraticCurveTo(120,266,153,221);c.stroke();
  }
  const geom=new T.CircleGeometry(1,64),map=new T.CanvasTexture(canvas);
  map.colorSpace=T.SRGBColorSpace;
  const oval=new T.Mesh(geom,new T.MeshPhysicalMaterial({map,roughness:.22,clearcoat:.45}));
  const rim=new T.Mesh(new T.TorusGeometry(1,.035,8,80),new T.MeshStandardMaterial({color:0xb29866,metalness:.8,roughness:.34}));
  rim.scale.z=.05;oval.add(rim);return oval;
}

function standingAccessory(id){
  const g=new T.Group();
  const bronze=new T.MeshStandardMaterial({color:0x785b39,metalness:.68,roughness:.34});
  function part(geo,mat,x,y,z){
    const mesh=new T.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;g.add(mesh);return mesh;
  }
  function turned(points){
    const profile=points.map(([x,y])=>new T.Vector2(x,y));
    const geometry=new T.LatheGeometry(profile,48),colors=[];
    for(let i=0;i<geometry.attributes.position.count;i++){
      const row=i%points.length;
      const recessed=row>0&&row<points.length-1&&points[row][0]<points[row-1][0];
      const light=recessed?.68:.95+.05*Math.sin(Math.floor(i/points.length)*Math.PI/12);
      colors.push(light,light*(recessed?1.09:1),light*(recessed?1.06:1));
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
    const metal=bronze.clone();metal.vertexColors=true;
    part(geometry,metal,0,0,0);
  }
  if(id==='vaza'){
    turned([[0,0],[.049,0],[.052,.006],[.05,.014],[.031,.023],[.031,.038],[.054,.181],[.058,.199],[.057,.204],[.051,.205],[.048,.195],[.026,.05],[0,.042]]);
  }else{
    bronze.color.setHex(0x95784e);bronze.roughness=.28;
    turned([[0,0],[.065,0],[.065,.015],[.054,.025],[0,.025]]);
    const glass=new T.MeshPhysicalMaterial({color:0xffebbf,transparent:true,opacity:.28,roughness:.11,metalness:.08,clearcoat:.7,depthWrite:false});
    part(new T.CylinderGeometry(.047,.047,.13,8),glass,0,.092,0);
    for(const x of [-.035,.035])for(const z of [-.035,.035])part(new T.CylinderGeometry(.003,.003,.14,8),bronze,x,.094,z);
    part(new T.CylinderGeometry(.023,.024,.078,24),new T.MeshStandardMaterial({color:0xe4d6b8}),0,.065,0);
    turned([[0,.157],[.063,.157],[.063,.166],[.032,.188],[.015,.195],[.009,.209],[0,.211]]);
  }
  return g;
}

export function personalizuj(monument,state,selection,model,aniso,resolution,stoneFaces){
  const faces=[];monument.traverse(mesh=>{if(mesh.userData.face)faces.push(mesh);});
  monument.updateMatrixWorld(true);
  const group=new T.Group();group.userData.release=[];monument.add(group);
  const double=selection.type==='dvojhrob',book=faces.length===2;
  let cover;monument.traverse(mesh=>{if(mesh.userData.coverField)cover=mesh;});
  const nameAt=state.nameAt??'face',verseAt=state.verseAt??'face';
  function onLeaf(place,index,defaultIndex){
    if(place==='slab'&&cover)return false;
    if(!book||double)return true;
    return index===(place==='rightPage'?1:place==='leftPage'?0:defaultIndex);
  }
  const people=(double?state.people:state.people.slice(0,1)).filter(p=>Object.values(p).some(Boolean));
  const datesOf=p=>[p.birth&&'* '+p.birth,p.death&&'† '+p.death].filter(Boolean).join('    ');
  if(cover){
    const lines=[];
    if(nameAt==='slab')people.forEach((p,i)=>{
      const center=(i+.5)/people.length,span=1/people.length;
      lines.push([p.first,.15,.15,center,span],[p.last,.35,.16,center,span],[datesOf(p),.54,.085,center,span]);
    });
    if(verseAt==='slab')state.epitaph.split(/\r?\n/).forEach((s,i)=>lines.push([s,(nameAt==='slab'?.73:.40)+i*.12,.10,.5,1]));
    if(lines.some(([s])=>s))group.userData.release.push(engraving(cover,lines,state.font,state.finish,aniso,resolution));
  }
  for(const [index,mesh] of faces.entries()){
    const {left,right,height,z}=mesh.userData.face;
    const surface=new T.Group();surface.applyMatrix4(monument.matrixWorld.clone().invert().multiply(mesh.matrixWorld));group.add(surface);
    const lettering=[];
    // A shared line on a carved book spans two adjacent engraving canvases.
    const sharedCenter=book?1-index:.5,sharedSpan=book?2:1;
    people.forEach((person,i)=>{
      if(!onLeaf(nameAt,index,0)||(book&&people.length===2&&i!==index))return;
      const shared=double&&people.length===1;
      const center=shared?sharedCenter:book?.5:(i+.5)/people.length;
      const span=shared?sharedSpan:book?1:1/people.length;
      const dates=datesOf(person);
      lettering.push([person.first,.30,.15,center,span],[person.last,.47,.16,center,span],[dates,.64,.082,center,span]);
    });
    if(onLeaf(verseAt,index,1)){
      const soloLeaf=book&&!double;
      state.epitaph.split(/\r?\n/).slice(0,2).forEach((line,i)=>lettering.push(
        [line,soloLeaf&&!onLeaf(nameAt,index,0)?.44+i*.14:.78+i*.10,soloLeaf?.12:.084,soloLeaf?.5:sharedCenter,soloLeaf?1:sharedSpan]));
    }
    if(lettering.some(([value])=>value))group.userData.release.push(engraving(mesh,lettering,state.font,state.finish,aniso,resolution));
    if(index===0){
      const contour=mesh.userData.face.contour;
      const [decorLeft,decorRight]=contour?fitColumn(contour,height*.67,height*.85,left,right):[left,right];
      const decorWidth=decorRight-decorLeft;
      if(state.extras.has('fotokeramika')){
        const photo=ovalPortrait(state.photo);photo.scale.set(height*.063,height*.083,1);
        photo.position.set(decorLeft+decorWidth*.5,height*.76,z+.0008+(mesh.userData.face.curveWidth?.014:0));surface.add(photo);
      }
      const sign=state.extras.has('kriz'),rose=state.extras.has('ornament-ruza');
      if(sign||rose){
        const bronze=new T.MeshStandardMaterial({color:0xb29a65,metalness:.65,roughness:.35});
        function wire(points,r){
          const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x*height,y*height,0)));
          const line=new T.Mesh(new T.TubeGeometry(curve,Math.max(10,points.length*2),r*height,6,false),bronze);
          line.position.set(decorLeft+decorWidth*(sign&&rose?.26:sign?.28:.72),height*.77,z+.002+(mesh.userData.face.curveWidth?.014:0));surface.add(line);return line;
        }
        if(sign){wire([[0,-.052],[0,.055]],.004);wire([[-.031,.014],[.031,.014]],.004);}
        if(rose){
          const offset=sign?decorWidth*.48:0;
          const twig=pts=>{wire(pts,.0023).position.x+=offset;};
          twig([[-.018,-.052],[0,-.02],[.011,.016]]);twig([[-.005,-.029],[-.028,-.010],[-.012,-.013],[-.005,-.029]]);
          const petals=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*4,r=.004+.017*i/96+.003*Math.sin(5*a);petals.push([.012+r*Math.cos(a),.030+r*Math.sin(a)]);}twig(petals);
        }
      }
      const lift=z+.002+(mesh.userData.face.curveWidth?.014:0);
      if(state.extras.has('holubica')){
        // The dove takes the first free place in the crown band and faces the centre.
        const photo=state.extras.has('fotokeramika');
        const at=!rose?.73:!sign?.27:!photo?.5:.73;
        const dove=holubica(height*.21);
        dove.position.set(decorLeft+decorWidth*at,height*(at===.5?.79:.74),lift);
        if(at<.5)dove.scale.x=-1;
        surface.add(dove);
      }
      if(state.extras.has('klasy')){
        const contourBase=contour?fitColumn(contour,height*.05,height*.30,left,right):[left,right];
        const span=contourBase[1]-contourBase[0];
        for(const side of [-1,1]){
          const ear=klas(height*.27,-side);
          ear.position.set(side<0?contourBase[0]+span*.085:contourBase[1]-span*.085,height*.05,lift);
          surface.add(ear);
        }
      }
    }
  }
  const grave=!['urna','pamatna'].includes(selection.type),bed=monument.userData.surface;
  // Small graves bring the pedestal forward; keep the vase and lantern in front of it.
  const headZ=grave?Math.max(-model.dlzka*.23,(bed?.pedestalFront??-Infinity)+.09):.075;
  for(const [id,side] of [['vaza',-1],['lampas',1]])if(state.extras.has(id)){
    const obj=standingAccessory(id);
    obj.position.set(side*(grave?model.sirka*.365:model.sirka*.50+.038),grave?.035+model.vyskaObruby+model.hrubkaDosky:.058,headZ);
    if(selection.type==='pamatna')obj.position.y=.755;
    if(!grave)obj.scale.setScalar(.58);group.add(obj);
  }
  const loose=[['zardiniera',zardiniera,['F','ML','MR']],['kamenna-kniha',kniha,['F','FL','FR','ML','MR']],
    ['kamenne-srdce',srdce,['FL','FR','ML','MR','F']],['kahance',kahance,['FR','FL','MR','ML','F']],
    ['kamenny-lampas',kamennyLampas,['HR','HL','FR','FL','MR','ML']]].filter(([id])=>state.extras.has(id));
  if(grave&&bed&&(loose.length||state.extras.has('lavicka'))){
    const faces=stoneFaces();
    const w=model.sirka,d=model.dlzka,blocked=[];
    const rect=(x,z,fx,fz)=>[x-fx,x+fx,z-fz,z+fz];
    const overlaps=(a,b)=>a[0]<b[1]&&b[0]<a[1]&&a[2]<b[3]&&b[2]<a[3];
    if(bed.recess)blocked.push([bed.recess.x0-.02,bed.recess.x1+.02,bed.recess.z0-.02,bed.recess.z1+.02]);
    const slabText=cover&&((nameAt==='slab'&&people.length)||(verseAt==='slab'&&state.epitaph.trim()));
    if(slabText){const f=cover.userData.coverField;blocked.push([f.left,f.right,-(f.bottom+f.height),-f.bottom]);}
    if(state.extras.has('vaza'))blocked.push(rect(-w*.365,headZ,.07,.07));
    if(state.extras.has('lampas'))blocked.push(rect(w*.365,headZ,.07,.07));
    const slots={F:[0,.40*d],FL:[-.28*w,.38*d],FR:[.28*w,.38*d],ML:[-.30*w,.10*d],MR:[.30*w,.10*d],HL:[-.365*w,headZ],HR:[.365*w,headZ]};
    for(const [,build,order] of loose){
      const obj=build(faces),[fx,fz]=obj.userData.footprint;
      let spot;
      for(const key of order){
        const x=T.MathUtils.clamp(slots[key][0],-w/2+fx+.02,w/2-fx-.02);
        const z=T.MathUtils.clamp(slots[key][1],bed.pedestalFront+fz+.03,d/2-fz-.02);
        const r=rect(x,z,fx,fz);
        if(!blocked.some(b=>overlaps(b,r))){spot=[x,z,r];break;}
      }
      if(!spot){const [x,z]=slots[order[0]];spot=[x,z,rect(x,z,fx,fz)];}
      blocked.push(spot[2]);
      const onGravel=bed.gravelFrom!=null&&spot[1]-fz>bed.gravelFrom;
      obj.position.set(spot[0],onGravel?bed.gravelTop:bed.top,spot[1]);group.add(obj);
    }
    if(state.extras.has('lavicka')){
      const bench=lavicka(faces);bench.position.set(w/2+.47,0,Math.min(.05,d*.1));group.add(bench);
    }
  }
  return group;
}

export function odstran(group){
  if(!group)return;
  group.removeFromParent();group.userData.release.forEach(release=>release());
  const materials=new Set();
  group.traverse(o=>{o.geometry?.dispose();for(const m of [o.material??[]].flat())materials.add(m);});
  for(const m of materials){m.map?.dispose();m.bumpMap?.dispose();m.dispose();}
}
