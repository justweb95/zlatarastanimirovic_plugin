import json, math, numpy as np
import matplotlib; matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon, Circle, Rectangle
Rin = 62/(2*math.pi)
O = json.load(open('data/_outlines_for_figs.json'))
M1 = json.load(open('data/mesh_sections_batch1.json')); M23 = json.load(open('data/mesh_sections_batch2_3.json')); M4 = json.load(open('data/mesh_sections_batch4_profiles.json'))
def z(pts): return [[p[0], p[1]-Rin] for p in pts]
GOLD='#c9a646'; MESH='#d62728'
def ring_panel(ax, key, title, mesh_sets=(), xlim=None, ylim=None, beads=()):
    d = O[key]; poly = np.array(d['poly'])
    ax.add_patch(Polygon(poly, closed=True, fc='#f3e6b8', ec='#8a7330', lw=0.8))
    for g in d['grooves']:
        p = np.array(g['pts']); ax.plot(p[:,0], p[:,1], color='#1f4e9c', lw=1.4)
        ax.fill(np.r_[p[:,0], p[::-1,0]], np.r_[p[:,1], np.interp(p[::-1,0], p[:,0][np.argsort(p[:,0])], p[:,1][np.argsort(p[:,0])])*0+np.max(p[:,1])], color='white', alpha=0.0)
        lab = g['form'].replace('-groove','').replace('convex-u','convex') + f" {g['g']['width']}" + (f"x{g['g'].get('depth')}" if g['g'].get('depth') and g['form'] not in ('convex-u-groove',) else '')
        ax.text(g['g']['pos'], d['H']+0.12, lab, ha='center', va='bottom', fontsize=6.5, rotation=0)
    for ms in mesh_sets:
        m = np.array(z(ms)); ax.plot(m[:,0], m[:,1], 'o', ms=3.2, mfc='none', mec=MESH, mew=0.9)
    for (cx, cz, r) in beads: ax.add_patch(Circle((cx, cz), r, fc='none', ec='#7a5c00', lw=0.8, ls='--'))
    ax.set_aspect('equal'); ax.set_title(title, fontsize=8.5)
    ax.set_xlim(*(xlim or (-0.2, d['W']+0.2))); ax.set_ylim(*(ylim or (-0.1, d['H']+0.45)))
    ax.axhline(0, color='#999', lw=0.6, ls=':'); ax.tick_params(labelsize=7); ax.set_xlabel('x od leve ivice [mm]', fontsize=7); ax.set_ylabel('z iznad linije prsta [mm]', fontsize=7)

# Fig 1: groove types on flat profile P1
fig, axs = plt.subplots(3, 2, figsize=(13, 7.8))
ring_panel(axs[0,0], 'P1_V', 'P1 5x1.5: V60 / V90 / V120 (sirina 0.5)', mesh_sets=[M1['left_P1_5x1.5']['groove0_v60_w0.5_at1.0']], ylim=(0.6, 1.95))
axs[0,0].text(0.05, 0.66, 'crveni krugovi = tacke iz zive 3D mreze', fontsize=6.5, color=MESH)
ring_panel(axs[0,1], 'P1_U', 'P1 8x2: U preseti 0.5x0.06 / 0.8x0.15 / 1.0x0.27 / 0.35x0.03 / 1.5x0.3', mesh_sets=[M23['batch2_left_P1_8x2.0_R0_11.8676']['u_w1.0_d0.27_at3.3'], M23['batch2_left_P1_8x2.0_R0_11.8676']['u_w0.35_d0.03_at4.6']], ylim=(1.2, 2.45))
ring_panel(axs[1,0], 'P1_U2', 'P1 8x2: U preseti 2.0x0.4 i 1.2x0.6 (jedini polukrug)', ylim=(1.0, 2.45))
ring_panel(axs[1,1], 'P1_SQ', 'P1 8x2: kvadratni (sirina = dno, + kosina 0.1x0.1 sa obe strane)', ylim=(1.0, 2.45))
ring_panel(axs[2,0], 'P1_CP', 'P1 8x2: wypukly (convex) 1.5 i 1.0 + perlage kanal 0.5 i 1.2', mesh_sets=[M23['batch2_left_P1_8x2.0_R0_11.8676']['convex_w1.5_h0.1_at1.5'], M23['batch2_left_P1_8x2.0_R0_11.8676']['perlage_w1.2_at6.5_channel']], ylim=(1.4, 2.6),
           beads=[])
