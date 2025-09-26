# SMARTEL — GitHub-ready (full)

## Repository structure
```
/index.html                -> your form (unchanged)
/pdf-client.js             -> binds Save/Print and calls the function
/mapping.json              -> (optional) your field mapping
/_headers                  -> HTTP headers (fonts/pdf caching)
/template.pdf              -> optional copy for local preview

/netlify/functions/
  generate_pdf.js          -> serverless function (Node 18+)
  package.json             -> function dependencies (pdf-lib)
  /assets/
    template.pdf           -> the PDF template used by the function
    NotoSansKR.ttf         -> font for KR text (optional)
```

## Netlify build settings
- **Base directory**: *(blank)*
- **Build command**: *(blank)*
- **Publish directory**: `.`
- **Functions directory**: `netlify/functions`

Then **Deploys → Trigger deploy → Clear cache and deploy site**.

## GitHub updates
Edit `index.html` or `mapping.json` as you like, commit & push – Netlify redeploys automatically.
