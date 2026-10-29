# 7. bölümün dünyası (birim mm, zemin kat döşemesi z = 0): levhadan yapılmış dolap, oturma odası, kesitli ev ve
# Antalya'da bahçeli bir parsel; çevresinde town.py'nin mahallesi. Atölyeden ayrı bir sahnedir. Dolabın üstü
# levhanın −Y ucundan kesilir: ağı levha yerelindeki koordinatlarla kurulur ve aynı malzemeyi taşır, dokusu nesne
# koordinatından gelir. Böylece 6. bölümün son karesindeki benekler 7. bölümün ilk karesinde aynı yerde durur;
# kesmede yalnızca kenarın ötesindeki şerit değişir. Levha yük taşımayan iç mekân panelidir: evde yalnızca dolapta
# ve duvar kaplamasında görünür; masa ve sandalyeler ahşaptır.
import math

from mathutils import Matrix

import lib
import pressing
import shredding as SH
import town
from town import slab

L, _, T = pressing.BOARD
SB_D, SB_H, PLINTH_H = 600.0, 800.0, 100.0  # dolap derinliği, üst yüz yüksekliği, süpürgelik
TOP_Y = (-pressing.BOARD[1] / 2, -pressing.BOARD[1] / 2 + SB_D)  # dolap üstü levha yerelinde (y aralığı)
WALL_T, SLAB_T, STOREY = 250.0, 300.0, 3000.0
HOUSE = (0.0, 13000.0, 0.0, 10000.0)  # dış ölçü: x0, x1, y0, y1
ROOM = (WALL_T, 6000.0, WALL_T, 5000.0)  # oturma odasının iç ölçüsü (ön duvarı ve tavanı kesik)
CLAD = 18.0  # arka duvar kaplaması
SB_X = (ROOM[0] + ROOM[1]) / 2
SB_Y = ROOM[3] - CLAD - 10.0 - SB_D / 2  # dolap üstünün ortası (dünya y)
PLINTH = -town.GROUND  # bahçe zemini döşemenin altında
PLOT = (-6000.0, -6000.0 + town.PLOT_W, -7000.0, -7000.0 + town.PLOT_D)  # parsel: ön kenar y0 sokağa bakar
GATE = (8800.0, 10200.0)
POOL = (15200.0, 18700.0, 1500.0, 10500.0)
# 6. bölümün son kadrajı dolap üstünde levha yereli x −466…274 (masaüstü), ±165 (mobil): uçlardaki eşya kesme
# karesine girmez, kamera geri çekildikçe kenardan belirir.
DECOR_X = (-760.0, 700.0)


def materials():
    m = town.materials()
    m.update({
        "render": lib.plastic("Render", "Sulpher Yellow", rough=0.85, wear=0.25, scale=0.002),
        "cut": lib.plastic("Cut", "Slate Color", rough=0.9),
        "plaster": lib.plastic("Plaster", "Ivory Buff", rough=0.9, wear=0.1, scale=0.003),
        "oak": lib.wood("Oak", "Maple", "Isabella Color", scale=1.0, rough=0.5, coat=0.3),
        "floor": lib.wood("FloorOak", "Isabella Color", "Pale Raw Umber", scale=0.8, rough=0.45, coat=0.4),
        "plinth": lib.plastic("Plinth", "Slate Color", rough=0.6),
        "glass": glass(),
        "terrace": lib.concrete("Terrace", "Warm Gray", "Light Grayish Olive", "Neutral Gray", unit=1.0),
        "pot": lib.plastic("Pot", "Burnt Sienna", rough=0.8),
        "rug": lib.plastic("Rug", "Pinkish Cinnamon", rough=0.95, wear=0.3, scale=0.01),
        "board": pressing.board_material(),
        # Açık renkli parti: ekru zemin, aynı lif benekleri. Levhanın rengi atığın karışımına göre değişir;
        # dolapla duvar ayrı partilerden (parametreler pressing.board_material ile aynı).
        "board_light": lib.felt("BoardLight", "Ecru", SH.FIBRE + ["Salvia Blue", "Olympic Blue"], scale=1.0,
                                density=0.4, rough=0.8, fuzz=0.12, bump=0.25, size=45.0),        "ceramic": lib.plastic("Ceramic", "Ivory Buff", rough=0.25, coat=0.5),
        "clay": lib.plastic("Clay", "Burnt Sienna", rough=0.7, wear=0.3, scale=0.02),
        "books": [lib.plastic("Book" + str(i), c, rough=0.6) for i, c in
                  enumerate(["Deep Lyons Blue", "Olive Ocher", "Ivory Buff", "Etruscan Red"])],
        "art": [lib.plastic("Art" + str(i), c, rough=0.8) for i, c in enumerate(["Naples Yellow", "Peach Red", "Vandar Poel's Blue"])],
    })
    return m


