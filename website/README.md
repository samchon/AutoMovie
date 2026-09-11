# @automovie/website

The public site at [samchon.github.io/automovie](https://samchon.github.io/automovie): a landing page and the viewer for the medieval baron manor, the finished production kept in this repository under `experimental/medieval-baron-manor`.

The manor page runs the production's authored source in the browser. It decodes the seven albedo textures, derives the shared prototype inventory the production's instance consumer reads, builds the scene, and then folds every entry into one mesh per material (`src/bakeManor.ts`) so the house draws in a few hundred calls instead of ten thousand. Views, flight, and the `?view=<id>` deep link all address the production's own authored observation points.

## Commands

```bash
pnpm --filter @automovie/website dev      # Vite dev server at http://127.0.0.1:5174/automovie/
pnpm --filter @automovie/website build    # ttsc --noEmit, then vite build into dist/
pnpm --filter @automovie/website preview  # serve dist/ at http://127.0.0.1:4174/automovie/
pnpm --filter @automovie/website deploy   # build, then publish dist/ to the gh-pages branch
```

`.github/workflows/website.yml` builds the site on every pull request that touches it and deploys `dist/` to `gh-pages` on every push to `master`. The site is served under the `/automovie/` project path, which `vite.config.ts` sets as `base`.

## Layout

| Path | Role |
| --- | --- |
| `index.html` | Landing page. Static; its screenshots under `public/shots/` were captured from the manor page itself. |
| `manor/index.html`, `src/manor.ts` | The manor viewer: loading card, featured views, the production's searchable view navigator, first-person flight. |
| `src/bakeManor.ts` | Entry-level mesh merge that keeps every view's visibility, pose, and clipping semantics. |
| `src/medieval-baron-manor.d.ts` | The typed boundary onto the production's JavaScript scene module. |
| `build/deploy.cjs` | Manual `gh-pages` publish, the same branch the workflow writes. |
