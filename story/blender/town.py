# 7. ve 8. bölümün çevresi (birim mm; bahçe zemini z = GROUND): Antalya'da bahçeli bir mahalle. Bitki örtüsü
# (turunç, zeytin, servi, palmiye, begonvil, çit), sokak ve komşu parseller. Komşular koleksiyon örneğidir: aynı
# parsel çeşidi kez kez yerleşir, Cycles geometriyi bir kez tutar (8. bölümün geniş kadrajı bunun üstüne kurulur).
import math

import bmesh
import bpy
from mathutils import Vector, noise

import lib

GROUND = -300.0  # bahçe zemini; evlerin döşemesi z = 0
PLOT_W, PLOT_D = 27000.0, 25000.0  # parsel genişliği (sokak boyunca) ve derinliği
STREET = 12000.0  # kaldırım + yol + kaldırım
WALK, ROAD = 2500.0, 7000.0
BLOCK_PITCH = 2 * PLOT_D + STREET  # sırt sırta iki parsel ve bir sokak


# --- Malzemeler ---

def foliage(name, dark, light, fruit=None, cell=160.0, rough=0.55):
    """Yaprak kümesi: hücre başına bir ton (iki Wada yeşili arasında), küme içinde kubbe, kümeler arası AO ile
    koyu. Yukarıdan bakınca taç yaprak yaprak değil küme küme okunur. `fruit`: küme yüzeyinde seyrek meyve.
    Taç ağı birim yarıçaplı ve nesne ölçeğiyle büyüyor; Object koordinatında desen tacın tamamına tek hücre
    düşüyordu. Bu yüzden dünya konumu (mm) kullanılır; sahnede taçlar hareket etmez."""
    m, b, n = lib.principled(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = 0.3
    pos = n.nodes.new("ShaderNodeNewGeometry").outputs["Position"]
    vec = n.warp(n.xform(pos, scale=(1 / cell,) * 3), 0.5, 0.4)
    vor = n.nodes.new("ShaderNodeTexVoronoi")
    n.link(vec, vor.inputs["Vector"])
    edge = n.nodes.new("ShaderNodeTexVoronoi")
    edge.feature = "DISTANCE_TO_EDGE"
    n.link(vec, edge.inputs["Vector"])
    sep = n.nodes.new("ShaderNodeSeparateColor")
    n.link(vor.outputs["Color"], sep.inputs["Color"])
    lobe = n.ramp(vor.outputs["Distance"], 0.85, 0.0)
    crevice = n.ramp(edge.outputs["Distance"], 0.0, 0.14)  # kümeler arası: gölgede kalan yaprak boşluğu
    col = n.mix(sep.outputs["Red"], lib.rgba(dark), lib.rgba(light))
    leaves = n.noise(n.xform(pos, scale=(1 / 60,) * 3), 1.0, 4.0, 0.6)
    ao = n.nodes.new("ShaderNodeAmbientOcclusion")
    ao.samples = 8
    ao.inputs["Distance"].default_value = 450.0
    val = n.math("MULTIPLY", n.math("MULTIPLY_ADD", ao.outputs["AO"], 0.6, 0.4), n.math("MULTIPLY_ADD", lobe, 0.35, 0.65))
    val = n.math("MULTIPLY", val, n.math("MULTIPLY_ADD", crevice, 0.65, 0.35))
    val = n.math("MULTIPLY", val, n.math("MULTIPLY_ADD", leaves, 0.3, 0.85))
    col = n.shade(col, val)
    if fruit:
        fv = n.nodes.new("ShaderNodeTexVoronoi")
        n.link(n.xform(pos, scale=(1 / 230,) * 3, loc=(3300.0, 1100.0, 7700.0)), fv.inputs["Vector"])
        fs = n.nodes.new("ShaderNodeSeparateColor")
        n.link(fv.outputs["Color"], fs.inputs["Color"])
        dot = n.math("MULTIPLY", n.math("LESS_THAN", fv.outputs["Distance"], 0.2), n.math("LESS_THAN", fs.outputs["Green"], 0.35))
        col = n.mix(dot, col, lib.rgba(fruit))
        lobe = n.math("MAXIMUM", lobe, dot)
    n.link(col, b.inputs["Base Color"])
    n.link(n.bump(n.math("MULTIPLY_ADD", leaves, 0.3, lobe), 0.7, 60.0), b.inputs["Normal"])
    return m


def frond_material():
    """Palmiye yaprağı (UV: u yaprak boyu 0–1, v enine 0–1, orta damar 0,5). Yaprakçıklar eğik şerit; aralar
    saydam. Yaprak başına ton: Geometry → Random Per Island. En alttaki birkaç yaprak kurumuş."""
    m, out, n = lib.surface_only("Frond")
    bsdf = n.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.inputs["Roughness"].default_value = 0.5
    tc = n.nodes.new("ShaderNodeTexCoord")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["UV"], sep.inputs["Vector"])
    u, v = sep.outputs["X"], sep.outputs["Y"]
    across = n.math("ABSOLUTE", n.math("SUBTRACT", v, 0.5))
    q = n.math("FRACT", n.math("MULTIPLY_ADD", u, 34.0, n.math("MULTIPLY", across, 9.0)))
    edge = n.math("POWER", n.math("MULTIPLY", across, 2.0), 3.0)
    leaf = n.math("LESS_THAN", q, n.math("SUBTRACT", 0.62, n.math("MULTIPLY", edge, 0.45)))
    rib = n.math("LESS_THAN", across, 0.035)
    solid = n.math("MAXIMUM", leaf, rib)
    geo = n.nodes.new("ShaderNodeNewGeometry")
    rnd = geo.outputs["Random Per Island"]
    tone = n.mix(rnd, lib.rgba("Olive Green"), lib.rgba("Oil Green"))
    dry = n.math("LESS_THAN", rnd, 0.1)
    tone = n.mix(dry, tone, lib.rgba("Isabella Color"))
    n.link(n.shade(tone, n.math("MULTIPLY_ADD", u, 0.25, 0.8)), bsdf.inputs["Base Color"])
    tr = n.nodes.new("ShaderNodeBsdfTransparent")
    mix = n.nodes.new("ShaderNodeMixShader")
    n.link(solid, mix.inputs["Fac"])
    n.link(tr.outputs[0], mix.inputs[1])
    n.link(bsdf.outputs[0], mix.inputs[2])
    n.link(mix.outputs[0], out.inputs["Surface"])
    return m


