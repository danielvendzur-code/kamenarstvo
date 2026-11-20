import * as THREE from 'three';

export function vytvorZulu(kamen) {
  const material = new THREE.MeshPhysicalMaterial({
    color: kamen.farba, roughness: kamen.drsnost, metalness: 0,
    ior: 1.58, clearcoat: 0.32, clearcoatRoughness: 0.075
  });
  material.onBeforeCompile = shader => {
    shader.uniforms.grainScale = {value: kamen.zrno};
    shader.vertexShader = 'varying vec3 vStone;\n' + shader.vertexShader.replace(
      '#include <begin_vertex>', '#include <begin_vertex>\nvStone = position;');
    shader.fragmentShader = `
      varying vec3 vStone;
      uniform float grainScale;
      float grain(vec3 p){
        p=fract(p*0.1031); p+=dot(p,p.yzx+33.33); return fract((p.x+p.y)*p.z);
      }
    ` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      vec3 p=vStone*grainScale;
      float crystal=grain(floor(p));
      float visibility=1.0-smoothstep(0.4,1.8,length(fwidth(p)));
      float mineral=mix(0.22,pow(crystal,5.0),visibility);
      diffuseColor.rgb *= 0.75 + grain(floor(p*0.34))*0.25;
      diffuseColor.rgb += vec3(0.042,0.043,0.044)*mineral;
    `);
  };
  return material;
}
