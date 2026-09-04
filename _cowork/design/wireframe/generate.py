#!/usr/bin/env python3
"""(Re)Configure wireframe, second pass: dark instrument look, CSS-only motion."""
import math, json, os, re

W, H = 1280, 820
BG = "#ece6d8"; PANEL = "#f4f0e6"; PANEL2 = "#e4ddcc"; LINE = "#cfc7b4"; LINE2 = "#1a1a1a"
INK = "#161616"; MUTE = "#6b665c"; DIM = "#a39c8d"; ACC = "#d6341c"; BLUE = "#1d4fa3"; YEL = "#f2b41c"
SHARED = "#f2b41c"; ACC_DIM = "#f3c9bf"
NOISE = "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='180' height='180'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 0.2  0 0 0 0 0.17  0 0 0 0 0.12  0 0 0 0.16 0'/></filter><rect width='180' height='180' filter='url(%23n)'/></svg>\")"
DISPLAY = '"Big Shoulders Display", "Archivo Narrow", Impact, sans-serif'
BODY = 'Jost, "Futura", "Century Gothic", sans-serif'
MONO = '"JetBrains Mono", Consolas, monospace'

CSS = f"""
    @property --n {{ syntax: '<integer>'; initial-value: 0; inherits: false; }}
    body {{ margin:0; font-family: {BODY}; color:{INK}; background:{BG}; }}
    a {{ color:{ACC}; text-decoration:none; border-bottom:1px solid {ACC}; }} a:hover {{ color:{BLUE}; border-color:{BLUE}; }}
    .root {{ position:relative; width:{W}px; height:{H}px; background:{BG}; overflow:hidden; box-sizing:border-box; }}
    .root:before {{ content:""; position:absolute; inset:0; background-image:{NOISE}; opacity:.9; pointer-events:none; }}
    .root > * {{ position:relative; z-index:1; }}
    .mono {{ font-family: {MONO}; font-size:11px; letter-spacing:0.06em; text-transform:uppercase; }}
    .bar {{ display:flex; align-items:center; gap:20px; height:64px; padding:0 28px; border-bottom:3px solid {INK}; box-sizing:border-box; }}
    .brand {{ white-space:nowrap; font-family:{DISPLAY}; font-weight:900; font-size:20px; letter-spacing:0.02em; text-transform:uppercase; }}
    .brand b {{ color:{ACC}; font-weight:900; }}
    .steps {{ display:flex; gap:4px; align-items:center; flex-grow:1; }}
    .step {{ white-space:nowrap; display:flex; align-items:center; gap:8px; padding:0 12px; height:64px; font-family:{DISPLAY}; font-weight:800; font-size:15px; text-transform:uppercase; letter-spacing:0.03em; color:{DIM}; }}
    .step .n {{ width:26px; height:26px; border-radius:13px; border:2px solid {DIM}; display:flex; align-items:center; justify-content:center; font-family:{BODY}; font-size:11px; font-weight:600; box-sizing:border-box; }}
    .step.done {{ color:{INK}; }}
    .step.done .n {{ background:{INK}; border-color:{INK}; color:{BG}; }}
    .step.now {{ color:{INK}; box-shadow: inset 0 -5px 0 {ACC}; }}
    .step.now .n {{ background:{ACC}; border-color:{ACC}; color:{BG}; animation: pulse 2.4s ease-in-out infinite; }}
    .clock {{ white-space:nowrap; font-family:{MONO}; font-size:11px; letter-spacing:0.08em; color:{MUTE}; }}
    .clock i {{ display:inline-block; width:8px; height:8px; border-radius:4px; background:{ACC}; margin-right:8px; animation: blink 1.4s steps(2) infinite; vertical-align:middle; }}
    .ghost {{ font-family:{BODY}; font-weight:600; font-size:11px; letter-spacing:0.14em; text-transform:uppercase; color:{INK}; border:2px solid {INK}; padding:8px 12px; }}
    .main {{ display:flex; gap:20px; padding:20px 28px; box-sizing:border-box; height:{H-64}px; }}
    .card {{ background:{PANEL}; border-top:3px solid {INK}; padding:20px; box-sizing:border-box; display:flex; flex-direction:column; gap:14px; position:relative; box-shadow: 0 1px 0 {LINE}; }}
    .h {{ font-family:{BODY}; font-weight:600; font-size:10px; letter-spacing:0.16em; text-transform:uppercase; color:{MUTE}; }}
    .h b {{ color:{ACC}; font-weight:600; }}
    .t {{ font-family:{DISPLAY}; font-weight:900; font-size:52px; line-height:0.9; letter-spacing:0.005em; text-transform:uppercase; }}
    .t2 {{ font-family:{DISPLAY}; font-weight:800; font-size:28px; line-height:1; text-transform:uppercase; letter-spacing:0.01em; }}
    .p {{ font-size:14px; line-height:1.5; color:{INK}; }}
    .s {{ font-size:12px; line-height:1.5; color:{MUTE}; }}
    .btn {{ display:flex; align-items:center; justify-content:space-between; height:54px; padding:0 18px; background:{ACC}; color:{BG}; font-family:{DISPLAY}; font-size:20px; letter-spacing:0.04em; text-transform:uppercase; font-weight:800; position:relative; overflow:hidden; }}
    .btn:before {{ content:""; position:absolute; right:-30px; top:-30px; width:60px; height:60px; border-radius:30px; background:{INK}; opacity:.18; }}
    .btn span:last-child {{ animation: nudge 1.6s ease-in-out infinite; font-family:{BODY}; font-size:20px; }}
    .btn2 {{ display:flex; align-items:center; justify-content:space-between; height:46px; padding:0 16px; border:2px solid {INK}; color:{INK}; font-family:{DISPLAY}; font-size:17px; letter-spacing:0.04em; text-transform:uppercase; font-weight:800; }}
    .field {{ display:flex; flex-direction:column; gap:8px; }}
    .input {{ height:50px; border-bottom:2px solid {INK}; display:flex; align-items:center; font-family:{MONO}; font-size:18px; background:transparent; }}
    .input:after {{ content:""; width:9px; height:22px; background:{ACC}; margin-left:4px; animation: blink 1s steps(2) infinite; }}
    .row {{ display:flex; align-items:center; gap:12px; }}
    .num {{ display:flex; flex-direction:column; gap:4px; }}
    .num .v {{ font-family:{DISPLAY}; font-weight:900; font-size:34px; line-height:1; }}
    .num .l {{ font-family:{BODY}; font-weight:600; font-size:9px; color:{MUTE}; text-transform:uppercase; letter-spacing:0.14em; }}
    .cnt {{ counter-reset: n var(--n); animation: count 1.6s cubic-bezier(.2,.7,.2,1) forwards; }}
    .cnt:after {{ content: counter(n); }}
    .note {{ position:absolute; font-family:{BODY}; font-size:12px; line-height:1.4; color:{BLUE}; max-width:230px; padding-left:12px; border-left:3px solid {BLUE}; }}
    .note:before {{ content:"Note"; display:block; font-size:9px; letter-spacing:0.18em; text-transform:uppercase; font-weight:600; margin-bottom:3px; }}
    .chip {{ font-family:{BODY}; font-weight:600; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; padding:5px 10px; border:1.5px solid {INK}; color:{INK}; border-radius:999px; }}
    .chip.on {{ background:{INK}; color:{BG}; }}
    .chip.acc {{ border-color:{ACC}; color:{ACC}; }}
    .slider {{ position:relative; height:28px; }}
    .slider .ticks {{ position:absolute; left:0; right:0; top:10px; height:8px; background: repeating-linear-gradient(90deg, {DIM} 0 1px, transparent 1px 10px); }}
    .slider .ticks:after {{ content:""; position:absolute; left:0; right:0; top:0; height:14px; background: repeating-linear-gradient(90deg, {INK} 0 1.5px, transparent 1.5px 50px); }}
    .slider .fill {{ position:absolute; left:0; top:12px; height:3px; background:{ACC}; transform-origin:left; animation: grow 1.2s cubic-bezier(.2,.7,.2,1) both; }}
    .slider .knob {{ position:absolute; top:0; width:0; height:0; margin-left:-9px; border-left:9px solid transparent; border-right:9px solid transparent; border-top:14px solid {ACC}; }}
    .check {{ width:20px; height:20px; border:2px solid {INK}; box-sizing:border-box; display:flex; align-items:center; justify-content:center; font-size:12px; border-radius:10px; }}
    .check.on {{ background:{ACC}; border-color:{ACC}; color:{BG}; }}
    .tog {{ width:44px; height:22px; border:2px solid {INK}; border-radius:11px; position:relative; box-sizing:border-box; }}
    .tog:after {{ content:""; position:absolute; top:3px; left:3px; width:12px; height:12px; border-radius:6px; background:{DIM}; }}
    .tog.on {{ border-color:{INK}; background:{INK}; }}
    .tog.on:after {{ left:25px; background:{ACC}; }}
    .feed {{ display:flex; flex-direction:column; gap:0; }}
    .feed .i {{ display:flex; gap:12px; font-size:13px; line-height:1.45; padding:9px 0; border-bottom:1px solid {LINE}; animation: slide .6s cubic-bezier(.2,.7,.2,1) both; }}
    .feed .i .k {{ font-family:{MONO}; font-size:10px; color:{MUTE}; width:44px; flex-shrink:0; padding-top:3px; }}
    .feed .i.new .k {{ color:{ACC}; }}
    .rise {{ animation: rise .7s cubic-bezier(.2,.7,.2,1) both; }}
    .blur {{ animation: blurin 1.1s cubic-bezier(.2,.7,.2,1) both; }}
    .draw polygon, .draw line, .draw path, .draw rect {{ stroke-dasharray: 1; stroke-dashoffset: 1; animation: draw 1.4s cubic-bezier(.4,0,.2,1) forwards; animation-delay: var(--d, 0s); }}
    .draw polygon {{ fill-opacity:0; animation: draw 1.4s cubic-bezier(.4,0,.2,1) forwards, fillin .8s ease-out forwards; animation-delay: var(--d, 0s), calc(var(--d, 0s) + 1s); }}
    .scan {{ position:absolute; left:0; right:0; top:0; height:2px; background:{ACC}; opacity:0.5; animation: scan 6s linear infinite; }}
    .ring {{ animation: spin 40s linear infinite; transform-origin: 50% 50%; }}
    .ring2 {{ animation: spin 90s linear infinite reverse; transform-origin: 50% 50%; }}
    .type {{ font-family:{MONO}; overflow:hidden; white-space:nowrap; border-right:2px solid {ACC}; width:0; animation: type 1.8s steps(40) .3s forwards, caret 1s steps(2) infinite; }}
    .disc {{ position:absolute; border-radius:50%; pointer-events:none; }}
    @keyframes blink {{ to {{ opacity:0; }} }}
    @keyframes pulse {{ 50% {{ transform: scale(1.18); }} }}
    @keyframes nudge {{ 0%,100% {{ transform:translateX(0); }} 50% {{ transform:translateX(6px); }} }}
    @keyframes count {{ to {{ --n: var(--to); }} }}
    @keyframes grow {{ from {{ transform: scaleX(0); }} }}
    @keyframes slide {{ from {{ opacity:0; transform: translateX(-14px); }} }}
    @keyframes rise {{ from {{ opacity:0; transform: translateY(14px); }} }}
    @keyframes blurin {{ from {{ opacity:0; filter: blur(14px); letter-spacing:0.06em; }} to {{ opacity:1; filter: blur(0); }} }}
    @keyframes draw {{ to {{ stroke-dashoffset: 0; }} }}
    @keyframes fillin {{ to {{ fill-opacity: var(--fo, 1); }} }}
    @keyframes scan {{ from {{ top:0; }} to {{ top:100%; }} }}
    @keyframes spin {{ to {{ transform: rotate(360deg); }} }}
    @keyframes type {{ to {{ width: 100%; }} }}
    @keyframes caret {{ 50% {{ border-color: transparent; }} }}
"""