def lawn():
    """Akdeniz çimi: iki yeşil arasında geniş lekeler, yer yer kuru sarı, biçme şeritleri, ince ot dokusu."""
    m, b, n = lib.principled("Lawn")
    b.inputs["Roughness"].default_value = 0.92
    b.inputs["Sheen Weight"].default_value = 0.4
    patch = n.noise(n.coords(scale=(1 / 5000,) * 3), 2.0, 5.0, 0.55)
    col = n.mix(n.ramp(patch, 0.35, 0.65), lib.rgba("Rainette Green"), lib.rgba("Oil Green"))
    dry = n.noise(n.coords(scale=(1 / 9000,) * 3, loc=(5.1, 2.2, 0.0)), 2.0, 6.0, 0.6)
    col = n.mix(n.math("MULTIPLY", n.ramp(dry, 0.6, 0.72), 0.45), col, lib.rgba("Olive Yellow"))
    tc = n.nodes.new("ShaderNodeTexCoord")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Object"], sep.inputs["Vector"])
    stripe = n.math("GREATER_THAN", n.math("SINE", n.math("MULTIPLY", sep.outputs["X"], math.pi / 1400.0)), 0.0)
    blades = n.noise(n.coords(scale=(1 / 6,) * 3), 1.0, 3.0, 0.6)
    val = n.math("MULTIPLY", n.math("MULTIPLY_ADD", stripe, 0.07, 0.93), n.math("MULTIPLY_ADD", blades, 0.3, 0.85))
    n.link(n.shade(col, val), b.inputs["Base Color"])
    n.link(n.bump(blades, 0.5, 8.0), b.inputs["Normal"])
    return m


def tiles(name, colours, size=(300.0, 300.0), joint=6.0, joint_col="Warm Gray", rough=0.7, stagger=False, var=0.1):
    """Döşeme ya da kaplama karosu (birim mm, Object XY): karo başına Wada renklerinden biri ve ± var/2 parlaklık
    farkı (yakın tonlar; zıt tonlar dama tahtası gibi okunuyordu), derz koyu, karo yüzünde hafif leke."""
    m, b, n = lib.principled(name)
    b.inputs["Roughness"].default_value = rough
    tc = n.nodes.new("ShaderNodeTexCoord")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Object"], sep.inputs["Vector"])
    y = n.math("DIVIDE", sep.outputs["Y"], size[1])
    iy = n.math("FLOOR", y)
    x = n.math("DIVIDE", sep.outputs["X"], size[0])
    if stagger:
        x = n.math("ADD", x, n.math("MULTIPLY", n.math("MODULO", n.math("ADD", iy, 1000.0), 2.0), 0.5))
    ix = n.math("FLOOR", x)
    cell = n.nodes.new("ShaderNodeCombineXYZ")
    n.link(ix, cell.inputs["X"])
    n.link(iy, cell.inputs["Y"])
    wn = n.nodes.new("ShaderNodeTexWhiteNoise")
    wn.noise_dimensions = "3D"
    n.link(cell.outputs[0], wn.inputs["Vector"])
    col = lib.pick(n, wn.outputs["Value"], colours)
    ws = n.nodes.new("ShaderNodeSeparateColor")
    n.link(wn.outputs["Color"], ws.inputs["Color"])
    col = n.shade(col, n.math("MULTIPLY_ADD", ws.outputs["Green"], var, 1.0 - var / 2))
    fx = n.math("MULTIPLY", n.math("ABSOLUTE", n.math("SUBTRACT", n.math("FRACT", x), 0.5)), size[0] * 2)
    fy = n.math("MULTIPLY", n.math("ABSOLUTE", n.math("SUBTRACT", n.math("FRACT", y), 0.5)), size[1] * 2)
    jx = n.math("GREATER_THAN", fx, size[0] - joint)
    jy = n.math("GREATER_THAN", fy, size[1] - joint)
    jnt = n.math("MAXIMUM", jx, jy)
    blot = n.noise(n.coords(scale=(1 / 120,) * 3), 2.0, 5.0, 0.6)
    col = n.shade(col, n.math("MULTIPLY_ADD", blot, 0.16, 0.9))
    col = n.mix(jnt, col, lib.rgba(joint_col))
    n.link(col, b.inputs["Base Color"])
    n.link(n.bump(n.math("SUBTRACT", 1.0, jnt), 0.4, 3.0), b.inputs["Normal"])
    return m