from matplotlib.patches import Ellipse
ax = axs[2,0]
for cx, w in ((5.0, 0.5), (6.5, 1.2)):
    d = 7/9*w; zt = 2.0 + 0.1655*(d/0.9333); zb = 2.0 - 0.1158*(d/0.9333)
    ax.add_patch(Ellipse((cx, (zt+zb)/2), d, zt-zb, fc='none', ec='#7a5c00', lw=0.9, ls='--'))
ax.text(6.5, 1.45, 'kuglica: izmerena sirina 0.933, visina 1.884-2.166 (oblik ESTIMATED)', fontsize=6, ha='center')
# edge panel: P1 6x1.5 with rabbet left and perlage right (schematic from measured points)
ax = axs[2,1]; d = O['P1_6x1.5']; poly = np.array(d['poly']); ax.add_patch(Polygon(poly, closed=True, fc='#f3e6b8', ec='#8a7330', lw=0.8))
b3 = M23['batch3_left_P1_6x1.5_3col_yellow_whitePd_red_edgeL_normal_0.3x0.05_edgeR_perlage_0.445']
for k in ('slice0_edge_band_groove_rect','slice3_edge_perlage_groove','slice3R_edge_perlage_floor','slice1_sepV_half','slice3_sepV_half'):
    m = np.array(z(b3[k])); ax.plot(m[:,0], m[:,1], 'o-', ms=3, color=MESH, lw=1)
for k in ('slice2_sepV_halves',):
    for seg in b3[k]: m = np.array(z(seg)); ax.plot(m[:,0], m[:,1], 'o-', ms=3, color=MESH, lw=1)
for x in b3['slices_offsets']: ax.axvline(x, color='#555', lw=0.6, ls='--')
ax.add_patch(Circle((5.805, 1.5-0.1+0.1), 0.195, fc='none', ec='#7a5c00', lw=0.8, ls='--'))
ax.text(0.02, 1.62, 'ivica "normal"\n0.3x0.05', fontsize=6.5); ax.text(5.0, 1.62, 'ivica perlage 0.445\n(kuglice 0.39)', fontsize=6.5)
ax.text(1.5, 1.62, 'granica traka\n(V90 0.2x0.1)', fontsize=6.5, ha='center'); ax.text(4.5, 1.62, 'granica traka', fontsize=6.5, ha='center')
for x0,x1,c,l in ((0,1.5,'#e8c86a','zuto'),(1.5,4.5,'#b9b7b7','belo Pd'),(4.5,6,'#e2ad8a','crveno')): ax.add_patch(Rectangle((x0,-0.08), x1-x0, 0.06, color=c)); ax.text((x0+x1)/2, -0.05, l, fontsize=6, ha='center', va='center')
ax.set_aspect('equal'); ax.set_xlim(-0.2, 6.2); ax.set_ylim(-0.1, 1.9); ax.set_title('P1 6x1.5: 3 trake + ivice (tacke iz zive 3D mreze)', fontsize=8.5); ax.tick_params(labelsize=7)
fig.suptitle('Wama zlebovi na ravnom profilu: plavo = rekonstrukcija (wamaMetalsGrooves.js), crveno = izmerene tacke iz 3D mreze', fontsize=10)
fig.tight_layout(); fig.savefig('figures/fig1_zlebovi_ravni_profil.png', dpi=150); plt.close(fig)