HEAD = """<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <script src="./support.js"></script>
</head>
<body>
<x-dc>
<helmet>
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Big+Shoulders+Display:wght@700;800;900&family=Jost:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap">
  <style>""" + CSS + """  </style>
</helmet>
"""
TAIL = """</x-dc>
</body>
</html>
"""

STEPS = ["Join", "Wishes", "The group", "Your flat", "Vote"]

def bar(now, app="building", right=None):
    if app == "flat":
        steps = ['<div class="step now"><span class="n">01</span>Draw your flat</div>',
                 '<div class="step"><span class="n">02</span>Send it to your group</div>']
        brand = "(Re)<b>Configure</b> / Flat"
    else:
        steps = []
        for i, s in enumerate(STEPS, 1):
            cls = "done" if i < now else ("now" if i == now else "")
            steps.append(f'<div class="step {cls}"><span class="n">0{i}</span>{s}</div>')
        brand = "(Re)<b>Configure</b> / Building"
    right = right if right is not None else '<div class="ghost">Architect</div>'
    return f'<div class="bar"><div class="brand">{brand}</div><div class="steps">{"".join(steps)}</div><div class="clock"><i></i>ZRH 19:38</div>{right}</div>'

def note(x, y, text, w=230):
    return f'<div class="note" style="left:{x}px; top:{y}px; max-width:{w}px">{text}</div>'

def d(i, step=0.08, base=0.1):
    return f'style="animation-delay:{base + i*step:.2f}s"'

def slider(pct, val, label, w=400):
    return f'''<div class="field"><div class="row" style="justify-content:space-between"><span class="h">{label}</span><span class="t2" style="color:{ACC}">{val}</span></div>
<div class="slider" style="width:{w}px"><div class="ticks"></div><div class="fill" style="width:{pct}%"></div><div class="knob" style="left:{pct}%"></div></div>
<div class="row mono" style="justify-content:space-between; color:{DIM}; font-size:9px"><span>0</span><span>10</span><span>20</span><span>30 %</span></div></div>'''

def cnt(to, cls=""):
    return f'<span class="v cnt {cls}" style="--to:{to}"></span>'

# ---------- radar (instrument) ----------
AXES = ["Privacy", "Shared space", "Cost", "Light", "Short walks"]
def radar(size, you, avg, ticks=True, labels=True, r=None, w=None):
    w = w or size; cx = w/2; cy = size/2; r = r or size*0.23; n = 5
    def pt(i, v):
        a = -math.pi/2 + i * 2*math.pi/n
        return (cx + r*v*math.cos(a), cy + r*v*math.sin(a))
    P = lambda pts: " ".join(f"{x:.1f},{y:.1f}" for x, y in pts)
    out = []
    if ticks:
        R = r*1.18
        tk = "".join(f'<line x1="{cx + R*math.cos(a):.1f}" y1="{cy + R*math.sin(a):.1f}" x2="{cx + (R+ (7 if k%10==0 else 3))*math.cos(a):.1f}" y2="{cy + (R+(7 if k%10==0 else 3))*math.sin(a):.1f}" stroke="{INK if k%10==0 else DIM}" stroke-width="{1.5 if k%10==0 else 1}"/>' for k in range(120) for a in [k*2*math.pi/120])
        out.append(f'<g class="ring">{tk}</g>')
        out.append(f'<circle class="ring2" cx="{cx}" cy="{cy}" r="{r*1.30:.1f}" fill="none" stroke="{BLUE}" stroke-width="2" stroke-dasharray="3 9"/>')
    for k in (0.33, 0.66, 1.0):
        out.append(f'<polygon points="{P(pt(i, k) for i in range(n))}" fill="none" stroke="{LINE}" stroke-width="1"/>')
    out += [f'<line x1="{cx}" y1="{cy}" x2="{pt(i,1)[0]:.1f}" y2="{pt(i,1)[1]:.1f}" stroke="{LINE}" stroke-width="1"/>' for i in range(n)]
    out.append(f'<polygon points="{P(pt(i, v) for i, v in enumerate(avg))}" fill="{BLUE}" fill-opacity="0.10" stroke="{BLUE}" stroke-width="1.5" stroke-dasharray="4 3"/>')
    out.append(f'<g class="draw"><polygon points="{P(pt(i, v) for i, v in enumerate(you))}" pathLength="1" fill="{ACC}" fill-opacity="0.35" stroke="{ACC}" stroke-width="2.5" style="--d:.3s; --fo:.35"/></g>')
    out += [f'<circle cx="{pt(i,v)[0]:.1f}" cy="{pt(i,v)[1]:.1f}" r="4" fill="{ACC}"/>' for i, v in enumerate(you)]
    if labels:
        for i, a in enumerate(AXES):
            x, y = pt(i, 1.48)
            anchor = "middle" if abs(x-cx) < 8 else ("start" if x > cx else "end")
            out.append(f'<text x="{x:.1f}" y="{y+4:.1f}" text-anchor="{anchor}" font-size="11" letter-spacing="1.6" font-weight="600" fill="{INK}" font-family="Jost, sans-serif">{a.upper()}</text>')
    return f'<svg width="{w}" height="{size}" viewBox="0 0 {w} {size}">{"".join(out)}</svg>'

