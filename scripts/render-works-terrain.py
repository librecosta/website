"""Bake the original Works terrain. Requires Pillow, NumPy and SciPy offline."""

import json
import re
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, gaussian_filter, map_coordinates, zoom
from scipy.interpolate import CubicSpline

ROOT = Path(__file__).resolve().parents[1]
WIDTH, DEPTH, SCALE = 1000, 700, 1.65
HEIGHT = 630
SHORELINES = [
    [(21, 354), (70, 321), (108, 277), (141, 259), (179, 194), (229, 165), (257, 119),
     (305, 88), (330, 52), (385, 48), (430, 67), (463, 65), (510, 92), (554, 113),
     (582, 148), (609, 173), (589, 214), (631, 240), (666, 252), (701, 265), (739, 294),
     (783, 307), (809, 331), (822, 353), (799, 373), (772, 376), (746, 404), (694, 402),
     (656, 415), (634, 451), (651, 469), (628, 477), (650, 506), (638, 531), (605, 543),
     (565, 567), (539, 564), (502, 591), (458, 585), (413, 618), (369, 609), (336, 634),
     (291, 616), (252, 623), (211, 593), (178, 578), (145, 544), (100, 534), (77, 500),
     (102, 477), (141, 478), (178, 458), (168, 441), (142, 447), (122, 434), (89, 449),
     (54, 422), (57, 393), (24, 384)],
    [(747, 136), (773, 103), (802, 91), (844, 70), (881, 72), (913, 85), (945, 105),
     (961, 135), (949, 170), (923, 183), (901, 209), (873, 215), (841, 204),
     (818, 186), (799, 176), (815, 159), (789, 155), (765, 172), (751, 158)],
    [(740, 580), (754, 550), (794, 531), (823, 511), (853, 509), (878, 493),
     (914, 514), (946, 524), (966, 554), (950, 584), (916, 597), (890, 616),
     (850, 613), (819, 629), (788, 614), (762, 611)],
]

ROAD = [(146, 422), (173, 399), (213, 419), (243, 449), (284, 466), (319, 489),
        (358, 464), (380, 425), (375, 386), (399, 347), (405, 311), (433, 266),
        (433, 234), (413, 207), (418, 182), (398, 159), (383, 140)]
TRAILS = [
    [(401, 312), (439, 291), (465, 294), (493, 306), (540, 308)],
    [(320, 493), (358, 512), (401, 509), (455, 517), (490, 537), (542, 532), (588, 512)],
    [(588, 512), (570, 482), (598, 446), (629, 410), (662, 380), (705, 375), (764, 347)],
    [(167, 419), (141, 409), (108, 416)], [(243, 449), (250, 422), (275, 401)],
    [(363, 457), (327, 425), (301, 429)], [(405, 311), (375, 293), (357, 267)],
    [(433, 234), (466, 210), (498, 205)], [(539, 308), (555, 293), (570, 296)],
    [(663, 381), (670, 353), (708, 344)], [(835, 143), (851, 158), (882, 163)],
    [(809, 582), (855, 567), (885, 548), (922, 551)],
]
RIVERS = [
    [(479, 240), (493, 263), (497, 285), (517, 310), (552, 326), (575, 351),
     (558, 379), (561, 403), (589, 424), (583, 450), (588, 468), (614, 478), (650, 502)],
    [(585, 447), (610, 449), (624, 463), (644, 472), (658, 484)],
    [(450, 291), (473, 304), (494, 303), (518, 310)],
]

nx, ny = round(WIDTH * SCALE), round(DEPTH * SCALE)
y, x = np.mgrid[:ny, :nx].astype(np.float32) / SCALE
rng = np.random.default_rng(2082)


def curve(points, closed=False):
    points = np.asarray(points)
    if closed:
        points = np.vstack((points, points[0]))
    lengths = np.r_[0, np.cumsum(np.linalg.norm(np.diff(points, axis=0), axis=1))]
    return CubicSpline(lengths, points, bc_type='periodic' if closed else 'natural')(
        np.linspace(0, lengths[-1], round(lengths[-1] / 2) + 1))


