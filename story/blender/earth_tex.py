# 8. bölümün yer dokuları yüklenmeden önce bir kez düzeltilir (önbellek: story/cache/imagery/graded, git dışı).
# 1. Açık deniz tek tona çekilir. Kaynakta Sentinel-2 kıyı şeridinin (~20 km) dışı düz bir dolgudur (24, 44, 76);
#    dolgunun ve şeridin sınırı, şerit dikişleri ve kıyı halkaları uzaktan yama gibi görünür. Kıyıya yakın su olduğu
#    gibi kalır (sığlık, akıntı izi); kıyıdan uzaklaştıkça şeridin açık su tonuna (SEA) geçer.
# 2. Görünüm dönüşümünün tam tersi: gölgelendiricinin kanal başına eğrisi yalnız gri ekseni çevirir, AgX kanalları
#    karıştırdığı için doygun renkte ton kayar (çöl −23°, deniz −9°; M-31). Dokunun her rengi, eğriden ve AgX'ten
#    geçince kaynaktaki rengi verecek değere çözülür (ölçülen 65³ tablo üzerinde sabit nokta yinelemesi).
import hashlib
import itertools
import os

import bpy
import numpy as np

VERSION = 1
# Sentinel-2 şeridinde açık su: z10'da dolgu dışındaki suyun en sık tonları (16,30,56), (14,28,54), (18,32,58);
# küresel katmanın okyanusu (16,28,50). 2026-10-29 ölçümü.
SEA = (16, 30, 56)
FILL = (24, 44, 76)  # z7–z13'te açık deniz dolgusu (z9'da suyun %56'sı); kıyıda bile kalmaz
SEA_SIGMA_KM = 3.0  # kıyı bandı: ~4 km'ye kadar kaynak, ~9 km'den sonra SEA
LUT_N = 65  # eğrinin düğümleriyle aynı ızgara (0, 1/64, …, 1)
ITERATIONS = 12
DARKEN = (1.0, 0.92, 0.84, 0.76, 0.68, 0.6, 0.52)  # ulaşılamayan renkte denenen ışık oranları
TOLERANCE = 0.002  # OKLab ΔE; altında kalan renk için koyulaştırma denenmez


def is_sea(s):
    """Deniz ailesindeki pikseller (8 bit): şerit, dolgu, küresel okyanus, güneş parlamasıyla grileşmiş karolar
    (z6'da Girit ve Libya açıkları: 27,38,57 … 47,55,73) ve adaların güneyindeki koyu derin su (9,18,37 …
    16,27,45). Turkuaz ya da yeşil göl, bulanık kıyı suyu, gölge ve orman dışarıda kalır; karada kalan tek tük
    mavi piksel kıyı bandında korunur."""
    r, g, b = (s[..., k].astype(np.int16) for k in range(3))
    return (r <= 52) & (g >= 12) & (g <= 66) & (b >= 28) & (b <= 100) & (b - g >= 10) & (g - r >= 5)


def _box(a, r, axis):
    """Kenarı uzatılmış kutu bulanıklığı (yarıçap r, kümülatif toplamla; süre r'den bağımsız)."""
    n = a.shape[axis]
    pad = [(0, 0)] * a.ndim
    pad[axis] = (r + 1, r)
    c = np.cumsum(np.pad(a, pad, mode="edge"), axis=axis, dtype=np.float64)
    hi = np.take(c, np.arange(2 * r + 1, n + 2 * r + 1), axis=axis)
    lo = np.take(c, np.arange(n), axis=axis)
    return ((hi - lo) / (2 * r + 1)).astype(np.float32)


def _gauss(a, rx, ry):
    """Üç geçişli kutu ≈ Gauss (σ ≈ r)."""
    for _ in range(3):
        a = _box(_box(a, rx, 1), ry, 0)
    return a


def _smoothstep(x, lo, hi):
    t = np.clip((x - lo) / (hi - lo), 0.0, 1.0)
    return t * t * (3 - 2 * t)


def unify_sea(s, spec):
    """s: (h, w, 3) uint8. Kıyıdan uzak deniz SEA olur; kara kesrinin Gauss ortalaması kıyıya uzaklığı verir."""
    h, w, _ = s.shape
    lat_mid = np.radians((spec["lat0"] + spec["lat1"]) / 2)
    kx = (spec["lon1"] - spec["lon0"]) * 111.32 * max(np.cos(lat_mid), 0.2) / w
    ky = (spec["lat1"] - spec["lat0"]) * 110.95 / h
    sea = is_sea(s)
    land = _gauss((~sea).astype(np.float32), max(1, round(SEA_SIGMA_KM / kx)), max(1, round(SEA_SIGMA_KM / ky)))
    keep = _smoothstep(land, 0.002, 0.1)
    keep[np.all(np.abs(s.astype(np.int16) - FILL) <= 3, axis=-1)] = 0.0
    keep = np.where(sea, keep, 1.0)
    replaced = float((keep < 0.5).mean())
    # Yerinde: küresel katman 33 milyon piksel, ara diziler belleği doldurmasın.
    out = s.astype(np.float32)
    out -= SEA
    out *= keep[..., None]
    out += np.array(SEA, np.float32) + 0.5
    return np.clip(out, 0, 255).astype(np.uint8), float(sea.mean()), replaced


def forward_lut(view, curve, lo, hi):
    """G(d): dokudaki değer d → ekranda görünen renk (eğri, 2^…, AgX), düz zeminde ışık × GAIN = 1 iken."""
    g = np.linspace(0.0, 1.0, LUT_N)
    d = np.stack(np.meshgrid(g, g, g, indexing="ij"), -1).reshape(-1, 3)
    return view(np.exp2(curve(d) * (hi - lo) + lo)).reshape(LUT_N, LUT_N, LUT_N, 3)