def mini_radar(you, size=40):
    return radar(size, you, [0.5]*5, ticks=False, labels=False, r=size*0.42)

# ---------- building ----------
def iso(x, y, z, sx=22, sy=11, sz=18):
    return ((x - y) * sx, (x + y) * sy - z * sz)

def building(size_w, size_h, cells, highlight=None, shared=None, mode="real", ground=True, pad=10, animate=True, stagger=0.05):
    sx, sy, sz = 22, 11, 18
    maxx = max(c[0]+c[3] for c in cells); maxy = max(c[1]+c[4] for c in cells); maxz = max(c[2] for c in cells)+1
    gx0, gy0 = (-1, -1) if ground else (0, 0)
    gx1, gy1 = (maxx+1, maxy+1) if ground else (maxx, maxy)
    pts = [iso(x,y,z) for (x,y,z) in ((gx0,gy0,0),(gx1,gy0,0),(gx1,gy1,0),(gx0,gy1,0),(0,0,maxz),(maxx,0,maxz),(0,maxy,maxz),(maxx,maxy,maxz))]
    bx0 = min(p[0] for p in pts); bx1 = max(p[0] for p in pts); by0 = min(p[1] for p in pts); by1 = max(p[1] for p in pts)
    k = min((size_w-2*pad)/(bx1-bx0), (size_h-2*pad)/(by1-by0))
    tx = (size_w - k*(bx1-bx0))/2 - k*bx0; ty = (size_h - k*(by1-by0))/2 - k*by0
    P = lambda ps: " ".join(f"{a:.1f},{b:.1f}" for a,b in ps)
    out = []
    if ground:
        g = [iso(gx0,gy0,0), iso(gx1,gy0,0), iso(gx1,gy1,0), iso(gx0,gy1,0)]
        out.append(f'<polygon points="{P(g)}" fill="{PANEL2}" stroke="{INK}" stroke-width="1.5"/>')
        # ground grid
        for gx in range(gx0, gx1+1, 2):
            out.append(f'<line x1="{iso(gx,gy0,0)[0]:.1f}" y1="{iso(gx,gy0,0)[1]:.1f}" x2="{iso(gx,gy1,0)[0]:.1f}" y2="{iso(gx,gy1,0)[1]:.1f}" stroke="{LINE}" stroke-width="0.8"/>')
        for gy in range(gy0, gy1+1, 2):
            out.append(f'<line x1="{iso(gx0,gy,0)[0]:.1f}" y1="{iso(gx0,gy,0)[1]:.1f}" x2="{iso(gx1,gy,0)[0]:.1f}" y2="{iso(gx1,gy,0)[1]:.1f}" stroke="{LINE}" stroke-width="0.8"/>')
    order = sorted(range(len(cells)), key=lambda i: (cells[i][0]+cells[i][1], cells[i][2]))
    for j, i in enumerate(order):
        x, y, z, w, dd = cells[i]
        top = [iso(x,y,z+1), iso(x+w,y,z+1), iso(x+w,y+dd,z+1), iso(x,y+dd,z+1)]
        right = [iso(x+w,y,z+1), iso(x+w,y+dd,z+1), iso(x+w,y+dd,z), iso(x+w,y,z)]
        front = [iso(x,y+dd,z+1), iso(x+w,y+dd,z+1), iso(x+w,y+dd,z), iso(x,y+dd,z)]
        hl = highlight and i in highlight; sh = shared and i in shared
        if mode == "backbone":
            ft, fr, ff, st = "none", "none", "none", INK
        else:
            if hl: ft, fr, ff, st = ACC, "#a8250f", "#c22d14", INK
            elif sh: ft, fr, ff, st = YEL, "#c48f0e", "#dca314", INK
            else: ft, fr, ff, st = "#fbf8f1", "#cfc7b4", "#e6dfcf", INK
        dl = f'style="--d:{0.2 + j*stagger:.2f}s"' if animate else ""
        out.append(f'<g class="{"draw" if animate else ""}"><polygon points="{P(top)}" pathLength="1" fill="{ft}" stroke="{st}" stroke-width="1.5" stroke-linejoin="round" {dl}/>'
                   f'<polygon points="{P(right)}" pathLength="1" fill="{fr}" stroke="{st}" stroke-width="1.5" stroke-linejoin="round" {dl}/>'
                   f'<polygon points="{P(front)}" pathLength="1" fill="{ff}" stroke="{st}" stroke-width="1.5" stroke-linejoin="round" {dl}/></g>')
    return f'<svg width="{size_w}" height="{size_h}" viewBox="0 0 {size_w} {size_h}"><g transform="translate({tx:.1f},{ty:.1f}) scale({k:.3f})">{"".join(out)}</g></svg>'

CELLS = [
    (0,0,0,4,3),(4,0,0,4,3),(8,0,0,4,3),(0,3,0,3,4),(9,3,0,3,4),(0,7,0,4,3),(4,7,0,4,3),(8,7,0,4,3),
    (0,0,1,4,3),(4,0,1,4,3),(8,0,1,4,3),(0,3,1,3,4),(9,3,1,3,4),(0,7,1,4,3),(8,7,1,4,3),
    (0,0,2,4,3),(8,0,2,4,3),(0,3,2,3,4),(9,3,2,3,4),(0,7,2,4,3),(8,7,2,4,3),
    (0,0,3,4,3),(8,0,3,4,3),(0,3,3,3,4),(0,7,3,4,3),
    (0,0,4,4,3),(0,3,4,3,4),
]
SHARED_IX = {4, 12, 20}
CELLS_DENSE = [(x,y,z,3,3) for z in range(6) for x in (0,3,6,9) for y in (0,3,6) if not (z>3 and x==9)]
CELLS_COURT = [(x,y,z,3,3) for z in range(3) for x in (0,3,6,9) for y in (0,3,6,9) if not (x in (3,6) and y in (3,6))]

# ---------- screens ----------
def screen_draw():
    body = f'''<div class="root">{bar(1, app="flat")}
<div class="main">
  <div class="card" style="flex-grow:1; padding:0; overflow:hidden">
    <svg width="880" height="{H-56-42}" viewBox="0 0 880 722" style="display:block" class="draw">
      <g stroke="{INK}" fill="none" stroke-width="2.5">
        <rect x="200" y="150" width="420" height="330" pathLength="1" style="--d:.1s"/>
        <line x1="200" y1="330" x2="470" y2="330" pathLength="1" style="--d:.5s"/>
        <line x1="470" y1="150" x2="470" y2="480" pathLength="1" style="--d:.6s"/>
        <line x1="470" y1="330" x2="620" y2="330" pathLength="1" style="--d:.7s"/>
        <rect x="500" y="180" width="90" height="120" pathLength="1" style="--d:.8s"/>
        <rect x="620" y="150" width="90" height="180" pathLength="1" stroke="{INK}" stroke-dasharray="6 4" style="--d:1s"/><rect x="620" y="150" width="90" height="180" fill="{YEL}" fill-opacity=".5"/>
      </g>
      <rect x="230" y="146" width="150" height="8" fill="{ACC}" class="rise"/>
      <rect x="196" y="360" width="8" height="90" fill="{ACC}" class="rise"/>
      <g font-family="Jost, sans-serif" font-weight="600" font-size="10" letter-spacing="1.5" fill="{MUTE}">
        <text x="230" y="240">LIVING / 24 M²</text><text x="230" y="420">BEDROOM / 14 M²</text><text x="500" y="420">KITCHEN / 11 M²</text><text x="510" y="245">BATH</text><text x="632" y="245" fill="{INK}">BALCONY</text>
        <text x="200" y="520">RED EDGE = GLAZING · YELLOW = OPEN AIR</text>
      </g>
    </svg>
    <div style="position:absolute; left:20px; top:20px; display:flex; gap:6px">
      <div class="chip on">Draw</div><div class="chip">Rooms</div><div class="chip">Windows</div><div class="chip">Balcony</div><div class="chip">Stair</div>
    </div>
  </div>
  <div style="width:320px; display:flex; flex-direction:column; gap:16px">
    <div class="card rise" {d(0)}>
      <div class="h">Your flat</div>
      <div class="t blur">Unit 6</div>
      <div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px">
        <div class="num"><span class="v">{cnt(70)}<small style="font-size:14px"> m²</small></span><span class="l">area</span></div>
        <div class="num"><span class="v">1</span><span class="l">storey</span></div>
        <div class="num"><span class="v">3.6<small style="font-size:14px"> m</small></span><span class="l">glazing</span></div>
      </div>
      <div class="row"><div class="chip acc">1 must fix</div><div class="s">the stair is too narrow · <a>show me</a></div></div>
    </div>
    <div class="card rise" {d(1)} style="gap:12px">
      <div class="h">Your group</div>
      <div class="p"><b>review-0023</b> · you are <b>Ana</b> <span class="s">· change</span></div>
      <div class="btn"><span>Send it to your group</span><span>→</span></div>
      <div class="s">Your neighbours see it within seconds.</div>
    </div>
    <div class="card rise" {d(2)} style="gap:6px; background:transparent; border-style:dashed">
      <div class="row" style="justify-content:space-between"><span class="h" style="color:{INK}">More</span><span class="h">+</span></div>
      <div class="s">Save to library · download files · replace an older version</div>
    </div>
  </div>
</div>
{note(600, 560, "One primary button. Today's four checkboxes go under More.", 260)}
{note(600, 650, "If the number is taken it asks first: “This flat belongs to Ben. Take it over?” Run 0025 has this.", 300)}
{note(50, 620, "The drawing tool as it is today, the tool bar cut to five. The plan draws itself in on landing.", 260)}
</div>'''
    return HEAD + body + TAIL

