import * as T from 'three';

const finishes={
  zlata:[0xf4d79b,.32,.34],strieborna:[0xd3d7d9,.60,.32],
  cierna:[0x161819,.05,.55],biela:[0xe4dfd2,.03,.75],piesokovana:[0xb5ab98,0,.93]
};

// Both canvases use the same glyph outlines. Successively narrower strokes
// lower the middle of each cut, leaving a sloping polished lip.
function engraving(mesh,lines,font,finish,anisotropy,resolution){
  const {left,right,height:h}=mesh.userData.face,w=right-left;
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
    px*=Math.min(1,mask.width*.82*span/Math.max(metrics.width,metrics.actualBoundingBoxLeft+metrics.actualBoundingBoxRight,1));
    for(const c of [ctx,cut]){c.font=px+'px '+font;c.textAlign='center';c.textBaseline='middle';c.lineJoin='round';}
    const x=mask.width*center,baseline=(.20+y*.72)*mask.height;
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
  const original=mesh.material,base=original[0],material=base.clone();
  const maps=[texture(mask),texture(height)];
  material.customProgramCacheKey=()=>base.customProgramCacheKey()+'-engraved';
  material.onBeforeCompile=(shader,renderer)=>{
    base.onBeforeCompile(shader,renderer);
    Object.assign(shader.uniforms,{
      inscription:{value:maps[0]},cutDepth:{value:maps[1]},letterColor:{value:new T.Color(color)},
      faceBox:{value:new T.Vector3(left,w,h)},finishMetal:{value:metalness},finishRough:{value:roughness}
    });
    shader.vertexShader='varying float faceNormalZ;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nfaceNormalZ=normal.z;');
    shader.fragmentShader='varying float faceNormalZ;uniform sampler2D inscription,cutDepth;uniform vec3 faceBox,letterColor;uniform float finishMetal,finishRough;\n'+shader.fragmentShader
      .replace('#include <roughnessmap_fragment>',`
        vec2 letterUV=vec2((vStone.x-faceBox.x)/faceBox.y,vStone.y/faceBox.z);
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
  mesh.material=[material,original[1]];
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

export function personalizuj(monument,state,selection,model,aniso,resolution){
  const faces=[];monument.traverse(mesh=>{if(mesh.userData.face)faces.push(mesh);});
  monument.updateMatrixWorld(true);
  const group=new T.Group();group.userData.release=[];monument.add(group);
  const double=selection.type==='dvojhrob',book=faces.length===2;
  for(const [index,mesh] of faces.entries()){
    const {left,right,height,z}=mesh.userData.face;
    const surface=new T.Group();surface.applyMatrix4(monument.matrixWorld.clone().invert().multiply(mesh.matrixWorld));group.add(surface);
    const width=right-left,lettering=[];
    const people=(double?state.people:state.people.slice(0,1)).filter(p=>Object.values(p).some(Boolean));
    // A shared line on a carved book spans two adjacent engraving canvases.
    const sharedCenter=book?1-index:.5,sharedSpan=book?2:1;
    people.forEach((person,i)=>{
      if(book&&((people.length===2&&i!==index)||(!double&&index===1)))return;
      const shared=double&&people.length===1;
      const center=shared?sharedCenter:book?.5:(i+.5)/people.length;
      const span=shared?sharedSpan:book?1:1/people.length;
      const dates=[person.birth&&'* '+person.birth,person.death&&'† '+person.death].filter(Boolean).join('    ');
      lettering.push([person.first,.30,.15,center,span],[person.last,.47,.16,center,span],[dates,.64,.082,center,span]);
    });
    if(double||!book||index===1){
      const soloLeaf=book&&!double;
      state.epitaph.split(/\r?\n/).slice(0,2).forEach((line,i)=>lettering.push(
        [line,soloLeaf?.44+i*.14:.78+i*.10,soloLeaf?.12:.084,soloLeaf?.5:sharedCenter,soloLeaf?1:sharedSpan]));
    }
    if(lettering.some(([value])=>value))group.userData.release.push(engraving(mesh,lettering,state.font,state.finish,aniso,resolution));
    if(index===0){
      if(state.extras.has('fotokeramika')){
        const photo=ovalPortrait(state.photo);photo.scale.set(height*.063,height*.083,1);
        photo.position.set(left+width*.5,height*.76,z+.0008+(mesh.userData.face.curveWidth?.014:0));surface.add(photo);
      }
      const sign=state.extras.has('kriz'),rose=state.extras.has('ornament-ruza');
      if(sign||rose){
        const bronze=new T.MeshStandardMaterial({color:0xb29a65,metalness:.65,roughness:.35});
        function wire(points,r){
          const curve=new T.CatmullRomCurve3(points.map(([x,y])=>new T.Vector3(x*height,y*height,0)));
          const line=new T.Mesh(new T.TubeGeometry(curve,Math.max(10,points.length*2),r*height,6,false),bronze);
          line.position.set(left+width*(sign&&rose?.26:sign?.28:.72),height*.77,z+.002+(mesh.userData.face.curveWidth?.014:0));surface.add(line);return line;
        }
        if(sign){wire([[0,-.052],[0,.055]],.004);wire([[-.031,.014],[.031,.014]],.004);}
        if(rose){
          const offset=sign?width*.48:0;
          const twig=pts=>{wire(pts,.0023).position.x+=offset;};
          twig([[-.018,-.052],[0,-.02],[.011,.016]]);twig([[-.005,-.029],[-.028,-.010],[-.012,-.013],[-.005,-.029]]);
          const petals=[];for(let i=0;i<=96;i++){const a=i/96*Math.PI*4,r=.004+.017*i/96+.003*Math.sin(5*a);petals.push([.012+r*Math.cos(a),.030+r*Math.sin(a)]);}twig(petals);
        }
      }
    }
  }
  for(const [id,side] of [['vaza',-1],['lampas',1]])if(state.extras.has(id)){
    const obj=standingAccessory(id),grave=!['urna','pamatna'].includes(selection.type);
    obj.position.set(side*(grave?model.sirka*.365:model.sirka*.50+.038),grave?.035+model.vyskaObruby+model.hrubkaDosky:.058,grave?-model.dlzka*.23:.075);
    if(selection.type==='pamatna')obj.position.y=.755;
    if(!grave)obj.scale.setScalar(.58);group.add(obj);
  }
  return group;
}

export function odstran(group){
  if(!group)return;
  group.removeFromParent();group.userData.release.forEach(release=>release());
  const materials=new Set();
  group.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});
  for(const m of materials){m.map?.dispose();m.bumpMap?.dispose();m.dispose();}
}