def _trilinear(lut, d):
    n = lut.shape[0] - 1
    x = np.clip(d, 0.0, 1.0) * n
    i = np.minimum(x.astype(np.int32), n - 1)
    f = x - i
    out = np.zeros_like(d)
    for c in itertools.product((0, 1), repeat=3):
        wgt = np.prod([f[:, k] if c[k] else 1 - f[:, k] for k in range(3)], axis=0)
        out += wgt[:, None] * lut[i[:, 0] + c[0], i[:, 1] + c[1], i[:, 2] + c[2]]
    return out


def decode(s):
    return np.where(s <= 0.04045, s / 12.92, ((s + 0.055) / 1.055) ** 2.4)


def encode(lin):
    lin = np.maximum(lin, 0.0)
    return np.where(lin <= 0.0031308, 12.92 * lin, 1.055 * lin ** (1 / 2.4) - 0.055)


def oklab(lin):
    lms = np.cbrt(np.maximum(lin, 0.0) @ np.array([[0.4122214708, 0.2119034982, 0.0883024619],
                                                    [0.5363325363, 0.6806995451, 0.2817188376],
                                                    [0.0514459929, 0.1073969566, 0.6299787005]]))
    return lms @ np.array([[0.2104542553, 1.9779984951, 0.0259040371],
                           [0.7936177850, -2.4285922050, 0.7827717662],
                           [-0.0040720468, 0.4505937099, -0.8086757660]])


def _fixed_point(want, lut):
    d = want.copy()
    for _ in range(ITERATIONS):
        d = np.clip(d + (want - _trilinear(lut, d)), 0.0, 1.0)
    return d


def invert(s, lut):
    """s: (n, 3) uint8 kaynak rengi → dokuya yazılacak uint8 değer. Benzersiz renkler çözülür, geri dağıtılır.
    AgX en parlak bölgede doygun renk veremez (beyaza giden yol: tepede en sarı ton 255, 255, 238); ulaşılamayan
    renkte hedef doğrusal ışıkta adım adım koyulaştırılır, kaynağa OKLab ΔE'si en küçük olan seçilir. Kanal başına
    çözüm (d = s) de adaydır: hiçbir renk düzeltmesizden kötü olmaz. Dönüş: değer, renk sayısı, piksel ağırlıklı ΔE
    ortalaması ve %99'u."""
    key = (s[:, 0].astype(np.int32) << 16) | (s[:, 1].astype(np.int32) << 8) | s[:, 2]
    u, inv, cnt = np.unique(key, return_inverse=True, return_counts=True)
    want = np.stack([u >> 16, (u >> 8) & 255, u & 255], -1) / 255.0
    target = oklab(decode(want))

    def de(d, idx):
        return np.linalg.norm(oklab(decode(_trilinear(lut, d))) - target[idx], axis=1)

    every = np.arange(len(u))
    best = want.copy()
    err = de(best, every)
    for k in DARKEN:
        bad = np.flatnonzero(err > TOLERANCE)
        if not len(bad):
            break
        d = _fixed_point(encode(decode(want[bad]) * k), lut)
        e = de(d, bad)
        better = e < err[bad]
        best[bad[better]], err[bad[better]] = d[better], e[better]
    w = cnt / cnt.sum()
    order = np.argsort(err)
    p99 = err[order][np.searchsorted(np.cumsum(w[order]), 0.99)]
    return (best * 255 + 0.5).astype(np.uint8)[inv.ravel()], len(u), float(np.sum(w * err)), float(p99)


def _read(path):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = "Non-Color"
    w, h = img.size
    px = np.empty(w * h * 4, np.float32)
    img.pixels.foreach_get(px)
    bpy.data.images.remove(img)
    return (px.reshape(h, w, 4)[..., :3] * 255 + 0.5).astype(np.uint8)


def _write(path, rgb):
    h, w, _ = rgb.shape
    img = bpy.data.images.new("Graded", w, h, alpha=False)
    img.colorspace_settings.name = "Non-Color"
    px = np.ones((h, w, 4), np.float32)
    px[..., :3] = rgb / 255.0
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = "PNG"
    img.save()
    bpy.data.images.remove(img)


def graded(spec, src, lut):
    """Düzeltilmiş dokunun yolu; yoksa üretir. Anahtar: kaynak, deniz ayarları ve ölçülen tablo."""
    key = hashlib.sha1()
    with open(src, "rb") as fh:
        key.update(fh.read())
    key.update(repr((VERSION, SEA, FILL, SEA_SIGMA_KM, ITERATIONS, DARKEN, TOLERANCE, spec["lon0"], spec["lon1"],
                     spec["lat0"], spec["lat1"])).encode())
    key.update(np.round(lut, 5).tobytes())
    out_dir = os.path.join(os.path.dirname(src), "graded")
    path = os.path.join(out_dir, f"{spec['name']}.{key.hexdigest()[:12]}.png")
    if os.path.exists(path):
        return path
    os.makedirs(out_dir, exist_ok=True)
    s = _read(src)
    s, sea, replaced = unify_sea(s, spec)
    h, w, _ = s.shape
    d, colours, mean, p99 = invert(s.reshape(-1, 3), lut)
    _write(path, d.reshape(h, w, 3))
    print(f"S8 graded {spec['name']} {w}x{h} deniz %{100 * sea:.1f} tek tona %{100 * replaced:.1f} "
          f"renk {colours} ΔE ortalama {mean:.4f} p99 {p99:.4f}")
    return path
