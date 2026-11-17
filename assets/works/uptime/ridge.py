"""Fractured coastal benches, the landing and the route to the tower."""

import math
import random

from mathutils import Vector
from mathutils.bvhtree import BVHTree

from fabric import rectangle, slab
from geometry import beam, block, collection, faceted_rock, lantern, material, mesh, railing, rod
from harbor import facets, footing, paving, route, surface
from terrain import stairs


COAST = [
    (-11.75, -3.20), (-10.20, -5.53), (-7.22, -7.03), (-5.23, -7.79), (-3.24, -7.86),
    (-1.57, -7.42), (.13, -7.74), (2.92, -7.05), (4.28, -7.36), (7.07, -6.29),
    (9.66, -4.52), (10.67, -2.00), (10.30, .70), (9.50, 2.63), (8.55, 4.65),
    (6.92, 6.92), (4.06, 8.11), (.90, 7.72), (-2.58, 6.94), (-5.13, 7.28),
    (-8.45, 6.10), (-10.42, 4.12), (-11.34, 1.70), (-12.13, -.36),
]
WORKSHELF = [
    (-9.11, -3.05), (-7.41, -4.96), (-5.47, -5.60), (-2.45, -5.60), (1.40, -5.45),
    (5.60, -5.06), (7.17, -3.48), (7.81, -1.38), (8.19, 1.29), (7.67, 4.24),
    (6.52, 5.95), (4.42, 6.84), (1.24, 6.20), (-1.52, 5.30), (-4.62, 5.63),
    (-6.74, 4.40), (-8.57, 2.30), (-9.63, -.11),
]
LANDING = [(3.95, -1.79), (5.53, -1.79), (5.98, -.63), (5.53, .48),
           (4.37, .54), (3.64, -.34)]
SUMMIT = [(1.20, 1.24), (3.00, 1.19), (4.73, .975), (5.84, 1.04), (7.12, 1.88),
          (7.49, 3.89), (6.87, 5.89), (5.82, 7.00), (3.84, 7.40), (1.64, 6.72),
          (.26, 5.45), (-.16, 3.84), (.28, 2.02)]
DOCK_Z = .93
COURT_Z = 2.32
TURN_Z = 3.98
SUMMIT_Z = 5.23
TOWER_XY = (3.55, 3.75)

FLIGHTS = (
    ('Harbor stair', (-3.20, -7.90, DOCK_Z), (-3.20, -5.56, COURT_Z), 1.38, 9),
    ('Lower ridge stair', (4.73, -4.72, COURT_Z), (4.73, -1.76, TURN_Z), 1.38, 11),
    ('Upper ridge stair', (4.73, -.76, TURN_Z), (4.73, .99, SUMMIT_Z), 1.34, 8),
    ('Tower door stair', (3.55, 1.39, SUMMIT_Z), (3.55, 1.86, 5.57), 1.37, 3),
)


def coast(group):
    def bedrock(x, y):
        return .60 + .16 * math.sin(.7*x + .4*y) + .10 * math.cos(.92*y - .52*x) + .029 * max(0, y + 3)

    base = facets('Ridge · continuous bedrock and shore shelf', COAST,
                  [(-.012, .27, .13, 'talus'), (.005, -.38, .25, 'cliff'), (.018, -.85, .18, 'shale'),
                   (.061, -1.60, .19, 'cliff'), (.166, -2.06, .14, 'shale')],
                  bedrock, .94, group, 19)
    layers = [base]
    for name, outline, level, rings, seed in (
        ('Station bench', WORKSHELF, COURT_Z,
         [(-.026, 1.93, .12, 'earth'), (-.075, 1.34, .21, 'cliff'),
          (-.080, .96, .14, 'shale'), (-.11, .34, .09, 'talus')], 40),
        ('Stair shoulder', LANDING, TURN_Z,
         [(-.025, 3.66, .17, 'earth'), (-.055, 3.14, .16, 'cliff'),
          (-.08, 2.68, .20, 'shale'), (-.075, 2.16, .055, 'cliff')], 62),
        ('Tower headland', SUMMIT, SUMMIT_Z,
         [(-.023, 4.83, .16, 'earth'), (-.075, 4.39, .17, 'cliff'), (-.080, 4.03, .16, 'shale'),
          (-.107, 3.57, .21, 'cliff'), (-.112, 2.99, .19, 'cliff'), (-.09, 2.09, .07, 'talus')], 83),
    ):
        layers.append(facets(name+' · stratified rock', outline, rings,
                             lambda _x, _y: level - .052, .70, group, seed))

    positions, indices = [], []
    for obj in layers:
        data = obj.data
        data.calc_loop_triangles()
        start = len(positions)
        positions.extend(vertex.co for vertex in data.vertices)
        indices.extend(tuple(start + index for index in tri.vertices) for tri in data.loop_triangles)
    return layers, BVHTree.FromPolygons(positions, indices, all_triangles=True)


