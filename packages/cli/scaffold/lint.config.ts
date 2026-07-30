import { automovie } from "@automovie/lint";
import type { ITtscLintConfig } from "@ttsc/lint";

/**
 * `@ttsc/lint` config for this automovie project, applied automatically by
 * `ttsc` (`npm run lint` runs `ttsc --noEmit`) and autofixed by `npm run
 * format` (`ttsc format`). The engine is the arbiter of physical truth at
 * runtime; this config is the arbiter of code health at build time.
 *
 * The `format` block mirrors automovie's own house style (80 columns, double
 * quotes, semicolons, `lf`, trailing commas, third-party-then-relative import
 * order); its `severity: "off"` means formatting is a `npm run format` opt-in,
 * not a build blocker. The `rules` are a deliberately small, high-value
 * CORRECTNESS set (the classes of bug this stack is most exposed to), not a
 * style dragnet:
 *
 * - `switch-exhaustiveness-check` is the load-bearing one: automovie's API is
 *   discriminated unions everywhere (action verbs, shapes, targets), and an
 *   unhandled variant is exactly the silent-skip the engine's own doctrine
 *   forbids. Here the compiler catches it in YOUR code too.
 * - `no-floating-promises` / `no-misused-promises` / `await-thenable` guard the
 *   async render and perform paths from dropped promises.
 * - `no-explicit-any` keeps you inside the typed contract the engine enforces
 *   against: an `any` is where a malformed pose slips past the type layer.
 * - The rest (`eqeqeq`, `no-var`, `prefer-const`, `no-self-compare`,
 *   `no-fallthrough`, `no-duplicate-imports`, `ban-ts-comment`, the small
 *   autofixable TypeScript rules) are cheap, unambiguous, and mechanically
 *   fixable.
 *
 * Add to it as your project grows; every rule here is `error` because each one
 * flags a real defect, not a preference.
 */
const config = {
  format: {
    severity: "off",
    semi: true,
    singleQuote: false,
    arrowParens: "always",
    bracketSpacing: true,
    quoteProps: "as-needed",
    trailingComma: "all",
    printWidth: 80,
    tabWidth: 2,
    useTabs: false,
    endOfLine: "lf",
    sortImports: {
      order: ["<THIRD_PARTY_MODULES>", "^[./]"],
    },
    jsDoc: true,
  },
  plugins: {
    automovie,
  },
  rules: {
    "automovie/asset-provenance": [
      "error",
      {
        manifests: [".automovie/assets.json"],
        assets: [
          "public/**/*.bin",
          "public/**/*.exr",
          "public/**/*.flac",
          "public/**/*.glb",
          "public/**/*.gltf",
          "public/**/*.hdr",
          "public/**/*.jpeg",
          "public/**/*.jpg",
          "public/**/*.json",
          "public/**/*.ktx",
          "public/**/*.ktx2",
          "public/**/*.mp3",
          "public/**/*.ogg",
          "public/**/*.otf",
          "public/**/*.png",
          "public/**/*.svg",
          "public/**/*.ttf",
          "public/**/*.vrm",
          "public/**/*.wav",
          "public/**/*.webp",
          "public/**/*.woff",
          "public/**/*.woff2",
        ],
      },
    ],
    "automovie/screenplay-contract": [
      "error",
      {
        indexes: [
          ".automovie/design/screenplay/index.json",
          ".automovie/design/*/screenplay/index.json",
        ],
        documents: ["docs/**/*.md"],
        shots: [
          ".automovie/design/shots/*.json",
          ".automovie/design/*/shots/*.json",
        ],
        acceptance: [
          ".automovie/design/acceptance/*.json",
          ".automovie/design/*/acceptance/*.json",
        ],
        models: [
          ".automovie/design/models/*.json",
          ".automovie/design/*/models/*.json",
          ".automovie/design/shared/models/*.json",
        ],
        formations: [
          ".automovie/design/formations/*.json",
          ".automovie/design/*/formations/*.json",
          ".automovie/design/shared/formations/*.json",
        ],
        worlds: [
          ".automovie/design/world.json",
          ".automovie/design/*/world.json",
          ".automovie/design/shared/world.json",
        ],
        realizations: [
          "generated/realizations/*.json",
          "generated/*/realizations/*.json",
        ],
        reviews: [
          ".automovie/reviews/shots/*.json",
          ".automovie/reviews/films/*.json",
          ".automovie/reviews/*/shots/*.json",
          ".automovie/reviews/*/films/*.json",
        ],
      },
    ],
    "automovie/state-presence": [
      "error",
      {
        slots: [
          {
            name: "screenplay-index",
            files: [
              ".automovie/design/screenplay/index.json",
              ".automovie/design/*/screenplay/index.json",
            ],
            requires: [],
          },
          {
            name: "shot-contracts",
            files: [
              ".automovie/design/shots/*.json",
              ".automovie/design/*/shots/*.json",
            ],
            requires: ["screenplay-index"],
          },
        ],
      },
    ],
    "automovie/template-sentinel": "error",
    eqeqeq: "error",
    "no-debugger": "error",
    "no-duplicate-imports": "error",
    "no-fallthrough": "error",
    "no-self-compare": "error",
    "no-var": "error",
    "prefer-const": "error",
    "typescript/await-thenable": "error",
    "typescript/ban-ts-comment": "error",
    "typescript/no-explicit-any": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/no-unnecessary-type-constraint": "error",
    "typescript/prefer-as-const": "error",
    "typescript/switch-exhaustiveness-check": "error",
  },
} satisfies ITtscLintConfig;

export default config;
