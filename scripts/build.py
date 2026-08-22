from pathlib import Path
from shutil import copytree, rmtree

root = Path(__file__).resolve().parent.parent
source = root / "public"
destination = root / "dist"

if destination.exists():
    rmtree(destination)

copytree(source, destination)
print("Built static site in dist/")

