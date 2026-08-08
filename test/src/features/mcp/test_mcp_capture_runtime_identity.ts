import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import {
  canonicalAutoMovieCaptureRuntimeIdentity,
  parseAutoMovieCaptureRuntimeIdentity,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

import { namedFacts } from "../internal/predicates";
import { testCaptureRuntimeIdentity } from "./productionFixtures";

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
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityAs",
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
        "throwsParseAutoMovieCaptureRuntimeIdentityBad",
        () =>
          throws(
            () => parseAutoMovieCaptureRuntimeIdentity("{bad"),
            "not JSON",
          ),
      ],
      [
        "throwsParseAutoMovieCaptureRuntimeIdentityStringify",
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
      throwsCanonicalAutoMovieCaptureRuntimeIdentityAs: true,
      throwsParseAutoMovieCaptureRuntimeIdentityBad: true,
      throwsParseAutoMovieCaptureRuntimeIdentityStringify: true,
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
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityBlank",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(blank),
            "non-blank",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityNotFinite",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(notFinite),
            "finite and positive",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityNotPositive",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(notPositive),
            "finite and positive",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityInvalidDigest",
        () =>
          throws(
            () => canonicalAutoMovieCaptureRuntimeIdentity(invalidDigest),
            "exact SHA-256",
          ),
      ],
    ]),
    {
      throwsCanonicalAutoMovieCaptureRuntimeIdentityBlank: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityNotFinite: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityNotPositive: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityInvalidDigest: true,
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
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithoutRevision",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(packageWithoutRevision),
            "requires",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithBlankRevision",
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
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithoutDigest",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(packageWithoutDigest),
            "requires",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithSystemProduct",
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
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityConfiguredWithoutDigest",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(configuredWithoutDigest),
            "exact executable",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentityConfiguredWithRevision",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(configuredWithRevision),
            "exact executable",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentitySystemWithProvenance",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(systemWithProvenance),
            "must leave",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentitySystemWithDigestOnly",
        () =>
          throws(
            () =>
              canonicalAutoMovieCaptureRuntimeIdentity(systemWithDigestOnly),
            "must leave",
          ),
      ],
      [
        "throwsCanonicalAutoMovieCaptureRuntimeIdentitySystemWithPackageProduct",
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
      throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithoutRevision: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithBlankRevision: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithoutDigest: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityPackageWithSystemProduct: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityConfiguredWithoutDigest: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentityConfiguredWithRevision: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentitySystemWithProvenance: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentitySystemWithDigestOnly: true,
      throwsCanonicalAutoMovieCaptureRuntimeIdentitySystemWithPackageProduct: true,
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
  TestValidator.equals(
    "system and configured browser identities remain representable",
    namedFacts([
      [
        "parseAutoMovieCaptureRuntimeIdentityCanonicalAutoMovieCaptureRuntimeIdentitySystem",
        () =>
          parseAutoMovieCaptureRuntimeIdentity(
            canonicalAutoMovieCaptureRuntimeIdentity(system),
          ).browser.source === "system-channel",
      ],
      [
        "parseAutoMovieCaptureRuntimeIdentityCanonicalAutoMovieCaptureRuntimeIdentityConfigured",
        () =>
          parseAutoMovieCaptureRuntimeIdentity(
            canonicalAutoMovieCaptureRuntimeIdentity(system),
          ).browser.source === "system-channel" &&
          parseAutoMovieCaptureRuntimeIdentity(
            canonicalAutoMovieCaptureRuntimeIdentity(configured),
          ).browser.source === "configured-executable",
      ],
    ]),
    {
      parseAutoMovieCaptureRuntimeIdentityCanonicalAutoMovieCaptureRuntimeIdentitySystem: true,
      parseAutoMovieCaptureRuntimeIdentityCanonicalAutoMovieCaptureRuntimeIdentityConfigured: true,
    },
  );
};
