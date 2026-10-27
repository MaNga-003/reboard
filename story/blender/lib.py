# Hikâye sahneleri için ortak yardımcılar (D-004): Cycles ile fotogerçekçi render.
# Malzemelerin taban renkleri yalnızca Wada sözlüğünden gelir (D-014); karedeki piksel rengi ışıkla değişir.
import json
import math
import os
import random

import bpy
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
with open(os.path.join(ROOT, "src", "design", "wada.json"), encoding="utf-8") as fh:
    WADA = {c["name"]: c["hex"] for c in json.load(fh)}

FRAMES_PER_SECTION = 30
SECTIONS = 8

QUALITY = {
    # örnek sayısı, uyarlamalı eşik, çözünürlük yüzdesi
    "preview": (64, 0.04, 50),
    "animatic": (128, 0.02, 50),
    "final": (1024, 0.004, 100),
}


class Cfg:
    def __init__(self, aspect, quality, out):
        self.aspect = aspect  # "d" 16:9, "m" 9:16
        self.quality = quality
        self.out = out

    @property
    def portrait(self):
        return self.aspect == "m"


def _lin(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def rgba(name, a=1.0):
    h = WADA[name].lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) / 255 for i in (0, 2, 4))
    return (_lin(r), _lin(g), _lin(b), a)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def _gpu():
    prefs = bpy.context.preferences.addons["cycles"].preferences
    for kind in ("OPTIX", "CUDA"):
        try:
            prefs.compute_device_type = kind
        except TypeError:
            continue
        prefs.get_devices()
        if any(d.type == kind for d in prefs.devices):
            for d in prefs.devices:
                d.use = d.type == kind
            return kind
    return None


def setup(cfg, f0, f1, exposure=0.0, look="AgX - Medium High Contrast"):
    sc = bpy.context.scene
    sc.render.engine = "CYCLES"
    kind = _gpu()
    sc.cycles.device = "GPU" if kind else "CPU"
    samples, threshold, pct = QUALITY[cfg.quality]
    sc.cycles.samples = samples
    sc.cycles.use_adaptive_sampling = True
    sc.cycles.adaptive_threshold = threshold
    sc.cycles.use_denoising = True
    sc.cycles.denoiser = "OPENIMAGEDENOISE"
    if hasattr(sc.cycles, "denoising_use_gpu"):
        sc.cycles.denoising_use_gpu = True
    sc.cycles.denoising_input_passes = "RGB_ALBEDO_NORMAL"
    sc.cycles.denoising_prefilter = "ACCURATE"
    sc.cycles.max_bounces = 12
    sc.cycles.diffuse_bounces = 4
    sc.cycles.glossy_bounces = 4
    sc.cycles.transmission_bounces = 8
    sc.cycles.transparent_max_bounces = 32
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.cycles.blur_glossy = 0.5
    # Gürültü deseni kareden kareye sabit: scroll ile ileri geri oynatılan dizide titreşim görünmesin.
    sc.cycles.seed = 7
    sc.cycles.use_animated_seed = False
    sc.cycles_curves.shape = "THICK"
    sc.cycles_curves.subdivisions = 3
    sc.render.use_persistent_data = True
    w, h = (1080, 1920) if cfg.portrait else (1920, 1080)
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = pct
    sc.view_settings.view_transform = "AgX"
    try:
        sc.view_settings.look = look
    except TypeError:
        pass
    sc.view_settings.exposure = exposure
    sc.render.image_settings.file_format = "PNG"
    sc.render.image_settings.color_mode = "RGB"
    sc.render.image_settings.color_depth = "8"
    sc.render.film_transparent = False
    sc.frame_start, sc.frame_end = f0, f1
    sc.frame_step = 2 if cfg.portrait else 1
    return sc


