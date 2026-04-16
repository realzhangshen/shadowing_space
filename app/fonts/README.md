# Self-hosted fonts

These WOFF2 files are bundled in the repo so the build step has no runtime
dependency on `fonts.googleapis.com` / `fonts.gstatic.com`. That makes:

- Builds possible on networks where Google Fonts is unreachable.
- Builds deterministic — the exact font version is pinned by the checked-in
  file bytes, not by whatever Google serves at build time.
- Production sites faster and more private — no external CDN hop for font
  delivery at runtime.

## Contents

| File                                     | Source                                | Glyphs                             |
| ---------------------------------------- | ------------------------------------- | ---------------------------------- |
| `inter-latin-wght-normal.woff2`          | `@fontsource-variable/inter`          | Latin (variable weight 100–900)    |
| `inter-cyrillic-wght-normal.woff2`       | `@fontsource-variable/inter`          | Cyrillic (variable weight 100–900) |
| `jetbrains-mono-latin-wght-normal.woff2` | `@fontsource-variable/jetbrains-mono` | Latin (variable weight 100–800)    |

## Regenerating

These are copied from the `@fontsource-variable/*` npm packages (which repackage
the Google Fonts distribution). To regenerate with a fresher upstream:

```bash
npm install --save-dev @fontsource-variable/inter @fontsource-variable/jetbrains-mono
cp node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2 app/fonts/
cp node_modules/@fontsource-variable/inter/files/inter-cyrillic-wght-normal.woff2 app/fonts/
cp node_modules/@fontsource-variable/jetbrains-mono/files/jetbrains-mono-latin-wght-normal.woff2 app/fonts/
```

## CJK fonts

The project intentionally does **not** bundle Noto Sans SC / TC / JP. CJK
glyphs come from the OS's system fonts (PingFang on macOS, Microsoft YaHei on
Windows, Noto Sans CJK on most Linux distros). This keeps the repo small
(~100KB instead of ~30MB) and gives users native-looking CJK text.