def dock(tree, group):
    group = collection('Quay · raised jetty and landing supplies', group)
    for i in range(15):
        y = -10.62 + (i+.5) * 2.72 / 15
        block('Jetty · laid decking', (-3.20, y, DOCK_Z-.078), (2.83, .161, .156), group, 'plank', i, .015)
        for x in (-4.16, -2.24):
            block('Jetty · plank nail', (x, y, DOCK_Z+.002), (.035, .034, .012), group, 'iron', 1, .005)
    for x in (-4.25, -3.20, -2.15):
        beam('Jetty · continuous joist', (x, -10.66, .733), (x, -7.82, .733), .23, .25, group, 'timber')
    for y in (-10.42, -9.22, -8.10):
        beam('Jetty · pile cap', (-4.56, y, .57), (-1.84, y, .57), .222, .23, group, 'timber')
        for x in (-4.39, -2.01):
            bottom = max(-1.66, min(surface(tree, x, y)-.21, -1.20))
            rod('Jetty · driven oak pile', (x, y, bottom), (x, y, 1.12), .143, group, 'timber', 8)
            rod('Jetty · cast cap', (x, y, 1.09), (x, y, 1.16), .162, group, 'iron', 8)
            rod('Jetty · iron collar', (x, y, .04), (x, y, .15), .15, group, 'iron', 8)
            beam('Jetty · skew knee brace', (x, y, -.46), ((x+3.20)*.5-3.20, y, .51), .13, .145, group, 'timber')
    for x in (-4.56, -1.84):
        railing('Jetty · safety handrail', [(x, -10.37, DOCK_Z), (x, -8.02, DOCK_Z)], group,
                height=.51, key='iron')
    for x, y, width in ((-4.04, -8.80, .46), (-4.07, -9.36, .39)):
        block('Jetty · spares crate', (x, y, DOCK_Z+.16), (width, .44, .32), group, 'plank', 1)
        for offset in (-.15, .15):
            block('Jetty · crate band', (x, y+offset, DOCK_Z+.329), (width+.022, .055, .027), group, 'timber', 2)
    for x in (-4.0, -2.42):
        rod('Mooring · cleat', (x, -10.24, DOCK_Z), (x, -10.24, 1.04), .068, group, 'iron', 8)
        beam('Mooring · cleat horn', (x-.12, -10.24, 1.04), (x+.12, -10.24, 1.04), .047, .045, group, 'iron')


def retaining_wall(group):
    for y, x0, x1, top in ((-5.42, -6.15, -4.05, 2.30), (-5.36, -2.36, 3.62, 2.30),
                           (-1.66, 3.91, 5.56, 3.93)):
        for row in range(4):
            length = x1-x0
            count = max(2, round(length/.63))
            cuts = [0, *((i+(.40 if row%2 else 0))/count for i in range(1, count)), 1]
            for i, (low, high) in enumerate(zip(cuts, cuts[1:])):
                pos = (x0+length*(low+high)/2, y+.064*row, top-.142-row*.236)
                block('Retaining wall · staggered ashlar', pos, (length*(high-low)-.018, .43, .223),
                      group, 'stone' if row < 3 else 'talus', i+row, .023)
        for x in (x0+.40, x1-.38):
            beam('Retaining wall · bronze drain outlet', (x, y+.02, top-.60),
                 (x, y-.34, top-.62), .115, .11, group, 'metal')


