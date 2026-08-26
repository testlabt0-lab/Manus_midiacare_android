from pathlib import Path
from PIL import Image

icon_path = Path(__file__).resolve().parents[1] / "assets" / "images" / "icon.png"
temp_path = icon_path.with_suffix(".optimized.png")

with Image.open(icon_path) as image:
    image = image.convert("RGBA")
    image.thumbnail((512, 512), Image.Resampling.LANCZOS)
    image.save(temp_path, format="PNG", optimize=True, compress_level=9)

temp_path.replace(icon_path)
