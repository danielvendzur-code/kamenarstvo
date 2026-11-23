import * as T from 'three';

const root=new URL('../assets/kamene/',import.meta.url);
const loader=new T.TextureLoader(), maps=new Map();
export function vzorka(stone){return new URL(stone.textura+'-vzorka.webp',root).href;}
export function loadStone(stone){
  const id=stone.textura;
  if(!maps.has(id)){
    const pending=Promise.all(['','-drsnost'].map(async suffix=>{
      const map=await loader.loadAsync(new URL(id+suffix+'.webp',root).href);
      map.wrapS=map.wrapT=T.RepeatWrapping;map.anisotropy=8;map.minFilter=T.LinearMipmapLinearFilter;
      if(!suffix)map.colorSpace=T.SRGBColorSpace;
      return map;
    })).then(pair=>{stone.maps=pair;}).catch(error=>{maps.delete(id);throw error;});
    maps.set(id,pending);
  }
  return maps.get(id);
}
export function vytvorZulu(stone,{satin=false,mirror=null}={}){
  const material=new T.MeshPhysicalMaterial({
    color:0xffffff,roughness:satin?.85:.065,ior:1.53,metalness:0,
    clearcoat:satin?.02:.38,clearcoatRoughness:.055,fog:false
  });
  const neutral=stone.textura==='absolute-black';
  material.customProgramCacheKey=()=>(neutral?'neutral-':'')+(mirror?'granite-planar':satin?'granite-satin':'granite-polished');
  material.onBeforeCompile=shader=>{
    shader.uniforms.slab={value:stone.maps[0]};shader.uniforms.grit={value:stone.maps[1]};
    shader.vertexShader='attribute float slabCut; varying vec3 vStone,cutPos,cutNormal,slabWorld; varying vec2 slabAxis;\n'+shader.vertexShader.replace('#include <begin_vertex>',`
      #include <begin_vertex>
      vStone=position;
      slabWorld=(modelMatrix*vec4(position,1.)).xyz;
      cutPos=position/1.65+modelMatrix[3].xyz*vec3(1.732,2.914,3.176);
      float angle=dot(modelMatrix[3].xyz,vec3(3.79,8.73,4.11));
      angle+=slabCut*.74;
      cutPos+=slabCut*vec3(.41,.63,.28);
      slabAxis=vec2(cos(angle),sin(angle));
      cutNormal=normal;`);
    shader.fragmentShader=`
      varying vec3 vStone,cutPos,cutNormal,slabWorld; varying vec2 slabAxis;
      uniform sampler2D slab,grit;
      vec4 projectSlab(sampler2D tex,vec3 weights){
        mat2 turn=mat2(slabAxis.x,-slabAxis.y,slabAxis.y,slabAxis.x);
        return texture2D(tex,turn*cutPos.zy)*weights.x+texture2D(tex,turn*cutPos.xz)*weights.y+texture2D(tex,turn*cutPos.xy)*weights.z;
      }
    `+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 weights=pow(abs(normalize(cutNormal)),vec3(8.));weights/=dot(weights,vec3(1.));
      diffuseColor.rgb=projectSlab(slab,weights).rgb;
      ${neutral?'diffuseColor.rgb+=vec3(.0075);':''}
      float surfaceGrain=projectSlab(grit,weights).g;
      diffuseColor.rgb+=${satin?'vec3(.027+.035*surfaceGrain)':'vec3(0.)'};`)
      .replace('#include <roughnessmap_fragment>',`#include <roughnessmap_fragment>
        roughnessFactor+= (surfaceGrain-.375)*${satin?'.65':'.25'};`);
    if(satin)shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
      #include <normal_fragment_maps>
      vec3 dx=dFdx(-vViewPosition),dy=dFdy(-vViewPosition);
      vec3 rx=cross(dy,normal),ry=cross(normal,dx);
      float det=dot(dx,rx);
      normal=normalize(normal-.00065*sign(det)*(dFdx(surfaceGrain)*rx+dFdy(surfaceGrain)*ry)/max(abs(det),1e-12));`);
    if(!mirror&&!satin){
      const ibl=T.ShaderChunk.envmap_physical_pars_fragment.replace(
        'vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );',
        `vec4 envMapColor=textureCubeUV(envMap,reflectVec,roughness);
         float upright=1.0-abs(inverseTransformDirection(normal,viewMatrix).y);
         envMapColor.rgb*=mix(.52,1.65,upright);
         float windowLight=smoothstep(-.35,.84,dot(reflectVec,normalize(vec3(-.55,.63,.68))));
         envMapColor.rgb+=vec3(.96,.93,.86)*(.08+.55*windowLight);
         // A nearby strip light has parallax across the face. Its reflection
         // moves across the polish as the observer walks around the monument.
         float rayDistance=(1.6-slabWorld.z)/max(reflectVec.z,.01);
         vec3 hit=slabWorld+reflectVec*rayDistance;
         float strip=1.-smoothstep(.12,.82,abs(hit.x+1.12+.18*hit.y));
         strip*=smoothstep(-.1,.3,hit.y)*(1.-smoothstep(2.3,3.2,hit.y));
         envMapColor.rgb+=vec3(1.10,1.07,.98)*strip*upright*smoothstep(.10,.4,reflectVec.z);
         ${neutral?'envMapColor.rgb=mix(vec3(dot(envMapColor.rgb,vec3(.2126,.7152,.0722))),envMapColor.rgb,.10);':''}`);
      shader.fragmentShader=shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',ibl);
    }
    if(mirror){
      // The reflected scene replaces incident specular radiance. The physical
      // shader still applies its dielectric Fresnel, grain and clear coat once.
      shader.uniforms.reflectedScene=mirror.tDiffuse;
      shader.uniforms.mirrorMatrix=mirror.textureMatrix;
      shader.vertexShader='uniform mat4 mirrorMatrix; varying vec4 mirrorUV;\n'+
        shader.vertexShader.replace('#include <begin_vertex>',
          '#include <begin_vertex>\nmirrorUV=mirrorMatrix*vec4(position,1.0);');
      const ibl=T.ShaderChunk.envmap_physical_pars_fragment.replace(
        'vec4 envMapColor = textureCubeUV( envMap, reflectVec, roughness );',
        'vec4 envMapColor = texture2DProj(reflectedScene,mirrorUV) * .82 + vec4(.12,.12,.11,0.);');
      shader.fragmentShader='uniform sampler2D reflectedScene; varying vec4 mirrorUV;\n'+
        shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',ibl);
    }
  };
  return material;
}