def screen_join():
    body = f'''<div class="root">{bar(1)}
<div class="disc" style="left:-120px; top:120px; width:420px; height:420px; background:{YEL}; opacity:.9"></div>
<div class="disc" style="left:640px; top:690px; width:90px; height:90px; background:{BLUE}"></div>
<div class="main" style="align-items:center; justify-content:center; gap:60px">
  <div style="width:520px; display:flex; flex-direction:column; gap:28px">
    <div class="h">01 / Join</div>
    <div class="t blur" style="font-size:96px">Join your<br>group</div>
    <div class="p rise" style="color:{MUTE}; max-width:420px" {d(2)}>A group is the people who will live in one building. Your architect gives you the code.</div>
  </div>
  <div class="card rise" style="width:400px; gap:24px; padding:28px" {d(3)}>
    <div class="field"><span class="h">Group code</span><div class="input">review-0023</div></div>
    <div class="field"><span class="h">Your name</span><div class="input">Ana</div></div>
    <div class="btn"><span>Join</span><span>→</span></div>
    <div class="s">No code yet? Ask your architect.</div>
  </div>
</div>
{note(80, 660, "Two fields, one button. Both are remembered, so next time this step is skipped.", 300)}
{note(880, 640, "“Group” = the people of one building. The code calls it a session today. Rename here if you have a better word.", 320)}
</div>'''
    return HEAD + body + TAIL

def ballot_item(i, name, sub, k):
    return f'''<div class="row rise" {d(k)} style="height:46px; border-bottom:1px solid {LINE2}; padding:0 4px">
<span class="mono" style="color:{ACC}; width:28px">0{i}</span><span class="t2" style="flex-grow:1; font-size:20px">{name}</span><span class="h">{sub}</span><span style="color:{DIM}; font-size:16px">≡</span></div>'''

def screen_wishes():
    you = [0.55, 0.45, 0.35, 0.8, 0.6]; avg = [0.6, 0.5, 0.55, 0.5, 0.45]
    body = f'''<div class="root">{bar(2)}
<div class="main">
  <div style="width:480px; display:flex; flex-direction:column; gap:26px">
    <div><div class="h">02 / Wishes</div><div class="t blur" style="margin-top:8px">Three questions.<br>The building follows.</div></div>
    <div class="rise" {d(2)}>{slider(30, "9 %", "Floor area you give to shared space")}
    <div class="s" style="margin-top:6px">9 % of your 70 m² is 6 m². The group gives 11 % on average.</div></div>
    <div class="field"><span class="h">Which shared spaces, in your order</span>
      {ballot_item(1, "Hall", "for the whole house", 3)}{ballot_item(2, "Terrace", "on the roof", 4)}{ballot_item(3, "Laundry", "", 5)}
      <div class="s">Lounge, Social · drag up to add</div>
    </div>
    <div class="field rise" {d(6)}><span class="h">Your flat</span>
      <div class="row" style="justify-content:space-between; height:32px"><span class="p">Corner flat</span><div class="tog on"></div></div>
      <div class="row" style="justify-content:space-between; height:32px"><span class="p">Near a terrace</span><div class="tog on"></div></div>
      <div class="row" style="justify-content:space-between; height:32px"><span class="p">On the quiet side</span><div class="tog"></div></div>
    </div>
  </div>
  <div style="flex-grow:1; display:flex; flex-direction:column; gap:16px">
    <div class="card" style="flex-grow:1; align-items:center; justify-content:center; gap:0; padding:12px">
      <div class="h" style="align-self:flex-start"><b>●</b> Your profile · live</div>
      {radar(520, you, avg, r=132, w=680)}
      <div class="row" style="gap:28px; align-self:flex-start"><div class="row" style="gap:8px"><div style="width:22px; height:2px; background:{ACC}"></div><span class="h">you</span></div><div class="row" style="gap:8px"><div style="width:22px; height:0; border-top:1px dashed {MUTE}"></div><span class="h">the group, on average</span></div></div>
    </div>
    <div class="btn rise" {d(4)}><span>Save my wishes</span><span>→</span></div>
  </div>
</div>
{note(1010, 120, "The radar draws itself and moves as you move the sliders. Neutral words on the axes.", 240)}
{note(1010, 660, "The dashed shape is the average the algorithm actually uses. When many push, it moves.", 240)}
</div>'''
    return HEAD + body + TAIL

def person(name, you, flats, changed, me, k):
    dot = f'<div class="mono" style="color:{ACC}">●</div>' if changed else f'<div class="mono" style="color:{DIM}">○</div>'
    return f'''<div class="row rise" {d(k)} style="gap:12px; padding:10px 0; border-bottom:1px solid {LINE2}">
{mini_radar(you)}<div style="flex-grow:1"><div class="p" style="font-weight:600">{name}{" <span class='mono' style='color:"+ACC+"'>you</span>" if me else ""}</div><div class="h">{flats}</div></div>{dot}</div>'''

def screen_group():
    people = [("Ana", [0.55,0.45,0.35,0.8,0.6], "2 flats / 9 %", True, True), ("Alisa", [0.7,0.3,0.6,0.5,0.4], "1 flat / 12 %", False, False),
              ("Bruno", [0.3,0.8,0.5,0.4,0.7], "1 flat / 20 %", True, False), ("Shrey", [0.5,0.6,0.7,0.5,0.5], "3 flats / 12 %", False, False), ("Mina", [0.6,0.4,0.4,0.7,0.3], "1 flat / 8 %", False, False)]
    ppl = "".join(person(*p, k) for k, p in enumerate(people))
    feed = [("now", "Bruno moved the <b>terrace</b> to level 3", True), ("2 min", "Ana sent <b>Unit 6</b>, a second copy", True), ("9 min", "Alisa now gives 12 %, was 9 %", False), ("12:51", "Shrey built the house", False)]
    fd = "".join(f'<div class="i{" new" if n else ""}" {d(k, .12, .4)}><span class="k">{t}</span><span>{s}</span></div>' for k, (t, s, n) in enumerate(feed))
    body = f'''<div class="root">{bar(3)}
<div class="main" style="gap:20px">
  <div style="width:280px; display:flex; flex-direction:column; gap:12px">
    <div class="card" style="gap:0; flex-grow:1"><div class="h" style="margin-bottom:6px">At the table · <b>5</b></div>{ppl}
      <div class="s" style="margin-top:10px">● changed something since the last building</div></div>
    <div class="card rise" {d(6)} style="gap:6px; border-top-color:{ACC}"><div class="h"><b>The group, together</b></div><div class="p">Gives <b>11 %</b> · wants <b>Hall</b> first, then Terrace · 8 flats asked for</div></div>
  </div>
  <div class="card" style="flex-grow:1; padding:12px; gap:8px; overflow:hidden">
    <div class="scan"></div>
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><div class="chip on">Real</div><div class="chip">Organisation</div><div class="chip">Backbone</div></div><div class="h">drag to turn / scroll to zoom</div></div>
    <div style="display:flex; align-items:center; justify-content:center; flex-grow:1">{building(560, 470, CELLS, shared=SHARED_IX)}</div>
    <div style="display:grid; grid-template-columns:repeat(6, minmax(0,1fr)); gap:8px; border-top:1px solid {LINE2}; padding-top:12px">
      <div class="num"><span class="v">1.98</span><span class="l">facade / floor</span></div>
      <div class="num"><span class="v">{cnt(12)}<small style="font-size:14px"> of 14</small></span><span class="l">flats fit</span></div>
      <div class="num"><span class="v">{cnt(86)}<small style="font-size:14px"> m²</small></span><span class="l">shared space</span></div>
      <div class="num"><span class="v">{cnt(82)}<small style="font-size:14px"> %</small></span><span class="l">windows in light</span></div>
      <div class="num"><span class="v">{cnt(11)}<small style="font-size:14px"> m</small></span><span class="l">walk to the stair</span></div>
      <div class="num"><span class="v">1 : 9</span><span class="l">shared : private</span></div>
    </div>
  </div>
  <div style="width:280px; display:flex; flex-direction:column; gap:12px">
    <div class="btn" style="height:64px; font-size:14px"><span>Build</span><span>→</span></div>
    <div class="h">last built by Shrey · 12:51 · ~20 s</div>
    <div class="card" style="gap:6px; flex-grow:1; padding:16px"><div class="h">Since you joined · <b>4</b></div><div class="feed">{fd}</div></div>
    <div class="card" style="padding:12px"><div class="mono" style="color:{DIM}; text-transform:none">Say something to the group_</div></div>
  </div>
</div>
{note(320, 130, "The building draws itself in, line by line, then fills. A slow red line sweeps while people wait.", 260)}
{note(700, 130, "Yellow blocks are shared spaces. A resident can drag one to another spot; the building reacts. Flats cannot be moved.", 260)}
{note(960, 600, "Six numbers count up. The same six on every screen and in the vote.", 160)}
</div>'''
    return HEAD + body + TAIL

