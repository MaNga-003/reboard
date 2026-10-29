# 8. bölümün zaman eğrisi için sonda (scripts/story-pace.mjs çalıştırır): aynı sahne, log genişlikte eşit adımlı
# kareler, düşük çözünürlükte. Kare çiftlerinin farkı (M-10) bu karelerden kestirilir; s8_earth.PACE buna göre seçilir.
#   blender -b --factory-startup -P story/blender/pace_probe.py -- --aspect d --frames 87 --out story/cache/pace
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import lib  # noqa: E402
import s8_earth  # noqa: E402


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--aspect", choices=["d", "m"], default="d")
    p.add_argument("--frames", type=int, default=87)
    p.add_argument("--out", default=os.path.join(lib.ROOT, "story", "cache", "pace"))
    args = p.parse_args(argv)
    # Küçük resim masaüstünde 32, mobilde 9 piksel: çeyrek çözünürlük ve az örnek yeter.
    lib.QUALITY["probe"] = (16, 0.1, 25)
    cfg = lib.Cfg(args.aspect, "probe", args.out)
    outdir = os.path.join(args.out, args.aspect)
    os.makedirs(outdir, exist_ok=True)
    # Her kare anahtarlansın (mobilde frame_step 2 olsa da): tek sayıda kare, yol n = kare − 1 adım.
    n = args.frames - 1 if args.frames % 2 else args.frames
    s8_earth.PACE[args.aspect] = tuple(i / n for i in range(n + 1))
    s8_earth.soft_k = lambda *a: 0.0  # doğrusal tablo kesme denetimini geçsin (lib.soft(t, 0) = t)
    lib.reset()
    f0 = 210
    s8_earth.build(cfg, f0, f0 + n)
    sc = bpy.context.scene
    for f in range(f0, f0 + n + 1):
        t1 = time.time()
        sc.frame_set(f)
        sc.render.filepath = os.path.join(outdir, f"f_{f:04d}.png")
        bpy.ops.render.render(write_still=True)
        print(f"P {args.aspect} {f} {time.time() - t1:.1f}s", flush=True)
    with open(os.path.join(outdir, "probe.json"), "w", encoding="utf-8") as fh:
        w0, w1 = s8_earth.s7.END[args.aspect][1], s8_earth.end_width(args.aspect)
        json.dump({"aspect": args.aspect, "f0": f0, "steps": n, "w0": w0, "w1": w1}, fh)


main()