def paint(paths, width=1, polygons=False):
    canvas = Image.new('L', (nx, ny))
    draw = ImageDraw.Draw(canvas)
    for points in paths:
        coords = [tuple(p * SCALE) for p in curve(points, polygons)]
        if polygons:
            draw.polygon(coords, fill=255)
        else:
            draw.line(coords, fill=255, width=max(1, round(width * SCALE)))
    return np.asarray(canvas) > 0


def noise(wavelength):
    rows, cols = round(DEPTH / wavelength) + 3, round(WIDTH / wavelength) + 3
    samples = rng.normal(size=(rows, cols)).astype(np.float32)
    return zoom(samples, (ny / rows, nx / cols), order=3, mode='reflect')


def distance(mask):
    return distance_transform_edt(mask).astype(np.float32) / SCALE


def gaussian(cx, cy, rx, ry, angle=0):
    co, si = np.cos(angle), np.sin(angle)
    a, b = x - cx, y - cy
    return np.exp(-.5 * (((a * co + b * si) / rx) ** 2 + ((b * co - a * si) / ry) ** 2))


def mix(a, b, weight):
    return np.asarray(a) * (1 - weight[..., None]) + np.asarray(b) * weight[..., None]


coarse, rolling, rock, grain = (noise(w) for w in (76, 30, 9, 2.8))
mask = paint(SHORELINES, polygons=True)
shore = distance(mask) - distance(~mask) + coarse * 4 + rock * 1.7
land = shore > 0
coast = np.clip(shore / 47, 0, 1)
mountains = (61 * gaussian(341, 155, 139, 35, -.59) + 31 * gaussian(430, 133, 62, 29, .5)
             + 34 * gaussian(317, 199, 104, 22, -.63) + 28 * gaussian(460, 204, 65, 21, .48))
peaks = np.zeros_like(x)
for cx, cy, rx, ry, power in [
    (219, 202, 16, 21, 17), (248, 195, 19, 16, 28), (278, 169, 21, 16, 30),
    (307, 151, 13, 20, 36), (330, 143, 19, 17, 30), (350, 119, 15, 16, 47),
    (371, 133, 17, 18, 36), (389, 115, 14, 14, 55), (415, 128, 18, 20, 42),
    (438, 109, 13, 17, 56), (460, 133, 17, 16, 35), (487, 154, 15, 17, 37),
    (506, 169, 17, 20, 21), (527, 181, 20, 18, 21),
]:
    peaks += power * gaussian(cx, cy, rx, ry, -.63)
hills = (38 * gaussian(715, 319, 80, 26, .24) + 17 * gaussian(756, 335, 36, 14, .36)
         + 27 * gaussian(877, 112, 59, 22, -.23) + 19 * gaussian(912, 142, 37, 21, .38)
         + 29 * gaussian(861, 545, 82, 20, -.27) + 17 * gaussian(369, 566, 138, 25, -.17)
         + 24 * gaussian(217, 532, 62, 24, .24))
basin = gaussian(506, 329, 67, 54, -.14)
upland = np.clip((mountains + peaks + hills) / 72, 0, 1.45)
gullies = np.abs(noise(14) * .78 + rock * .3)
surface = np.maximum(0, (14 + mountains + peaks + hills + rolling * (6 + upland * 5)
                         + rock * (2 + upland * 3) + grain * .5 - 15 * basin
                         - gullies * (3 + upland * 6)) * coast ** .72)
river_mask = paint(RIVERS, 2.3)
river_dist = distance(~river_mask)
surface *= 1 - .34 * np.exp(-(river_dist / 7) ** 2)
elevation = np.where(land, 10 + surface, 0).astype(np.float32)

dzdy, dzdx = np.gradient(gaussian_filter(elevation, .95), 1 / SCALE)
length = np.sqrt(1 + dzdx ** 2 + dzdy ** 2)
lighting = np.clip((.50 * dzdx + .44 * dzdy + .745) / length, .02, 1)
shade = np.ones_like(x)
for step in (6, 12, 20, 32, 48, 68):
    upstream = np.roll(elevation, (round(step * .67 * SCALE), round(step * .74 * SCALE)), (0, 1))
    shade = np.minimum(shade, 1 - np.clip((upstream - elevation - step * .79) / 38, 0, .61))
shade = gaussian_filter(shade, 2)

