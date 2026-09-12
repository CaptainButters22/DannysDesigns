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
    "seasidesculpt/index.html",
    "seasidesculpt/classes/index.html",
    "seasidesculpt/schedule/index.html",
    "seasidesculpt/pricing/index.html",
    "seasidesculpt/host/index.html",
    "seasidesculpt/closeout/index.html",
    "seasidesculpt/styles.css",
    "seasidesculpt/app.js",
    "seasidesculpt/admin/index.html",
    "seasidesculpt/admin/admin.css",
    "seasidesculpt/admin/admin.js",
]

for relative_path in required_files:
    assert (dist / relative_path).is_file(), f"Missing {relative_path}"

home = (dist / "index.html").read_text(encoding="utf-8")
admin = (dist / "admin/index.html").read_text(encoding="utf-8")
cname = (dist / "CNAME").read_text(encoding="utf-8")
robots = (dist / "robots.txt").read_text(encoding="utf-8")
sitemap = (dist / "sitemap.xml").read_text(encoding="utf-8")
seaside_home = (dist / "seasidesculpt/index.html").read_text(encoding="utf-8")
seaside_schedule = (dist / "seasidesculpt/schedule/index.html").read_text(encoding="utf-8")
seaside_admin = (dist / "seasidesculpt/admin/index.html").read_text(encoding="utf-8")

assert "<title>Danny's Designs" in home, "Home page must have branded metadata"
assert 'href="/admin/"' in home, "Home page must link to the admin route"
assert 'name="robots" content="noindex, nofollow"' in admin, "Admin must be noindex"
assert "CaptainButters22/DannysDesigns" in admin, "Admin must link to this repository"
assert "fallback page" in admin, "Admin fallback behavior must be explicit"
assert "https://api.dannysdesigns.com/admin" in admin, "Admin fallback must link to the origin"
assert cname.strip() == "dannysdesigns.com", "CNAME must use the requested domain"
assert "Disallow: /admin/" in robots, "robots.txt must exclude admin"
assert "Disallow: /seasidesculpt/" in robots, "robots.txt must exclude the template preview"
assert "/admin" not in sitemap, "Sitemap must exclude admin"
assert "/seasidesculpt" not in sitemap, "Sitemap must exclude the template preview"
assert 'name="robots" content="noindex, nofollow"' in seaside_home, "Template home must be noindex"
assert 'href="schedule/"' in seaside_home, "Template home must link to the schedule route"
assert 'data-book' in seaside_schedule, "Schedule must retain booking controls"
assert 'name="robots" content="noindex, nofollow"' in seaside_admin, "Template admin must be noindex"
assert 'data-panel="schedule"' in seaside_admin, "Template admin must include schedule editing"
assert 'data-panel="pricing"' in seaside_admin, "Template admin must include pricing editing"

print(f"Validated {len(required_files)} files and 9 site requirements.")