def glass():
    m, b, _ = lib.principled("Glass")
    b.inputs["Transmission Weight"].default_value = 1.0
    b.inputs["Roughness"].default_value = 0.02
    b.inputs["Base Color"].default_value = lib.rgba("Nile Blue")
    return m


# --- Kesme ---

def board_matrix():
    """6. bölümde levhanın dünya matrisi: pres kökü × levhanın kökteki yeri (pressing.board)."""
    wx, wy = pressing.world(0.0, 0.0)
    xout = (pressing.TABLE_X[0] + pressing.TABLE_X[1]) / 2
    z = pressing.ROLL_Z + pressing.SHEET[2] + T / 2
    return (Matrix.Translation((wx, wy, pressing.FLOOR)) @ Matrix.Rotation(pressing.ROT, 4, "Z")
            @ Matrix.Translation((xout, 0.0, z)))


def top_matrix():
    """Dolap üstünün dünya matrisi (levha yereli → ev): ön kenar dünya −Y'ye bakar."""
    yc = (TOP_Y[0] + TOP_Y[1]) / 2
    return Matrix.Translation((SB_X, SB_Y - yc, SB_H - T / 2))


def cut():
    """6. bölümün dünyasından 7. bölümün dünyasına: levhanın yerelinde aynı nokta."""
    return top_matrix() @ board_matrix().inverted()


# --- Dolap ve oda ---

def sideboard(m):
    """Büfe: üstü, yanları, kapakları ve arkası levhadan; kapaklar ön kenarla aynı düzlemde, aralarında 3 mm
    gölge derzi; içeri çekilmiş koyu süpürgelik. Kulpsuz (bas-aç): ön yüz yalnızca levha."""
    top = lib.box("SideboardTop", (L, SB_D, T), (0, 0, 0), m["board"], bevel=1.5)
    top.data.transform(Matrix.Translation((0.0, (TOP_Y[0] + TOP_Y[1]) / 2, 0.0)))  # levha yereline
    top.matrix_world = top_matrix()
    objs = [top]
    y0 = SB_Y - SB_D / 2  # ön yüz
    zb, zt = PLINTH_H, SB_H - T  # gövdenin altı ve üstü
    for sx in (-1, 1):
        objs.append(lib.box("SideboardSide", (T, SB_D - T, zt - zb), (SB_X + sx * (L / 2 - T / 2), SB_Y + T / 2,
                                                                       (zb + zt) / 2), m["board"], bevel=1.0))
    objs.append(lib.box("SideboardBottom", (L - 2 * T, SB_D - T, T), (SB_X, SB_Y + T / 2, zb + T / 2), m["board"]))
    objs.append(lib.box("SideboardBack", (L, T, zt - zb), (SB_X, SB_Y + SB_D / 2 - T / 2, (zb + zt) / 2), m["board"]))
    gap, n = 3.0, 3
    dw = (L - (n + 1) * gap) / n
    for k in range(n):
        x = SB_X - L / 2 + gap + dw / 2 + k * (dw + gap)
        objs.append(lib.box("SideboardDoor", (dw, T, zt - zb - 2 * gap), (x, y0 + T / 2, (zb + zt) / 2),
                            m["board"], bevel=1.0))
    objs.append(lib.box("SideboardPlinth", (L - 80, SB_D - 80, PLINTH_H), (SB_X, SB_Y + 20, PLINTH_H / 2), m["plinth"]))
    return objs


