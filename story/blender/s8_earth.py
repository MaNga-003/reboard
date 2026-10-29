# 8. bölüm: Antalya, Türkiye, Dünya (birim mm). 7. bölümün son karesinden aynı sahnede dikine yükselir: mahalle,
# Aksu'nun tarlaları, Antalya körfezi, Türkiye ve uzayda Dünya. Ev gerçek bir noktaya (manifest "home") oturur;
# 7. bölümün genel zemini Dünya küresinin yüzeyine dönüşür, mahalle 1,5–2 km'lik bir yerleşime büyür. Yer dokuları
# scripts/story-imagery.mjs'ten gelir (EOX Sentinel-2 cloudless 2016, iç içe düzeyler; künye orada).
import json
import math
import os
import tempfile
import types

import bpy
import numpy as np
from mathutils import Vector

import earth_tex
import house
import lib
import s6_panel as s6
import s7_house as s7
import town

IMAGERY = os.path.join(lib.ROOT, "story", "cache", "imagery")
R = 6.371e9  # Dünya'nın ortalama yarıçapı
HOME_XY = ((house.HOUSE[0] + house.HOUSE[1]) / 2, (house.HOUSE[2] + house.HOUSE[3]) / 2)
SURFACE = town.GROUND - 1800.0  # 7. bölümün genel zemininin yüksekliği: havuz tabanlarının altında
# Son karede kürenin çapı, kadrajın kısa kenarına oranla. Metin kartı masaüstünde sol altta, mobilde altta durur.
GLOBE = {"d": 0.62, "m": 0.84}
# 90°'de TRACK_TO'nun yukarı ekseni (Y) bakışla çakışır. Açı log genişlik yolunun ilk %40'ında (~9 km'ye kadar)
# kurulur: kadraj genişliğine bağlı, böylece zaman eğrisi değişince aynı genişlikte aynı görüntü kalır.
EL_END, EL_T = 89.5, 0.4
# Kare başına log genişlik payı (0 → 1), anahtarlanan her kare için (masaüstü 210–239, mobil 210–238). İlk adım
# 7. bölümün son zoom hızını sürdürür, son adım küreye yavaşça oturur: ikisi de eski lib.soft eğrisinin adımıdır
# (camera_path denetler). Aradakiler fark dizisi (M-10) pürüzsüz kalacak biçimde ölçülerek seçildi: log genişlikte
# eşit adımlı düşük çözünürlüklü bir sondadan her kare çiftinin farkı kestirildi (eski eğride kestirim ×1,38 ve
# ×1,71; final dizide ölçülen ×1,39 ve ×1,77); fark dizisinin ve zoom hızının ikinci farkları en aza indirildi.
# Yerleşimin silindiği 2–15 km'de ve Sahra'nın girdiği 1000–4000 km'de zoom yavaşlar, ev ızgarasında (fark
# küçük) hızlanır. Mobil yalnız çift kareleri gösterir; tek karelerde değer iki komşunun ortasıdır.
PACE = {
    "d": (0.00000, 0.00925, 0.02524, 0.04779, 0.07494, 0.10436, 0.13592, 0.17047, 0.21085, 0.25303, 0.29884,
          0.34401, 0.38704, 0.43673, 0.48563, 0.53979, 0.58964, 0.63942, 0.68652, 0.73192, 0.77008, 0.79988,
          0.82837, 0.86206, 0.89491, 0.92511, 0.95296, 0.97497, 0.99075, 1.00000),
    "m": (0.00000, 0.01336, 0.02672, 0.04613, 0.06554, 0.10831, 0.15107, 0.20357, 0.25607, 0.30374, 0.35142,
          0.39332, 0.43522, 0.48232, 0.52942, 0.58105, 0.63268, 0.67676, 0.72085, 0.75403, 0.78722, 0.82565,
          0.86409, 0.89577, 0.92745, 0.95036, 0.97328, 0.98664, 1.00000),
}
# Gökyüzü ışığı söner, güneş beyazlaşır; kadraj genişliğine göre (logaritmik, yumuşak). Gölgeler 30 km'de piksel
# altına iner; gece yarısı kadraja ~7000 km'de girer, o zamana gökyüzü sönmüş olur.
SKY_W = (3.0e7, 1.5e9)
# Kürede ışığın en güçlü olduğu yer evde değil, güneşin dik geldiği noktadadır (evde cos i = 0,70; orada 1,42 kat).
# Kadraj 1000 km'den 10.000 km'ye büyürken pozlama oraya geçer: çöl AgX'in omzunda beyaza ve pembeye kaçmaz.
GLOBE_W = (1.0e9, 1.0e10)
# Yerleşim kadraj 2 km'den 15 km'ye büyürken kenarından içe doğru saydamlaşır, altındaki uydu görüntüsü görünür
# (25 km'de 3 km'lik gri leke kalmaz; ev 15 km'de 2 piksel). Kenar yumuşaklığı VILLAGE_SOFT.
VILLAGE_FADE_W = (2.0e6, 1.5e7)
FEATHER = 0.08  # yama kenarında yumuşak geçiş (yamanın kenar uzunluğuna oranla)
# Görüntü ekranda kaynağıyla aynı görünsün: doku görünüm dönüşümünün (AgX) tersinden geçer, düz zeminde ışık × GAIN = 1.
# Işık düz zeminde albedoyu 1,232 ile çarpar (7. bölümün güneşi + göğü, rampa sonrası beyaz güneş; M-31).
GAIN = 1.0 / 1.232
LOG2_LIN = (-14.0, 4.0)  # görünüm dönüşümünün ölçüldüğü doğrusal aralık (log2): siyahın altından beyazın ötesine
ATMOSPHERE = (60.0e6, 2.5, "Pale King's Blue")  # kabuk yüksekliği, ışıma gücü, renk
SPACE = ("Deep Indigo", "Dull Violet Black", 1.0)  # DESIGN_SYSTEM: uzay finali; kürenin çevresinden köşelere
VILLAGE_R = 1.6e6  # yerleşimin ortalama yarıçapı
VILLAGE_EVERY = 8  # her 8 parsel sütununda bir kuzey–güney sokağı
VILLAGE_SOFT = 0.4 * VILLAGE_R