def roof_tiles():
    """Alaturka kiremit (hip çatı): sıralar eğime dik. Yüzün yerel normali Y'ye yakınsa sıralar X boyunca,
    değilse Y boyunca. Kiremit başına ton, oluk profili ve sıra bindirmesinin gölgesi."""
    m, b, n = lib.principled("RoofTiles")
    b.inputs["Roughness"].default_value = 0.75
    tc = n.nodes.new("ShaderNodeTexCoord")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Object"], sep.inputs["Vector"])
    ns = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Normal"], ns.inputs["Vector"])
    use_y = n.math("GREATER_THAN", n.math("ABSOLUTE", ns.outputs["Y"]), n.math("ABSOLUTE", ns.outputs["X"]))
    course_c = n.math("ADD", n.math("MULTIPLY", use_y, sep.outputs["Y"]),
                      n.math("MULTIPLY", n.math("SUBTRACT", 1.0, use_y), sep.outputs["X"]))
    along_c = n.math("ADD", n.math("MULTIPLY", use_y, sep.outputs["X"]),
                     n.math("MULTIPLY", n.math("SUBTRACT", 1.0, use_y), sep.outputs["Y"]))
    c = n.math("DIVIDE", course_c, 330.0)
    ic = n.math("FLOOR", c)
    a = n.math("ADD", n.math("DIVIDE", along_c, 210.0), n.math("MULTIPLY", n.math("MODULO", n.math("ADD", ic, 1000.0), 2.0), 0.5))
    ia = n.math("FLOOR", a)
    cell = n.nodes.new("ShaderNodeCombineXYZ")
    n.link(ia, cell.inputs["X"])
    n.link(ic, cell.inputs["Y"])
    n.link(use_y, cell.inputs["Z"])
    wn = n.nodes.new("ShaderNodeTexWhiteNoise")
    n.link(cell.outputs[0], wn.inputs["Vector"])
    col = lib.pick(n, wn.outputs["Value"], ["Ochre Red", "Brick Red", "Etruscan Red", "Ochre Red", "Sudan Brown"])
    barrel = n.math("SINE", n.math("MULTIPLY", n.math("FRACT", a), math.pi))
    lap = n.math("FRACT", c)
    lap = n.math("MINIMUM", lap, n.math("SUBTRACT", 1.0, lap))
    lap = n.ramp(lap, 0.0, 0.12)
    grime = n.noise(n.coords(scale=(1 / 1500,) * 3), 2.0, 5.0, 0.6)
    val = n.math("MULTIPLY", n.math("MULTIPLY_ADD", barrel, 0.3, 0.72), n.math("MULTIPLY_ADD", lap, 0.3, 0.7))
    val = n.math("MULTIPLY", val, n.math("MULTIPLY_ADD", grime, 0.2, 0.9))
    n.link(n.shade(col, val), b.inputs["Base Color"])
    n.link(n.bump(n.math("MULTIPLY", barrel, lap), 0.6, 25.0), b.inputs["Normal"])
    return m


def asphalt():
    m, b, n = lib.principled("Asphalt")
    b.inputs["Roughness"].default_value = 0.85
    agg = n.noise(n.coords(scale=(1 / 4,) * 3), 1.0, 2.0, 0.5)
    patch = n.noise(n.coords(scale=(1 / 3000,) * 3), 2.0, 5.0, 0.55)
    col = n.mix(n.math("MULTIPLY", n.ramp(patch, 0.4, 0.7), 0.4), lib.rgba("Slate Color"), lib.rgba("Dark Medici Blue"))
    n.link(n.shade(col, n.math("MULTIPLY", n.math("MULTIPLY_ADD", agg, 0.35, 0.8), 0.75)), b.inputs["Base Color"])
    n.link(n.bump(agg, 0.3, 3.0), b.inputs["Normal"])
    return m


def water():
    """Havuz suyu: saydam, kırılma indisi 1,33; rüzgârın kırıştırdığı yüzey. Kostik kapalıyken kırılan yüzey
    güneşi keser ve havuz tabanı kararır: gölge ışınlarına su, Nile Blue tonunda düz saydam görünür."""
    m, out, n = lib.surface_only("Water")
    b = n.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.02
    b.inputs["IOR"].default_value = 1.333
    b.inputs["Base Color"].default_value = lib.rgba("Nile Blue")
    rip = n.noise(n.coords(scale=(1 / 700, 1 / 500, 1 / 700)), 2.0, 4.0, 0.55)
    n.link(n.bump(rip, 0.25, 12.0), b.inputs["Normal"])
    tr = n.nodes.new("ShaderNodeBsdfTransparent")
    tr.inputs["Color"].default_value = lib.rgba("Nile Blue")
    lp = n.nodes.new("ShaderNodeLightPath")
    mix = n.nodes.new("ShaderNodeMixShader")
    n.link(lp.outputs["Is Shadow Ray"], mix.inputs["Fac"])
    n.link(b.outputs[0], mix.inputs[1])
    n.link(tr.outputs[0], mix.inputs[2])
    n.link(mix.outputs[0], out.inputs["Surface"])
    return m