def connections(tree, group):
    dock(tree, group)
    route_group = collection('Stairs, railings and finished approach', group)
    for name, a, b, width, count in FLIGHTS:
        stairs(name, a, b, width, count, route_group, rails=name != 'Tower door stair')
        if name == 'Tower door stair':
            continue
        a, b = Vector(a), Vector(b)
        for ratio in (.26, .56, .83):
            point = a.lerp(b, ratio)
            for sign in (-1, 1):
                footing(name+' · bedrock foundation', point.x+sign*width*.31, point.y, point.z-.155,
                        .31, tree, route_group)

    route('Lower terrace · cross walk', [(-7.33, -4.45), (-5.60, -4.72), (3.98, -4.72)],
          1.35, COURT_Z, route_group)
    paving('Lower terrace · jetty landing', (-3.91, -5.56, -2.49, -5.395), COURT_Z, route_group)
    paving('Lower stair · turning sill', (3.98, -5.395, 5.44, -4.72), COURT_Z, route_group)
    paving('Control · paved entry landing', (-4.89, -4.045, -3.23, -3.69), COURT_Z, route_group)
    paving('Workshop · paved service approach', (.20, -4.045, 1.93, -2.78), COURT_Z, route_group)
    paving('Ridge · intermediate landing', (4.02, -1.76, 5.44, -.76), TURN_Z, route_group, pitch=.47)
    paving('Ridge · upper landing', (4.06, .99, 5.42, 1.64), SUMMIT_Z, route_group, pitch=.47)
    paving('Ridge · tower door landing', (2.86, 1.09, 4.06, 1.39), SUMMIT_Z, route_group, pitch=.44)
    upper_edges = [[(4.07, -.79, TURN_Z), (4.07, -1.74, TURN_Z)],
                   [(5.39, -1.74, TURN_Z), (5.39, -.77, TURN_Z)],
                   [(5.39, 1.01, SUMMIT_Z), (5.39, 2.14, SUMMIT_Z), (6.17, 2.60, SUMMIT_Z)],
                   [(-6.08, -5.30, COURT_Z), (-4.11, -5.30, COURT_Z)],
                   [(-2.34, -5.31, COURT_Z), (2.92, -5.22, COURT_Z)]]
    for points in upper_edges:
        railing('Path · cliff rail', points, route_group, height=.61, key='metal')

    civil = collection('Retaining courses, gutter and stair lights', group)
    retaining_wall(civil)
    for x0, x1 in ((-7.12, -4.95), (-3.19, .16), (1.97, 3.90)):
        rod('Cross walk · stone drainage slot', (x0, -3.98, 2.264), (x1, -3.98, 2.264), .077, civil, 'mortar', 4)
    for x in (-6.17, -2.45, 3.49):
        block('Drainage · cast grate', (x, -3.99, 2.31), (.35, .21, .045), civil, 'mortar', bevel=.014)
        for i in range(6):
            dx = .046*(i-2.5)
            beam('Drainage · grate bar', (x+dx, -4.085, 2.332), (x+dx, -3.895, 2.332),
                 .019, .019, civil, 'iron', bevel=.004)
    for x, y, level in ((-4.32, -8.18, DOCK_Z), (-4.08, -5.27, COURT_Z), (2.78, -5.00, COURT_Z),
                         (5.47, -1.53, TURN_Z), (5.50, 1.78, SUMMIT_Z), (-6.88, -4.11, COURT_Z)):
        rod('Path lamp · stand', (x, y, level), (x, y, level+.63), .045, civil, 'iron', 8)
        lantern('Path lamp · shelter', (x, y, level+.55), civil)


