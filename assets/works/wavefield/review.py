"""Render Echo Cape and the five original island sources at a common scale."""

import argparse
from pathlib import Path
import sys

HERE = Path(__file__).resolve().parent
sys.path.insert(0,str(HERE.parent/'sofaraway'))
from compare import assemble, render_case


def main():
    cli = argparse.ArgumentParser(description=__doc__)
    cli.add_argument('--source',type=Path,default=HERE/'wavefield.blend')
    cli.add_argument('--scratch',type=Path,required=True)
    cli.add_argument('--output',type=Path,required=True)
    cli.add_argument('--device',choices=['CPU','CUDA','OPTIX'],default='CPU')
    args = cli.parse_args(sys.argv[sys.argv.index('--')+1:])
    args.scratch.mkdir(parents=True,exist_ok=True)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    refs = (
        ('Wavefield / WF1',args.source,'WAVEFIELD'),
        ('Harvest / H2',HERE.parent/'harvest'/'harvest.blend','HARVEST'),
        ('Liquid Glass / L2',HERE.parent/'liquid-glass'/'liquid-glass.blend','LIQUID GLASS'),
        ('SoFarAway / S2',HERE.parent/'sofaraway'/'sofaraway.blend','SOFARAWAY'),
        ('GopherAtlas / G2',HERE.parent/'gopher-atlas'/'gopher-atlas.blend','GOPHER ATLAS'),
        ('Tool4Furry / T2',HERE.parent/'tool4furry'/'tool4furry.blend','TOOL4FURRY'),
    )
    paths = []
    for i,(label,source,prefix) in enumerate(refs,1):
        panel = (args.scratch/f'{i}.png').resolve()
        render_case(label,source.resolve(),prefix,0,panel,args.device)
        paths.append(panel)
    assemble(paths,args.output.resolve())


if __name__ == '__main__':
    main()