def materials():
    _MESHES.clear()  # lib.reset() eski ağları siler; önbellek her sahnede baştan kurulur
    renders = ["Sulpher Yellow", "Ivory Buff", "Pinkish Cinnamon", "Naples Yellow", "White", "Pale Lemon Yellow"]
    return {
        "lawn": lawn(),
        "leaf": foliage("Leaf", "Cossack Green", "Oil Green"),
        "citrus": foliage("Citrus", "Cossack Green", "Chromium Green", fruit="Orange", cell=300.0, rough=0.5),
        "olive": foliage("OliveLeaf", "Krongbergs Green", "Light Grayish Olive", cell=280.0, rough=0.65),
        "cypress": foliage("Cypress", "Deep Slate Olive", "Blackish Olive", cell=180.0, rough=0.7),
        "bougain": foliage("Bougainvillea", "Rosolanc Purple", "Eupatorium Purple", cell=200.0, rough=0.6),
        "hedge": foliage("Hedge", "Cossack Green", "Olive Green", cell=200.0, rough=0.65),
        "frond": frond_material(),
        "bark": lib.plastic("Bark", "Light Brownish Olive", rough=0.95, wear=0.5, scale=0.004),
        "trunk": lib.plastic("PalmTrunk", "Isabella Color", rough=0.95, wear=0.6, scale=0.006),
        "renders": [lib.plastic("Render" + str(i), c, rough=0.85, wear=0.2, scale=0.002) for i, c in enumerate(renders)],
        "coping": lib.plastic("Coping", "Ivory Buff", rough=0.7, wear=0.2, scale=0.004),
        "roof": roof_tiles(),
        "membrane": lib.plastic("RoofMembrane", "Warm Gray", rough=0.9, wear=0.4, scale=0.0015),
        "deck": tiles("Deck", ["Pinkish Cinnamon", "Vinaceous Cinnamon", "Ochraceous Salmon"], (400.0, 400.0), 5.0),
        "paving": tiles("Paving", ["Warm Gray", "Ecru", "Neutral Gray"], (200.0, 100.0), 3.0, "Light Grayish Olive",
                        stagger=True),
        "walk": tiles("Sidewalk", ["Neutral Gray", "Warm Gray"], (400.0, 400.0), 6.0, "Slate Color"),
        "asphalt": asphalt(),
        "kerb": lib.plastic("Kerb", "Mineral Gray", rough=0.8, wear=0.3, scale=0.003),
        "marking": lib.plastic("Marking", "White", rough=0.6, wear=0.4, scale=0.002),
        "liner": tiles("PoolLiner", ["Venice Green", "Calamine BLue"], (250.0, 250.0), 4.0, "Nile Blue", rough=0.3),
        "water": water(),
        "solar": lib.plastic("Solar", "Dark Tyrian Blue", rough=0.15, coat=0.6),
        "tank": lib.plastic("Tank", "White", rough=0.4),
        "window": lib.plastic("WindowDark", "Slate Color", rough=0.15, coat=0.6),
        "frame": lib.plastic("WindowFrame", "Slate Color", rough=0.35),
        "car": [lib.plastic("Car" + str(i), c, rough=0.25, coat=0.8) for i, c in
                enumerate(["White", "Neutral Gray", "Deep Lyons Blue", "Carmine Red", "Black"])],
        "carglass": lib.plastic("CarGlass", "Black", rough=0.05, coat=1.0),
        "pole": lib.steel("Pole", "Neutral Gray", rough=0.4, brushed=False),
        "lounger": lib.plastic("Lounger", "White", rough=0.5),
        "pergola": lib.wood("Pergola", "Maple", "Isabella Color", scale=1.0, rough=0.6, coat=0.1),
    }


# --- Bitki örtüsü ---

_MESHES = {}


def crown_mesh(kind, seed, material):
    """Birim taç (yarıçap 1): ikosfer, Voronoi hücreleriyle loblu ve düşük frekanslı gürültüyle düzensiz.
    `kind`: round (turunç, zeytin), flame (servi), clump (begonvil, çit). Malzeme ağda durduğu için önbellek
    anahtarında malzeme de var."""
    key = (kind, seed, material.name)
    if key in _MESHES:
        return _MESHES[key]
    bm = bmesh.new()
    bmesh.ops.create_icosphere(bm, subdivisions=4, radius=1.0)
    off = Vector((seed * 17.3, seed * 5.9, seed * 11.1))
    lobes, rough = {"round": (2.4, 0.32), "flame": (3.2, 0.18), "clump": (3.0, 0.4)}[kind]
    for v in bm.verts:
        d = v.co.normalized()
        f1 = noise.voronoi(d * lobes + off)[0][0]
        low = noise.noise(d * 1.4 + off)
        r = 1.0 + rough * (0.6 * (0.45 - f1) + 0.5 * low)
        x, y, z = d * r
        if kind == "round":
            z = z * (0.55 if z < 0 else 0.9)
        elif kind == "flame":
            t = (z + 1.0) / 2.0  # 0 dip, 1 tepe
            s = math.sin(math.pi * max(t, 0.02) ** 0.62)
            x, y, z = x * s, y * s, t
        v.co = (x, y, z)
    me = bpy.data.meshes.new(f"Crown_{kind}_{seed}_{material.name}")
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    me.materials.append(material)
    _MESHES[key] = me
    return me


def _obj(name, kind, seed, loc, scale, rot_z, material):
    o = lib.link(bpy.data.objects.new(name, crown_mesh(kind, seed, material)))
    o.location = loc
    o.scale = scale
    o.rotation_euler = (0.0, 0.0, rot_z)
    return o