# --- Kamera ---

def end_width(aspect):
    """Kürenin çapı GLOBE oranını tutacak kadraj genişliği (hedef uzaklığında). Lens 100, sensör 36: yarım görüş
    açısının tanjantı 0,18; uzun kenar 1920 px, kısa kenar 1080 px (iki en-boy oranında da)."""
    tan_a = GLOBE[aspect] * 540.0 / 960.0 * 0.18
    dist = R / math.sin(math.atan(tan_a)) - R
    return dist * 36.0 / 100.0


def soft_k(aspect, frames, w0, w1):
    """7. bölümün son karesindeki zoom hızı (log genişlik / kare) 8. bölümün ilk karesinde aynen sürer."""
    rate = (1 - s7.SOFT) * math.log(s7.END[aspect][1] / s6.END[aspect][2]) / frames
    return 1.0 - rate * frames / math.log(w1 / w0)


def camera_path(cam, cfg, f0, f1):
    el0, w0, g = s7.END[cfg.aspect]
    g = Vector(g)
    w1 = end_width(cfg.aspect)
    pace = PACE[cfg.aspect]
    n = f1 - f0
    if len(pace) != n + 1:
        raise SystemExit(f"PACE[{cfg.aspect}] {len(pace)} kare, yol {n + 1} kare")
    # Kesmedeki ve sondaki gösterilen adım lib.soft eğrisininkiyle aynı kalmalı (7. bölüm değişirse burada düşer).
    k, s = soft_k(cfg.aspect, n, w0, w1), (2 if cfg.portrait else 1)
    for i in (s, n - s):
        if abs(pace[i] - lib.soft(i / n, k)) > 1e-4:
            raise SystemExit(f"PACE[{cfg.aspect}][{i}] {pace[i]:.5f}, kesme hızı {lib.soft(i / n, k):.5f} ister")

    def u(t):
        x = t * n
        i = min(int(x), n - 1)
        return lib.lerp(pace[i], pace[i + 1], x - i)

    def width(t):
        return lib.expo(w0, w1, u(t))

    def path(t):
        el = lib.lerp(el0, EL_END, lib.smooth(min(1.0, u(t) / EL_T)))
        return lib.orbit(g, lib.dist_for_width(cam, width(t)), 270.0, el), g

    def fstop(t):
        return 0.1 / (2 * s7.END_K * width(t))

    lib.fly(cam, cam.constraints[0].target, f0, f1, path, fstop)
    return width


# --- Yer ---

def manifest():
    path = os.path.join(IMAGERY, "manifest.json")
    if not os.path.exists(path):
        raise SystemExit(f"Yer dokuları yok: {path}. Önce `node scripts/story-imagery.mjs` çalıştırın.")
    with open(path, encoding="utf-8") as fh:
        return json.load(fh)