def lathe(name, profile, loc, material, segs=48):
    """Dönel gövde: profile [(yarıçap, z)] alttan üste; dip kapalı."""
    verts, faces = [(0.0, 0.0, profile[0][1])], []
    k = len(profile)
    for i in range(segs):
        a = 2 * math.pi * i / segs
        verts += [(r * math.cos(a), r * math.sin(a), z) for r, z in profile]
    for i in range(segs):
        a, b = 1 + i * k, 1 + ((i + 1) % segs) * k
        faces.append((0, b, a))
        faces += [(a + j, b + j, b + j + 1, a + j + 1) for j in range(k - 1)]
    o = lib.mesh_from(name, verts, faces, material)
    o.location = loc
    return o


def decor(m):
    """Dolabın iki ucunda eşya (kesme karesinin dışında): solda sırlı vaso ve kil kâse, sağda kitap yığını;
    dolabın üstünde, kaplamaya asılı yazısız bir baskı."""
    z = SB_H
    x0, x1 = SB_X + DECOR_X[0], SB_X + DECOR_X[1]
    objs = [lathe("Vase", [(70, 0), (110, 60), (125, 160), (95, 280), (55, 340), (60, 380)], (x0, SB_Y + 60, z),
                  m["ceramic"]),
            lathe("Bowl", [(50, 0), (120, 30), (150, 70), (145, 75)], (x0 + 40, SB_Y - 160, z), m["clay"])]
    h = z
    for i, (bw, bd, bt, rot) in enumerate(((300, 230, 40, 4), (280, 210, 32, -6), (260, 200, 45, 2))):
        objs.append(lib.box("Book", (bw, bd, bt), (x1, SB_Y - 20, h + bt / 2), m["books"][i], rot=(0, 0, rot), bevel=2))
        h += bt
    objs.append(lathe("Cup", [(35, 0), (45, 10), (48, 90), (46, 92)], (x1 + 30, SB_Y - 30, h), m["clay"]))
    # Baskı: çerçeve ve iki renk alanı (yazısız).
    wy = ROOM[3] - CLAD - 12
    ax, az, aw, ah = SB_X + 150, SB_H + 1050, 900, 700
    objs.append(lib.box("ArtFrame", (aw + 50, 24, ah + 50), (ax, wy, az), m["oak"], bevel=2))
    objs.append(lib.box("ArtField", (aw, 6, ah), (ax, wy - 13, az), m["art"][0]))
    objs.append(lib.cylinder("ArtSun", 170, 4, (ax - 120, wy - 17, az + 60), m["art"][1], rot=(90, 0, 0)))
    objs.append(lib.box("ArtSea", (aw, 4, ah * 0.32), (ax, wy - 17, az - ah * 0.34), m["art"][2]))
    return objs


