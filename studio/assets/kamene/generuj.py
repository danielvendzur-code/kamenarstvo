"""Generate periodic mineral fields. One tile represents 1.65 metres of slab.

Usage: python3 generuj.py [stone ...]   (no arguments bakes the first six stones)
"""
import sys
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
    # Second catalogue; each has its own recipe below.
    'star-galaxy': None,
    'blue-pearl': None,
    'multicolor-red': None,
    'paradiso': None,
    'steel-grey': None,
}
FIRST = list(STONES)[:6]

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

def save(name, rgb, rough, quality, corner=(800,800)):
    image = Image.fromarray(rgb.clip(0,255).astype('uint8'))
    image.save(OUT/(name+'.webp'),quality=quality,method=4)
    x, y = corner
    image.crop((x,y,x+200,y+200)).resize((192,192),Image.Resampling.LANCZOS).save(OUT/(name+'-vzorka.webp'),quality=92)
    Image.fromarray(rough.clip(0,255).astype('uint8')).save(OUT/(name+'-drsnost.webp'),quality=55,method=4)

def bake(name, spec, seed):
    rng = np.random.default_rng(seed)
    if name in RECIPES:
        save(name, *RECIPES[name](rng))
        return
    base, inclusion, density = spec
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
    save(name, rgb, 96+30*(fine-.5)+14*(grain-.5)+3*broad,
         90 if name in ('viscont-white','indian-juparana') else 82)

# ---------- Helpers for the second catalogue ----------

def flow(rng, rows, cols, y, x):
    """Smooth periodic fbm (cubic lattice) for folded bands without lattice creases."""
    total = 0
    for i in range(4):
        lattice = rng.standard_normal((rows*2**i, cols*2**i)).astype('f')
        total = total + .5**i * map_coordinates(lattice, [y*rows*2**i, x*cols*2**i], order=3, mode='grid-wrap')
    return total

def cells(rng, density, sampling=(1, 1), pad=128):
    """Periodic Voronoi mosaic: seed coordinates of every pixel's crystal and a boundary mask.
    Unequal sampling stretches the crystals; the larger spacing axis becomes the short one."""
    seeds = np.ones((N,N), dtype=bool)
    seeds[tuple(rng.integers(0,N,(2,density**2)))] = False
    nearest = distance_transform_edt(np.pad(seeds,pad,mode='wrap'),sampling=sampling,
                                     return_distances=False,return_indices=True)
    ids = (nearest[:,pad:-pad,pad:-pad]-pad)%N
    flat = ids[0]*N + ids[1]
    edge = (flat != np.roll(flat,1,0)) | (flat != np.roll(flat,1,1))
    return ids, edge.astype('f')

def per_cell(rng, ids, count=1):
    """Independent random attributes shared by all pixels of a crystal."""
    return [rng.random((N,N),dtype=np.float32)[tuple(ids)] for _ in range(count)]

def at(field, x, y, order=1):
    return map_coordinates(field, [y*N, x*N], order=order, mode='grid-wrap')

def jittered(rng, amount=.0012):
    return X + amount*noise(rng,256,256,Y,X), Y + amount*1.15*noise(rng,232,232,Y,X)

def blend(rgb, weight, colour):
    weight = np.clip(weight, 0, 1)[...,None]
    return rgb*(1-weight) + weight*np.asarray(colour, dtype='f')

def lerp(a, b, t):
    a, b = np.asarray(a,'f'), np.asarray(b,'f')
    return a + np.clip(t,0,1)[...,None]*(b-a)

# ---------- Recipes: each returns (rgb, roughness, webp quality[, swatch corner]) ----------

def star_galaxy(rng):
    # Norite: a near-black pyroxene-plagioclase ground with platy bronzite flakes.
    x, y = jittered(rng, .001)
    broad = fbm(rng,6,6,Y,X)
    ground = crystals(rng,300,x,y,1.0)
    fine = crystals(rng,640,x,y,.8)
    speck = rng.normal(0,1,(N,N)).astype('f')
    rgb = np.array([10,11,12],'f') + ((ground-.5)*7 + (fine-.5)*4 + speck*1.1 + broad*1.2)[...,None]
    # Two flake sizes. Loose clouds raise the abundance without forming clusters.
    cloud = np.clip(.5 + .45*fbm(rng,9,9,Y,X), 0, 1)
    small, _ = cells(rng, 760)
    large, _ = cells(rng, 300)
    s_hit, s_tone = per_cell(rng, small, 2)
    l_hit, l_tone = per_cell(rng, large, 2)
    flake = np.maximum(np.clip((s_hit - (.972 - .024*cloud))*60, 0, 1),
                       np.clip((l_hit - (.9965 - .002*cloud))*400, 0, 1))
    tone = np.where(l_hit > .995, l_tone, s_tone)
    flake = at(gaussian_filter(flake,.55,mode='wrap'), x, y)
    tone = at(tone, x, y, 0)
    bronze = lerp([104,74,42], [204,162,98], tone)
    rgb = blend(rgb, flake, 0) + flake[...,None]*bronze
    rough = 92 + 12*(fine-.5) + 6*(ground-.5) - 46*flake
    return rgb, rough, 86

