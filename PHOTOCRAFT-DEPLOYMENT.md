# PhotoCraft browser deployment

Official project: https://github.com/storytold/photocraft

Release: https://github.com/storytold/photocraft/releases/tag/v0.23.1

Latest stable checked on 2026-11-14: v0.23.1 (not a prerelease).
The official `photocraft-web-0.23.1.zip` was verified against the release's
`SHA256SUMS.txt` (retained in `vendor/photocraft/`):

```
3a498eb517bca6cec89f9c6b1fc6448269a05428c8a3a4637c16817da157f03c
```

`photocraft/` contains the entire extracted release, including hidden files,
boot Wasm, split app parts, original relative paths, licences, attribution,
NOTICE, and hosting instructions. Git attributes disable line-ending conversion.
No third-party distribution, backend, analytics, or image upload service is added.
Images are edited on the visitor's device; Save/Export downloads files.
Download work before closing the tab: there is no server document storage.

The Actions workflow stages all release files unchanged under `/photocraft/`.
It also copies the release's root `snippets/` to `app/snippets/`, byte for byte,
to satisfy the v0.23.1 generated JavaScript imports without editing release code.
The root snippets directory remains intact. No SPA fallback is configured.

## Hosting requirements and Pages limitations

See `photocraft/HOSTING.md` from the actual release and the official
[hosting notes](https://github.com/storytold/photocraft/blob/v0.23.1/packaging/web/README.md).

- Use HTTPS and trailing-slash URLs so relative assets resolve at the repository subpath.
- Wasm requires `application/wasm`; JavaScript requires a JavaScript MIME type.
- Serve `app/*.part-*` unchanged, without Content-Encoding; the app inflates them.
- Unknown assets should return HTTP 404, not the application HTML.
- Upstream recommends immutable caching on hashed assets and no-cache on HTML,
  app/parts.txt and app/photocraft-web.js, plus compression on HTML/JS/boot Wasm.
  GitHub Pages controls headers and compression; it does not apply `_headers`
  or `.htaccess`. Those originals are retained but cannot enforce these rules.
  Pages' default caching can briefly retain old named manifests after upgrades.
- No COOP/COEP isolation headers are needed.

Enable Settings → Pages → Source: GitHub Actions, and allow Actions deployments
to the `github-pages` environment. The workflow requires pages:write and
id-token:write. Repository visibility must remain unchanged.

To stage locally, run `python scripts/prepare_photocraft.py` in a fresh checkout;
serve `_site` with a static HTTP server. For upgrades, replace the entire
release folder with a newly checksum-verified official stable release and review
whether the snippets compatibility copy is still needed.