def cladding(m):
    """Arka duvarın iç yüzü açık renkli levha şeritlerle kaplı: 600 mm şerit, 6 mm derz, döşemeden tavana."""
    x0, x1, _, y1 = ROOM
    objs = []
    w, gap = 600.0, 6.0
    n = int((x1 - x0) // (w + gap))
    left = (x0 + x1) / 2 - n * (w + gap) / 2 + gap / 2
    for k in range(n):
        objs.append(lib.box("Cladding", (w, CLAD, STOREY - 40), (left + k * (w + gap) + w / 2, y1 - CLAD / 2,
                                                                 (STOREY - 40) / 2 + 20), m["board_light"], bevel=1.5))
    return objs


def chair(m, x, y, rot):
    """Sade ahşap sandalye; arkalık yerel +Y'de."""
    objs = [lib.box("ChairSeat", (440, 420, 30), (0, 0, 450), m["oak"], bevel=4),
            lib.box("ChairBack", (420, 24, 300), (0, 200, 720), m["oak"], bevel=4)]
    for sx in (-190, 190):
        for sy in (-180, 190):
            h = 870 if sy > 0 else 435
            objs.append(lib.box("ChairLeg", (32, 32, h), (sx, sy, h / 2), m["oak"], bevel=3))
    g = lib.empty("Chair", (x, y, 0))
    g.rotation_euler = (0, 0, math.radians(rot))
    for o in objs:
        o.parent = g
    return objs + [g]


def furniture(m):
    """Odanın ortasında ahşap yemek masası ve sandalyeler, altında kilim; köşede saksıda zeytin fidanı."""
    objs = []
    tx, ty, tl, td, th = SB_X - 200, 2300.0, 1800.0, 900.0, 750.0
    objs.append(lib.box("Rug", (2800, 2000, 8), (tx, ty, 4), m["rug"], bevel=2))
    objs.append(lib.box("TableTop", (tl, td, 30), (tx, ty, th - 15), m["oak"], bevel=3))
    for sx in (-1, 1):
        for sy in (-1, 1):
            objs.append(lib.box("TableLeg", (60, 60, th - 30), (tx + sx * (tl / 2 - 90), ty + sy * (td / 2 - 90),
                                                               (th - 30) / 2), m["oak"], bevel=3))
    for dx in (-450, 450):
        objs += chair(m, tx + dx, ty + td / 2 + 30, 0)
        objs += chair(m, tx + dx, ty - td / 2 - 30, 180)
    objs.append(lathe("Fruit", [(60, 0), (150, 40), (180, 80), (176, 84)], (tx + 150, ty + 50, th), m["ceramic"]))
    x0, x1, y0, y1 = ROOM
    px, py = x0 + 600, y1 - 600
    objs.append(lib.cylinder("Pot", 200, 420, (px, py, 210), m["pot"], bevel=4))
    objs += town.tree(m, "olive", px, py, 4, size=0.19, z0=420)  # taç ~0,5 m: duvarlara değmez
    return objs


# --- Ev ---

def shell(m):
    """Tek katlı, düz çatılı ev. Oturma odasının ön duvarı ve tavanı kesik (bebek evi kesiti); kesit yüzü koyu.
    Çatı teras: karo döşeli, harpuştalı korkuluk."""
    X0, X1, Y0, Y1 = HOUSE
    x0, x1, y0, y1 = ROOM
    top = STOREY + SLAB_T
    objs = [slab("Slab", X0, X1, Y0, Y1, -SLAB_T, 0, m["cut"]),
            slab("RoomFloor", x0, x1, y0, y1, 0, 2, m["floor"]),
            slab("WallLeft", X0, X0 + WALL_T, Y0, Y1, 0, top, m["render"]),
            slab("WallRight", X1 - WALL_T, X1, Y0, Y1, 0, top, m["render"]),
            slab("WallBack", X0, X1, Y1 - WALL_T, Y1, 0, top, m["render"]),
            slab("WallFront", x1, X1, Y0, Y0 + WALL_T, 0, top, m["render"]),
            # Odanın iç duvarları: sağda bölme, arkada öbür odalarla ortak duvar.
            slab("WallInner", x1, x1 + WALL_T, Y0, y1 + WALL_T, 0, STOREY, m["render"]),
            slab("WallInnerBack", X0 + WALL_T, x1 + WALL_T, y1, y1 + WALL_T, 0, STOREY, m["render"]),
            slab("PlasterSide", x1 - 4, x1, y0, y1, 2, STOREY, m["plaster"]),
            slab("PlasterLeft", x0, x0 + 4, y0, y1, 2, STOREY, m["plaster"]),
            # Çatı: kesik odanın üstü açık; üstünde teras karosu.
            slab("Roof", x1, X1, Y0, Y1, STOREY, top, m["render"]),
            slab("Roof", X0, x1, y1, Y1, STOREY, top, m["render"]),
            slab("RoofDeck", x1 + WALL_T, X1 - 150, Y0 + 150, Y1 - 150, top, top + 30, m["deck"]),
            slab("RoofDeck", X0 + 150, x1 + WALL_T, y1 + WALL_T, Y1 - 150, top, top + 30, m["deck"])]
    for a in ((x1, X1, Y0, Y0 + 150), (X0, X1, Y1 - 150, Y1), (X1 - 150, X1, Y0, Y1), (X0, X0 + 150, y1, Y1),
              (x1, x1 + 150, Y0, y1), (X0, x1, y1, y1 + 150)):
        objs.append(slab("Parapet", *a, top, top + 450, m["render"]))
        objs.append(slab("Coping", a[0] - 20, a[1] + 20, a[2] - 20, a[3] + 20, top + 450, top + 500, m["coping"], bevel=6))
    # Kesit yüzleri: sol duvarın ve bölmenin kesik ucu koyu bant (duvar kalınlığı okunur).
    objs.append(slab("CutBand", X0, X0 + WALL_T, Y0 - 2, Y0, 0, top, m["cut"]))
    objs.append(slab("CutBand", x1, x1 + WALL_T, Y0 - 2, Y0, 0, STOREY, m["cut"]))
    return objs


def windows(m):
    """Sol duvarda odanın penceresi; ön ve yan cephede öbür odaların pencereleri."""
    objs = []
    _, _, y0, y1 = ROOM
    X0, X1, Y0, _ = HOUSE

    def window(name, cx, cy, cz, w, h, axis):
        fs, gs = ((WALL_T + 20, w + 80, h + 80), (WALL_T + 30, w, h)) if axis == "x" else \
            ((w + 80, WALL_T + 20, h + 80), (w, WALL_T + 30, h))
        objs.append(lib.box(name + "Frame", fs, (cx, cy, cz), m["frame"]))
        objs.append(lib.box(name + "Glass", gs, (cx, cy, cz), m["glass"]))

    window("RoomWin", X0 + WALL_T / 2, (y0 + y1) / 2, 1450, 1800, 1700, "x")
    for x in (8000, 11000):
        window("FrontWin", x, Y0 + WALL_T / 2, 1450, 1400, 1500, "y")
    for y in (3000, 7500):
        window("SideWin", X1 - WALL_T / 2, y, 1450, 1400, 1500, "x")
    return objs


def roof_terrace(m):
    """Çatı terası: ahşap pergola (çıtaların gölgesi terasa çizgi çizer), iki şezlong, korkuluk boyunca
    saksılar ve güneş enerjili su ısıtıcısı."""
    top = STOREY + SLAB_T + 30
    objs = []
    px0, px1, py0, py1 = 7000.0, 11800.0, 900.0, 4600.0
    for x in (px0, px1):
        for y in (py0, py1):
            objs.append(lib.box("PergolaPost", (110, 110, 2400), (x, y, top + 1200), m["pergola"], bevel=4))
    for y in (py0, py1):
        objs.append(lib.box("PergolaBeam", (px1 - px0 + 400, 90, 180), ((px0 + px1) / 2, y, top + 2400 - 90), m["pergola"], bevel=4))
    x = px0 - 100
    while x <= px1 + 100:
        objs.append(lib.box("PergolaSlat", (50, py1 - py0 + 500, 140), (x, (py0 + py1) / 2, top + 2400 + 70), m["pergola"], bevel=3))
        x += 420
    for lx in (8300.0, 10300.0):
        objs.append(lib.box("Lounger", (700, 1900, 120), (lx, (py0 + py1) / 2 - 200, top + 300), m["lounger"], bevel=40))
        objs.append(lib.box("LoungerBack", (700, 600, 100), (lx, (py0 + py1) / 2 + 900, top + 520), m["lounger"],
                            rot=(35, 0, 0), bevel=40))
    for k in range(5):
        cx = 7300.0 + k * 1300
        objs.append(lib.box("Planter", (900, 450, 500), (cx, HOUSE[3] - 500, top + 250), m["clay"], bevel=10))
        objs += town.shrub(m, "hedge" if k % 2 else "bougain", cx, HOUSE[3] - 500, 300 + k, r=480, z0=top + 450)
    objs += town.solar_heater(m, 3200.0, 8400.0, top)
    return objs


def garden(m):
    """Parsel: çim (bütün mahallenin zemini), evin çevresinde teras, kapıdan terasa yol, sağda havuz ve güvertesi,
    bahçe duvarı ve begonviller; solda turunç ağaçları, kapının iki yanında palmiye, arkada servi sırası."""
    X0, X1, Y0, Y1 = HOUSE
    px0, px1, py0, py1 = PLOT
    G = town.GROUND
    hole = (POOL[0] - 300, POOL[1] + 300, POOL[2] - 300, POOL[3] + 300)
    objs = town.lawn_patch(m, px0, px1, py0, py1, hole)
    objs += [slab("Terrace", X0 - 1500, X1 + 1500, Y0 - 2500, Y1 + 1500, G - 10, -SLAB_T + 2, m["terrace"]),
             slab("Path", GATE[0], GATE[1], py0, Y0 - 2500, G - 10, G + 30, m["paving"])]
    objs += town.pool(m, *POOL)
    objs += town.ring("PoolDeck", (X1 + 1500, px1 - 700, Y0 - 1000, POOL[3] + 1500), hole, G - 10, G + 30, m["deck"])
    for lx in (16000.0, 17900.0):
        objs.append(lib.box("Lounger", (1900, 700, 120), (lx, POOL[2] - 1050, G + 300), m["lounger"], bevel=40))
    objs += town.walls(m, px0, px1, py0, py1, gate=GATE, mat=m["render"])
    for x, y in ((1500.0, py0 + 600), (6200.0, py0 + 600), (13800.0, py0 + 600), (px1 - 600, 13000.0)):
        objs += town.shrub(m, "bougain", x, y, int(x) & 255, r=1000)
    for i, (x, y) in enumerate(((-4200.0, 800.0), (-3700.0, 5200.0), (-4300.0, 9500.0), (16800.0, -4300.0))):
        objs += town.tree(m, "olive" if i == 3 else "citrus", x, y, 40 + i, size=1.25 if i == 3 else 1.0)
    for i, x in enumerate((GATE[0] - 1400, GATE[1] + 1400)):
        objs += town.palm(m, x, py0 + 1800, 60 + i, h=7600 + 500 * i)
    x = px0 + 1200
    while x < px1 - 800:
        objs += town.tree(m, "cypress", x, py1 - 1000, int(x) & 1023)
        x += 2600
    objs += town.hedge(m, px0 + 250, px0 + 1250, py0 + 1200, py1 - 2000)
    return objs


def surroundings(m):
    """Komşu parseller ve sokaklar: hero parselin çevresi örnek koleksiyonlardan."""
    vs = town.variants(m)
    objs = town.neighbourhood(m, vs, PLOT[0], PLOT[2], cols=range(-2, 4), rows=range(-1, 2), skip={(0, 0)})
    objs += town.streets(m, PLOT[0] - 3 * town.PLOT_W, PLOT[0] + 5 * town.PLOT_W, PLOT[2], blocks=[0, 1])
    return objs


# Güneşe doğru yön (lib.sun): önden sağdan, öğleden sonra yüksekliğinde. Dolap güneşte, bölmenin gölgesi odanın
# sağ yarısına düşer. 8. bölümde kürenin gündüz yarısını da bu yön belirler.
SUN = (0.45, -0.55, 0.7)
SKY = ("Pale King's Blue", 0.8)
SUN_POWER = (4.0, "Sulpher Yellow")


def lights():
    lib.world(SKY[0], strength=SKY[1])
    lib.sun(SUN, strength=SUN_POWER[0], angle=1.5, color=SUN_POWER[1])


def build(neighbours=True, ground=400000.0):
    """ground=None: genel zemin yok (8. bölümde yerine Dünya küresi gelir)."""
    m = materials()
    objs = (shell(m) + windows(m) + roof_terrace(m) + sideboard(m) + decor(m) + cladding(m) + furniture(m)
            + garden(m))
    if ground:
        objs.append(town.ground(m, ground, ((PLOT[0] + PLOT[1]) / 2, (PLOT[2] + PLOT[3]) / 2)))
    if neighbours:
        objs += surroundings(m)
    lights()
    return objs, m