def planting(tree, group):
    rng = random.Random(920)
    trees = [(-10.16, -2.51, 2.15), (-9.23, -3.66, 1.61), (-7.83, -4.17, 1.42),
             (-10.14, 1.42, 2.04), (-8.61, 2.96, 2.46), (-7.55, 4.09, 2.12),
             (-5.94, 4.52, 2.39), (-4.48, 4.37, 2.26), (-2.83, 4.55, 2.32),
             (-1.74, 4.59, 1.72), (-.52, 6.12, 2.08), (.66, 5.88, 1.70),
             (4.19, 6.55, 1.67), (6.15, 5.25, 1.87), (8.13, 3.54, 2.26),
             (8.35, 1.65, 2.10), (8.22, .12, 1.72), (7.04, -3.56, 1.49), (6.96, -5.53, 1.42)]
    for i, (x, y, height) in enumerate(trees):
        z = surface(tree, x, y)
        lean = (.16+height*.061) * (.47+.53*math.sin(i*.76)**2)
        rod('Salt-cut pine · tapered trunk', (x, y, z-.09), (x+lean, y+.15, z+height*.86),
            height*.059, group, 'bark', 7)
        for level in range(3):
            spread = height * (.38-.082*level)
            tip = (x+lean*1.30, y+.15, z+height*(.61+.23*level))
            cz = z+height*(.30+.19*level)
            width = [(math.cos(a)*spread*rng.uniform(.87, 1.19)+x+lean*level*.33,
                      math.sin(a)*spread*rng.uniform(.82, 1.16)*.77+y,
                      cz+rng.uniform(-.10, .07)) for a in (i*.27+j*math.tau/8 for j in range(8))]
            points = [*width, tip, (x+lean*level*.24, y, cz-.08)]
            faces = [(j, (j+1)%8, 8) for j in range(8)] + [((j+1)%8, j, 9) for j in range(8)]
            mesh('Salt-cut pine · wind-shaped bough', points, faces, group,
                 [material('pine', key) for key in range(5)], [rng.randrange(5) for _ in faces])

    pockets = [(-9.92, -4.10), (-8.85, -5.24), (-7.11, -5.75), (-5.31, -6.36),
               (-1.36, -6.37), (1.09, -6.34), (2.83, -6.18), (5.50, -6.24), (6.18, -4.8),
               (7.24, -2.32), (8.57, -.91), (9.44, -2.80), (8.47, 3.83), (7.45, 4.88),
               (6.77, 5.85), (5.64, 6.66), (2.93, 6.69), (1.06, 5.45), (-.26, 3.29),
               (-3.37, 3.87), (-5.32, 4.97), (-8.94, 3.15), (-10.07, .62), (-8.85, -1.85)]
    for i, (x, y) in enumerate(pockets):
        for j in range(4):
            px, py = x+rng.uniform(-.37, .37), y+rng.uniform(-.33, .33)
            z = surface(tree, px, py)
            size = rng.uniform(.17, .36)
            faceted_rock('Heather · rooted cushion', (px, py, z-.03), (size, size*.82, size*.72),
                         group, 'leaves' if j%2 else 'grass', i*4+j)
        for j in range(4):
            px, py = x+rng.uniform(-.36, .36), y+rng.uniform(-.35, .35)
            z = surface(tree, px, py)
            lift = rng.uniform(.14, .24)
            mesh('Coastal grass · tapered blades', [(px-.030,py,z),(px+.030,py,z),
                 (px+.043,py+.026,z+lift),(px-.011,py-.027,z+lift*.60)],
                 [(0,1,2),(0,2,3)], group, [material('grass', j)])
    boulders = [(-10.03,-5.07,1.03),(-8.40,-6.60,.81),(-6.79,-7.08,1.16),(-5.46,-7.74,.87),
                (-1.89,-7.31,.73),(-.35,-7.79,.88),(2.11,-7.25,1.16),(4.49,-7.16,1.05),
                (7.43,-5.86,.81),(9.81,-3.62,1.00),(10.26,-2.13,.83),(10.45,.29,.75),
                (8.39,4.25,.81),(6.86,6.58,.78),(2.45,7.42,.73),(-4.99,6.04,.72),
                (-8.53,5.14,.69),(-10.93,3.14,.78),(-11.74,.42,1.13),(-11.48,-2.62,.89),
                (6.43,-2.93,.58),(6.33,.59,.43),(.02,3.40,.63),(-.66,5.39,.74)]
    for i, (x, y, size) in enumerate(boulders):
        z = surface(tree, x, y)
        stone = faceted_rock('Rockfall · bedding plane block', (x, y, z-.17), (size, size*.68, size*.73),
                             group, 'shale' if i%3 else 'talus', 60+i)
        stone.rotation_euler.y = .14*(-1)**i
        for j in range(3):
            px, py = x+rng.uniform(-.69,.69), y+rng.uniform(-.56,.56)
            side = rng.uniform(.17,.37)
            faceted_rock('Rockfall · shore fragment', (px, py, surface(tree, px, py)-.065),
                         (side, side*.77, side*.64), group, 'cliff', 850+i*3+j)