def ring_angles(first=2e-6, grow=2 ** (1 / 12), step=0.008):
    """Evden açısal uzaklık (radyan): yakında geometrik (1 km'de 50 m, 100 km'de 6 km aralık), uzakta 51 km'de bir.
    Kutbu evde olan bir UV küresi: tek ağ hem 1 km'lik hem 30.000 km'lik kadrajda yeterince ince."""
    out, t = [], first
    while t * (grow - 1) < step:
        out.append(t)
        t *= grow
    while t < math.pi - step / 2:
        out.append(t)
        t += step
    return np.array(out)


def frame_at(home):
    """Evin noktasında yerel eksenlerin dünya merkezli birim vektörleri: yukarı, doğu, kuzey."""
    lon, lat = math.radians(home["lon"]), math.radians(home["lat"])
    up = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    east = np.array([-math.sin(lon), math.cos(lon), 0.0])
    return up, east, np.cross(up, east)


def globe(man, material, segments=512):
    """Dünya küresi. Nesnenin kökü evin noktasında (yerel koordinat evde küçük: float32 hassasiyeti orada santimetre
    düzeyinde). Her köşe dünya merkezli birim yönünü (`geo`) taşır; enlem ve boylam gölgelendiricide hesaplanır
    (köşe başına UV kutupta ve 180. boylamda bozulurdu)."""
    up, east, north = frame_at(man["home"])
    th = ring_angles()
    ps = np.arange(segments) * (2 * math.pi / segments)
    st, ct = np.sin(th)[:, None], np.cos(th)[:, None]
    dx, dy = st * np.sin(ps)[None, :], st * np.cos(ps)[None, :]
    dz = np.broadcast_to(ct, dx.shape)
    # Yerel konum: x doğu, y kuzey, z yukarı; cos θ − 1 küçük açıda −2 sin²(θ/2) ile hassas.
    drop = np.broadcast_to(-2 * np.sin(th / 2)[:, None] ** 2, dx.shape)
    co = np.concatenate([[[0.0, 0.0, 0.0]], np.stack([dx, dy, drop], -1).reshape(-1, 3) * R, [[0.0, 0.0, -2 * R]]])
    geo = np.concatenate([[up], (dx[..., None] * east + dy[..., None] * north + dz[..., None] * up).reshape(-1, 3), [-up]])
    n, k = len(th), segments
    j = np.arange(k)
    faces = [(0, 1 + (i + 1) % k, 1 + i) for i in j]
    for r in range(n - 1):
        a, b = 1 + r * k, 1 + (r + 1) * k
        faces += [(a + i, a + (i + 1) % k, b + (i + 1) % k, b + i) for i in j]
    last = 1 + (n - 1) * k
    faces += [(last + i, last + (i + 1) % k, len(co) - 1) for i in j]
    me = bpy.data.meshes.new("Earth")
    me.from_pydata(co.tolist(), [], faces)
    me.attributes.new("geo", "FLOAT_VECTOR", "POINT").data.foreach_set("vector", geo.astype(np.float32).ravel())
    me.polygons.foreach_set("use_smooth", np.ones(len(faces), bool))
    me.update()
    me.materials.append(material)
    o = lib.link(bpy.data.objects.new("Earth", me))
    o.location = (*HOME_XY, SURFACE)
    return o


# --- Görünüm dönüşümü (AgX): ekranda görünen renk ölçülür, render etmeden ---

