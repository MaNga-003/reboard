# Hikâye karelerini üretir. Kullanım:
#   blender -b --factory-startup -P story/blender/build.py -- --aspect d --quality final --sections 1-8
#   --frames 0,15,29 yalnızca bu kareleri (bölüm içi sıra) render eder; --out çıktı klasörü.
import argparse
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import bpy  # noqa: E402

import lib  # noqa: E402

MODULES = {
    1: "s1_fibre",
    2: "s2_scraps",
    3: "s3_weighing",
    4: "s4_shred",
}


def parse():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument("--aspect", choices=["d", "m"], default="d")
    p.add_argument("--quality", choices=list(lib.QUALITY), default="preview")
    p.add_argument("--sections", default="1-8")
    p.add_argument("--frames", default="")
    p.add_argument("--out", default=os.path.join(lib.ROOT, "story", "out"))
    p.add_argument("--blend", action="store_true", help="sahneyi .blend olarak da kaydet (inceleme için)")
    return p.parse_args(argv)


def section_list(spec):
    out = []
    for part in spec.split(","):
        if "-" in part:
            a, b = part.split("-")
            out.extend(range(int(a), int(b) + 1))
        else:
            out.append(int(part))
    return [s for s in out if s in MODULES]


def main():
    args = parse()
    cfg = lib.Cfg(args.aspect, args.quality, args.out)
    outdir = os.path.join(args.out, args.aspect)
    os.makedirs(outdir, exist_ok=True)
    for sec in section_list(args.sections):
        mod = __import__(MODULES[sec])
        f0 = (sec - 1) * lib.FRAMES_PER_SECTION
        f1 = f0 + lib.FRAMES_PER_SECTION - 1
        lib.reset()
        t0 = time.time()
        mod.build(cfg, f0, f1)
        print(f"S{sec} build {time.time() - t0:.1f}s")
        sc = bpy.context.scene
        if args.blend:
            bpy.ops.wm.save_as_mainfile(filepath=os.path.join(outdir, f"s{sec}.blend"))
        if args.frames:
            frames = [f0 + int(x) for x in args.frames.split(",")]
        else:
            frames = list(range(f0, f1 + 1, sc.frame_step))
        for f in frames:
            t1 = time.time()
            sc.frame_set(f)
            sc.render.filepath = os.path.join(outdir, f"f_{f:04d}.png")
            bpy.ops.render.render(write_still=True)
            print(f"S{sec} frame {f} {time.time() - t1:.1f}s", flush=True)


main()
