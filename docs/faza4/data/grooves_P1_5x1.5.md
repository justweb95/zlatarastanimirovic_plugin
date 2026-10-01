# Groove sweep, P1 5.0x1.5, size 62, yellow 585 (W0 = 6.560941993004 g state weight without groove)
# columns: form | rep type | width | depth | angle | radius(rep) | state weight g | removed g
v-groove-60 | v | 0.2 | 0.17321 | 60 | 0 | 6.54455 | 0.01639
v-groove-60 | v | 0.3 | 0.25981 | 60 | 0 | 6.52829 | 0.03266
v-groove-60 | v | 0.4 | 0.34641 | 60 | 0 | 6.49575 | 0.06519
v-groove-60 | v | 0.5 | 0.43301 | 60 | 0 | 6.46347 | 0.09747
v-groove-90 | v | 0.2 | 0.1 | 90 | 0 | 6.55146 | 0.00948
v-groove-90 | v | 0.3 | 0.15 | 90 | 0 | 6.54203 | 0.01892
v-groove-90 | v | 0.4 | 0.2 | 90 | 0 | 6.52315 | 0.03779
v-groove-90 | v | 0.5 | 0.25 | 90 | 0 | 6.50436 | 0.05658
v-groove-120 | v | 0.2 | 0.05774 | 120 | 0 | 6.55546 | 0.00548
v-groove-120 | v | 0.3 | 0.0866 | 120 | 0 | 6.55000 | 0.01094
v-groove-120 | v | 0.4 | 0.11547 | 120 | 0 | 6.53907 | 0.02187
v-groove-120 | v | 0.5 | 0.14434 | 120 | 0 | 6.52817 | 0.03277
u-groove | u | 0.35 | 0.03 | - | 0.175 | 6.55240 | 0.00854
u-groove | u | 0.5 | 0.06 | - | 0.25 | 6.53252 | 0.02842
u-groove | u | 0.8 | 0.15 | - | 0.4 | 6.44770 | 0.11324
u-groove | u | 1.0 | 0.27 | - | 0.5 | 6.30750 | 0.25344
u-groove | u | 1.5 | 0.3 | - | 0.75 | 6.13911 | 0.42184
u-groove | u | 2.0 | 0.4 | - | 1.0 | 5.81435 | 0.74659
u-groove | u | 1.2 | 0.6 | - | 0.6 | 5.89503 | 0.66591
convex-u-groove | bump | 1.0 | 0.1 | - | 0.5 | 6.56094 | 0
convex-u-groove | bump | 1.5 | 0.1 | - | 0.75 | 6.56094 | 0
square-groove | rect | 0.3,0.5,0.8,1.0,1.5,2.0 x depth 0.05..0.50 step 0.05 (independent) ; removed = rho*w*d*2pi*(Ro-d/2) exactly
square-groove | rect | 0.3 | 0.05 | 6.54672 | 0.01422 ; 0.3x0.5 0.13936 ; 0.5x0.5 0.23226 ; 0.8x0.5 0.37162 ; 1.0x0.5 0.46453 ; 1.5x0.5 0.69679 ; 2.0x0.05 0.09479 ; 2.0x0.5 0.92906
perlage | round | bead widths 0.35/0.5/0.75/0.9/1.2 | depth 0.1 | state weight unchanged 6.56094
# coupling: V forms: width<->depth locked by angle (d = w/2 / tan(angle/2)); U: 7 fixed (w,d) presets, choosing one sets both; square: width and depth independent; convex: w 1.0/1.5, height 0.1; perlage: 5 sizes
# position slider limits at default width (W=5): V w0.2 [0.4,4.6]; U w0.35 [0.325,4.675]; convex [0,5]; square w0.3 [0.35,4.65]; perlage w0.5 [0.25,4.75]; step 0.01
# surface: polished only for all design grooves (perlage: none)
# price (ring left only): none 5988; V60 6198 (ek 2519.40 = +13 zł/g); V90 5988; V120 5988; U 6198; convex 5988; square 6198; perlage 6198. Price DTO weight stays 6.560941993004 (groove volume ignored)
