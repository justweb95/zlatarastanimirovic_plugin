import math, re, json, numpy as np
import os
_T=os.path.dirname(os.path.abspath(__file__)); _D=os.path.join(_T,'..','data')
exec(open(os.path.join(_T,'profgeo.py')).read()); exec(open(os.path.join(_T,'builder.py')).read())
Rin=62/(2*math.pi)
def from_tokens(l):
    name,dims,_,*t=l.split(' '); W,H=map(float,dims.split('x'))
    if t[0].startswith('Ft'):
        if t[1].startswith('S('): dx,dy=map(float,t[1][2:-1].split(',')); top=('chamfer',dx,dy); rt=0; i=2
        else: top=('flat',); rt=float(t[1][1:]); i=2
    elif t[0].startswith('AR'): top=('dome',float(t[0][2:])); rt=float(t[3][1:]); i=4
    else: return None
    if i<len(t) and t[i].startswith('W'): i+=1
    rest=t[i:]
    if rest[0].startswith('S('): dx,dy=map(float,rest[0][2:-1].split(',')); inner=('slope',dx,dy,float(rest[1][2:])); ri=0
    else:
        ri=float(rest[0][1:])
        if rest[1].startswith('Fi'): inner=('flat',)
        elif rest[1].startswith('AR'): inner=('dome',float(rest[1][2:]))
        else: return None
    out=build(W,H,top,inner,rt,ri); return name,W,H,outline(out,W,0.002)
def geom_index():
    G={}
    for l in open(os.path.join(_D,'wama_matrix_halfprofiles.txt')):
        if l[0]!='P': continue
        r=from_tokens(l.strip())
        if r: G[(r[0],r[1],r[2])]=('rebuilt',r[3])
    for l in open(os.path.join(_D,'wama_sweep_paths.txt')):
        if l[0]!='P': continue
        p,req,W,H,ad,wt,d=l.strip().split('|'); G[(p,float(W),float(H))]=('api',sample(parse_compact(d),0.002))
    for l in open(os.path.join(_D,'wama_paths_5x1.5.txt')):
        if l[0]!='P': continue
        p,W,H,sf,wt,d=l.strip().split('|'); G[(p,float(W),float(H))]=('api',sample(parse_compact(d),0.002))
    return G
def meas(P,W,H):
    m=metrics(P); at=m['at']
    t=lambda x:(lambda ab:ab[1]-ab[0])(at(x))
    xs=P[:,0]; z=H/2-P[:,1]; band=z[np.abs(xs)>=W/2-0.3]
    return dict(tC=t(0.0),tE=t(W/2-0.25),mean=m['A']/W,band=band.max()-band.min(),Din=2*Rin,Dout=2*(Rin+H))