def screen_yourflat():
    sents = ["Copy 2 of 2 of <b>Unit 6</b> stands on <b>level 1</b> of 5, in the south-west corner.",
             "Its windows face south and west. All 3.6 m of the glazing you drew looks at open air.",
             "Your door is 14 m of walking from the stair.",
             "You share a wall with <b>Alisa</b>. There is a lounge on your level.",
             "The building gave you a terrace of 6 m² in front of your windows."]
    ss = "".join(f'<div class="p rise" {d(k, .18, .6)}>{s}</div>' for k, s in enumerate(sents))
    body = f'''<div class="root">{bar(4)}
<div class="main">
  <div class="card" style="flex-grow:1; padding:12px; gap:8px">
    <div class="row" style="justify-content:space-between"><div class="row" style="gap:6px"><div class="chip on">Your flat</div><div class="chip">Whole building</div></div><div class="row" style="gap:6px"><div class="chip">L0</div><div class="chip on">L1</div><div class="chip">L2</div><div class="chip">L3</div><div class="chip">L4</div></div></div>
    <div style="display:flex; align-items:center; justify-content:center; flex-grow:1">{building(600, 560, CELLS, highlight={13}, shared=SHARED_IX)}</div>
  </div>
  <div class="card" style="width:440px; gap:14px">
    <div class="h">04 / Your flat</div>
    <div class="type h" style="color:{INK}; font-size:12px">What the building decided for you</div>
    {ss}
    <div class="row rise" {d(6, .18, .6)} style="gap:8px"><div class="chip acc">2 wishes met</div><div class="chip">corner ✓</div><div class="chip">near a terrace ✓</div></div>
    <div class="p rise" {d(7, .18, .6)} style="padding:14px; border:1px dashed {LINE2}">3 copies of Unit 6 did not fit: no shaft could reach their wet rooms. <a>What can I change?</a></div>
    <div style="flex-grow:1"></div>
    <div class="btn"><span>Next: vote on the building</span><span>→</span></div>
  </div>
</div>
{note(50, 640, "Your flat in red, shared spaces yellow. Click a copy to read its card.", 240)}
{note(860, 590, "The card as run 0054 writes it. The heading types itself, the sentences arrive one by one.", 380)}
</div>'''
    return HEAD + body + TAIL

def vote_card(letter, cells, chosen, nums, votes, k):
    style = f"border-top-color:{ACC}; border-top-width:6px" if chosen else ""
    numrows = "".join(f'<div class="num"><span class="v" style="font-size:24px">{v}</span><span class="l">{l}</span></div>' for v, l in nums)
    btn = f'<div class="btn"><span>Building {letter}, that one</span><span>→</span></div>' if chosen else f'<div class="btn2" style="height:52px"><span>Choose {letter}</span><span>→</span></div>'
    return f'''<div class="card rise" {d(k, .2, .3)} style="flex-grow:1; gap:10px; {style}">
<div class="row" style="justify-content:space-between"><div class="t" style="font-size:32px">Building {letter}</div><div class="chip{" acc" if chosen else ""}">{votes} chose this</div></div>
<div style="display:flex; justify-content:center">{building(440, 190, cells, shared=set(range(0,len(cells),7)), stagger=0.03)}</div>
<div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px">{numrows}</div>
{btn}</div>'''

def screen_vote():
    A = [("2.1", "facade / floor"), ("14 of 14", "flats fit"), ("92 m²", "shared"), ("88 %", "in light"), ("9 m", "walk"), ("1 : 8", "shared : private")]
    B = [("1.6", "facade / floor"), ("14 of 14", "flats fit"), ("70 m²", "shared"), ("71 %", "in light"), ("16 m", "walk"), ("1 : 11", "shared : private")]
    body = f'''<div class="root">{bar(5)}
<div class="main" style="flex-direction:column; gap:14px">
  <div class="row" style="justify-content:space-between; align-items:flex-end">
    <div><div class="h">05 / Vote · round <b>2</b> of 4</div><div class="t blur" style="margin-top:6px; font-size:40px; max-width:600px">Which one do you want to live in?</div></div>
    <div class="row" style="gap:16px; align-items:flex-end"><div class="h">7 of 10 have voted</div>
      <div class="row" style="gap:8px; opacity:0.8">{building(110, 64, CELLS_COURT, ground=False, animate=False)}<span class="h">all shared</span></div>
      <div class="row" style="gap:8px; opacity:0.8">{building(110, 64, CELLS_DENSE, ground=False, animate=False)}<span class="h">no shared</span></div></div>
  </div>
  <div style="display:flex; gap:20px; flex-grow:1">
    {vote_card("A", CELLS_COURT, True, A, 4, 0)}
    {vote_card("B", CELLS_DENSE, False, B, 3, 1)}
  </div>
  <div class="card rise" {d(3, .2, .3)} style="flex-direction:row; align-items:center; gap:18px; padding:12px 20px">
    <span class="h" style="color:{INK}; white-space:nowrap">Why A?</span>
    <div class="row" style="gap:8px"><div class="check on">✓</div><span class="p">more light</span></div>
    <div class="row" style="gap:8px"><div class="check on">✓</div><span class="p">shorter walks</span></div>
    <div class="row" style="gap:8px"><div class="check"></div><span class="p">more shared space</span></div>
    <div class="row" style="gap:8px"><div class="check"></div><span class="p">cheaper to build</span></div>
    <div class="row" style="gap:8px"><div class="check on">✓</div><span class="p">my flat sits better</span></div>
    <div style="flex-grow:1"></div><div class="btn" style="width:200px; height:44px"><span>Send my vote</span><span>→</span></div>
  </div>
</div>
{note(60, 640, "Two buildings, same six numbers, same angle. The two extremes at the top right, so people vote informed.", 300)}
{note(1000, 640, "Five boxes: the human fitness. The packer raises the weights the group ticked.", 240)}
</div>'''
    return HEAD + body + TAIL

def arch_row(label, val, k):
    return f'<div class="row rise" {d(k, .05, .2)} style="justify-content:space-between; height:34px; border-bottom:1px solid {LINE}"><span class="p" style="color:{MUTE}">{label}</span><span class="mono" style="color:{INK}">{val}</span></div>'

