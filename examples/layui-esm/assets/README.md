# Self-hosted assets

The CDN-based `../index.html` runs without npm or a build step. To verify a self-hosted release, copy these
published files into this directory without changing their relative layout:

```text
aieditor/browser.js
aieditor/style.css
aieditor/assets/*
```

Then replace the two AiEditor CDN URLs in `index.html` with `/assets/aieditor/style.css` and
`/assets/aieditor/browser.js`. Do not copy `dist/index.js`; it is the bundler entry and intentionally retains bare
npm imports.
