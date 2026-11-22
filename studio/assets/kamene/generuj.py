"""Generate periodic mineral fields. One tile represents 1.65 metres of slab."""
from pathlib import Path
import numpy as np
from scipy.ndimage import map_coordinates, gaussian_filter, distance_transform_edt
from PIL import Image

OUT = Path(__file__).parent
N = 2048
Y, X = np.indices((N, N), dtype=np.float32) / N
STONES = {
    'absolute-black': ([12,13,14], [35,35,35], 320),
    'impala': ([48,49,49], [121,123,120], 320),
    'tan-brown': ([36,32,31], [130,81,61], 175),
    'aurora': ([65,50,50], [156,99,85], 205),
    'viscont-white': ([194,195,191], [108,111,109], 270),
    'indian-juparana': ([190,158,143], [101,96,98], 240),
}

def noise(rng, rows, cols, y, x):
    lattice = rng.standard_normal((rows, cols)).astype('f')
    return map_coordinates(lattice, [y*rows, x*cols], order=1, mode='grid-wrap')

def fbm(rng, rows, cols, y, x):
    return sum(.5**i * noise(rng, rows*2**i, cols*2**i, y, x) for i in range(5))

def crystals(rng, density, x, y, softness=1.15):
    seeds = np.ones((N,N), dtype=bool)
    seeds[tuple(rng.integers(0,N,(2,density**2)))] = False
    # Padded periodic rim gives the same nearest crystal across both tile edges.
    pad = 96
    nearest = distance_transform_edt(np.pad(seeds,pad,mode='wrap'),return_distances=False,return_indices=True)
    ids = (nearest[:,pad:-pad,pad:-pad]-pad)%N
    values = rng.random((N,N),dtype=np.float32)[tuple(ids)]
    return map_coordinates(gaussian_filter(values,softness,mode='wrap'), [y*N,x*N],order=1,mode='grid-wrap')

def bake(name, spec, seed):
    base, inclusion, density = spec
    rng = np.random.default_rng(seed)
    warp = fbm(rng,3,3,Y,X)
    broad = fbm(rng,8,8,Y,X)
    jitter = noise(rng,256,256,Y,X)
    x = X+.0012*jitter
    y = Y+.0014*noise(rng,232,232,Y,X)
    grain = crystals(rng,density,x,y,.72 if name in ('viscont-white','indian-juparana') else 1.15)
    fine = crystals(rng,density*2,x,y)
    speck = rng.normal(0,1,(N,N)).astype('f')
    if name in ('viscont-white','indian-juparana'):
        # Elongated, broken mineral beds follow deformation in the host rock.
        beds = fbm(rng, 14, 4, Y + X + .09*warp, X)
        bands = np.clip(.42*beds, 0, 1) * np.clip(.52 + .36*broad, 0, 1)
        # Bands change the local abundance of mica, not the outline of a vein.
        mica = np.clip((grain - (.84 - .12*bands))*13, 0, 1)
        quartz = np.clip((.46-grain)*4, 0, 1)
        pink = name == 'indian-juparana'
        feldspar = np.array([207,167,147] if pink else [210,211,207])
        quartz_rgb = np.array([158,151,148] if pink else [167,172,173])
        mica_rgb = np.array([87,78,76] if pink else [71,74,75])
        rgb = feldspar + quartz[...,None]*(quartz_rgb-feldspar)
        rgb += mica[...,None]*(mica_rgb-feldspar)
        rgb += (16*(fine-.5) + 2.5*speck - 18*bands + 4*broad)[...,None]
    else:
        mix = np.clip((grain-.38)*1.42+.16*(fine-.5)+(.28 if name=='aurora' else .09)*broad,0,1)
        variation = (fine-.5)*17 + speck*2 + broad*3
        if name=='absolute-black':
            mix *= .18
            variation *= .19
        rgb = np.array(base) + mix[:,:,None]*(np.array(inclusion)-base) + variation[:,:,None]
    image = Image.fromarray(rgb.clip(0,255).astype('uint8'))
    image.save(OUT/(name+'.webp'),quality=90 if name in ('viscont-white','indian-juparana') else 82,method=4)
    image.crop((800,800,1000,1000)).resize((192,192),Image.Resampling.LANCZOS).save(OUT/(name+'-vzorka.webp'),quality=92)
    rough = (96+30*(fine-.5)+14*(grain-.5)+3*broad).clip(0,255).astype('uint8')
    Image.fromarray(rough).save(OUT/(name+'-drsnost.webp'),quality=55,method=4)

if __name__=='__main__':
    for i,(name,spec) in enumerate(STONES.items()):
        bake(name,spec,3912+i)