def screen_architect():
    rows = "".join(arch_row(*r, k) for k, r in enumerate([("Plot", "11 × 11 modules"), ("Floors", "7"), ("Cores", "2"), ("Corridors", "open galleries"), ("Roof terraces", "reached"), ("Given outdoor", "5 %"), ("Compactness weight", "30"), ("Evolve steps", "1000"), ("Vote weight", "2.5"), ("Shadows", "on"), ("Ground plane", "on")]))
    body = f'''<div class="root">{bar(3, right='<div class="ghost" style="background:'+INK+'; color:'+BG+'">Architect ×</div>')}
<div class="main" style="gap:20px">
  <div style="flex-grow:1; opacity:0.35; display:flex; align-items:center; justify-content:center">{building(560, 470, CELLS, shared=SHARED_IX, mode="backbone")}</div>
  <div class="card" style="width:420px; gap:8px; box-shadow:-24px 0 48px rgba(0,0,0,0.5); animation: slidein .6s cubic-bezier(.2,.7,.2,1) both">
    <style>@keyframes slidein {{ from {{ transform: translateX(60px); opacity:0; }} }}</style>
    <div class="t" style="font-size:40px">Architect</div>
    <div class="s">The operator's tools. Residents never see this.</div>
    <div class="h" style="margin-top:10px">Site and structure</div>{rows}
    <div class="h" style="margin-top:10px">Views and export</div>
    <div class="row" style="gap:6px"><div class="chip on">Real</div><div class="chip">Organisation</div><div class="chip">Backbone</div><div class="chip">Fabrication data</div></div>
    <div class="row" style="gap:8px; margin-top:8px"><div class="btn2" style="flex-grow:1">Screenshot</div><div class="btn2" style="flex-grow:1">Export group</div><div class="btn2" style="flex-grow:1">Rebuild</div></div>
  </div>
</div>
{note(80, 110, "The fourteen groups of today, one fold away. Run 0054 already folds them. The drawer slides in from the right.", 280)}
{note(80, 660, "The same building as wire, so the architect sees the bones while the group sees the skin.", 280)}
</div>'''
    return HEAD + body + TAIL

def fix(html):
    def merge(m):
        tag = m.group(0)
        styles = re.findall(r'\sstyle="([^"]*)"', tag)
        if len(styles) < 2: return tag
        tag = re.sub(r'\sstyle="[^"]*"', '', tag)
        return tag[:-1] + ' style="' + '; '.join(x.strip().rstrip(';') for x in styles) + '">'
    return re.sub(r'<[a-zA-Z][^>]*>', merge, html)


# ---------- new screens, 3 Sept evening ----------

def bar_flat(step, right_extra=""):
    steps = []
    for i, s in enumerate(["Draw your flat", "Send it to your group"], 1):
        cls = "done" if i < step else ("now" if i == step else "")
        steps.append(f'<div class="step {cls}"><span class="n">0{i}</span>{s}</div>')
    return (f'<div class="bar"><div class="brand">(Re)<b>Configure</b> / Flat</div>'
            f'<div class="steps">{"".join(steps)}</div>'
            f'<div class="row" style="gap:6px"><div class="chip on">Model</div><div class="chip">Plan</div><div class="chip">Diagram</div></div>'
            f'<div class="row" style="gap:8px">{right_extra}<div class="ghost">Units</div><div class="ghost">Open</div><div class="ghost">?</div></div></div>')

def journey(here):
    names = ["Draw your flat", "Send it", "Your wishes", "The group", "Your flat in it", "Vote"]
    out = []
    for i, n in enumerate(names):
        on = i <= here
        out.append(f'''<div class="row rise" {d(i, .1, .8)} style="gap:10px; flex-shrink:0">
<div style="width:14px; height:14px; border-radius:7px; background:{ACC if i==here else (INK if on else "transparent")}; border:2px solid {INK if on else DIM}; box-sizing:border-box"></div>
<span class="h" style="color:{INK if on else DIM}">{n}</span></div>''')
        if i < len(names)-1:
            out.append(f'<div style="flex-grow:1; height:2px; background:{INK if i < here else LINE}; min-width:24px"></div>')
    return f'<div class="row" style="gap:10px">{"".join(out)}</div>'

def screen_landing():
    body = f'''<div class="root">
<div class="disc" style="left:-180px; top:-140px; width:560px; height:560px; background:{YEL}"></div>
<div class="disc" style="right:-90px; bottom:-120px; width:340px; height:340px; background:{BLUE}; opacity:.9"></div>
<div style="position:absolute; left:0; right:0; top:0; height:10px; background:{ACC}"></div>
<div style="padding:64px 64px 0; box-sizing:border-box; height:{H}px; display:flex; flex-direction:column">
  <div class="row" style="justify-content:space-between">
    <div class="brand" style="font-size:26px">(Re)<b>Configure</b></div>
    <div class="h">ETH Zürich · MAS DFAB · Shrey Tatamiya</div>
  </div>
  <div style="flex-grow:1; display:flex; align-items:center; gap:80px; padding-bottom:40px">
    <div style="width:620px">
      <div class="t blur" style="font-size:88px; line-height:0.88">Draw the flat<br>you want<br>to live in.</div>
      <div class="p rise" {d(2)} style="font-size:18px; line-height:1.5; margin-top:28px; max-width:460px">
        Then the building arranges itself around everybody's flats. You and your
        neighbours decide together how much is shared, and where it goes.</div>
    </div>
    <div style="width:400px; display:flex; flex-direction:column; gap:14px">
      <div class="btn rise" {d(3)} style="height:76px; font-size:26px"><span>Start a flat</span><span>→</span></div>
      <div class="btn2 rise" {d(4)} style="height:64px; font-size:20px"><span>Join a group</span><span>→</span></div>
      <div class="btn2 rise" {d(5)} style="height:64px; font-size:20px"><span>Open a file</span><span>→</span></div>
      <div class="s rise" {d(6)} style="margin-top:6px">Already sent your flat? <a>Go to your group</a></div>
    </div>
  </div>
  <div style="padding:22px 0 34px; border-top:3px solid {INK}">
    <div class="h" style="margin-bottom:14px">How it goes</div>
    {journey(0)}
  </div>
</div>
{note(760, 560, "The whole journey on the first screen, so a resident knows what they are in for. This is also the user-journey slide.", 300)}
</div>'''
    return HEAD + body + TAIL

def flat_column(state="drawn"):
    if state == "empty":
        nums = f'''<div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px; opacity:.35">
        <div class="num"><span class="v">—</span><span class="l">area</span></div>
        <div class="num"><span class="v">—</span><span class="l">storeys</span></div>
        <div class="num"><span class="v">—</span><span class="l">glazing</span></div></div>'''
        title = '<div class="t" style="font-size:34px; color:'+DIM+'">Untitled</div>'
        note_line = f'<div class="p" style="color:{MUTE}">Drag a room onto the grid to start. Nothing is checked until you do.</div>'
        send = f'<div class="btn2" style="opacity:.4"><span>Send it to your group</span><span>→</span></div>'
    else:
        nums = f'''<div style="display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:10px">
        <div class="num"><span class="v">70<small style="font-size:15px"> m²</small></span><span class="l">area</span></div>
        <div class="num"><span class="v">1</span><span class="l">storey</span></div>
        <div class="num"><span class="v">3.6<small style="font-size:15px"> m</small></span><span class="l">glazing</span></div></div>'''
        title = '<div class="t" style="font-size:34px">Unit 6</div>'
        note_line = f'<div class="row"><div class="chip acc">1 must fix</div><div class="s">no way in yet · <a>show me</a></div></div>'
        send = f'<div class="btn"><span>Send it to your group</span><span>→</span></div>'
    return f'''<div style="width:340px; display:flex; flex-direction:column; gap:14px">
  <div class="card rise" {d(0)} style="gap:12px">
    <div class="row" style="justify-content:space-between"><span class="h">Your flat</span><span class="h" style="font-size:14px">–</span></div>
    {title}{nums}{note_line}
  </div>
  <div class="card rise" {d(1)} style="gap:12px">
    <div class="h">Your group</div>
    <div class="p"><b>room1</b> · you are <b>Ana</b> <span class="s">· change</span></div>
    {send}
    <div class="s">Your neighbours see it within seconds. It becomes Flat 6 and Unit 6.</div>
  </div>
  <div class="card rise" {d(2)} style="gap:6px; background:transparent; border-top-style:dashed">
    <div class="row" style="justify-content:space-between"><span class="h" style="color:{INK}">More</span><span class="h" style="font-size:14px">+</span></div>
    <div class="s">Design number · colour · save the files · replace an older version</div>
  </div>
</div>'''