# Fig 2: grooves on domed / D profiles
fig, axs = plt.subplots(3, 1, figsize=(10, 11))
b2r = M23['batch2_right_P16_6x2.0']; b1r = M1['right_P16_6x2.0']
ring_panel(axs[0], 'P16_6x2', 'P16 6x2: convex 1.5 (poz 1.3), V90 0.5 (poz 3.0), kvadratni 0.3x0.5 (poz 4.4)', mesh_sets=[b1r['groove_convex_w1.5_h0.1_at1.3'], b1r['groove_v90_w0.5_at3.0'], b2r['square_w0.3_d0.5_at4.4']], ylim=(1.0, 2.5))
m4 = M4['left_P16_5x1.8_apex_11.6676']
ring_panel(axs[1], 'P16_5x1.8', 'P16 5x1.8: U 1.0x0.27 van centra (rotiran prema nagibu), V90 0.5 centar, kvadratni 0.3x0.3', mesh_sets=[m4['u_w1.0_d0.27_at1.2_offcentre_rotated'], m4['v90_w0.5_at2.5'], m4['square_w0.3_d0.3_at3.9']], ylim=(0.9, 2.3))
m4r = M4['right_P11_5x1.8_white']
ring_panel(axs[2], 'P11_5x1.8', 'P11 5x1.8 (D): kvadratni 0.5x0.3 (dno ravno, od nize ivice), V60 0.5 (dno = srednja visina ivica - dubina)', mesh_sets=[m4r['square_w0.5_d0.3_at1.3'], m4r['v60_w0.5_at3.8']], ylim=(0.9, 2.3))
fig.suptitle('Zlebovi na zaobljenim profilima: V i kvadratni ostaju radijalni, U i wypukly se rotiraju sa nagibom povrsine', fontsize=10)
fig.tight_layout(); fig.savefig('figures/fig2_zlebovi_na_profilima.png', dpi=150); plt.close(fig)

# Fig 3: divisions unrolled
def unrolled(ax, W, cuts, amp, cyc, colors, title):
    th = np.linspace(0, 2*np.pi, 721)
    bounds = [np.zeros_like(th)] + [c - amp*np.sin(cyc*th) for c in cuts] + [np.full_like(th, W)]
    for i in range(len(bounds)-1): ax.fill_between(np.degrees(th), bounds[i], bounds[i+1], color=colors[i], lw=0)
    for b in bounds[1:-1]: ax.plot(np.degrees(th), b, color='#333', lw=0.8)
    ax.set_xlim(0, 360); ax.set_ylim(0, W); ax.set_title(title, fontsize=8.5); ax.set_xlabel('ugao oko prstena [°]', fontsize=7); ax.set_ylabel('x po sirini [mm]', fontsize=7); ax.tick_params(labelsize=7); ax.set_xticks([0,90,180,270,360])
Y,Wt,R,Pd = '#e8c86a','#d9d6d2','#e2ad8a','#b9b7b7'
fig, axs = plt.subplots(3, 3, figsize=(13, 8.5))
W=6
unrolled(axs[0,0], W, [3], 0, 1, [Y,Wt], 'vertical-1-1 (rez 3.0)')
unrolled(axs[0,1], W, [2], 0, 1, [Y,Wt], 'vertical-1-2 (rez 2.0)')
unrolled(axs[0,2], W, [1.5,4.5], 0, 1, [Y,Wt,R], 'vertical-1-2-1 (rezovi 1.5 / 4.5)')
unrolled(axs[1,0], W, [3], 0.3*W/2, 2, [Y,Wt], 'wave-1-1: 30 %, 2 ciklusa (A = 0.9)')
unrolled(axs[1,1], W, [3], 0.7*W/2, 2, [Y,Wt], 'wave-1-1: 70 %, 2 ciklusa (A = 2.1)')
unrolled(axs[1,2], W, [3], 0.5*W/2, 6, [Y,R], 'wave-1-1: 50 %, 6 ciklusa')
unrolled(axs[2,0], W, [3], 0.3*W/2, 1, [Y,Wt], 'diagonal-1-1: 30 % (= 1 ciklus)')
unrolled(axs[2,1], W, [2,4], 0.3*W/2, 1, [Wt,Y,Wt], 'diagonal-1-1-1: obe granice paralelne')
unrolled(axs[2,2], W, [1.5,3.0,4.5], 0, 1, [Y,Wt,Y,Wt], 'vertical-free-4: rezovi pomerljivi (0.01 mm)')
fig.suptitle('Podela boja razvijena po obimu: trake idu oko celog prstena; granica x_b(θ) = rez − A·sin(n·θ), A = procenat/100 · W/2', fontsize=10)
fig.tight_layout(); fig.savefig('figures/fig3_podela_boja.png', dpi=150); plt.close(fig)

