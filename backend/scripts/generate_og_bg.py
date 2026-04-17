"""One-shot script to generate the base OG background gradient.

Run once: `python backend/scripts/generate_og_bg.py`
Produces: backend/static/share/og-bg.png (1200x630, dark indigo gradient)
"""
from PIL import Image, ImageDraw
import os

W, H = 1200, 630
img = Image.new("RGB", (W, H), (10, 10, 15))
draw = ImageDraw.Draw(img)

for y in range(H):
    ratio = y / H
    r = int(10 + 6 * ratio)
    g = int(10 + 4 * ratio)
    b = int(15 + 30 * (1 - ratio))
    draw.line([(0, y), (W, y)], fill=(r, g, b))

glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
gdraw = ImageDraw.Draw(glow)
gdraw.ellipse((-200, -200, 600, 400), fill=(99, 102, 241, 40))
img = Image.alpha_composite(img.convert("RGBA"), glow).convert("RGB")

out = os.path.join(
    os.path.dirname(__file__), "..", "static", "share", "og-bg.png"
)
os.makedirs(os.path.dirname(out), exist_ok=True)
img.save(out, "PNG", optimize=True)
print(f"Generated: {out}")