def tree(m, kind, x, y, seed, size=1.0, z0=GROUND):
    """Ağaç: gövde ve taç. kind: citrus (turunç), olive, cypress."""
    rs = lib.rng(seed)
    rot = rs.uniform(0, 2 * math.pi)
    objs = []
    if kind == "cypress":
        h = 9000.0 * size * rs.uniform(0.85, 1.15)
        r = 700.0 * size * rs.uniform(0.85, 1.1)
        objs.append(lib.cylinder("Trunk", 120 * size, 900, (x, y, z0 + 450), m["bark"], verts=10))
        objs.append(_obj("Cypress", "flame", seed % 6, (x, y, z0 + 500), (r, r, h), rot, m["cypress"]))
        return objs
    if kind == "olive":
        R, h, mat, trunk_r = 2600.0, 3600.0, m["olive"], 220.0
    else:
        R, h, mat, trunk_r = 1700.0, 2600.0, m["citrus"], 110.0
    R *= size * rs.uniform(0.85, 1.15)
    h *= size * rs.uniform(0.9, 1.1)
    objs.append(lib.cylinder("Trunk", trunk_r * size, h, (x, y, z0 + h / 2), m["bark"], verts=12))
    objs.append(_obj("Crown", "round", seed % 8, (x, y, z0 + h + R * 0.25), (R, R, R * 0.85), rot, mat))
    return objs


def shrub(m, kind, x, y, seed, r=900.0, z0=GROUND, squash=0.7):
    """Çalı ya da begonvil kümesi: loblu, basık."""
    rs = lib.rng(seed)
    mat = m["bougain"] if kind == "bougain" else m["hedge"]
    rr = r * rs.uniform(0.8, 1.2)
    return [_obj("Shrub", "clump", seed % 6, (x, y, z0 + rr * squash * 0.6), (rr, rr, rr * squash),
                 rs.uniform(0, 6.28), mat)]


def hedge(m, x0, x1, y0, y1, h=1400.0, z0=GROUND):
    """Çit: uzun kenar boyunca dizili basık kümeler (düz kutu yukarıdan yeşil şerit gibi cansız okunur)."""
    objs = []
    L = max(x1 - x0, y1 - y0)
    along_x = (x1 - x0) >= (y1 - y0)
    w = min(x1 - x0, y1 - y0)
    n = max(1, int(L / (w * 1.1)))
    rs = lib.rng(int(x0 * 7 + y0 * 3) & 0xFFFF)
    for k in range(n):
        t = (k + 0.5) / n
        cx, cy = (x0 + t * (x1 - x0), (y0 + y1) / 2) if along_x else ((x0 + x1) / 2, y0 + t * (y1 - y0))
        r = w * 0.65
        objs.append(_obj("Hedge", "clump", rs.randrange(6), (cx, cy, z0 + h / 2),
                         (r * 1.1, r * 1.1, h / 2), rs.uniform(0, 6.28), m["hedge"]))
    return objs


def palm(m, x, y, seed, h=7000.0, z0=GROUND, n=22, length=3000.0, width=900.0):
    """Hurma palmiyesi: hafif eğik gövde ve sarkan yapraklardan tepe. Yapraklar tek ağda, UV'leri yaprak
    boyunca; yaprakçıklar malzemede saydam aralıklarla."""
    rs = lib.rng(seed)
    lean_az = rs.uniform(0, 2 * math.pi)
    lean = rs.uniform(0.0, 0.06)
    top = Vector((x + math.cos(lean_az) * lean * h, y + math.sin(lean_az) * lean * h, z0 + h))
    mid = (Vector((x, y, z0)) + top) / 2
    axis = (top - Vector((x, y, z0))).normalized()
    trunk = lib.cylinder("PalmTrunk", 200, h, mid, m["trunk"], verts=14)
    trunk.rotation_euler = axis.to_track_quat("Z", "Y").to_euler()
    verts, faces, uvs = [], [], []
    K = 14
    for i in range(n):
        az = 2 * math.pi * i / n + rs.uniform(-0.12, 0.12)
        e0 = math.radians(rs.uniform(20, 65))
        e1 = math.radians(rs.uniform(-60, -25))
        L = length * rs.uniform(0.8, 1.1)
        W = width * rs.uniform(0.8, 1.1)
        dirh = Vector((math.cos(az), math.sin(az), 0.0))
        side = Vector((-math.sin(az), math.cos(az), 0.0))
        p = top.copy()
        base = len(verts)
        for k in range(K + 1):
            s = k / K
            ang = e0 + (e1 - e0) * s ** 1.5
            if k:
                p = p + (dirh * math.cos(ang) + Vector((0.0, 0.0, math.sin(ang)))) * (L / K)
            w = W / 2 * math.sin(math.pi * min(1.0, 0.08 + s * 0.95)) ** 0.8
            fold = Vector((0.0, 0.0, -0.4 * w))
            verts += [p + side * w + fold, p.copy(), p - side * w + fold]
            uvs += [(s, 1.0), (s, 0.5), (s, 0.0)]
        for k in range(K):
            a = base + 3 * k
            faces += [(a, a + 3, a + 4, a + 1), (a + 1, a + 4, a + 5, a + 2)]
    me = bpy.data.meshes.new("PalmCrown")
    me.from_pydata([tuple(v) for v in verts], [], faces)
    uv = me.uv_layers.new(name="UVMap")
    for poly in me.polygons:
        poly.use_smooth = True
        for li in poly.loop_indices:
            uv.data[li].uv = uvs[me.loops[li].vertex_index]
    me.materials.append(m["frond"])
    crown = lib.link(bpy.data.objects.new("PalmCrown", me))
    return [trunk, crown]


# --- Yapılar ---

