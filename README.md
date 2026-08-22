# Danny's Designs

The static website for [dannysdesigns.com](https://dannysdesigns.com), deployed with GitHub Pages.

## Local development

```bash
python -m http.server 4173 --directory public
```

Then open `http://localhost:4173`.

## Build and validation

```bash
python scripts/build.py
python tests/validate_site.py
```

The production-ready site is generated in `dist/`. The `/admin/` page is intentionally excluded from search indexing and directs authenticated maintainers to the repository and Pages settings.