def grid_svg(w, h, ghost=False):
    dots = []
    for i in range(-7, 8):
        for j in range(-7, 8):
            x = w/2 + (i - j) * 26; y = h/2 + (i + j) * 13
            dots.append(f'<circle cx="{x:.0f}" cy="{y:.0f}" r="1.4" fill="{DIM}"/>')
    edge = [(w/2 + (i-j)*26, h/2 + (i+j)*13) for (i, j) in ((-7,-7),(7,-7),(7,7),(-7,7))]
    e = " ".join(f"{a:.0f},{b:.0f}" for a, b in edge)
    gh = ""
    if ghost:
        p = [(w/2 + (i-j)*26, h/2 + (i+j)*13) for (i, j) in ((-3,-3),(1,-3),(1,1),(-3,1))]
        gp = " ".join(f"{a:.0f},{b:.0f}" for a, b in p)
        gh = (f'<polygon points="{gp}" fill="{ACC}" fill-opacity=".08" stroke="{ACC}" stroke-width="2" stroke-dasharray="8 6"/>'
              f'<text x="{w/2-30:.0f}" y="{h/2-8:.0f}" font-family="Jost, sans-serif" font-weight="600" font-size="13" letter-spacing="1.4" fill="{ACC}">DROP A ROOM HERE</text>')
    return f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}"><polygon points="{e}" fill="none" stroke="{INK}" stroke-width="1.5"/>{"".join(dots)}{gh}</svg>'

def palette_col():
    groups = [("Rooms", [("Living Room", "7×5", ACC), ("Kitchen", "4×4", YEL), ("Bedroom, small", "5×4", BLUE), ("Bedroom, large", "6×5", BLUE), ("Bathroom", "4×4", DIM), ("WC", "2×3", DIM)]),
              ("Circulation & outdoor", [("Hall", "1×1", INK), ("Outdoor", "1×1", "#3f7d54")]),
              ("Structure & access", [("Stair, straight", "2×8", DIM), ("Entrance", "exterior edge", ACC)])]
    out = []
    k = 0
    for name, items in groups:
        out.append(f'<div class="h" style="margin-top:14px">{name}</div>')
        cells = "".join(f'''<div class="rise" {d(k+i, .05, .2)} style="display:flex; align-items:center; gap:8px; padding:8px; border:1.5px solid {LINE}">
<div style="width:16px; height:16px; background:{c}"></div><div><div class="p" style="font-size:12px; font-weight:500; line-height:1.2">{n}</div><div class="s" style="font-size:10px">{s}</div></div></div>''' for i, (n, s, c) in enumerate(items))
        k += len(items)
        out.append(f'<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px">{cells}</div>')
    return f'''<div style="width:260px; display:flex; flex-direction:column; gap:6px; padding-right:6px">
<div class="h" style="color:{INK}">Place</div>
<div class="s">Drag a tile onto the grid. Press ? for every shortcut.</div>
{"".join(out)}
<div class="h" style="margin-top:16px">Floors</div>
<div class="row" style="justify-content:space-between; padding:10px 12px; background:{INK}; color:{BG}"><span class="h" style="color:{BG}">Floor 0</span><span>◉</span></div>
<div class="btn2" style="height:38px; font-size:14px; margin-top:6px"><span>+ Add floor</span><span></span></div>
</div>'''

def screen_flat_empty():
    body = f'''<div class="root">{bar_flat(1)}
<div class="main" style="gap:20px">
  {palette_col()}
  <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; position:relative">
    {grid_svg(700, 560, ghost=True)}
  </div>
  {flat_column("empty")}
</div>
{note(300, 690, "First run: no error before the resident has done anything. The numbers are dashes, the check line is a hint, Send is asleep until there is something to send.", 320)}
{note(690, 690, "One ghost tile shows where the first room goes. It fades once anything is placed.", 230)}
</div>'''
    return HEAD + body + TAIL

def screen_flat_draw2():
    body = f'''<div class="root">{bar_flat(1)}
<div class="main" style="gap:20px">
  {palette_col()}
  <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; position:relative">
    <svg width="700" height="560" viewBox="0 0 700 560" class="draw">
      <g stroke="{INK}" fill="none" stroke-width="2.5">
        <polygon points="350,120 570,230 350,340 130,230" pathLength="1" style="--d:.1s"/>
        <line x1="240" y1="175" x2="460" y2="285" pathLength="1" style="--d:.5s"/>
        <line x1="350" y1="120" x2="350" y2="340" pathLength="1" style="--d:.6s"/>
      </g>
      <polygon points="350,340 460,285 530,320 420,375" fill="{YEL}" fill-opacity=".55" stroke="{INK}" stroke-width="2" stroke-dasharray="7 5"/>
      <line x1="350" y1="120" x2="460" y2="175" stroke="{ACC}" stroke-width="6"/>
      <line x1="130" y1="230" x2="240" y2="285" stroke="{ACC}" stroke-width="6"/>
      <g font-family="Jost, sans-serif" font-weight="600" font-size="11" letter-spacing="1.4" fill="{MUTE}">
        <text x="255" y="200">LIVING / 24 M²</text><text x="255" y="290">BEDROOM / 14 M²</text>
        <text x="370" y="205">KITCHEN</text><text x="380" y="300">BATH</text><text x="430" y="345" fill="{INK}">BALCONY</text>
        <text x="130" y="430">RED EDGE = GLAZING · YELLOW = OPEN AIR</text>
      </g>
    </svg>
    <div style="position:absolute; right:0; bottom:0; display:flex; gap:8px; align-items:flex-end">
      <div class="card" style="padding:10px 14px; gap:6px"><div class="h">View</div>
        <div class="row" style="gap:6px"><div class="chip on">Cutaway</div><div class="chip">Solid</div><div class="chip">Frame</div></div></div>
      <div class="card" style="padding:10px; gap:4px; align-items:center"><div class="h">North 0°</div>
        <svg width="54" height="54" viewBox="0 0 54 54"><circle class="ring" cx="27" cy="27" r="22" fill="none" stroke="{LINE}" stroke-width="1" stroke-dasharray="2 5"/><circle cx="27" cy="27" r="16" fill="none" stroke="{INK}" stroke-width="1.5"/><polygon points="27,8 31,27 23,27" fill="{ACC}"/><polygon points="27,46 31,27 23,27" fill="{INK}"/></svg></div>
    </div>
  </div>
  {flat_column()}
</div>
{note(300, 96, "One view cluster in one corner: cutaway, solid, frame, north. Not three places.", 250)}
{note(690, 96, "The column is the only place anything leaves this app. The top bar only brings things in: Units, Open.", 250)}
{note(300, 690, "“More” holds the design number, the colour and the file checkboxes. One click, not four decisions up front.", 250)}
</div>'''
    return HEAD + body + TAIL


def bar_flat2(step, strip=True):
    steps = []
    for i, s in enumerate(["Draw your flat", "Send it"], 1):
        cls = "done" if i < step else ("now" if i == step else "")
        steps.append(f'<div class="step {cls}"><span class="n">0{i}</span>{s}</div>')
    st = ""
    if strip:
        st = (f'<div class="row" style="gap:13px; padding:0 14px; border-left:1px solid {LINE}; height:64px; align-items:center">'
              f'<div class="num"><span class="v" style="font-size:22px">70<small style="font-size:11px"> m²</small></span><span class="l">area</span></div>'
              f'<div class="num"><span class="v" style="font-size:22px">1</span><span class="l">storey</span></div>'
              f'<div class="num"><span class="v" style="font-size:22px">3.6<small style="font-size:11px"> m</small></span><span class="l">glazing</span></div>'
              f'<div class="chip acc" style="white-space:nowrap">1 must fix</div></div>')
    return (f'<div class="bar" style="gap:0"><div class="brand" style="padding:0 18px 0 4px; font-size:18px">(Re)<b>Configure</b></div>'
            f'<div class="steps">{"".join(steps)}</div>{st}<div style="flex-grow:1"></div>'
            f'<div class="row" style="gap:5px; padding:0 16px 0 14px; border-left:1px solid {LINE}"><div class="chip on">Model</div><div class="chip">Plan</div><div class="chip">Diagram</div>'
            f'<div class="ghost">Units</div><div class="ghost">Open</div><div class="ghost">?</div></div></div>')

