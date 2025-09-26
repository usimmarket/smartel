
# SMARTEL form (static, GitHub + Netlify)
- Client-only PDF generation with pdf-lib.
- Update mapping.json when you change coordinates. Push to GitHub to deploy.

Files:
- index.html
- template.pdf
- pdf-client.js
- mapping.json
- fonts/NotoSansKR.ttf
- _headers (disable caching for template/mapping)

Mapping item format:
{
  "name": "subscriber",
  "selector": "[name='subscriber']",
  "page": 0,
  "x": 80,
  "y": 720,
  "size": 11
}
