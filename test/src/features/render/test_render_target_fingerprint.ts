import {
  autoMovieRenderDigest,
  autoMovieRenderTargetAssets,
  autoMovieRenderTargetSummary,
  compareAutoMovieRenderIds,
  compareAutoMovieRenderTarget,
  sealAutoMovieRenderTarget,
} from "@automovie/engine";
import {
  AutoMovieContentDigest,
  IAutoMovieRenderReport,
  IAutoMovieRenderTarget,
  IAutoMovieRenderTargetSettings,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";

import { namedFacts, throwsError } from "../internal/predicates";

/**
 * A report is evidence only while the target it measured is still the target in
 * front of the consumer.
 *
 * The digest is proved against Node's own SHA-256 rather than against a stored
 * expectation of this engine's output, because the whole point of writing the
 * transform out is that the browser-side engine and the Node-side capture path
 * agree byte for byte. A snapshot of this code's own hash would agree with
 * itself and with nothing else.
 *
 * Scenarios:
 *
 * 1. The pure-TypeScript digest equals `node:crypto` on the empty string, on both
 *    sides of the 55/56-byte padding boundary, on an exact block, on a
 *    multi-block input, and on astral, multi-byte and lone-surrogate text.
 * 2. Sealing is order-independent in the asset list and stable across calls.
 * 3. A blank renderer field, a non-integer buffer size, a non-positive ratio or
 *    exposure, a shadow policy contradicting its filter, a blank or duplicated
 *    asset path and a malformed digest are each refused.
 * 4. Every kind of drift is detected and named: renderer, each setting, a changed
 *    asset, a removed asset and an added asset.
 * 5. An unchanged target is fresh, and the one-line summary says which.
 */
export const test_render_target_fingerprint = (): void => {
  const oracle = (text: string): AutoMovieContentDigest =>
    `sha256:${createHash("sha256").update(Buffer.from(text, "utf8")).digest("hex")}`;
  const samples = [
    "",
    "a",
    "x".repeat(55),
    "x".repeat(56),
    "x".repeat(63),
    "x".repeat(64),
    "x".repeat(65),
    "x".repeat(200),
    "표준 한글 텍스트",
    "éࠀ\u{1f600}",
    `lone-high:${String.fromCharCode(0xd800)}`,
    `lone-low:${String.fromCharCode(0xdc00)}`,
    `high-then-ascii:${String.fromCharCode(0xd800)}Z`,
  ];
  TestValidator.equals(
    "the engine's own SHA-256 agrees with node:crypto on every boundary",
    samples.map((text) => autoMovieRenderDigest(text)),
    samples.map(oracle),
  );

  // Code units, not collation. `"B".localeCompare("a")` is positive in English
  // and in most other locales, so evidence ordered that way would reorder
  // itself with the host's language; ordering by code unit puts "B" first
  // everywhere, which is what makes two machines produce the same bytes.
  TestValidator.equals(
    "ordering is by code unit, answering all three ways and ignoring collation",
    [
      compareAutoMovieRenderIds("a", "b"),
      compareAutoMovieRenderIds("b", "a"),
      compareAutoMovieRenderIds("a", "a"),
      compareAutoMovieRenderIds("B", "a"),
      Math.sign("B".localeCompare("a")),
    ],
    [-1, 1, 0, -1, 1],
  );

  const settings: IAutoMovieRenderTargetSettings = {
    width: 1920,
    height: 1080,
    pixelRatio: 2,
    shadows: true,
    shadowType: "pcf",
    toneMapping: "acesFilmic",
    exposure: 1.2,
  };
  const seal = (
    override?: Partial<IAutoMovieRenderTargetSettings>,
    assets?: Array<{ path: string; digest: `sha256:${string}` }>,
  ): IAutoMovieRenderTarget =>
    sealAutoMovieRenderTarget({
      renderer: { api: "webgl2", vendor: "acme", device: "gpu-1" },
      settings: { ...settings, ...override },
      assets:
        assets ??
        autoMovieRenderTargetAssets({
          "b.png": `sha256:${"b".repeat(64)}`,
          "a.png": `sha256:${"a".repeat(64)}`,
        }),
    });
  const sealed = seal();
  TestValidator.equals(
    "sealing normalizes asset order and repeats byte for byte",
    {
      paths: sealed.assets.map((asset) => asset.path),
      stable: seal().digest === sealed.digest,
      shuffled:
        seal(undefined, [
          { path: "b.png", digest: `sha256:${"b".repeat(64)}` },
          { path: "a.png", digest: `sha256:${"a".repeat(64)}` },
        ]).digest === sealed.digest,
    },
    { paths: ["a.png", "b.png"], stable: true, shuffled: true },
  );

  TestValidator.equals(
    "every malformed target field is refused at its own message",
    namedFacts([
      [
        "blank api",
        () =>
          throwsError(
            () =>
              sealAutoMovieRenderTarget({
                renderer: { api: " ", vendor: "acme", device: "gpu-1" },
                settings,
                assets: [],
              }),
            "renderer.api must be non-blank",
          ),
      ],
      [
        "blank vendor",
        () =>
          throwsError(
            () =>
              sealAutoMovieRenderTarget({
                renderer: { api: "webgl2", vendor: "", device: "gpu-1" },
                settings,
                assets: [],
              }),
            "renderer.vendor must be non-blank",
          ),
      ],
      [
        "blank device",
        () =>
          throwsError(
            () =>
              sealAutoMovieRenderTarget({
                renderer: { api: "webgl2", vendor: "acme", device: "" },
                settings,
                assets: [],
              }),
            "renderer.device must be non-blank",
          ),
      ],
      [
        "fractional width",
        () => throwsError(() => seal({ width: 10.5 }), "settings.width"),
      ],
      [
        "zero height",
        () => throwsError(() => seal({ height: 0 }), "settings.height"),
      ],
      [
        "zero ratio",
        () => throwsError(() => seal({ pixelRatio: 0 }), "settings.pixelRatio"),
      ],
      [
        "infinite exposure",
        () =>
          throwsError(
            () => seal({ exposure: Number.POSITIVE_INFINITY }),
            "settings.exposure",
          ),
      ],
      [
        "shadows on with no filter",
        () => throwsError(() => seal({ shadowType: "none" }), "contradicts"),
      ],
      [
        "shadows off with a filter",
        () => throwsError(() => seal({ shadows: false }), "contradicts"),
      ],
      [
        "blank asset path",
        () =>
          throwsError(
            () =>
              seal(undefined, [
                { path: " ", digest: `sha256:${"a".repeat(64)}` },
              ]),
            "asset path must be non-blank",
          ),
      ],
      [
        "duplicated asset",
        () =>
          throwsError(
            () =>
              seal(undefined, [
                { path: "a.png", digest: `sha256:${"a".repeat(64)}` },
                { path: "a.png", digest: `sha256:${"a".repeat(64)}` },
              ]),
            "declared more than once",
          ),
      ],
      [
        "malformed digest",
        () =>
          throwsError(
            () => seal(undefined, [{ path: "a.png", digest: "sha256:zz" }]),
            "exact lowercase SHA-256",
          ),
      ],
    ]),
    {
      "blank api": true,
      "blank vendor": true,
      "blank device": true,
      "fractional width": true,
      "zero height": true,
      "zero ratio": true,
      "infinite exposure": true,
      "shadows on with no filter": true,
      "shadows off with a filter": true,
      "blank asset path": true,
      "duplicated asset": true,
      "malformed digest": true,
    },
  );

  const carrying = (
    target: IAutoMovieRenderTarget,
  ): IAutoMovieRenderReport => ({
    version: 1,
    protocol: "automovie.render-report.v1",
    tier: "review",
    status: "within",
    findings: [],
    mask: `sha256:${"0".repeat(64)}`,
    target,
    digest: `sha256:${"0".repeat(64)}`,
  });
  const drifted = (current: IAutoMovieRenderTarget): string[] =>
    compareAutoMovieRenderTarget({
      report: carrying(sealed),
      current,
    }).drift.map((entry) => entry.field);

  TestValidator.equals(
    "every kind of drift is detected and named",
    {
      fresh: compareAutoMovieRenderTarget({
        report: carrying(sealed),
        current: seal(),
      }),
      renderer: drifted(
        sealAutoMovieRenderTarget({
          renderer: { api: "webgpu", vendor: "other", device: "gpu-2" },
          settings,
          assets: sealed.assets,
        }),
      ),
      width: drifted(seal({ width: 1280 })),
      shadow: drifted(seal({ shadows: false, shadowType: "none" })),
      tone: drifted(seal({ toneMapping: "none" })),
      exposure: drifted(seal({ exposure: 1 })),
      ratio: drifted(seal({ pixelRatio: 1 })),
      height: drifted(seal({ height: 720 })),
      changedAsset: drifted(
        seal(undefined, [
          { path: "a.png", digest: `sha256:${"c".repeat(64)}` },
          { path: "b.png", digest: `sha256:${"b".repeat(64)}` },
        ]),
      ),
      removedAsset: drifted(
        seal(undefined, [
          { path: "a.png", digest: `sha256:${"a".repeat(64)}` },
        ]),
      ),
      addedAsset: drifted(
        seal(undefined, [
          { path: "a.png", digest: `sha256:${"a".repeat(64)}` },
          { path: "b.png", digest: `sha256:${"b".repeat(64)}` },
          { path: "c.png", digest: `sha256:${"c".repeat(64)}` },
        ]),
      ),
    },
    {
      fresh: { fresh: true, drift: [] },
      renderer: ["renderer.api", "renderer.device", "renderer.vendor"],
      width: ["settings.width"],
      shadow: ["settings.shadowType", "settings.shadows"],
      tone: ["settings.toneMapping"],
      exposure: ["settings.exposure"],
      ratio: ["settings.pixelRatio"],
      height: ["settings.height"],
      changedAsset: ['assets["a.png"]'],
      removedAsset: ['assets["b.png"]'],
      addedAsset: ['assets["c.png"]'],
    },
  );

  TestValidator.equals(
    "the one-line summary states freshness or the exact drift",
    {
      fresh: autoMovieRenderTargetSummary({
        report: carrying(sealed),
        current: seal(),
      }),
      stale: autoMovieRenderTargetSummary({
        report: carrying(sealed),
        current: seal({ width: 1280 }),
      }).includes("settings.width 1920 -> 1280"),
    },
    { fresh: `fresh: ${sealed.digest}`, stale: true },
  );
};
