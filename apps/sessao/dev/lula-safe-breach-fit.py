"""Offline image experiment: uv run --with pillow python dev/lula-safe-breach-fit.py."""
from math import cos, sin, radians
from pathlib import Path
from PIL import Image

assets = Path(__file__).resolve().parents[1] / 'public' / 'assets'
original = Image.open(assets / 'lula-safe-breach.webp').convert('RGBA')
cell = original.crop((384, 0, 512, 128))
cell.paste((0, 0, 0, 0), (116, 40, 128, 65))
# Reuse the intact tool painted in frame 1; rotate around its grip, behind the hand.
tool = original.crop((98, 17, 115, 40))
c, s = cos(radians(20)), sin(radians(20))
transform = (c, -s, 5 - c * 119 + s * 67, s, c, 23 - s * 119 - c * 67)
layer = tool.transform((128, 128), Image.Transform.AFFINE, transform, Image.Resampling.BICUBIC)
repaired = Image.alpha_composite(layer, cell)
# Keep every original pixel outside the small tool patch, including all of frames 1–3.
result = original.copy()
result.paste(repaired.crop((98, 40, 128, 70)), (384 + 98, 40))
result.save(assets / 'lula-safe-breach-fit-tool.png', optimize=True)

assert result.crop((0, 0, 384, 128)).tobytes() == original.crop((0, 0, 384, 128)).tobytes()
assert not any(result.getpixel((511, y))[3] > 32 for y in range(128))
