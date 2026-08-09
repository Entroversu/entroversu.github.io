# Entroversu

Static website for [entroversu.com](https://entroversu.com/).

The public `SIGNALS RECEIVED` badge uses [hits.sh](https://hits.sh/) to count anonymous page views across the homepage and album pages. It uses no cookies, fingerprinting or IP tracking; the displayed number represents page-load signals rather than unique people.

`ENTITIES ENTERED` is an approximate unique-browser count. The site stores only the local value `yes` in the visitor's browser after its first successful entry; no name, account, fingerprint or individual identifier is created or retained by Entroversu. Restricted browser modes and multiple devices mean that this number is intentionally approximate.

Private, aggregate traffic and performance metrics are collected with cookieless [Cloudflare Web Analytics](https://developers.cloudflare.com/web-analytics/). The public disclosure is available at [/privacy/](https://entroversu.com/privacy/).

## Updating the catalogue

1. Update the album card and homepage JSON-LD in `index.html`.
2. Optimize new cover art:

   ```powershell
   python scripts/optimize_covers.py
   ```

3. Generate the individual album pages and sitemap:

   ```powershell
   node scripts/build-album-pages.mjs
   ```

4. Test locally before publishing.

   ```powershell
   node scripts/validate-site.mjs
   ```
