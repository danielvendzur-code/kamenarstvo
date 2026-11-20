import * as T from 'three';

// Interpolation and footprint filtering keep the minerals continuous at both scales.
const noiseGLSL=`
  varying vec3 vStone;
  uniform float grainScale;
  float lattice(vec3 p){
    p=fract(p*0.1031);p+=dot(p,p.yzx+33.33);
    return fract((p.x+p.y)*p.z);
  }
  float smoothNoise(vec3 p){
    vec3 i=floor(p),f=fract(p);
    vec3 u=f*f*f*(f*(f*6.0-15.0)+10.0);
    vec3 e=vec3(1,0,0);
    return mix(
      mix(mix(lattice(i),lattice(i+e.xyy),u.x),mix(lattice(i+e.yxy),lattice(i+e.xxy),u.x),u.y),
      mix(mix(lattice(i+e.yyx),lattice(i+e.xyx),u.x),mix(lattice(i+e.yxx),lattice(i+1.0),u.x),u.y),
      u.z);
  }
  float visibleGrain(vec3 p){
    return 1.0-smoothstep(0.35,1.5,length(fwidth(p)));
  }
`;

export function vytvorZulu(stone,{satin=false,mirror=null}={}){
  const material=new T.MeshPhysicalMaterial({
    color:stone.farba, roughness:satin?0.29:stone.drsnost, metalness:0,
    ior:1.52, clearcoat:satin?0.18:1, clearcoatRoughness:satin?0.24:0.04,
    fog:false
  });
  material.customProgramCacheKey=()=>mirror?'granite-planar':'granite-environment';
  material.onBeforeCompile=shader=>{
    shader.uniforms.grainScale={value:stone.zrno};
    shader.vertexShader='varying vec3 vStone;\n'+shader.vertexShader.replace(
      '#include <begin_vertex>','#include <begin_vertex>\nvStone=position;');
    shader.fragmentShader=noiseGLSL+shader.fragmentShader.replace('#include <color_fragment>',`
      #include <color_fragment>
      vec3 p=vStone*grainScale*0.28;
      float coarse=smoothNoise(p)-0.5;
      float fine=smoothNoise(p*2.13+7.3)-0.5;
      vec3 micro=p*4.51+17.2;
      float crystals=smoothstep(0.76,0.94,smoothNoise(micro));
      diffuseColor.rgb*=1.0+coarse*visibleGrain(p)*0.65+fine*visibleGrain(p*2.13)*0.38;
      diffuseColor.rgb+=vec3(0.035)*mix(0.012,crystals,visibleGrain(micro));
    `);
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
        'vec4 envMapColor = texture2DProj(reflectedScene,mirrorUV);');
      shader.fragmentShader='uniform sampler2D reflectedScene; varying vec4 mirrorUV;\n'+
        shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',ibl);
    }
  };
  return material;
}
