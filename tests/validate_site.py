from pathlib import Path

root = Path(__file__).resolve().parent.parent
dist = root / "dist"
required_files = [
    "index.html",
    "admin/index.html",
    "assets/styles.css",
    "assets/site.js",
    "CNAME",
    "robots.txt",
    "sitemap.xml",
    "404.html",
    ".nojekyll",
]

for relative_path in required_files:
    assert (dist / relative_path).is_file(), f"Missing {relative_path}"

home = (dist / "index.html").read_text(encoding="utf-8")
admin = (dist / "admin/index.html").read_text(encoding="utf-8")
cname = (dist / "CNAME").read_text(encoding="utf-8")
robots = (dist / "robots.txt").read_text(encoding="utf-8")
sitemap = (dist / "sitemap.xml").read_text(encoding="utf-8")

assert "<title>Danny's Designs" in home, "Home page must have branded metadata"
assert 'href="/admin/"' in home, "Home page must link to the admin route"
assert 'name="robots" content="noindex, nofollow"' in admin, "Admin must be noindex"
assert "CaptainButters22/DannysDesigns" in admin, "Admin must link to this repository"
assert cname.strip() == "dannysdesigns.com", "CNAME must use the requested domain"
assert "Disallow: /admin/" in robots, "robots.txt must exclude admin"
assert "/admin" not in sitemap, "Sitemap must exclude admin"

print(f"Validated {len(required_files)} files and 7 site requirements.")

