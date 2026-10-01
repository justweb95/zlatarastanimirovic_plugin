import re, math, numpy as np
def parse_compact(d):
    """Parse compact SVG path (units 0.01 mm). Returns list of segments in mm: ('L',a,b) or ('A',a,b,r,large,sweep)."""
    toks=re.findall(r'[MLAZ]|[+-](?=\d|\.)|-?\d+(?:\.\d+)?', d.replace('+',' + ').replace('A',' A ').replace('L',' L ').replace('M',' M ').replace('Z',' Z '))
    # re-tokenise robustly: handle arc marker after two radii
    s=d.replace('Z',' Z ').replace('M',' M ').replace('L',' L ').replace('A',' A ')
    parts=s.split(); i=0; segs=[]; cur=None; start=None
    def num(t): return float(t)/100.0
    while i<len(parts):
        c=parts[i]; i+=1
        if c=='M': cur=(num(parts[i]),num(parts[i+1])); start=cur; i+=2
        elif c=='L': p=(num(parts[i]),num(parts[i+1])); segs.append(('L',cur,p)); cur=p; i+=2
        elif c=='A':
            r1=num(parts[i]); rest=parts[i+1]; i+=2
            m=re.match(r'^(-?\d+(?:\.\d+)?)([+-])(-?\d+(?:\.\d+)?)?$',rest)
            r2=float(m.group(1))/100; sweep=1 if m.group(2)=='+' else 0
            if m.group(3) is not None: x=float(m.group(3))/100
            else: x=num(parts[i]); i+=1
            y=num(parts[i]); i+=1
            p=(x,y); segs.append(('A',cur,p,r1,0,sweep)); cur=p
        elif c=='Z':
            if math.hypot(cur[0]-start[0],cur[1]-start[1])>1e-9: segs.append(('L',cur,start))
            cur=start
    return segs
def arc_center(a,b,r,la,sw):
    (x1,y1),(x2,y2)=a,b; mx,my=(x1+x2)/2,(y1+y2)/2; dx,dy=(x2-x1)/2,(y2-y1)/2; d2=dx*dx+dy*dy
    h=math.sqrt(max(0,r*r-d2)); L=math.sqrt(d2) or 1; ux,uy=-dy/L,dx/L; sgn=-1 if la==sw else 1
    return (mx+sgn*h*ux, my+sgn*h*uy)
def sample(segs,step=0.002):
    pts=[]
    for s in segs:
        if s[0]=='L':
            a,b=s[1],s[2]; n=max(1,int(math.ceil(math.hypot(b[0]-a[0],b[1]-a[1])/step)))
            for k in range(n): pts.append((a[0]+(b[0]-a[0])*k/n, a[1]+(b[1]-a[1])*k/n))
        else:
            _,a,b,r,la,sw=s; c=arc_center(a,b,r,la,sw)
            a0=math.atan2(a[1]-c[1],a[0]-c[0]); a1=math.atan2(b[1]-c[1],b[0]-c[0]); da=a1-a0
            if sw==1:
                while da<0: da+=2*math.pi
            else:
                while da>0: da-=2*math.pi
            n=max(2,int(math.ceil(abs(da)*r/step)))
            for k in range(n): t=a0+da*k/n; pts.append((c[0]+r*math.cos(t), c[1]+r*math.sin(t)))
    return np.array(pts)
def metrics(P,inner_circ=62.0):
    x,y=P[:,0],P[:,1]; x2,y2=np.roll(x,-1),np.roll(y,-1); cr=x*y2-x2*y
    A=cr.sum()/2; cy=((y+y2)*cr).sum()/(6*A); A=abs(A)
    yTop,yBot=y.min(),y.max(); W=x.max()-x.min(); H=yBot-yTop
    def at(xq):
        hits=[]
        for k in range(len(P)):
            xa,ya,xb,yb=x[k],y[k],x2[k],y2[k]
            if (xa-xq)*(xb-xq)<=0 and xa!=xb: hits.append(ya+(yb-ya)*(xq-xa)/(xb-xa))
        return (min(hits),max(hits)) if hits else (np.nan,np.nan)
    Rin=inner_circ/(2*math.pi); Rc=Rin+(yBot-cy)
    return dict(W=W,H=H,A=A,yTop=yTop,yBot=yBot,cy=cy,Rc=Rc,vol=A*2*math.pi*Rc,at=at)
