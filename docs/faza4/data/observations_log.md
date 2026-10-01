# Observation log (transcribed from live API responses, 2026-10-01, container 6abd2fc176791b724e0ee716)

## Division preset sweep (left ring P1 5x1.5, yellow 585; price = shown vk)
none 5988 (1 disc) | vertical-1-1 6424 (cut 2.5) | vertical-1-2 6424 (cut 1.6667) | vertical-1-3 6424 (cut 1.25)
wave-1-1 6892 (cut 2.5, cyc 2, pct "30", slice amp 0.75 n 2) | diagonal-1-1 6892 (cyc 1, pct "30", amp 0.75 n 1)
vertical-1-1-1 / 2-1-1 / 3-1-1 / 4-1-1 / 1-2-1 / 1-3-1 / 1-4-1 / 2-1-2: 6424 (discCount 3)
diagonal-1-1-1 / 1-2-1 / 2-1-2: 6892 ; wave-1-1-1 / 1-2-1 / 2-1-2: 6892 (discCount 3, isWavy true)
NOTE diagonal-1-2-1 and wave-1-2-1 returned discs 1.6667/1.6667/1.6667 (cuts 1.6667, 3.3333)
vertical-free-2 6424 (cut limits [0.6,4.4]) | free-3 6424 ([0.6,2.8333],[2.1667,4.4]) | free-4 6424 (discCount 4) | free-5 6424 (discCount 5)
default colours from server: alternating yellow / white
3D: segments always [{start 0, end 1, slices[...], disks[...], grooves[...], perlages[...]}] in every preset tested (one segment)
three-colour diagonal/wave presets: both slices carry identical amplitude / cycles / shiftAngle 0

## Wave parameters (wave-1-1, W5): pct 30/40/50/60/70 -> amp 0.75/1.0/1.25/1.5/1.75 ; cycles "3","6","1","2" -> sine.numberOfCycles 3/6/1/2 with amp unchanged ; W8 pct70 -> amp 2.8, pct30 -> 1.2

## GreedyAlloyCombination (vertical-1-1, start yellow/white 585)
disc1 -> manganese  => colours [manganese, manganese]
disc1 -> white-pd   => [yellow, white-pd]
disc1 -> red        => [yellow, red]
disc0 fineness 750  => fineness [750, 750]
then disc1 -> white-pd => [yellow, white-pd], fineness [585, 585]
setting disc1 fineness 750 with disc0 585 => both 750 (price weight = all-750)

## Rhodium flag
right ring disc0 had rhodinated true carried over after colour white -> yellow; price DTO isRhodinated false, price unchanged (7900 before and after clearing)

## Separation possibilities (vertical-1-1): active [false]; form v60/v90/v120/u/convex(x)/square/perlage(x); width .2/.3/.4/.5; depth .1/.15/.2/.25; surface polished; no "color" key returned
## Engine enum (universal-3d.js): groove types rect, u, u_2, v, bump, bump_2, edge_round, double_bump, angle_bump, angle_rect, angle_bump_2, facedRect, colorit, diamond_channel, perlageSimple ; DEFAULT_GROOVE_CHAMFER 0.05

## Groove placement (left P1 5x1.5, repeated addWithForm v-groove-90 after deleteAll)
add0 pos [2.5] ; add1 [2.5,3.8] ; add2 [2.5,3.8,1.2] ; add3..7: "message.cannot-adapt-the-following-errors" {"errors":["grooveCollision"]}, still 3 grooves
groove1 position requests: 3.2 -> 3.2 ; 2.9 -> 3.2 (MoveGroove) ; 2.8 -> 3.2 ; 2.75 -> 3.25 ; 2.72 -> 3.22 ; 2.71 -> 3.21 ; 2.7 -> 3.2 ; 2.65 -> 3.25 ; 2.6 -> 3.2
groove0 width 0.2 -> 0.5 => grooveCollision, unchanged ; groove2 position 0.4 -> 0.6 (MoveGroove), 0.3 -> 0.6
right ring (with stone at centre): square requested 4.6 -> 4.4 (MoveGroove); square requested 3.0 -> 4.3; default positions 3.925 / 1.075 avoid the stone

## Groove amplitude: groove.amplitude [0] and numberOfCycles [0] in every non-wavy state; possibility mirroredSine undefined (UI toggle disabled)

## Perlage config (segments[0].perlages) for design perlage widths
w0.35 -> perlageWidth/Height 0.2722, grooveWidth 0.35, grooveDepth 0.1 ; w0.5 -> 0.3889 / 0.5 ; w0.75 -> 0.5833 / 0.75 ; w0.9 -> 0.7 / 0.9 ; w1.2 -> 0.9333 / 1.2 (ratio 7/9) ; type round, lineCount 1, orientation surface
Edge perlage: width 0.325 -> bead 0.3 in groove 0.35 ; 0.445 -> 0.39 / 0.5 ; 0.645 -> 0.54 / 0.75 ; 0.8 -> 0.7 / 0.9 (different ratio from design perlage)
Edge normal: 0.8 x 0.5 -> 3D rect groove width 1.6 depth 0.5 centred at offset 0, extra slice at 0.8 ; widths at W3/W5/W8 single colour all selectable [0.3,0.5,0.8,1,1.5,2] ; on 3-colour P1 6x1.5 (first band 1.5 mm) 1.0/1.5/2.0 not selectable
Edge price class: edge normal alone -> 384/g (585) ; edge perlage alone -> 384/g

## Male/female (both rings P1 5x1.5 yellow 585, V60 0.5 @1.5)
left groove state == right groove state (angle 60, depth 0.43301, width 0.5, pos 1.5) ; left weight 6.463473835683 == right weight 6.463473835683 ; 3D groove configs identical
price left 6198 (ek 2519.402) | right 6371 (ek 2589.779 = 2519.402 + 70.377 diamond)

## Thickness sweep for groove options (P1 W5): H 0.8, 1.0, 1.2, 1.8, 2.0, 2.5 (+1.5 in profile sweep) ; P16 W5: H 1.0, 1.5, 2.5
## Width sweep: P1 H1.5 at W 2, 3, 4, 6, 8, 12 (+5)

## Surfaces on two bands: hammered on disc0 only -> ek-gold 130 (80 + rhodium 50 on disc1) ; hammered on both discs -> 130 (surface surcharge counted once)
