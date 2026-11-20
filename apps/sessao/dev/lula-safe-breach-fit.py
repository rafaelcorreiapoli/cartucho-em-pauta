"""Integrate the ImageGen arm/tool patch: uv run --with pillow python dev/lula-safe-breach-fit.py."""
from pathlib import Path
from PIL import Image, ImageDraw

app = Path(__file__).resolve().parents[1]
assets = app / 'public' / 'assets'
original = Image.open(assets / 'lula-safe-breach.webp').convert('RGBA')
generated = Image.open(app / 'dev' / 'assets' / 'lula-safe-breach-frame4-imagegen.png').convert('RGBA')
generated = generated.resize((128, 128), Image.Resampling.LANCZOS)
# Keep the original head, torso, left arm, legs and shoes. Replace only the right arm/tool.
mask = Image.new('L', (128, 128), 0)
draw = ImageDraw.Draw(mask)
draw.rectangle((94, 35, 127, 88), fill=255)
draw.rectangle((84, 61, 127, 88), fill=255)
cell = Image.composite(generated, original.crop((384, 0, 512, 128)), mask)
result = original.copy()
result.paste(cell, (384, 0))
assert result.crop((0, 0, 384, 128)).tobytes() == original.crop((0, 0, 384, 128)).tobytes()
assert not any(result.getpixel((511, y))[3] > 32 for y in range(128))
result.save(assets / 'lula-safe-breach-imagegen.png', optimize=True)
