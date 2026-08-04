import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import {
  canonicalAutoMovieCaptureRuntimeIdentity,
  parseAutoMovieCaptureRuntimeIdentity,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { testCaptureRuntimeIdentity } from "./productionFixtures";

/**
 * Evaluate named facts in order and stop at the first false one, so a failed
 * comparison names the fact instead of collapsing into one boolean. Stopping
 * keeps the short-circuit semantics the original conjunction had, which some
 * facts depend on to guard the ones after them.
 */
const namedFacts = (
  entries: ReadonlyArray<readonly [string, () => boolean]>,
): Record<string, boolean> => {
  const output: Record<string, boolean> = {};
  for (const [name, evaluate] of entries) {
    output[name] = evaluate();
    if (output[name] === false) break;
  }
  return output;
};

const throws = (task: () => unknown, fragment: string): boolean => {
  try {
    task();
    return false;
  } catch (error) {
    return error instanceof Error && error.message.includes(fragment);
  }
};

/** Capture-runtime identities are structured, canonical, and source-aware. */
export const test_mcp_capture_runtime_identity = (): void => {
  const identity = testCaptureRuntimeIdentity();
  const canonical = canonicalAutoMovieCaptureRuntimeIdentity(identity);
  // Canonical encoding sorts keys, so the round trip is a content identity
  // rather than a byte identity: comparing serialized text would only restate
  // the sort. Re-encoding the parsed value pins that the canonical bytes are
  // the fixed point the manifest stores.
  TestValidator.equals(
    "structured capture identity round-trips through canonical JSON",
    parseAutoMovieCaptureRuntimeIdentity(canonical),
    identity,
  );
  TestValidator.equals(
    "canonical capture identity is its own re-encoding",
    canonicalAutoMovieCaptureRuntimeIdentity(
      parseAutoMovieCaptureRuntimeIdentity(canonical),
    ),
    canonical,
  );
  TestValidator.equals(
    "capture identity rejects schema and canonical encoding drift",
    namedFacts([
      [
        "rejected",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(
                {} as IAutoMovieCaptureRuntimeIdentity,
              ),
            "Invalid AutoMovie",
          ),
      ],
      [
        "rejected2",
        () =>
          throws(
            () => parseAutoMovieCaptureRuntimeIdentity("{bad"),
            "not JSON",
          ),
      ],
      [
        "rejected3",
        () =>
          throws(
            () =>
              parseAutoMovieCaptureRuntimeIdentity(
                JSON.stringify(identity, null, 2),
              ),
            "not canonical",
          ),
      ],
    ]),
    {
      rejected: true,
      rejected2: true,
      rejected3: true,
    },
  );

  const blank = structuredClone(identity);
  blank.graphics.renderer = " ";
  const notFinite = structuredClone(identity);
  notFinite.mode.deviceScaleFactor = Number.NaN;
  const notPositive = structuredClone(identity);
  notPositive.mode.deviceScaleFactor = 0;
  const invalidDigest = structuredClone(identity);
  invalidDigest.browser.executableDigest = "sha256:bad" as `sha256:${string}`;
  TestValidator.equals(
    "capture identity rejects blank and dishonest raster fields",
    namedFacts([
      [
        "rejected",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(blank),
            "non-blank",
          ),
      ],
      [
        "rejected2",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(notFinite),
            "finite and positive",
          ),
      ],
      [
        "rejected3",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(notPositive),
            "finite and positive",
          ),
      ],
      [
        "rejected4",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(invalidDigest),
            "exact SHA-256",
          ),
      ],
    ]),
    {
      rejected: true,
      rejected2: true,
      rejected3: true,
      rejected4: true,
    },
  );

  const packageWithoutRevision = structuredClone(identity);
  packageWithoutRevision.browser.revision = null;
  const packageWithBlankRevision = structuredClone(identity);
  packageWithBlankRevision.browser.revision = " ";
  const packageWithoutDigest = structuredClone(identity);
  packageWithoutDigest.browser.executableDigest = null;
  const packageWithSystemProduct = structuredClone(identity);
  packageWithSystemProduct.browser.product = "chrome";
  const configuredWithoutDigest = structuredClone(identity);
  configuredWithoutDigest.browser.source = "configured-executable";
  configuredWithoutDigest.browser.revision = null;
  configuredWithoutDigest.browser.executableDigest = null;
  const configuredWithRevision = structuredClone(identity);
  configuredWithRevision.browser.source = "configured-executable";
  const systemWithProvenance = structuredClone(identity);
  systemWithProvenance.browser.product = "chrome";
  systemWithProvenance.browser.source = "system-channel";
  const systemWithDigestOnly = structuredClone(identity);
  systemWithDigestOnly.browser.product = "chrome";
  systemWithDigestOnly.browser.source = "system-channel";
  systemWithDigestOnly.browser.revision = null;
  const systemWithPackageProduct = structuredClone(identity);
  systemWithPackageProduct.browser.source = "system-channel";
  systemWithPackageProduct.browser.revision = null;
  systemWithPackageProduct.browser.executableDigest = null;
  TestValidator.equals(
    "capture identity enforces provenance rules for each browser source",
    namedFacts([
      [
        "rejected",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(packageWithoutRevision),
            "requires",
          ),
      ],
      [
        "rejected2",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(
                packageWithBlankRevision,
              ),
            "requires",
          ),
      ],
      [
        "rejected3",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(packageWithoutDigest),
            "requires",
          ),
      ],
      [
        "rejected4",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(
                packageWithSystemProduct,
              ),
            "requires",
          ),
      ],
      [
        "rejected5",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(configuredWithoutDigest),
            "exact executable",
          ),
      ],
      [
        "rejected6",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(configuredWithRevision),
            "exact executable",
          ),
      ],
      [
        "rejected7",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(systemWithProvenance),
            "must leave",
          ),
      ],
      [
        "rejected8",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(systemWithDigestOnly),
            "must leave",
          ),
      ],
      [
        "rejected9",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(
                systemWithPackageProduct,
              ),
            "must leave",
          ),
      ],
    ]),
    {
      rejected: true,
      rejected2: true,
      rejected3: true,
      rejected4: true,
      rejected5: true,
      rejected6: true,
      rejected7: true,
      rejected8: true,
      rejected9: true,
    },
  );

  const system = structuredClone(identity);
  system.browser.product = "chrome";
  system.browser.source = "system-channel";
  system.browser.revision = null;
  system.browser.executableDigest = null;
  const configured = structuredClone(identity);
  configured.browser.source = "configured-executable";
  configured.browser.revision = null;
  TestValidator.predicate(
    "system and configured browser identities remain representable",
    parseAutoMovieCaptureRuntimeIdentity(
      canonicalAutoMovieCaptureRuntimeIdentity(system),
    ).browser.source === "system-channel" &&
      parseAutoMovieCaptureRuntimeIdentity(
        canonicalAutoMovieCaptureRuntimeIdentity(configured),
      ).browser.source === "configured-executable",
  );
};
