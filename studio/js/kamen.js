import * as T from 'three';

// Interpolation and footprint filtering keep the minerals continuous at both scales.
const noiseGLSL=`
  varying vec3 vStone;
  uniform float grainScale, contrast, band, splitFace;
  uniform vec3 mineralColor, veinColor;
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
    color:stone.farba, roughness:satin?.53:Math.max(.115,stone.drsnost), metalness:0,
    ior:1.49, clearcoat:satin?.06:.38, clearcoatRoughness:satin?.36:.10,
    fog:false
  });
  material.customProgramCacheKey=()=>mirror?'granite-planar':satin?'granite-satin':'granite-polished';
  material.onBeforeCompile=shader=>{
    Object.assign(shader.uniforms,{
      grainScale:{value:stone.zrno},contrast:{value:stone.kontrast},band:{value:stone.zilkovanie},
      mineralColor:{value:new T.Color(stone.krystal)},veinColor:{value:new T.Color(stone.zila)},
      splitFace:{value:satin?1:0}
    });
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
      float feldspar=smoothstep(.53,.81,coarse+.5+fine*.34);
      float fleck=mix(.10,feldspar,visibleGrain(p));
      vec3 q=vStone*3.4;
      float fold=smoothNoise(q*1.8)+.32*smoothNoise(q*4.3);
      float strata=q.x*.85+q.y*.45+q.z*.64+fold*1.18;
      float vein=1.0-smoothstep(.028,.18,abs(fract(strata)-.5));
      float drift=.5+.5*cos(strata*6.283);
      diffuseColor.rgb=mix(diffuseColor.rgb,mineralColor,contrast*(fleck*.76+.13*drift));
      diffuseColor.rgb=mix(diffuseColor.rgb,veinColor,band*(.72*vein+.25*drift));
      diffuseColor.rgb+=mineralColor*(.12*contrast)*mix(.012,crystals,visibleGrain(micro));
      diffuseColor.rgb+=splitFace*(.009+.021*(coarse+.5));

    `);
    if(satin){
      shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',`
        #include <normal_fragment_maps>
        float relief=smoothNoise(vStone*85.)*.0015+smoothNoise(vStone*224.)*.00045;
        vec3 sx=dFdx(-vViewPosition),sy=dFdy(-vViewPosition);
        vec3 r1=cross(sy,normal),r2=cross(normal,sx);
        float det=dot(sx,r1);
        normal=normalize(abs(det)*normal-sign(det)*(dFdx(relief)*r1+dFdy(relief)*r2));
      `);
    }
    if(!mirror&&!satin){
      const ibl=T.ShaderChunk.envmap_physical_pars_fragment.replace(
        'return envMapColor.rgb * envMapIntensity;',
        `vec3 reflected=envMapColor.rgb;
         float daylight=dot(reflected,vec3(.2126,.7152,.0722));
         return (mix(vec3(daylight),reflected,.67)+vec3(.90*sqrt(max(daylight,0.0))))*envMapIntensity;`);
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
        'vec4 envMapColor = texture2DProj(reflectedScene,mirrorUV) * 0.52;');
      shader.fragmentShader='uniform sampler2D reflectedScene; varying vec4 mirrorUV;\n'+
        shader.fragmentShader.replace('#include <envmap_physical_pars_fragment>',ibl);
    }
  };
  return material;
}

// Photograph a centimetre-scale sample with the production material and lighting.
export function vzorka(renderer,stone,environment){
  const sample=new T.Scene();
  sample.environment=environment;
  const material=vytvorZulu(stone);
  const disc=new T.Mesh(new T.SphereGeometry(.065,48,32),material);
  sample.add(disc,new T.HemisphereLight(0xffffff,0x888888,1.4));
  const light=new T.DirectionalLight(0xffffff,2);light.position.set(-1,2,2);sample.add(light);
  const camera=new T.OrthographicCamera(-.049,.049,.049,-.049,.001,1);
  camera.position.z=.22;
  const n=96,rt=new T.WebGLRenderTarget(n,n,{colorSpace:T.SRGBColorSpace});
  const previous=renderer.getRenderTarget();
  renderer.setRenderTarget(rt);renderer.render(sample,camera);
  const bytes=new Uint8Array(n*n*4);renderer.readRenderTargetPixels(rt,0,0,n,n,bytes);
  renderer.setRenderTarget(previous);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=n;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(n,n);
  for(let y=0;y<n;y++)pixels.data.set(bytes.subarray(y*n*4,(y+1)*n*4),(n-y-1)*n*4);
  ctx.putImageData(pixels,0,0);disc.geometry.dispose();material.dispose();rt.dispose();
  return canvas.toDataURL();
}
