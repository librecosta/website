"""Load the eight authored Blender islands and render an equal-scale contact sheet."""

import argparse
from pathlib import Path
import sys

import bpy
import numpy as np

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent / 'sofaraway'))
from compare import CELL, render_case


def contact_sheet(panels, output):
    width, height = CELL
    background = np.array((19, 24, 30), dtype=np.float32) / 255
    sheet = np.ones((height*2, width*4, 4), dtype=np.float32)
    sheet[:, :, :3] = background
    for i, path in enumerate(panels):
        source = bpy.data.images.load(str(path), check_existing=False)
        values = np.empty(width*height*4, dtype=np.float32)
        source.pixels.foreach_get(values)
        rgba = values.reshape((height, width, 4))
        x, y = (i%4)*width, (1-i//4)*height
        sheet[y:y+height, x:x+width, :3] = rgba[:, :, :3]*rgba[:, :, 3:4]+background*(1-rgba[:, :, 3:4])
        bpy.data.images.remove(source)
    image = bpy.data.images.new('The Vigil Station · Eight island comparison', width=width*4, height=height*2, alpha=False)
    image.file_format = 'PNG'
    image.filepath_raw = str(output)
    image.pixels.foreach_set(sheet.ravel())
    image.save()


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source', type=Path, default=HERE/'uptime.blend')
    cli.add_argument('--scratch', type=Path, required=True)
    cli.add_argument('--output', type=Path, required=True)
    cli.add_argument('--device', choices=['CPU', 'CUDA', 'OPTIX'], default='CPU')
    args = cli.parse_args(sys.argv[sys.argv.index('--') + 1:])
    args.scratch.mkdir(parents=True, exist_ok=True)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    root = HERE.parent
    references = (
        ('LibreCosta Uptime / U1', args.source, 'UPTIME'),
        ('Harvest / H2', root/'harvest'/'harvest.blend', 'HARVEST'),
        ('Liquid Glass / L2', root/'liquid-glass'/'liquid-glass.blend', 'LIQUID GLASS'),
        ('SoFarAway / S2', root/'sofaraway'/'sofaraway.blend', 'SOFARAWAY'),
        ('GopherAtlas / G2', root/'gopher-atlas'/'gopher-atlas.blend', 'GOPHER ATLAS'),
        ('Tool4Furry / T2', root/'tool4furry'/'tool4furry.blend', 'TOOL4FURRY'),
        ('Wavefield / WF2', root/'wavefield'/'wavefield-final.blend', 'WAVEFIELD'),
        ('GoFurry / GF2', root/'gofurry'/'gofurry.blend', 'GOFURRY'),
    )
    panels = []
    for i, (label, path, prefix) in enumerate(references, 1):
        panel = (args.scratch/f'{i}.png').resolve()
        render_case(label, path.resolve(), prefix, 0, panel, args.device)
        panels.append(panel)
    contact_sheet(panels, args.output.resolve())


if __name__ == '__main__':
    main()