def slab(name, x0, x1, y0, y1, z0, z1, mat, bevel=0.0):
    return lib.box(name, (x1 - x0, y1 - y0, z1 - z0), ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), mat, bevel=bevel)


def ring(name, outer, hole, z0, z1, mat):
    """Ortasında dikdörtgen boşluk olan döşeme: dört şerit (havuzun çevresi)."""
    x0, x1, y0, y1 = outer
    a0, a1, b0, b1 = hole
    return [slab(name, x0, x1, y0, b0, z0, z1, mat), slab(name, x0, x1, b1, y1, z0, z1, mat),
            slab(name, x0, a0, b0, b1, z0, z1, mat), slab(name, a1, x1, b0, b1, z0, z1, mat)]


def lawn_patch(m, x0, x1, y0, y1, hole=None, z=GROUND):
    """Parselin çimi. Havuz zeminin altına indiği için çim tek düzlem olamaz: havuzun yerinde boşluk bırakılır,
    mahallenin genel zemini havuz tabanının altında durur (ground)."""
    def pl(a0, a1, b0, b1):
        return lib.plane("Lawn", (a1 - a0, b1 - b0), ((a0 + a1) / 2, (b0 + b1) / 2, z), m["lawn"])
    if not hole:
        return [pl(x0, x1, y0, y1)]
    a0, a1, b0, b1 = hole
    return [pl(x0, x1, y0, b0), pl(x0, x1, b1, y1), pl(x0, a0, b0, b1), pl(a1, x1, b0, b1)]


def ground(m, size, center=(0.0, 0.0)):
    """Mahallenin genel zemini: havuz tabanının (GROUND − 1600) altında, parsellerin ve sokakların arasından
    görünmez; mahallenin dışında kalan çim."""
    return lib.plane("Ground", (size, size), (center[0], center[1], GROUND - 1800), m["lawn"])


def hip_roof(name, x0, x1, y0, y1, z0, pitch=0.55, overhang=500.0, mat=None):
    """Kırma çatı: mahya uzun kenar boyunca; dört yüz ve saçak altı."""
    x0, x1, y0, y1 = x0 - overhang, x1 + overhang, y0 - overhang, y1 + overhang
    w, d = x1 - x0, y1 - y0
    flip = d > w
    if flip:  # mahya Y boyunca: x ve y yer değiştirip kur, sonra döndür
        x0, x1, y0, y1 = y0, y1, x0, x1
        w, d = d, w
    h = d / 2 * pitch
    yc = (y0 + y1) / 2
    V = [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0), (x0 + d / 2, yc, z0 + h), (x1 - d / 2, yc, z0 + h)]
    F = [(0, 1, 5, 4), (1, 2, 5), (2, 3, 4, 5), (3, 0, 4), (0, 3, 2, 1)]
    if flip:
        V = [(y, x, z) for x, y, z in V]
        F = [tuple(reversed(f)) for f in F]
    o = lib.mesh_from(name, V, F, mat, smooth_shade=False)
    return o


def solar_heater(m, x, y, z, rot=0.0):
    """Güneş enerjili su ısıtıcısı: güneye (−Y) eğik iki kolektör ve arkalarında yatay depo."""
    g = lib.empty("SolarHeater", (x, y, z))
    objs = [lib.box("Collector", (900, 1900, 50), (sx, 0, 650), m["solar"], rot=(-45, 0, 0), bevel=8)
            for sx in (-480, 480)]
    objs.append(lib.cylinder("Tank", 270, 1900, (0, 750, 1150), m["tank"], rot=(0, 90, 0), bevel=6))
    for sx in (-900, 900):
        objs.append(lib.box("Stand", (40, 1300, 40), (sx, 300, 500), m["pole"], rot=(-45, 0, 0)))
    for o in objs:
        o.parent = g
    g.rotation_euler = (0.0, 0.0, rot)
    return objs + [g]


def pool(m, x0, x1, y0, y1, depth=1500.0, coping=350.0, z=GROUND):
    """Havuz: kenar taşı, karo kaplı tekne, su yüzü kenardan 120 mm aşağıda."""
    objs = [slab("PoolFloor", x0, x1, y0, y1, z - depth - 100, z - depth, m["liner"])]
    for a in ((x0 - 100, x0, y0 - 100, y1 + 100), (x1, x1 + 100, y0 - 100, y1 + 100),
              (x0, x1, y0 - 100, y0), (x0, x1, y1, y1 + 100)):
        objs.append(slab("PoolWall", *a, z - depth - 100, z, m["liner"]))
    objs.append(lib.plane("PoolWater", (x1 - x0, y1 - y0), ((x0 + x1) / 2, (y0 + y1) / 2, z - 120), m["water"]))
    for a in ((x0 - coping, x1 + coping, y0 - coping, y0), (x0 - coping, x1 + coping, y1, y1 + coping),
              (x0 - coping, x0, y0, y1), (x1, x1 + coping, y0, y1)):
        objs.append(slab("PoolCoping", *a, z, z + 40, m["coping"], bevel=8))
    return objs


def walls(m, x0, x1, y0, y1, gate=None, h=1300.0, t=200.0, mat=None, z=GROUND):
    """Bahçe duvarı: dört kenar, ön kenarda (y0) kapı boşluğu (gx0, gx1); üstünde harpuşta."""
    mat = mat or m["renders"][0]
    runs = []
    if gate:
        runs += [(x0, gate[0], y0, y0 + t), (gate[1], x1, y0, y0 + t)]
    else:
        runs.append((x0, x1, y0, y0 + t))
    runs += [(x0, x1, y1 - t, y1), (x0, x0 + t, y0, y1), (x1 - t, x1, y0, y1)]
    objs = []
    for a in runs:
        objs.append(slab("GardenWall", *a, z, z + h, mat))
        objs.append(slab("WallCoping", a[0] - 30, a[1] + 30, a[2] - 30, a[3] + 30, z + h, z + h + 60, m["coping"], bevel=6))
    return objs