def world(color, strength=1.0, camera_color=None, camera_strength=1.0, stars=None):
    """Ortamı `color` aydınlatır; kamera zemini ayrı verilebilir (stüdyo fonu ya da uzay)."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new("World")
    sc.world = w
    w.use_nodes = True
    nt = w.node_tree
    nodes, links = nt.nodes, nt.links
    nodes.clear()
    out = nodes.new("ShaderNodeOutputWorld")
    amb = nodes.new("ShaderNodeBackground")
    amb.inputs["Color"].default_value = rgba(color)
    amb.inputs["Strength"].default_value = strength
    if camera_color is None and not stars:
        links.new(amb.outputs[0], out.inputs["Surface"])
        return w
    cam_bg = nodes.new("ShaderNodeBackground")
    cam_bg.inputs["Color"].default_value = rgba(camera_color or color)
    cam_bg.inputs["Strength"].default_value = camera_strength
    cam_out = cam_bg
    if stars:
        tc = nodes.new("ShaderNodeTexCoord")
        vor = nodes.new("ShaderNodeTexVoronoi")
        vor.inputs["Scale"].default_value = 300.0
        links.new(tc.outputs["Generated"], vor.inputs["Vector"])
        ramp = nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "EASE"
        ramp.color_ramp.elements[0].position = 0.0
        ramp.color_ramp.elements[0].color = (1, 1, 1, 1)
        ramp.color_ramp.elements[1].position = 0.025
        ramp.color_ramp.elements[1].color = (0, 0, 0, 1)
        links.new(vor.outputs["Distance"], ramp.inputs["Fac"])
        # Yıldızların yalnız bir kısmı yanar: hücrenin rastgele rengiyle seyreltilir.
        sep = nodes.new("ShaderNodeSeparateColor")
        links.new(vor.outputs["Color"], sep.inputs["Color"])
        thin = nodes.new("ShaderNodeMath")
        thin.operation = "GREATER_THAN"
        thin.inputs[1].default_value = 0.85
        links.new(sep.outputs["Red"], thin.inputs[0])
        star = nodes.new("ShaderNodeMath")
        star.operation = "MULTIPLY"
        links.new(ramp.outputs["Color"], star.inputs[0])
        links.new(thin.outputs[0], star.inputs[1])
        st_bg = nodes.new("ShaderNodeBackground")
        st_bg.inputs["Color"].default_value = rgba(stars)
        st_bg.inputs["Strength"].default_value = 2.0
        add = nodes.new("ShaderNodeMixShader")
        links.new(star.outputs[0], add.inputs["Fac"])
        links.new(cam_bg.outputs[0], add.inputs[1])
        links.new(st_bg.outputs[0], add.inputs[2])
        cam_out = add
    lp = nodes.new("ShaderNodeLightPath")
    mix = nodes.new("ShaderNodeMixShader")
    links.new(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    links.new(amb.outputs[0], mix.inputs[1])
    links.new(cam_out.outputs[0], mix.inputs[2])
    links.new(mix.outputs[0], out.inputs["Surface"])
    return w


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def empty(name, loc=(0, 0, 0)):
    o = link(bpy.data.objects.new(name, None))
    o.location = loc
    return o


def camera(cfg, lens=50, fstop=None, shift=True, sensor=36.0, clip=(0.01, 10000)):
    data = bpy.data.cameras.new("Cam")
    data.lens = lens
    data.sensor_width = sensor
    data.sensor_fit = "AUTO"
    data.clip_start, data.clip_end = clip
    if shift:
        # Metin kutusu masaüstünde solda, mobilde altta durur; özne öbür tarafa kayar.
        if cfg.portrait:
            data.shift_y = -0.12
        else:
            data.shift_x = -0.13
    cam = link(bpy.data.objects.new("Cam", data))
    tgt = empty("Target")
    con = cam.constraints.new("TRACK_TO")
    con.target = tgt
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    if fstop:
        data.dof.use_dof = True
        data.dof.focus_object = tgt
        data.dof.aperture_fstop = fstop
        data.dof.aperture_blades = 7
        data.dof.aperture_rotation = math.radians(10)
    bpy.context.scene.camera = cam
    return cam, tgt


def frame_width(cam, dist):
    """Hedef uzaklığında yatay görüş genişliği (sahne birimi)."""
    d = cam.data
    return d.sensor_width * dist / d.lens


def dist_for_width(cam, width):
    d = cam.data
    return width * d.lens / d.sensor_width


def orbit(center, dist, az, el):
    a, e = math.radians(az), math.radians(el)
    return Vector(center) + Vector((math.cos(e) * math.cos(a), math.cos(e) * math.sin(a), math.sin(e))) * dist


def smooth(t):
    return t * t * (3 - 2 * t)


def soft(t, k=0.3):
    """Sabite yakın hız, uçlarda hafif yumuşama: scroll ile sürülen dizide en doğal his."""
    return (1 - k) * t + k * smooth(t)


def expo(a, b, t):
    return a * (b / a) ** t


def lerp(a, b, t):
    if isinstance(a, (tuple, list, Vector)):
        return Vector(a).lerp(Vector(b), t)
    return a + (b - a) * t


def fly(cam, tgt, f0, f1, path, fstop=None):
    """path(t) -> (kamera, hedef). fstop(t) verilirse diyafram da anahtarlanır."""
    for f in range(f0, f1 + 1):
        t = (f - f0) / (f1 - f0)
        c, g = path(t)
        cam.location = c
        cam.keyframe_insert("location", frame=f)
        tgt.location = g
        tgt.keyframe_insert("location", frame=f)
        if fstop:
            cam.data.dof.aperture_fstop = fstop(t)
            cam.data.dof.keyframe_insert("aperture_fstop", frame=f)


def key(obj, path, frame, value):
    setattr(obj, path, value)
    obj.keyframe_insert(path, frame=frame)


# --- Işıklar ---

def area_light(loc, target, size=2.0, power=500.0, color=None, size_y=None, spread=180, name="Area"):
    d = bpy.data.lights.new(name, "AREA")
    d.energy = power
    if size_y:
        d.shape = "RECTANGLE"
        d.size_y = size_y
    else:
        d.shape = "SQUARE"
    d.size = size
    d.spread = math.radians(spread)
    if color:
        d.color = rgba(color)[:3]
    o = link(bpy.data.objects.new(name, d))
    o.location = loc
    con = o.constraints.new("TRACK_TO")
    con.target = empty(name + "Target", target)
    con.track_axis = "TRACK_NEGATIVE_Z"
    con.up_axis = "UP_Y"
    return o


def sun(direction, strength=3.0, angle=1.0, color=None):
    d = bpy.data.lights.new("Sun", "SUN")
    d.energy = strength
    d.angle = math.radians(angle)
    if color:
        d.color = rgba(color)[:3]
    o = link(bpy.data.objects.new("Sun", d))
    o.rotation_euler = (-Vector(direction).normalized()).to_track_quat("-Z", "Y").to_euler()
    return o


# --- Düğüm yardımcıları ---

def _sock(sockets, ident):
    for s in sockets:
        if s.identifier == ident:
            return s
    raise KeyError(ident)


class N:
    """Malzeme düğüm ağacı için kısa yazım."""

    def __init__(self, m):
        self.nt = m.node_tree
        self.nodes = self.nt.nodes
        self.links = self.nt.links

    def new(self, kind, **inputs):
        n = self.nodes.new(kind)
        for k, v in inputs.items():
            n.inputs[k].default_value = v
        return n

    def link(self, a, b):
        self.links.new(a, b)

    def _set(self, sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            self.links.new(v, sock)

    def math(self, op, a, b=None, c=None, clamp=False):
        n = self.nodes.new("ShaderNodeMath")
        n.operation = op
        n.use_clamp = clamp
        for i, v in enumerate((a, b, c)):
            if v is not None:
                self._set(n.inputs[i], v)
        return n.outputs[0]

    def mix(self, fac, a, b):
        n = self.nodes.new("ShaderNodeMix")
        n.data_type = "RGBA"
        self._set(_sock(n.inputs, "Factor_Float"), fac)
        self._set(_sock(n.inputs, "A_Color"), a)
        self._set(_sock(n.inputs, "B_Color"), b)
        return _sock(n.outputs, "Result_Color")

    def coords(self, kind="Object", scale=(1, 1, 1), rot=(0, 0, 0), loc=(0, 0, 0)):
        tc = self.nodes.new("ShaderNodeTexCoord")
        mp = self.nodes.new("ShaderNodeMapping")
        mp.inputs["Scale"].default_value = scale
        mp.inputs["Rotation"].default_value = rot
        mp.inputs["Location"].default_value = loc
        self.links.new(tc.outputs[kind], mp.inputs["Vector"])
        return mp.outputs["Vector"]

    def noise(self, vec, scale, detail=6.0, rough=0.55, dims="3D"):
        n = self.nodes.new("ShaderNodeTexNoise")
        n.noise_dimensions = dims
        n.inputs["Scale"].default_value = scale
        n.inputs["Detail"].default_value = detail
        n.inputs["Roughness"].default_value = rough
        self.links.new(vec, n.inputs["Vector"])
        return n.outputs["Fac"]

    def bump(self, height, strength, distance, normal=None):
        b = self.new("ShaderNodeBump", Strength=strength, Distance=distance)
        self.link(height, b.inputs["Height"])
        if normal is not None:
            self.link(normal, b.inputs["Normal"])
        return b.outputs["Normal"]

    def shade(self, color, factor):
        """Rengin parlaklığını çarpar (aynı tonun koyusu ya da açığı); yeni ton icat etmez."""
        hsv = self.nodes.new("ShaderNodeHueSaturation")
        self._set(hsv.inputs["Color"], color)
        self._set(hsv.inputs["Value"], factor)
        return hsv.outputs["Color"]


def principled(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    return m, m.node_tree.nodes["Principled BSDF"], N(m)


def surface_only(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, out, N(m)


# --- Malzemeler ---

def plastic(name, color, rough=0.45, coat=0.0, metal=0.0, wear=0.0, scale=1.0):
    """Boyalı ya da plastik yüzey; `wear` hafif leke ve pürüz katar."""
    m, b, n = principled(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    b.inputs["Coat Weight"].default_value = coat
    base = rgba(color)
    if wear:
        v = n.coords(scale=(scale,) * 3)
        nz = n.noise(v, 6.0, 8.0, 0.6)
        n.link(n.shade(base, n.math("MULTIPLY_ADD", nz, wear, 1.0 - wear / 2)), b.inputs["Base Color"])
        n.link(n.math("MULTIPLY_ADD", nz, 0.25, max(0.02, rough - 0.12)), b.inputs["Roughness"])
        n.link(n.bump(n.noise(v, 60.0, 4.0), 0.05, 0.002), b.inputs["Normal"])
    else:
        b.inputs["Base Color"].default_value = base
    return m


def steel(name="Steel", color="Neutral Gray", rough=0.3, brushed=True, scale=1.0):
    m, b, n = principled(name)
    b.inputs["Metallic"].default_value = 1.0
    b.inputs["Base Color"].default_value = rgba(color)
    b.inputs["Roughness"].default_value = rough
    if brushed:
        v = n.coords(scale=(scale, scale, scale * 200))
        nz = n.noise(v, 30.0, 8.0, 0.7)
        n.link(n.math("MULTIPLY_ADD", nz, 0.2, max(0.02, rough - 0.08)), b.inputs["Roughness"])
        b.inputs["Anisotropic"].default_value = 0.5
    return m


def fibre_hair(name, color, rough=0.45, radial=0.6, var=0.25, ior=1.55):
    """Tek tek lifler için saç BSDF'i. Renk Wada'dan; lif başına parlaklık sapması `var`."""
    m, out, n = surface_only(name)
    h = n.nodes.new("ShaderNodeBsdfHairPrincipled")
    h.parametrization = "COLOR"
    h.inputs["Roughness"].default_value = rough
    h.inputs["Radial Roughness"].default_value = radial
    h.inputs["Coat"].default_value = 0.0
    h.inputs["IOR"].default_value = ior
    info = n.nodes.new("ShaderNodeHairInfo")
    val = n.math("MULTIPLY_ADD", info.outputs["Random"], var, 1.0 - var / 2)
    n.link(n.shade(rgba(color), val), h.inputs["Color"])
    n.link(h.outputs[0], out.inputs["Surface"])
    return m


def fibre_diffuse(name, color, rough=0.7, sheen=0.6, var=0.2):
    """Kalın lif ve iplik çekirdeği: mat yüzey, ipliğe paralel tüy parıltısı."""
    m, b, n = principled(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = sheen
    b.inputs["Sheen Roughness"].default_value = 0.35
    info = n.nodes.new("ShaderNodeHairInfo")
    val = n.math("MULTIPLY_ADD", info.outputs["Random"], var, 1.0 - var / 2)
    n.link(n.shade(rgba(color), val), b.inputs["Base Color"])
    return m


def fabric(name, warp, weft=None, pitch=(0.5, 0.6), fuzz=0.7, rough=0.85, twill=3, var=0.12, bump=0.6):
    """Dokuma kumaş yüzeyi (Object koordinatı, birim = mm): çözgü Y, atkı X yönünde.
    twill=n ise çözgü n-1 atkının üstünden geçer (ör. 3: denimin 2/1 dimisi), 0 ise bezayağı."""
    weft = weft or warp
    m, b, n = principled(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = fuzz
    b.inputs["Sheen Roughness"].default_value = 0.4
    pw, pf = pitch
    tc = n.nodes.new("ShaderNodeTexCoord")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Object"], sep.inputs["Vector"])
    u = n.math("DIVIDE", sep.outputs["X"], pw)  # çözgü indeksi
    w = n.math("DIVIDE", sep.outputs["Y"], pf)  # atkı indeksi
    iu = n.math("FLOOR", n.math("ADD", u, 0.5))
    iw = n.math("FLOOR", n.math("ADD", w, 0.5))
    period = twill if twill else 2
    phase = n.math("MODULO", n.math("ADD", n.math("ADD", iu, iw), 1000.0 * period), period)
    over = n.math("GREATER_THAN", phase, 0.5)  # 1: çözgü üstte
    # İplik kesiti: merkezde 1, kenarda 0.
    fu = n.math("ABSOLUTE", n.math("SUBTRACT", u, iu))
    fw = n.math("ABSOLUTE", n.math("SUBTRACT", w, iw))
    prof_warp = n.math("COSINE", n.math("MULTIPLY", fu, math.pi))
    prof_weft = n.math("COSINE", n.math("MULTIPLY", fw, math.pi))
    # Üstteki ipliğin boyuna kıvrımı: geçiş noktasında en yüksek.
    arch_warp = n.math("COSINE", n.math("MULTIPLY", fw, math.pi * 0.8))
    arch_weft = n.math("COSINE", n.math("MULTIPLY", fu, math.pi * 0.8))
    h_warp = n.math("MULTIPLY", prof_warp, arch_warp)
    h_weft = n.math("MULTIPLY", prof_weft, arch_weft)
    height = n.math("ADD", n.math("MULTIPLY", over, h_warp), n.math("MULTIPLY", n.math("SUBTRACT", 1.0, over), h_weft))
    # Lif dokusu: iplik boyunca gerilmiş gürültü, üstteki ipliğin yönüne göre.
    fib_warp = n.noise(n.coords(scale=(14.0 / pw, 1.2 / pf, 14.0 / pw)), 1.0, 8.0, 0.7)
    fib_weft = n.noise(n.coords(scale=(1.2 / pw, 14.0 / pf, 14.0 / pw)), 1.0, 8.0, 0.7)
    fib = n.math("ADD", n.math("MULTIPLY", over, fib_warp), n.math("MULTIPLY", n.math("SUBTRACT", 1.0, over), fib_weft))
    h_all = n.math("MULTIPLY_ADD", fib, 0.35, height)
    n.link(n.bump(h_all, bump, min(pw, pf) * 0.35), b.inputs["Normal"])
    col = n.mix(over, rgba(weft), rgba(warp))
    blot = n.noise(n.coords(scale=(0.08, 0.08, 0.08)), 3.0, 4.0, 0.5)
    slub = n.noise(n.coords(scale=(0.6 / pw, 0.02, 0.6 / pw)), 1.0, 3.0, 0.5)
    val = n.math("MULTIPLY_ADD", n.math("ADD", blot, slub), var / 2, 1.0 - var / 2)
    shading = n.math("MULTIPLY", val, n.math("MULTIPLY_ADD", height, 0.35, 0.65))
    n.link(n.shade(col, shading), b.inputs["Base Color"])
    return m


def felt(name, base, flecks, scale=1.0, density=0.5, rough=0.9, fuzz=0.8, bump=0.6, size=1.2):
    """Atık tekstilden lif keçesi ya da levha. Birim mm; `size` lif kırığı uzunluğu (mm)."""
    m, b, n = principled(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Sheen Weight"].default_value = fuzz
    b.inputs["Sheen Roughness"].default_value = 0.5
    color = rgba(base)
    k = len(flecks)
    for i, rot in enumerate((0.0, 1.1, 2.3, 0.6)):
        v = n.coords(scale=(scale / size, scale * 5 / size, scale / size), rot=(0.0, 0.0, rot),
                     loc=(i * 3.1, i * 1.7, i * 2.3))
        vor = n.nodes.new("ShaderNodeTexVoronoi")
        n.link(v, vor.inputs["Vector"])
        sep = n.nodes.new("ShaderNodeSeparateColor")
        n.link(vor.outputs["Color"], sep.inputs["Color"])
        ramp = n.nodes.new("ShaderNodeValToRGB")
        ramp.color_ramp.interpolation = "CONSTANT"
        els = ramp.color_ramp.elements
        els[0].position, els[0].color = 0.0, rgba(flecks[0])
        els[1].position, els[1].color = 1.0 / k, rgba(flecks[1 % k])
        for j in range(2, k):
            els.new(j / k).color = rgba(flecks[j])
        n.link(sep.outputs["Red"], ramp.inputs["Fac"])
        mask = n.math("LESS_THAN", sep.outputs["Green"], density / 2)
        thin = n.math("LESS_THAN", vor.outputs["Distance"], 0.32)
        color = n.mix(n.math("MULTIPLY", mask, thin), color, ramp.outputs["Color"])
    tone = n.noise(n.coords(scale=(scale / 6,) * 3), 4.0, 8.0, 0.6)
    n.link(n.shade(color, n.math("MULTIPLY_ADD", tone, 0.3, 0.85)), b.inputs["Base Color"])
    hgt = n.noise(n.coords(scale=(scale / size * 2,) * 3), 3.0, 12.0, 0.7)
    n.link(n.bump(hgt, bump, size / scale * 0.2), b.inputs["Normal"])
    return m


def wood(name, light, dark, scale=1.0, rough=0.55, coat=0.2):
    """Kontrplak ya da masif ahşap yüzey; damar X yönünde. Birim: mm başına `scale`."""
    m, b, n = principled(name)
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = 0.25
    v = n.coords(scale=(0.004 * scale, 0.06 * scale, 0.06 * scale))
    warp = n.noise(n.coords(scale=(0.01 * scale,) * 3), 2.0, 4.0, 0.5)
    wave = n.nodes.new("ShaderNodeTexWave")
    wave.wave_type = "RINGS"
    wave.inputs["Scale"].default_value = 1.0
    wave.inputs["Distortion"].default_value = 6.0
    wave.inputs["Detail"].default_value = 3.0
    n.link(v, wave.inputs["Vector"])
    g = n.math("POWER", wave.outputs["Fac"], 3.0)
    g = n.math("MULTIPLY_ADD", warp, 0.3, g)
    col = n.mix(n.math("MINIMUM", g, 1.0), rgba(light), rgba(dark))
    pores = n.noise(n.coords(scale=(0.05 * scale, 3.0 * scale, 3.0 * scale)), 1.0, 2.0, 0.5)
    n.link(n.shade(col, n.math("MULTIPLY_ADD", pores, 0.15, 0.92)), b.inputs["Base Color"])
    n.link(n.bump(pores, 0.08, 0.05 / scale), b.inputs["Normal"])
    return m


def paper(name, color, rough=0.8, scale=1.0):
    m, b, n = principled(name)
    b.inputs["Roughness"].default_value = rough
    nz = n.noise(n.coords(scale=(scale,) * 3), 2.0, 12.0, 0.65)
    n.link(n.shade(rgba(color), n.math("MULTIPLY_ADD", nz, 0.1, 0.95)), b.inputs["Base Color"])
    n.link(n.bump(nz, 0.1, 0.02 / scale), b.inputs["Normal"])
    return m


def emission(name, color, strength):
    m, out, n = surface_only(name)
    em = n.new("ShaderNodeEmission", Strength=strength)
    em.inputs["Color"].default_value = rgba(color)
    n.link(em.outputs[0], out.inputs["Surface"])
    return m


# --- Geometri ---

def _finish(obj, material, smooth_shade=False):
    if material:
        obj.data.materials.append(material)
    if smooth_shade:
        for p in obj.data.polygons:
            p.use_smooth = True
    return obj


def box(name, size, loc, material=None, bevel=0.0, rot=(0, 0, 0), segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=tuple(math.radians(r) for r in rot))
    o = bpy.context.active_object
    o.name = name
    o.scale = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
        for p in o.data.polygons:
            p.use_smooth = True
    return _finish(o, material)


def cylinder(name, radius, depth, loc, material=None, rot=(0, 0, 0), verts=64, bevel=0.0):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc,
                                        rotation=tuple(math.radians(r) for r in rot))
    o = bpy.context.active_object
    o.name = name
    if bevel:
        mod = o.modifiers.new("Bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 3
        mod.limit_method = "ANGLE"
        mod.harden_normals = True
    for p in o.data.polygons:
        p.use_smooth = True
    if hasattr(o.data, "set_sharp_from_angle"):
        o.data.set_sharp_from_angle(angle=math.radians(40))
    return _finish(o, material)


def sphere(name, radius, loc, material=None, segments=128, rings=64):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=radius, location=loc)
    o = bpy.context.active_object
    o.name = name
    return _finish(o, material, smooth_shade=True)


def plane(name, size, loc, material=None, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=tuple(math.radians(r) for r in rot))
    o = bpy.context.active_object
    o.name = name
    o.scale = (size[0], size[1], 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return _finish(o, material)


def mesh_from(name, verts, faces, material=None, smooth_shade=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    o = link(bpy.data.objects.new(name, me))
    return _finish(o, material, smooth_shade)


def curves(name, strands, material):
    """strands: [(N,3) dizi, (N,) yarıçap] listesi. Tek Curves nesnesi; Cycles gerçek eğri olarak izler."""
    import numpy as np

    c = bpy.data.hair_curves.new(name)
    c.add_curves([len(p) for p, _ in strands])
    pos = np.concatenate([p for p, _ in strands]).astype(np.float32)
    rad = np.concatenate([r for _, r in strands]).astype(np.float32)
    c.position_data.foreach_set("vector", pos.ravel())
    attr = c.attributes.get("radius") or c.attributes.new("radius", "FLOAT", "POINT")
    attr.data.foreach_set("value", rad)
    c.materials.append(material)
    return link(bpy.data.objects.new(name, c))


def rng(seed):
    return random.Random(seed)
