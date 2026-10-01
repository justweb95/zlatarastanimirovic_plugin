# Reconstruct a Wama-style ring cross-section from parameters (right half, mirrored).
# Coordinates: x across the band (0 = centre), y DOWN, y=0 = middle of H, outer apex at y=-H/2, inner apex at y=+H/2.
import math
def build(W,H,top,inner,rt,ri,wall_side=True):
    """top: ('flat',) | ('dome',R) | ('chamfer',dx,dy) | ('conc',R)   (conc = hollow top, rim at y=-H/2 at the side fillet)
       inner: ('flat',) | ('dome',R) | ('slope',dx,dy,R)  (slope from wall bottom inward, then dome R)
       rt/ri: corner fillet radii (top / inner); ri shrinks automatically if the wall would be negative.
       returns dict with key points and the wall length."""
    c=W/2; out={}
    # ---- top: find tangent point on side (x=c, y=yTopSide) and on top primitive
    if top[0]=='flat':
        yt=-H/2; ytSide=yt+rt; out['top']=[('L',(0,yt),(c-rt,yt)),('A',(c-rt,yt),(c,ytSide),rt,(c-rt,yt+rt))]
    elif top[0]=='dome':
        R=top[1]; yc=-H/2+R; d=R-rt; fx=c-rt; fy=yc-math.sqrt(d*d-fx*fx)
        tx,ty=fx*R/d,yc+(fy-yc)*R/d; ytSide=fy
        out['top']=[('A',(0,-H/2),(tx,ty),R,(0,yc)),('A',(tx,ty),(c,fy),rt,(fx,fy))]
    elif top[0]=='chamfer':
        dx,dy=top[1],top[2]; yt=-H/2; ytSide=yt+dy; out['top']=[('L',(0,yt),(c-dx,yt)),('L',(c-dx,yt),(c,ytSide))]
    elif top[0]=='conc':
        R=top[1]; out['top']=None; ytSide=None
    # ---- inner
    if inner[0]=='flat':
        yb=H/2
        def inner_side(r): return yb-r
        def inner_geom(r): return [('A',(c,yb-r),(c-r,yb),r,(c-r,yb-r)),('L',(c-r,yb),(0,yb))]
    elif inner[0]=='dome':
        R=inner[1]; yc=H/2-R
        def inner_side(r):
            d=R-r; fx=c-r; return yc+math.sqrt(d*d-fx*fx)
        def inner_geom(r):
            d=R-r; fx=c-r; fy=yc+math.sqrt(d*d-fx*fx); tx,ty=fx*R/d,yc+(fy-yc)*R/d
            return [('A',(c,fy),(tx,ty),r,(fx,fy)),('A',(tx,ty),(0,H/2),R,(0,yc))]
    elif inner[0]=='slope':
        dx,dy,R=inner[1],inner[2],inner[3]; yc=H/2-R
        # slope ends at x=c-dx on the dome circle
        xe=c-dx; ye=yc+math.sqrt(R*R-xe*xe); ys=ye-dy
        def inner_side(r): return ys
        def inner_geom(r): return [('L',(c,ys),(xe,ye)),('A',(xe,ye),(0,H/2),R,(0,yc))]
        ri=0
    r=ri; ybSide=inner_side(r)
    if ytSide is not None and ybSide<ytSide-1e-9 and inner[0]!='slope':
        # shrink inner fillet until wall = 0 (bisection)
        lo,hi=0.0,ri
        for _ in range(80):
            m=(lo+hi)/2
            if inner_side(m)<ytSide: hi=m
            else: lo=m
        r=lo; ybSide=inner_side(r)
    out['inner']=inner_geom(r); out['ri_used']=r
    out['wall']=None if ytSide is None else ybSide-ytSide
    out['ytSide'],out['ybSide']=ytSide,ybSide
    return out

def outline(out,W,step=0.002):
    """Sample a full closed outline (both halves) from build() output; y down."""
    import numpy as np
    pts=[]
    def arc(a,b,r,c):
        a0=math.atan2(a[1]-c[1],a[0]-c[0]); a1=math.atan2(b[1]-c[1],b[0]-c[0]); da=a1-a0
        while da>math.pi: da-=2*math.pi
        while da<-math.pi: da+=2*math.pi
        n=max(2,int(abs(da)*r/step)+1)
        return [(c[0]+r*math.cos(a0+da*k/n), c[1]+r*math.sin(a0+da*k/n)) for k in range(n)]
    def seg(s):
        if s[0]=='L':
            a,b=s[1],s[2]; n=max(1,int(math.hypot(b[0]-a[0],b[1]-a[1])/step)+1)
            return [(a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n) for k in range(n)]
        return arc(s[1],s[2],s[3],s[4])
    right=[]
    for s in out['top']: right+=seg(s)
    right+=seg(('L',(W/2,out['ytSide']),(W/2,out['ybSide'])))
    for s in out['inner']: right+=seg(s)
    right.append(right[-1])
    left=[(-x,y) for (x,y) in reversed(right)]
    return np.array(right+left)