# Fig 4: metal LUT analysis
L = json.load(open('data/wama-lut-stops.json'))['metals']
def h2rgb(h): h=h.lstrip('#'); return np.array([int(h[i:i+2],16) for i in (0,2,4)])/255
def lab(c):
    l=np.where(c<=0.04045,c/12.92,((c+0.055)/1.055)**2.4); M=np.array([[0.4124,0.3576,0.1805],[0.2126,0.7152,0.0722],[0.0193,0.1192,0.9505]]); X=M@l; t=X/np.array([0.95047,1,1.08883])
    f=np.where(t>216/24389,np.cbrt(t),(24389/27*t+16)/116); return 116*f[1]-16, 500*(f[0]-f[1]), 200*(f[1]-f[2])
names = {'yellow':'zuto (yellow)','red':'crveno (red)','white':'belo Ni (white)','manganese':'manganovo (manganese)','white-pd':'belo Pd (white-pd)'}
fig = plt.figure(figsize=(12, 7.5)); gs = fig.add_gridspec(2, 2, height_ratios=[1, 1.2])
ax0 = fig.add_subplot(gs[0, :])
for i,(k,stops) in enumerate(L.items()):
    xs=np.array([s[0] for s in stops]); cs=np.array([h2rgb(s[1]) for s in stops]); xx=np.linspace(0,1,400); img=np.stack([np.interp(xx,xs,cs[:,j]) for j in range(3)],-1)
    ax0.imshow(img[None,:,:], extent=(0,1,i,i+0.8), aspect='auto')
    ax0.text(-0.01, i+0.4, names[k], ha='right', va='center', fontsize=8)
ax0.set_xlim(-0.0,1); ax0.set_ylim(-0.1, len(L)); ax0.set_yticks([]); ax0.set_xlabel('indeks LUT-a = osvetljenost reflektovanog okruzenja (0 = crno, 1 = belo)', fontsize=8); ax0.set_title('LUT gradijenti metala (izmereno u Fazi 1, iz Wama gradients/*.png)', fontsize=9)
ax1 = fig.add_subplot(gs[1,0]); ax2 = fig.add_subplot(gs[1,1])
cols = {'yellow':'#c9a646','red':'#c0704f','white':'#8f8a85','manganese':'#6f7590','white-pd':'#444444'}
for k,stops in L.items():
    xs=np.array([s[0] for s in stops]); cs=np.array([h2rgb(s[1]) for s in stops]); xx=np.linspace(0,1,201)
    labs=np.array([lab(np.array([np.interp(x,xs,cs[:,j]) for j in range(3)])) for x in xx])
    ax1.plot(xx, labs[:,0], color=cols[k], label=names[k]); ax2.plot(xx, np.hypot(labs[:,1],labs[:,2]), color=cols[k], label=names[k])
ax1.set_title('svetlina L* po indeksu', fontsize=9); ax2.set_title('zasicenost C* po indeksu', fontsize=9)
for a in (ax1,ax2): a.tick_params(labelsize=7); a.set_xlabel('indeks LUT-a', fontsize=8); a.grid(alpha=0.3)
ax1.legend(fontsize=7); fig.tight_layout(); fig.savefig('figures/fig4_metali_lut.png', dpi=150); plt.close(fig)
print('ok')