def car(m, x, y, rot, seed, z=GROUND):
    """Park etmiş otomobil: yukarıdan gövde, cam ve tavan okunur."""
    rs = lib.rng(seed)
    g = lib.empty("Car", (x, y, z))
    body = m["car"][rs.randrange(len(m["car"]))]
    objs = [lib.box("CarBody", (4300, 1800, 750), (0, 0, 520), body, bevel=120),
            lib.box("CarCabin", (2300, 1600, 520), (-150, 0, 1080), m["carglass"], bevel=140),
            lib.box("CarRoof", (1500, 1500, 60), (-200, 0, 1340), body, bevel=30)]
    for sx in (-1350, 1350):
        for sy in (-800, 800):
            objs.append(lib.cylinder("Wheel", 330, 220, (sx, sy, 330), m["carglass"], rot=(90, 0, 0), verts=20))
    for o in objs:
        o.parent = g
    g.rotation_euler = (0.0, 0.0, rot)
    return objs + [g]


def street(m, x0, x1, y_front, seed=5):
    """Parsel önünden geçen sokak (yol X boyunca): y_front parselin ön kenarı; kaldırımlar, bordürler, kesik
    şerit çizgisi, kaldırımda turunç ağaçları ve sokak lambaları, yol kenarında birkaç otomobil."""
    rs = lib.rng(seed)
    yw0 = y_front - WALK
    yr0 = yw0 - ROAD
    yw1 = yr0 - WALK
    objs = [slab("Sidewalk", x0, x1, yw0, y_front, GROUND, GROUND + 150, m["walk"]),
            slab("Sidewalk", x0, x1, yw1, yr0, GROUND, GROUND + 150, m["walk"]),
            slab("Road", x0, x1, yr0, yw0, GROUND - 40, GROUND + 10, m["asphalt"]),
            slab("Kerb", x0, x1, yw0, yw0 + 150, GROUND, GROUND + 160, m["kerb"]),
            slab("Kerb", x0, x1, yr0 - 150, yr0, GROUND, GROUND + 160, m["kerb"])]
    yc = (yr0 + yw0) / 2
    x = x0 + 1000
    while x + 3000 < x1:
        objs.append(slab("Marking", x, x + 3000, yc - 60, yc + 60, GROUND + 10, GROUND + 14, m["marking"]))
        x += 8000
    x = x0 + 4500
    while x < x1:
        for yy, s in ((yw0 + WALK * 0.55, 1), (yw1 + WALK * 0.45, -1)):
            objs += tree(m, "citrus", x + rs.uniform(-300, 300), yy, rs.randrange(1 << 16), size=0.7, z0=GROUND + 150)
        x += 9000 + rs.uniform(-800, 800)
    x = x0 + 9000
    while x < x1:
        objs.append(lib.cylinder("LampPole", 60, 6500, (x, yw0 + 400, GROUND + 3400), m["pole"], verts=12))
        objs.append(lib.box("LampArm", (120, 1600, 80), (x, yw0 - 300, GROUND + 6550), m["pole"], bevel=20))
        x += 30000
    x = x0 + rs.uniform(3000, 9000)
    while x < x1 - 5000:
        objs += car(m, x, yr0 + 1300, 0.0 if rs.random() < 0.5 else math.pi, rs.randrange(1 << 16), z=GROUND + 10)
        x += rs.uniform(14000, 40000)
    return objs


# --- Komşu parseller ---

