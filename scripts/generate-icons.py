#!/usr/bin/env python3
"""Génère le logo nettoyé et toutes les icônes (site, favicon, PWA, iOS) à partir de la source du logo.

Usage : python3 scripts/generate-icons.py chemin/vers/logo-source.jpeg
Dépendance : Pillow (`pip install pillow`). Les fichiers générés sont versionnés : ce script
n'est utile que pour changer de logo.
"""
import sys
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
ICONS = ROOT / "apps/web/public/icons"
BLACK_POINT = 14  # les artefacts JPEG du fond noir (0 à ~12) deviennent du noir pur


def clean(img: Image.Image) -> Image.Image:
    lut = [max(0, round((v - BLACK_POINT) * 255 / (255 - BLACK_POINT))) for v in range(256)]
    return img.convert("RGB").point(lut * 3)


def on_black(logo: Image.Image, size: int, scale: float = 1.0) -> Image.Image:
    canvas = Image.new("RGB", (size, size), (0, 0, 0))
    inner = round(size * scale)
    resized = logo.resize((inner, inner), Image.LANCZOS)
    offset = (size - inner) // 2
    canvas.paste(resized, (offset, offset))
    return canvas


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    logo = clean(Image.open(sys.argv[1]))
    if logo.size[0] != logo.size[1]:
        sys.exit("Le logo source doit être carré.")

    (ROOT / "assets/logo").mkdir(parents=True, exist_ok=True)
    ICONS.mkdir(parents=True, exist_ok=True)

    logo.save(ROOT / "assets/logo/watch-relay.png", optimize=True)
    on_black(logo, 256).save(ICONS / "logo-256.png", optimize=True)  # en-tête du site (affiché à 64 px)
    on_black(logo, 192).save(ICONS / "icon-192.png", optimize=True)
    on_black(logo, 512).save(ICONS / "icon-512.png", optimize=True)
    # Maskable : le motif tient dans la zone de sécurité (80 %), le fond noir déborde.
    on_black(logo, 512, 0.8).save(ICONS / "icon-maskable-512.png", optimize=True)
    on_black(logo, 180, 0.9).save(ICONS / "apple-touch-icon.png", optimize=True)
    on_black(logo, 32).save(ICONS / "favicon-32.png", optimize=True)
    on_black(logo, 256).save(ROOT / "apps/web/public/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
    print("✓ logo et icônes générés")


if __name__ == "__main__":
    main()
