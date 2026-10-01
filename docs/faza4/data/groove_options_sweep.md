# groove option sweep (right ring used as scratch; it carries 1 small diamond at the top centre, which moves default groove positions away from centre)
# values: width ids (0.01 mm), depth ids (0.01 mm), position slider [min,max] in mm from left edge
PROFILES P1,P2,P3,P4,P6,P8,P10,P11,P12,P13,P14,P16,P18 at 5x1.5: IDENTICAL option lists and position limits:
 v-groove-60 w [20,30,40,50] d [17,26,35,43] pos [0.4,4.6]
 v-groove-90 w [20,30,40,50] d [10,15,20,25] pos [0.4,4.6]
 v-groove-120 w [20,30,40,50] d [6,9,12,14] pos [0.4,4.6]
 u-groove w [35,50,80,100,120,150,200] d [3,6,15,27] (filtered by fit at default pos 3.925) pos [0.325,4.675]
 convex-u-groove w [100,150] d [10] pos [0,5]
 square-groove w [30,50,80,100,150,200] d [5..50 step 5] pos [0.35,4.65]
 perlage w [35,50,75,90,120] d [10] pos [0.25,4.75]
WIDTH P1 H1.5: 2 mm pos V [0.4,1.6] U [0.325,1.675] convex [0,2] sq [0.35,1.65] perl [0.25,1.75]; U depth list W2 [3,6,15,27] W3 all 7, W4 [3,6] (def pos 3.175), W6 [3,6,15,27,30,60] (def 4.675), W8/W12 all 7 => U presets filtered so groove edge stays >= 0.5 mm from ring edge at current position
HEIGHT P1 W5: H0.8 -> V60 d max 35 (0.433 removed), square d max 40; H1.0..2.5 full lists
HEIGHT P16 W5: H1.0 -> V60 d max 35, square d max 35; H1.5, 2.5 full
=> estimated rule: depth <= 0.5 * local wall thickness under the groove (min over groove width)
PRICE check: left ring with V60+U+square: ek 2519.401725313 = 6.560941993004*384 (same as single V60) ; right ring P16 6x2 V90+convex+perlage+diamond 0.002ct: ek 3649.50 = 9.320636923004*384 + 70.377 (ek-gold, diamond)