def view(lin):
    """Doğrusal renkler (n, 3) → ekranda görünen sRGB (n, 3), sahnenin görünüm ayarlarıyla (AgX, bakış, pozlama).
    Renkler kayan noktalı bir görüntüye yazılır, save_render 16 bit PNG'ye görünüm dönüşümünü uygular, ham okunur."""
    sc = bpy.context.scene
    lin = np.asarray(lin, np.float32).reshape(-1, 3)
    w = min(len(lin), 4096)
    h = -(-len(lin) // w)
    px = np.ones((w * h, 4), np.float32)
    px[: len(lin), :3] = lin
    img = bpy.data.images.new("ViewProbe", w, h, float_buffer=True, alpha=False)
    img.colorspace_settings.name = "Linear Rec.709"
    img.pixels.foreach_set(px.ravel())
    fmt = sc.render.image_settings
    keep = fmt.file_format, fmt.color_mode, fmt.color_depth
    fmt.file_format, fmt.color_mode, fmt.color_depth = "PNG", "RGB", "16"
    with tempfile.TemporaryDirectory() as tmp:
        path = os.path.join(tmp, "view.png")
        img.save_render(path, scene=sc)
        back = bpy.data.images.load(path)
        back.colorspace_settings.name = "Non-Color"
        buf = np.empty(w * h * 4, np.float32)
        back.pixels.foreach_get(buf)
        bpy.data.images.remove(back)
    fmt.file_format, fmt.color_mode, fmt.color_depth = keep
    bpy.data.images.remove(img)
    return buf.reshape(-1, 4)[: len(lin), :3].astype(np.float64)


_oklab, _decode = earth_tex.oklab, earth_tex.decode


def on_screen(name):
    """Wada rengini ekranda hex'iyle göstermek için gereken doğrusal renk ve kalan OKLab ΔE. AgX koyu ve doygun
    rengi değiştirir (Deep Indigo doğrudan verilince ekranda ΔE ≈ 0,05 koyu). Log uzayda iki adımlı ızgara araması."""
    want = np.array(lib.rgba(name)[:3])
    target = _oklab(want)
    x = np.log2(np.maximum(want, 1e-5))
    for span, k in ((4.0, 41), (0.2, 21)):
        g = np.linspace(-span, span, k)
        cand = np.stack(np.meshgrid(x[0] + g, x[1] + g, x[2] + g, indexing="ij"), -1).reshape(-1, 3)
        de = np.linalg.norm(_oklab(_decode(view(np.exp2(cand)))) - target, axis=1)
        x = cand[np.argmin(de)]
    return (*(float(v) for v in np.exp2(x)), 1.0), float(de.min())


_GREY = {}


def grey_curve():
    """Görünüm dönüşümünün gri eksendeki tersi, 65 düğüm: ekran değeri → log2 doğrusal (0–1'e sıkıştırılmış).
    Ölçülür (doğrusal rampa → view); düğümler arası doğrusal (VECTOR tutamaç), np.interp ile aynı."""
    if not _GREY:
        lo, hi = LOG2_LIN
        lin = np.exp2(np.linspace(lo, hi, 512))
        shown = view(np.repeat(lin[:, None], 3, axis=1))[:, 1]
        _GREY["xs"] = np.linspace(0.0, 1.0, 65)
        _GREY["ts"] = (np.interp(_GREY["xs"], shown, np.log2(lin)) - lo) / (hi - lo)
    return _GREY["xs"], _GREY["ts"]


def view_curve(n, col):
    """Doku ekranda kaynağıyla aynı görünsün: ekran değeri (0–1) görünüm dönüşümünün gri eksendeki tersinden geçer.
    Eğri log2 girişi 0–1'e sıkıştırılmış tutar; Cycles 256 adımlık tabloyla değerlendirir. GAIN üstelde: çıkış
    2^(…) × GAIN. Kanallar arası karışımı dokunun kendisi taşır (earth_tex)."""
    lo, hi = LOG2_LIN
    xs, ts = grey_curve()
    cu = n.nodes.new("ShaderNodeRGBCurve")
    for c in cu.mapping.curves[:3]:
        c.points[0].location = (xs[0], ts[0])
        c.points[1].location = (xs[-1], ts[-1])
        for x, t in zip(xs[1:-1], ts[1:-1]):
            c.points.new(float(x), float(t))
        for p in c.points:
            p.handle_type = "VECTOR"
    cu.mapping.update()
    n.link(col, cu.inputs["Color"])
    sep = n.nodes.new("ShaderNodeSeparateColor")
    n.link(cu.outputs["Color"], sep.inputs["Color"])
    comb = n.nodes.new("ShaderNodeCombineColor")
    for ch in ("Red", "Green", "Blue"):
        e = n.math("MULTIPLY_ADD", sep.outputs[ch], hi - lo, lo + math.log2(GAIN))
        n.link(n.math("POWER", 2.0, e), comb.inputs[ch])
    return comb.outputs["Color"]


def layer(n, lon, lat, spec, lut, extension="EXTEND"):
    """Eşdikdörtgen bir doku: (boylam, enlem) → UV; kenarda FEATHER genişliğinde yumuşak maske."""
    a, b, c, d = spec["lon0"], spec["lon1"], spec["lat0"], spec["lat1"]
    u = n.math("MULTIPLY_ADD", lon, 1 / (b - a), -a / (b - a))
    v = n.math("MULTIPLY_ADD", lat, 1 / (d - c), -c / (d - c))
    uv = n.nodes.new("ShaderNodeCombineXYZ")
    n.link(u, uv.inputs["X"])
    n.link(v, uv.inputs["Y"])
    tex = n.nodes.new("ShaderNodeTexImage")
    tex.image = bpy.data.images.load(earth_tex.graded(spec, os.path.join(IMAGERY, spec["file"]), lut))
    tex.image.colorspace_settings.name = "Non-Color"  # ekran değeri; view_curve doğrusala çevirir
    tex.interpolation = "Cubic"
    tex.extension = extension
    n.link(uv.outputs[0], tex.inputs["Vector"])
    edge = n.math("MINIMUM", n.math("MINIMUM", u, n.math("SUBTRACT", 1.0, u)),
                  n.math("MINIMUM", v, n.math("SUBTRACT", 1.0, v)))
    return tex.outputs["Color"], n.ramp(edge, 0.0, FEATHER)


def earth_material(man):
    """Küresel mozaiğin üstünde evin çevresindeki yamalar iç içe: ince olan kabanın üstünde, kenarı yumuşak. Hepsi
    aynı mozaikten (story-imagery.mjs), ton tutarlı; kadrajda yalnız çözünürlük değişir. Renk albedo gibi ışıkla
    çarpılır; gece yarısı kararır. Parlak çölde albedo 1'i aşar: Cycles kırpmaz, OIDN bozmaz (ölçüm, M-31)."""
    m, out, n = lib.surface_only("Earth")
    attr = n.nodes.new("ShaderNodeAttribute")
    attr.attribute_name = "geo"
    unit = n.nodes.new("ShaderNodeVectorMath")
    unit.operation = "NORMALIZE"
    n.link(attr.outputs["Vector"], unit.inputs[0])
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(unit.outputs[0], sep.inputs["Vector"])
    deg = 180.0 / math.pi
    lat = n.math("MULTIPLY", n.math("ARCSINE", sep.outputs["Z"]), deg)
    lon = n.math("MULTIPLY", n.math("ARCTAN2", sep.outputs["Y"], sep.outputs["X"]), deg)
    layers = {s["name"]: s for s in man["layers"]}
    xs, ts = grey_curve()
    lut = earth_tex.forward_lut(view, lambda d: np.interp(d, xs, ts), *LOG2_LIN)
    col, _ = layer(n, lon, lat, layers["eox_global"], lut, "REPEAT")
    for spec in sorted((s for s in man["layers"] if s["name"].startswith("eox_z")), key=lambda s: int(s["name"][5:])):
        c, mask = layer(n, lon, lat, spec, lut)
        col = n.mix(mask, col, c)
    bsdf = n.nodes.new("ShaderNodeBsdfDiffuse")
    n.link(view_curve(n, col), bsdf.inputs["Color"])
    n.link(bsdf.outputs[0], out.inputs["Surface"])
    return m


def atmosphere():
    """İnce atmosfer kabuğu (yalnız kamera görür, ışık ve gölge vermez): kenara bakan yüzde (Layer Weight)
    parlar, gece yarısında söner. Kamera kabuğun içindeyken aşağı bakan ışın kabuğa hiç değmez; geçişte bakış
    kabuğa dik olduğu için katkısı sıfıra yakındır, kesik görünmez."""
    h, power, colour = ATMOSPHERE
    m, out, n = lib.surface_only("Atmosphere")
    lw = n.new("ShaderNodeLayerWeight", Blend=0.5)
    rim = n.math("POWER", lw.outputs["Facing"], 6.0)
    geo = n.nodes.new("ShaderNodeNewGeometry")
    dot = n.nodes.new("ShaderNodeVectorMath")
    dot.operation = "DOT_PRODUCT"
    n.link(geo.outputs["Normal"], dot.inputs[0])
    dot.inputs[1].default_value = Vector(house.SUN).normalized()
    day = n.ramp(dot.outputs["Value"], -0.25, 0.35)
    em = n.new("ShaderNodeEmission")
    em.inputs["Color"].default_value = lib.rgba(colour)
    n.link(n.math("MULTIPLY", n.math("MULTIPLY", rim, day), power), em.inputs["Strength"])
    tr = n.nodes.new("ShaderNodeBsdfTransparent")
    add = n.nodes.new("ShaderNodeAddShader")
    n.link(tr.outputs[0], add.inputs[0])
    n.link(em.outputs[0], add.inputs[1])
    n.link(add.outputs[0], out.inputs["Surface"])
    o = lib.sphere("Atmosphere", R + h, (*HOME_XY, SURFACE - R), m, segments=256, rings=128)
    for attr in ("visible_diffuse", "visible_glossy", "visible_transmission", "visible_volume_scatter", "visible_shadow"):
        setattr(o, attr, False)
    return o


def sky(cfg):
    """Kamera dışı ışınlar 7. bölümün gökyüzünü görür (gücü yükseldikçe söner); kamera ışınları uzayı: kürenin
    çevresinde Deep Indigo, köşelere doğru Dull Violet Black, ekranda hex'leriyle (on_screen). Merkez lens
    kaydırmasıyla kürenin durduğu yerde."""
    sc = bpy.context.scene
    w = bpy.data.worlds.new("Sky")
    sc.world = w
    w.use_nodes = True
    n = lib.N(w)
    n.nodes.clear()
    out = n.nodes.new("ShaderNodeOutputWorld")
    amb = n.new("ShaderNodeBackground", Color=lib.rgba(house.SKY[0]), Strength=house.SKY[1])
    inner, outer, power = SPACE
    tc = n.nodes.new("ShaderNodeTexCoord")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(tc.outputs["Window"], sep.inputs["Vector"])
    # Pencere koordinatı 0–1; uzaklık uzun kenarın pikseliyle ölçülür (daire daire kalsın).
    cx, cy, ax, ay = (0.63, 0.5, 1.0, 1080 / 1920) if cfg.aspect == "d" else (0.5, 0.62, 1080 / 1920, 1.0)
    dx = n.math("MULTIPLY", n.math("SUBTRACT", sep.outputs["X"], cx), ax)
    dy = n.math("MULTIPLY", n.math("SUBTRACT", sep.outputs["Y"], cy), ay)
    dist = n.math("SQRT", n.math("ADD", n.math("MULTIPLY", dx, dx), n.math("MULTIPLY", dy, dy)))
    bg = n.nodes.new("ShaderNodeBackground")
    (ci, de_i), (co, de_o) = on_screen(inner), on_screen(outer)
    print(f"S8 space_dE {inner}={de_i:.4f} {outer}={de_o:.4f}")
    n.link(n.mix(n.ramp(dist, 0.2, 0.75), ci, co), bg.inputs["Color"])
    bg.inputs["Strength"].default_value = power
    lp = n.nodes.new("ShaderNodeLightPath")
    mix = n.nodes.new("ShaderNodeMixShader")
    n.link(lp.outputs["Is Camera Ray"], mix.inputs["Fac"])
    n.link(amb.outputs[0], mix.inputs[1])
    n.link(bg.outputs[0], mix.inputs[2])
    n.link(mix.outputs[0], out.inputs["Surface"])
    return amb.inputs["Strength"]


def _lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def daylight(sun, ambient, width, f0, f1):
    """Gökyüzü söndükçe güneş beyazlaşır ve güçlenir: düz zemindeki aydınlık (güneş + gök) parlaklıkta sabit kalır.
    7. bölümün gök + güneş toplamı zaten nötre yakın (R:G:B ≈ 1,13 : 1,28 : 1,10), beyaz güneş tonu da korur.
    Cycles'ta dik güneş (güç 1) beyaz yayınık yüzeyi 1/π yapar, gökyüzü (güç 1) 1,0 (ölçüm, M-31)."""
    cos_i = Vector(house.SUN).normalized().z
    warm, white = lib.rgba(house.SUN_POWER[1]), lib.rgba("White")
    sky_lum = house.SKY[1] * _lum(lib.rgba(house.SKY[0]))
    total = house.SUN_POWER[0] * cos_i / math.pi * _lum(warm) + sky_lum

    for f in range(f0, f1 + 1):
        w = width((f - f0) / (f1 - f0))
        s = log_ramp(w, *SKY_W)
        colour = [lib.lerp(a, b, s) for a, b in zip(warm[:3], white[:3])]
        sun.data.color = colour
        sun.data.keyframe_insert("color", frame=f)
        a = house.SKY[1] * (1 - s)
        ambient.default_value = a
        ambient.keyframe_insert("default_value", frame=f)
        exposure = lib.lerp(1.0, cos_i, log_ramp(w, *GLOBE_W))
        sun.data.energy = (total - a * _lum(lib.rgba(house.SKY[0]))) * math.pi / (cos_i * _lum(colour)) * exposure
        sun.data.keyframe_insert("energy", frame=f)


def log_ramp(w, lo, hi):
    """Kadraj genişliği lo'dan hi'ye (logaritmik) büyürken 0'dan 1'e yumuşak geçiş."""
    return lib.smooth(min(1.0, max(0.0, math.log(w / lo) / math.log(hi / lo))))


# --- Yerleşim ---

def col_x(i):
    """Parsel sütunu i'nin batı kenarı. 7. bölümün sokakları −3…4 sütunlarını kapsar; bloklar 8 sütun, aralarında
    kuzey–güney sokağı."""
    return house.PLOT[0] + i * town.PLOT_W + ((i + 3) // VILLAGE_EVERY) * town.STREET


def row_y(j):
    """Parsel sırası j'nin güney kenarı (town.neighbourhood ile aynı düzen)."""
    block, back = divmod(j, 2)
    return house.PLOT[2] + block * town.BLOCK_PITCH + back * town.PLOT_D


def edge_radius(x, y):
    """Yerleşimin sınırı: evden uzaklığa göre dalgalı bir daire (kıyıya ve tarlaya doğru düzensiz yayılır)."""
    a = math.atan2(y - HOME_XY[1], x - HOME_XY[0])
    return VILLAGE_R * (1 + 0.1 * math.sin(2 * a + 0.7) + 0.07 * math.sin(3 * a + 2.1) + 0.05 * math.sin(5 * a + 4.0)
                        + 0.03 * math.sin(9 * a + 1.3))


def place(coll, x, y, rot=0.0, mirror=False):
    e = town.instance(coll, x, y, rot)
    if mirror:
        e.scale = (-1.0, 1.0, 1.0)
    return e


def village(m, seed=8):
    """7. bölümün mahallesi yerleşime büyür: aynı ızgara (parsel, sırt sırta iki sıra, doğu–batı sokağı), her 8
    sütunda bir kuzey–güney sokağı ve kavşak. Hepsi koleksiyon örneği; çeşit için 8 yeni parsel ve aynalama.
    Sınırda parseller seyrekleşir, aralarında Dünya'nın dokusu (tarla) görünür. 7. bölümün hücreleri boş kalır."""
    rs = lib.rng(seed)
    vs = [bpy.data.collections[f"Variant{i}"] for i in range(8)]
    vs += [town.collection_of(f"Plot{i}", town.plot_variant(m, 200 + i)) for i in range(8)]
    W, D, S = town.PLOT_W, town.PLOT_D, town.STREET
    ew = [town.collection_of(f"StreetEW{i}", town.street(m, 0.0, VILLAGE_EVERY * W, 0.0, 40 + i)) for i in range(3)]
    ns = [town.collection_of(f"StreetNS{i}", town.street(m, 0.0, 2 * D, 0.0, 50 + i)) for i in range(3)]
    junction = town.collection_of("Junction", [town.slab("Junction", 0.0, S, -S, 0.0, town.GROUND - 40, town.GROUND + 10,
                                                         m["asphalt"])])
    span = VILLAGE_R * 1.3
    cols = range(-int(span / W) - 1, int(span / W) + 2)
    blocks = range(-int(span / town.BLOCK_PITCH) - 1, int(span / town.BLOCK_PITCH) + 2)
    kmax = cols[-1] // VILLAGE_EVERY + 1
    count = 0
    for b in blocks:
        yb = row_y(2 * b)
        for k in range(-kmax, kmax + 1):
            x0 = col_x(VILLAGE_EVERY * k - 3)
            xs = x0 - S
            for cx, cy, coll, args in ((x0 + VILLAGE_EVERY * W / 2, yb - S / 2, ew, (x0, yb, 0.0)),
                                       (xs + S / 2, yb + D, ns, (xs, yb, math.pi / 2)),
                                       (xs + S / 2, yb - S / 2, [junction], (xs, yb, 0.0))):
                if coll is ew and k == 0 and b in (0, 1):
                    continue  # 7. bölümün sokakları
                if math.hypot(cx - HOME_XY[0], cy - HOME_XY[1]) < 0.95 * edge_radius(cx, cy):
                    place(coll[rs.randrange(len(coll))], *args)
                    count += 1
        for j in (2 * b, 2 * b + 1):
            y = row_y(j)
            for i in cols:
                if -2 <= i <= 3 and -1 <= j <= 1:
                    continue  # 7. bölümün parselleri
                x = col_x(i)
                cx, cy = x + W / 2, y + D / 2
                r = edge_radius(cx, cy)
                p = (1.1 * r - math.hypot(cx - HOME_XY[0], cy - HOME_XY[1])) / (0.25 * r)
                if rs.random() >= p:
                    continue
                mirror = rs.random() < 0.5
                coll = vs[rs.randrange(len(vs))]
                if j % 2:  # arka sıra: döndürülmüş, +Y'deki sokağa bakar
                    place(coll, x if mirror else x + W, y + D, math.pi, mirror)
                else:
                    place(coll, x + W if mirror else x, y, 0.0, mirror)
                count += 1
    return count


def village_fade():
    """Sahnedeki bütün malzemeler (7. bölümün evi ve mahallesi, yerleşim) ortak bir düğüm grubuyla saydamlaşır:
    yüzey noktası evden yatay uzaklığına göre, anahtarlanan yarıçapın (Radius) dışında kalınca. Dünya ve atmosfer
    sonra kurulur, onlara dokunulmaz. Dönüş: yarıçapın soketi."""
    g = bpy.data.node_groups.new("VillageFade", "ShaderNodeTree")
    g.interface.new_socket("Fade", in_out="OUTPUT", socket_type="NodeSocketFloat")
    n = lib.N(types.SimpleNamespace(node_tree=g))
    pos = n.nodes.new("ShaderNodeNewGeometry")
    sep = n.nodes.new("ShaderNodeSeparateXYZ")
    n.link(pos.outputs["Position"], sep.inputs["Vector"])
    dx = n.math("SUBTRACT", sep.outputs["X"], HOME_XY[0])
    dy = n.math("SUBTRACT", sep.outputs["Y"], HOME_XY[1])
    dist = n.math("SQRT", n.math("ADD", n.math("MULTIPLY", dx, dx), n.math("MULTIPLY", dy, dy)))
    radius = n.nodes.new("ShaderNodeValue")
    radius.name = "Radius"
    mr = n.nodes.new("ShaderNodeMapRange")
    mr.interpolation_type = "SMOOTHSTEP"
    n.link(dist, mr.inputs["Value"])
    n.link(n.math("SUBTRACT", radius.outputs[0], VILLAGE_SOFT), mr.inputs["From Min"])
    n.link(radius.outputs[0], mr.inputs["From Max"])
    out = n.nodes.new("NodeGroupOutput")
    n.link(mr.outputs["Result"], out.inputs["Fade"])
    for m in list(bpy.data.materials):
        if not m.use_nodes:
            continue
        nt = m.node_tree
        for o in [x for x in nt.nodes if x.bl_idname == "ShaderNodeOutputMaterial"]:
            sock = o.inputs["Surface"]
            if not sock.is_linked:
                continue
            src = sock.links[0].from_socket
            grp = nt.nodes.new("ShaderNodeGroup")
            grp.node_tree = g
            tr = nt.nodes.new("ShaderNodeBsdfTransparent")
            mix = nt.nodes.new("ShaderNodeMixShader")
            nt.links.new(grp.outputs[0], mix.inputs[0])
            nt.links.new(src, mix.inputs[1])
            nt.links.new(tr.outputs[0], mix.inputs[2])
            nt.links.new(mix.outputs[0], sock)
    return radius.outputs[0]


def key_fade(radius, width, f0, f1):
    """Yarıçap kenardaki en uzak parselin ötesinden (1,4 R + yumuşaklık) sıfıra iner; 0'da her nokta saydam."""
    r0 = 1.4 * VILLAGE_R + VILLAGE_SOFT
    for f in range(f0, f1 + 1):
        radius.default_value = lib.lerp(r0, 0.0, log_ramp(width((f - f0) / (f1 - f0)), *VILLAGE_FADE_W))
        radius.keyframe_insert("default_value", frame=f)


def build(cfg, f0=210, f1=239):
    sc = lib.setup(cfg, f0, f1, exposure=0.0)
    man = manifest()
    _, m = house.build(ground=None)
    n = village(m)
    radius = village_fade()
    globe(man, earth_material(man))
    atmosphere()
    ambient = sky(cfg)
    cam, _ = lib.camera(cfg, lens=100, fstop=2.0, clip=(1.0, 1.0e12))
    # Son kadraj son render edilen karede kurulur: mobil yalnız çift kareleri işler (238), 239 onu tutar.
    last = f0 + (f1 - f0) // sc.frame_step * sc.frame_step
    width = camera_path(cam, cfg, f0, last)
    daylight(bpy.data.objects["Sun"], ambient, width, f0, last)
    key_fade(radius, width, f0, last)
    print(f"S8 instances={n} objects={len(bpy.data.objects)} end_width_km={width(1.0) / 1e6:.0f}")
    return {}
