"""Derive runtime textures from transparent image-generation concept references.
No model generation: retain original source pixels for a later Meshy handoff.
"""
from pathlib import Path
from PIL import Image
root = Path(__file__).resolve().parents[1]
source = root / 'images/concepts/expansion'
for original in sorted(source.glob('*.png')):
    image = Image.open(original).convert('RGBA')
    alpha = image.getchannel('A')
    if alpha.getextrema()[0] == 255:
        raise ValueError(f'{original}: expected real transparency')
    bounds = alpha.getbbox()
    if not bounds:
        raise ValueError(f'{original}: empty artwork')
    image = image.crop(bounds)
    for folder, size in [('images/hud/expansion', 128), ('images/scene/expansion', 512)]:
        target = root / folder / original.name
        target.parent.mkdir(parents=True, exist_ok=True)
        copy = image.copy()
        copy.thumbnail((size - 4, size - 4), Image.Resampling.LANCZOS)
        canvas = Image.new('RGBA', (size, size))
        # Bottom-align world art to a predictable deck contact point.
        y = size - copy.height - 2 if '/scene/' in folder else (size - copy.height) // 2
        canvas.alpha_composite(copy, ((size - copy.width) // 2, y))
        canvas.save(target, optimize=True)
print('Prepared', len(list(source.glob('*.png'))), 'sprite/icon pairs')