def at_rgb(rgb, x, y):
    return np.stack([at(rgb[...,c], x, y) for c in range(3)], -1)

def seed_value(field, ids):
    """Sample a field once per crystal so mineral phases change at grain boundaries."""
    return field[ids[0], ids[1]]

def blue_pearl(rng):
    # Larvikite: blocky ternary feldspars, many with a blue-silver schiller, dark mafic
    # minerals in some of the gaps. Some large tablets are recrystallised into smaller grains.
    x, y = jittered(rng, .0011)
    big, big_edge = cells(rng, 56, (1, 1.3), 160)
    small, small_edge = cells(rng, 120)
    split = seed_value(flow(rng,7,7,Y,X), big) < -.35
    ids = np.where(split[None], small, big)
    edge = np.maximum(big_edge, split*small_edge*.4)
    tone, sheen, angle, twin, kind = per_cell(rng, ids, 5)
    rows, cols = np.indices((N,N))
    dy = (rows - ids[0] + N//2) % N - N//2
    dx = (cols - ids[1] + N//2) % N - N//2
    theta = angle*np.pi
    along = dx*np.cos(theta) + dy*np.sin(theta)
    mottle = flow(rng,48,48,Y,X)
    # Schiller drifts across a crystal; polysynthetic twins add fine stripes to some.
    glow = np.clip((sheen - .58)*3.4, 0, 1) * np.clip(.62 + along/58 + .12*mottle, 0, 1)
    stripes = (twin > .55) * (.5 + .5*np.sin(along*2*np.pi/(3.4+3*twin)))
    base = lerp([45,50,58], [74,81,93], tone*.76 + .1*stripes + .16*mottle)
    sheen_rgb = lerp([104,113,126], [98,126,166], np.clip(kind*1.6, 0, 1))
    rgb = lerp(base, sheen_rgb, glow*(.78 + .22*stripes))
    rgb = blend(rgb, (kind > .955)*.8, [30,32,36])
    rgb = at_rgb(rgb, x, y)
    # Mafic fill only in part of the gaps, thickest where three crystals meet.
    gaps = gaussian_filter(edge,.9,mode='wrap')*np.clip(.35 + .9*flow(rng,16,16,Y,X), 0, 1)
    gaps = at(np.clip(gaps*2.2, 0, 1), x, y)
    mafic, _ = cells(rng, 380)
    clot, = per_cell(rng, mafic, 1)
    clot = at(gaussian_filter(np.clip((clot-.972)*40,0,1)*np.clip(gaussian_filter(edge,3,mode='wrap')*4,0,1),.8,mode='wrap'), x, y)
    rgb = blend(rgb, gaps*.62 + clot*.95, [21,23,26])
    rgb += (rng.normal(0,1,(N,N)).astype('f')*1.5 + 2.5*at(mottle,x,y))[...,None]
    fine = crystals(rng,520,x,y,.9)
    rough = 94 + 18*(fine-.5) - 22*at(glow, x, y) + 10*gaps
    return rgb, rough, 80

def multicolor_red(rng):
    # Migmatite: red feldspar-rich melt with biotite schlieren and grey leucosome lenses,
    # folded only gently, built from crystals rather than smooth paint.
    warp = flow(rng,2,3,Y,X)
    v = Y + .05*warp + .016*flow(rng,5,4,Y,X)
    u = X + .06*flow(rng,2,2,Y,X)
    layers = flow(rng,8,2,v,u)
    streaks = flow(rng,24,3,v,u)
    thin = flow(rng,64,5,v,u)
    lens = flow(rng,16,2,v + .01*warp,u)
    x, y = jittered(rng, .0013)
    grains, _ = cells(rng, 300)
    flakes, _ = cells(rng, 700)
    tone, pink = per_cell(rng, grains, 2)
    flake_tone, pepper = per_cell(rng, flakes, 2)
    dark = seed_value(.75*streaks + .42*layers + .30*thin, flakes) > .56
    grey = (seed_value(lens, grains) > .95) & ~dark
    shade = np.clip(.5 + .35*flow(rng,6,3,v,u), 0, 1)
    rgb = lerp([86,30,27], [148,60,46], .55*tone + .45*shade)
    rgb = blend(rgb, (pink > .93)*.75, [164,94,82])
    rgb = blend(rgb, ((pepper > .94) & ~grey)*.85, [34,28,27])
    rgb = blend(rgb, grey*1., 0) + grey[...,None]*lerp([108,104,103], [172,166,162], tone)
    rgb = blend(rgb, dark*1., 0) + dark[...,None]*lerp([22,20,20], [78,72,70], flake_tone**1.6)
    rgb = at_rgb(rgb, x, y)
    rgb += rng.normal(0,1,(N,N)).astype('f')[...,None]*2.2
    fine = crystals(rng,460,x,y)
    rough = 96 + 24*(fine-.5) + 10*at(dark*1.,x,y)
    return rgb, rough, 80, (1180, 640)

def paradiso(rng):
    # Paradiso: violet-grey gneiss with undulating lilac and dark plum layers and garnets.
    warp = flow(rng,2,2,Y,X)
    v = Y + .07*warp + .03*flow(rng,4,3,Y,X)
    u = X + .09*flow(rng,3,2,Y,X)
    broad = flow(rng,9,2,v,u)
    streaks = flow(rng,22,3,v,u)
    thin = flow(rng,58,5,v,u)
    x, y = jittered(rng, .0012)
    grains, _ = cells(rng, 330)
    flakes, _ = cells(rng, 720)
    tone, = per_cell(rng, grains, 1)
    flake_tone, = per_cell(rng, flakes, 1)
    lilac = seed_value(broad, grains) > .62
    plum = (seed_value(.8*streaks - .35*broad + .3*thin, flakes) > .95) & ~lilac
    pale = (seed_value(thin + .25*broad, grains) > 1.22) & ~plum
    rgb = lerp([82,66,78], [126,110,121], .6*tone + .4*np.clip(.5 + .3*broad, 0, 1))
    rgb = blend(rgb, lilac*1., 0) + lilac[...,None]*lerp([128,113,126], [166,152,163], tone)
    rgb = blend(rgb, pale*1., 0) + pale[...,None]*lerp([172,162,171], [196,188,195], tone)
    rgb = blend(rgb, plum*1., 0) + plum[...,None]*lerp([32,26,32], [72,58,68], flake_tone)
    rgb = at_rgb(rgb, x, y)
    # Garnets sit preferentially in the mica-rich layers.
    garnets, _ = cells(rng, 520)
    pick, depth = per_cell(rng, garnets, 2)
    host = np.where(lilac | pale, .25, 1.)
    garnet = np.clip((pick - (1 - .02*host))*90, 0, 1)
    garnet = at(gaussian_filter(garnet,.7,mode='wrap'), x, y)
    rgb = blend(rgb, garnet*.92, 0) + (garnet*.92)[...,None]*lerp([72,24,28], [118,44,46], at(depth,x,y,0))
    rgb += rng.normal(0,1,(N,N)).astype('f')[...,None]*2
    fine = crystals(rng,500,x,y)
    rough = 96 + 24*(fine-.5) - 10*garnet
    return rgb, rough, 80, (900, 300)

def steel_grey(rng):
    # Fine, even grain: grey feldspar crystals with black mafic and white quartz specks.
    x, y = jittered(rng, .0009)
    grains, _ = cells(rng, 560)
    specks, _ = cells(rng, 1100)
    tone, = per_cell(rng, grains, 1)
    kind, shade = per_cell(rng, specks, 2)
    rgb = lerp([62,63,66], [98,99,102], tone + .05*fbm(rng,8,8,Y,X))
    black = (kind > .88)*1.
    white = (kind < .045)*1.
    rgb = blend(rgb, black*.9, 0) + (black*.9)[...,None]*lerp([18,18,20], [40,40,42], shade)
    rgb = blend(rgb, white*.85, 0) + (white*.85)[...,None]*lerp([160,160,157], [204,204,200], shade)
    rgb = at_rgb(rgb, x, y)
    rgb += rng.normal(0,1,(N,N)).astype('f')[...,None]*.9
    fine = crystals(rng,1000,x,y,.75)
    rough = 96 + 26*(fine-.5) + 8*at(black,x,y)
    return rgb, rough, 68

RECIPES = {
    'star-galaxy': star_galaxy,
    'blue-pearl': blue_pearl,
    'multicolor-red': multicolor_red,
    'paradiso': paradiso,
    'steel-grey': steel_grey,
}

if __name__=='__main__':
    names = sys.argv[1:] or FIRST
    unknown = [name for name in names if name not in STONES]
    if unknown:
        sys.exit('unknown stone: '+', '.join(unknown))
    # A stone keeps its seed however the list is chosen.
    for name in names:
        bake(name, STONES[name], 3912+list(STONES).index(name))