def plot_variant(m, seed):
    """Komşu parsel (yerel: x 0..PLOT_W, y 0..PLOT_D, ön kenar y = 0 sokağa bakar). Ev (kırma kiremit ya da düz
    çatı ve güneş enerjili ısıtıcı), teras, bazen havuz, ağaçlar, bahçe duvarı ve begonvil."""
    rs = lib.rng(seed)
    objs = []
    hw, hd = rs.choice([(12000.0, 10000.0), (14000.0, 9000.0), (11000.0, 10500.0), (13000.0, 9500.0)])
    hx0 = rs.uniform(4500.0, PLOT_W - hw - 4500.0)
    hy0 = rs.uniform(5500.0, 6500.0)  # arkada havuza yer kalsın: hy0 + hd + 6000 < arka duvar
    keep_out = [(hx0 - 800, hx0 + hw + 800, hy0 - 3000, hy0 + hd + 800)]
    storeys = rs.choice([1, 2, 2])
    top = storeys * 3000.0 + 300.0
    render = rs.choice(m["renders"])
    objs.append(slab("House", hx0, hx0 + hw, hy0, hy0 + hd, GROUND, top, render))
    if rs.random() < 0.55:
        objs.append(hip_roof("Roof", hx0, hx0 + hw, hy0, hy0 + hd, top, pitch=rs.uniform(0.45, 0.6), mat=m["roof"]))
    else:
        objs.append(slab("RoofDeck", hx0 + 150, hx0 + hw - 150, hy0 + 150, hy0 + hd - 150, top, top + 30, m["membrane"]))
        for a in ((hx0, hx0 + hw, hy0, hy0 + 150), (hx0, hx0 + hw, hy0 + hd - 150, hy0 + hd),
                  (hx0, hx0 + 150, hy0, hy0 + hd), (hx0 + hw - 150, hx0 + hw, hy0, hy0 + hd)):
            objs.append(slab("Parapet", *a, top, top + 500, render))
        objs += solar_heater(m, hx0 + hw * rs.uniform(0.3, 0.7), hy0 + hd * 0.6, top + 30)
    # Ön cephe pencereleri (eğik bakışta okunur).
    for s in range(storeys):
        for k in range(int(hw // 3500)):
            wx = hx0 + 1800 + k * 3500
            objs.append(slab("Window", wx, wx + 1300, hy0 - 40, hy0 + 10, s * 3000 + 900, s * 3000 + 2400, m["window"]))
    objs.append(slab("Terrace", hx0 - 1500, hx0 + hw + 1500, hy0 - 3000, hy0, GROUND, GROUND + 60, m["deck"]))
    gate = (hx0 + hw / 2 - 700, hx0 + hw / 2 + 700)
    objs.append(slab("Path", gate[0], gate[1], 0.0, hy0 - 3000, GROUND, GROUND + 50, m["paving"]))
    hole = None
    if rs.random() < 0.6:
        px0 = rs.uniform(3000.0, PLOT_W - 12000.0)
        py0 = hy0 + hd + 2000
        objs += pool(m, px0, px0 + 8000, py0, py0 + 4000)
        objs.append(slab("PoolDeck", px0 - 1500, px0 + 9500, hy0 + hd + 800, py0 - 350, GROUND, GROUND + 40, m["deck"]))
        keep_out.append((px0 - 1200, px0 + 9200, py0 - 1200, py0 + 5200))
        hole = (px0 - 300, px0 + 8300, py0 - 300, py0 + 4300)
    objs += lawn_patch(m, 0.0, PLOT_W, 0.0, PLOT_D, hole)
    objs += walls(m, 0.0, PLOT_W, 0.0, PLOT_D, gate=gate, mat=render)
    for _ in range(rs.randint(1, 3)):
        objs += shrub(m, "bougain", rs.uniform(500, PLOT_W - 500), 500.0, rs.randrange(1 << 16), r=900)
    placed, target = 0, rs.randint(3, 6)
    for _ in range(30):  # yasak bölgelere (ev, teras, havuz) düşmeyen 3–6 ağaç
        if placed >= target:
            break
        tx, ty = rs.uniform(1500.0, PLOT_W - 1500.0), rs.uniform(1500.0, PLOT_D - 1500.0)
        if any(a <= tx <= b and c <= ty <= d for a, b, c, d in keep_out):
            continue
        kind = rs.choice(["citrus", "citrus", "olive", "cypress", "palm"])
        if kind == "palm":
            objs += palm(m, tx, ty, rs.randrange(1 << 16), h=rs.uniform(5500, 8500))
        else:
            objs += tree(m, kind, tx, ty, rs.randrange(1 << 16), size=rs.uniform(0.8, 1.1))
        keep_out.append((tx - 2000, tx + 2000, ty - 2000, ty + 2000))
        placed += 1
    if rs.random() < 0.5:
        objs += hedge(m, 300.0, 1300.0, 1000.0, PLOT_D - 1000.0)
    return objs


def collection_of(name, objs):
    """Nesneleri sahneden alıp bağımsız bir koleksiyona taşır (yalnız örnek olarak görünür)."""
    coll = bpy.data.collections.new(name)
    for o in objs:
        for c in list(o.users_collection):
            c.objects.unlink(o)
        coll.objects.link(o)
    return coll


def instance(coll, x, y, rot):
    e = lib.link(bpy.data.objects.new("Plot_" + coll.name, None))
    e.instance_type = "COLLECTION"
    e.instance_collection = coll
    e.location = (x, y, 0.0)
    e.rotation_euler = (0.0, 0.0, rot)
    return e


def variants(m, k=8, seed=100):
    return [collection_of(f"Variant{i}", plot_variant(m, seed + i)) for i in range(k)]


def neighbourhood(m, vs, x_origin, y_origin, cols, rows, skip=(), seed=11):
    """Parsel ızgarası: hero parselin ön sol köşesi (x_origin, y_origin) referans. Sütun i, sıra j: her blokta
    sırt sırta iki parsel (j çift: ön kenarı −Y'deki sokağa bakar; j tek: döndürülmüş, +Y'deki sokağa bakar).
    `skip`: boş bırakılacak (i, j) hücreleri (hero parsel)."""
    rs = lib.rng(seed)
    objs = []
    for i in cols:
        for j in rows:
            if (i, j) in skip:
                continue
            x = x_origin + i * PLOT_W
            block, back = divmod(j, 2)
            if back:
                y = y_origin + block * BLOCK_PITCH + 2 * PLOT_D
                objs.append(instance(vs[rs.randrange(len(vs))], x + PLOT_W, y, math.pi))
            else:
                y = y_origin + block * BLOCK_PITCH
                objs.append(instance(vs[rs.randrange(len(vs))], x, y, 0.0))
    return objs


def streets(m, x0, x1, y_origin, blocks, seed=21):
    """Bloklar arası sokaklar: blok b'nin önündeki sokak y_origin + b·BLOCK_PITCH'te."""
    objs = []
    for b in blocks:
        objs += street(m, x0, x1, y_origin + b * BLOCK_PITCH, seed + b)
    return objs