altitude = np.clip((surface - 15) / 121, 0, 1)
material = mix([34, 65, 70], [128, 141, 126], altitude ** .83)
sand = np.exp(-((shore - 3) / 6) ** 2) * np.clip(.8 - upland * .45, 0, 1)
material = mix(material, [125, 122, 89], sand * .51)
material *= (.54 + lighting * .60)[..., None] * (.49 + shade * .51)[..., None]
material += (rolling * 2.3 + rock * 1.9 + grain * 1.15)[..., None]
contour = np.exp(-((np.abs((surface + .7) % 8 - 4)) / .42) ** 2) * coast
material = mix(material, [147, 171, 153], contour * (.12 + .17 * altitude))

primary = gaussian_filter(paint([ROAD], 2.3).astype(np.float32), .75)
secondary = gaussian_filter(paint(TRAILS[:3], 1.35).astype(np.float32), .6)
paths = gaussian_filter(paint(TRAILS[3:], 1).astype(np.float32), .55)
material = mix(material, [175, 161, 120], np.maximum.reduce([primary * .68, secondary * .57, paths * .45]))
water = gaussian_filter(river_mask.astype(np.float32), .62)
material = mix(material, [15, 44, 55], water * .84)
material = mix(material, [101, 147, 145], np.exp(-((river_dist - .8) / .6) ** 2) * .30)

depth = np.maximum(-shore, 0)
sea = mix([6, 16, 23], [26, 63, 70], np.exp(-depth / 26) * .82)
sea += (coarse * 1.3 + rolling * .65 + grain * .6)[..., None]
soundings = np.exp(-((np.abs((depth + rolling * 1.7) % 14 - 7)) / .65) ** 2) * np.exp(-depth / 52)
sea = mix(sea, [74, 127, 130], soundings * .34)
sea = mix(sea, [8, 18, 23], (1 - shade) * .60)
surface_colors = np.where(land[..., None], material, sea)
surface_colors = np.clip(surface_colors, 0, 255).astype(np.uint8)


def projection(depth_y, z):
    return 38 + .843 * depth_y - .63 * z


# The view looks from the south. Draw scanlines north to south so near slopes
# and coastal walls correctly occlude distant terrain in the baked image.
image = np.zeros((round(HEIGHT * SCALE), nx, 3), dtype=np.uint8)
image[:] = [6, 15, 22]
projected = np.rint(projection(y, elevation) * SCALE).astype(np.int32)
columns = np.arange(nx)
for row in range(ny - 1):
    start = projected[row]
    stop = projected[row + 1]
    visible = stop >= start
    for dy in range(int(np.max(stop - start)) + 1):
        scan = start + dy
        pixels = visible & (scan <= stop) & (scan >= 0) & (scan < len(image))
        if not np.any(pixels):
            break
        if dy == 0:
            image[scan[pixels], columns[pixels]] = surface_colors[row, pixels]
        else:
            color = surface_colors[row, pixels].astype(np.float32)
            cliff = (stop - start)[pixels] > 3
            color[cliff] *= .79
            image[scan[pixels], columns[pixels]] = color.astype(np.uint8)

screen_y, screen_x = np.mgrid[:len(image), :nx].astype(np.float32) / SCALE
edge = np.minimum.reduce([screen_x / 38, (WIDTH - screen_x) / 38, screen_y / 47, (HEIGHT - screen_y) / 45])
image = mix([6, 15, 22], image, np.clip(edge, 0, 1) ** .65)
out = ROOT / 'public/works/terrain.webp'
Image.fromarray(np.clip(image, 0, 255).astype(np.uint8)).save(out, quality=86, method=6)

projects = (ROOT / 'src/components/works/projects.ts').read_text(encoding='utf-8')
positions = re.findall(r"position: \[(\d+), (\d+)\]", projects)
markers = {}
for cx, cy in [(int(cx), int(cy)) for cx, cy in positions]:
    z = float(map_coordinates(elevation, [[cy * SCALE], [cx * SCALE]], order=1)[0])
    markers[f'{cx},{cy}'] = round(projection(cy, z), 2)
projection_file = ROOT / 'src/components/works/terrain-projection.json'
projection_file.write_text(json.dumps(markers, indent=2) + '\n', encoding='utf-8')
print(f'{out.name} {out.stat().st_size:,} bytes')
