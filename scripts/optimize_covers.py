from pathlib import Path
from PIL import Image


REPO_ROOT = Path(__file__).resolve().parents[1]
COVERS_DIR = REPO_ROOT / "covers"


def main() -> None:
    converted = 0
    for source in sorted(COVERS_DIR.glob("*.jpg")):
        destination = source.with_suffix(".webp")
        if destination.exists() and destination.stat().st_mtime >= source.stat().st_mtime:
            continue
        with Image.open(source) as image:
            image.convert("RGB").save(destination, "WEBP", quality=82, method=6)
        converted += 1
    print(f"Optimized {converted} cover(s) as WebP.")


if __name__ == "__main__":
    main()