def screen_step1():
    body = f"""<div class="root">{bar_flat2(1)}
<div class="main" style="gap:20px">
  {palette_col()}
  <div style="flex-grow:1; display:flex; align-items:center; justify-content:center; position:relative">
    <svg width="880" height="620" viewBox="0 0 880 620" class="draw">
      <g stroke="{INK}" fill="none" stroke-width="2.5">
        <polygon points="440,120 720,260 440,400 160,260" pathLength="1" style="--d:.1s"/>
        <line x1="300" y1="190" x2="580" y2="330" pathLength="1" style="--d:.5s"/>
        <line x1="440" y1="120" x2="440" y2="400" pathLength="1" style="--d:.6s"/>
      </g>
      <polygon points="440,400 580,330 670,375 530,445" fill="{YEL}" fill-opacity=".55" stroke="{INK}" stroke-width="2" stroke-dasharray="7 5"/>
      <line x1="440" y1="120" x2="580" y2="190" stroke="{ACC}" stroke-width="6"/>
      <line x1="160" y1="260" x2="300" y2="330" stroke="{ACC}" stroke-width="6"/>
      <g font-family="Jost, sans-serif" font-weight="600" font-size="11" letter-spacing="1.4" fill="{MUTE}">
        <text x="320" y="220">LIVING / 24 M²</text><text x="320" y="335">BEDROOM / 14 M²</text>
        <text x="465" y="225">KITCHEN</text><text x="475" y="345">BATH</text><text x="545" y="415" fill="{INK}">BALCONY</text>
        <text x="160" y="510">RED EDGE = GLAZING · YELLOW = OPEN AIR</text>
      </g>
    </svg>
    <div style="position:absolute; right:0; bottom:0; display:flex; gap:8px; align-items:flex-end">
      <div class="card" style="padding:10px 14px; gap:6px"><div class="h">View</div>
        <div class="row" style="gap:6px"><div class="chip on">Cutaway</div><div class="chip">Solid</div><div class="chip">Frame</div></div></div>
      <div class="card" style="padding:10px; gap:4px; align-items:center"><div class="h">North 0°</div>
        <svg width="54" height="54" viewBox="0 0 54 54"><circle class="ring" cx="27" cy="27" r="22" fill="none" stroke="{LINE}" stroke-width="1" stroke-dasharray="2 5"/><circle cx="27" cy="27" r="16" fill="none" stroke="{INK}" stroke-width="1.5"/><polygon points="27,8 31,27 23,27" fill="{ACC}"/><polygon points="27,46 31,27 23,27" fill="{INK}"/></svg></div>
    </div>
  </div>
</div>
{note(300, 690, "No right panel. The numbers live as a thin strip in the bar and stay live while you draw. The check chip is red until the flat holds together.", 280)}
{note(620, 690, "The drawing gets the whole middle. One panel on screen, never two.", 200)}
{note(870, 690, "“02 Send” lights up once the flat has a way in. Clicking it is the whole of step two.", 230)}
</div>"""
    return HEAD + body + TAIL

def screen_step2():
    body = f"""<div class="root">{bar_flat2(2, strip=False)}
<div class="main" style="gap:60px; align-items:center; padding:32px 64px">
  <div style="flex-grow:1; display:flex; flex-direction:column; align-items:center; gap:18px">
    <div class="h">Your flat, as your neighbours will see it</div>
    <svg width="620" height="440" viewBox="0 0 620 440" class="draw">
      <g stroke="{INK}" fill="none" stroke-width="2.5">
        <polygon points="310,70 540,185 310,300 80,185" pathLength="1" style="--d:.2s"/>
        <line x1="195" y1="127" x2="425" y2="242" pathLength="1" style="--d:.6s"/>
        <line x1="310" y1="70" x2="310" y2="300" pathLength="1" style="--d:.7s"/>
        <polygon points="310,300 310,340 80,225 80,185" pathLength="1" fill="{PANEL2}" style="--d:.9s"/>
        <polygon points="310,300 310,340 540,225 540,185" pathLength="1" fill="{PANEL2}" style="--d:1s"/>
      </g>
      <polygon points="310,300 425,242 500,280 385,338" fill="{YEL}" fill-opacity=".55" stroke="{INK}" stroke-width="2" stroke-dasharray="7 5"/>
      <line x1="310" y1="70" x2="425" y2="127" stroke="{ACC}" stroke-width="6"/>
      <line x1="80" y1="185" x2="195" y2="242" stroke="{ACC}" stroke-width="6"/>
    </svg>
    <div class="row rise" {d(2)} style="gap:36px">
      <div class="num"><span class="v">70<small style="font-size:15px"> m²</small></span><span class="l">area</span></div>
      <div class="num"><span class="v">1</span><span class="l">storey</span></div>
      <div class="num"><span class="v">3.6<small style="font-size:15px"> m</small></span><span class="l">glazing</span></div>
      <div class="num"><span class="v">4</span><span class="l">rooms</span></div>
      <div class="row"><div class="chip">All checks pass</div></div>
    </div>
  </div>
  <div style="width:420px; display:flex; flex-direction:column; gap:16px">
    <div class="t blur" style="font-size:56px">Send it to<br>your group.</div>
    <div class="card rise" {d(2)} style="gap:16px; padding:24px">
      <div class="field"><span class="h">Your group</span><div class="input" style="font-size:22px">room1</div></div>
      <div class="field"><span class="h">Your name</span><div class="input" style="font-size:22px">Ana</div></div>
      <div class="btn" style="height:64px; font-size:24px"><span>Send it</span><span>→</span></div>
      <div class="s">It becomes Flat 6 and Unit 6. Your neighbours see it within seconds.</div>
    </div>
    <div class="card rise" {d(3)} style="gap:6px; background:transparent; border-top-style:dashed">
      <div class="row" style="justify-content:space-between"><span class="h" style="color:{INK}">More</span><span class="h" style="font-size:14px">+</span></div>
      <div class="s">Design number · colour · save the files · replace an older version</div>
    </div>
  </div>
</div>
{note(60, 730, "Step two is its own screen. The palette is gone, the flat is shown whole, and there is one thing to do.", 320)}
{note(640, 96, "The group fields sit next to the button that uses them, not in a sidebar three steps away.", 260)}
</div>"""
    return HEAD + body + TAIL

SCREENS = {"Landing": screen_landing, "FlatEmpty": screen_flat_empty, "FlatDraw": screen_step1, "FlatSend": screen_step2, "Join": screen_join, "Wishes": screen_wishes, "Group": screen_group,
           "YourFlat": screen_yourflat, "Vote": screen_vote, "Architect": screen_architect}

if __name__ == "__main__":
    os.chdir(os.path.dirname(os.path.abspath(__file__)))
    for name, fn in SCREENS.items():
        fname = "Main.dc.html" if name == "Group" else f"{name}.dc.html"
        with open(fname, "w") as f: f.write(fix(fn()))
    gap, rgap = 80, 140
    rows = [["Landing.dc.html", "FlatEmpty.dc.html", "FlatDraw.dc.html", "FlatSend.dc.html"], ["Join.dc.html", "Wishes.dc.html", "Main.dc.html"], ["YourFlat.dc.html", "Vote.dc.html", "Architect.dc.html"]]
    titles = {"Landing.dc.html": "Flat app · 00 Landing", "FlatEmpty.dc.html": "Flat app · 01 Empty, first run", "FlatDraw.dc.html": "Flat app · 01 Draw your flat", "FlatSend.dc.html": "Flat app · 02 Send it to your group", "Join.dc.html": "Building app · 01 Join", "Wishes.dc.html": "Building app · 02 Your wishes", "Main.dc.html": "Building app · 03 The group", "YourFlat.dc.html": "Building app · 04 Your flat", "Vote.dc.html": "Building app · 05 Vote", "Architect.dc.html": "Building app · the Architect drawer"}
    boards = [{"file": f, "x": c*(W+gap), "y": r*(H+rgap), "w": W, "h": H, "title": titles[f]} for r, row in enumerate(rows) for c, f in enumerate(row)]
    canvas = {"artboards": boards,
              "annotations": [
                  {"id": "brief", "x": W+gap, "y": 40, "w": 520, "text": "(Re)Configure, the final interface. Third pass, Bauhaus on paper, 3 Sept 2026.\nTop row: the flat app. Rows two and three: the building app, five steps left to right, plus the Architect drawer.\nMotion is part of the design: click into an artboard and reload it to see the building draw itself, the numbers count, the radar trace, the heading type. Orange = the one primary action per screen. Orange NOTE blocks are for the reader, not part of the interface."},
                  {"id": "taste", "x": 2*(W+gap), "y": 40, "w": 460, "text": "Where the look comes from:\n· Bauhaus: paper, black rules, red / blue / yellow, circles and triangles as controls, a flat square-cut condensed face (Big Shoulders) with Jost (a Futura cousin) for reading\n· BASEBORN: heavy uppercase, a clock in the bar, hover that moves\n· Critical Danger: the headline arrives out of a blur, one hot colour\n· SearchSystem: tiny mono labels, slashes, numbered everything, corner marks on frames\n· anime.js: instrument rings with tick marks, typed-in text, numbers that count\n· Smithsons' Soho House: as found. The building is drawn as lines first, skin second."}],
              "launch": {"view": "canvas"}}
    with open("canvas.json", "w") as f: json.dump(canvas, f, indent=2)
    print("wrote", len(SCREENS), "artboards")
