import type { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import {
  canonicalAutoMovieCaptureRuntimeIdentity,
  parseAutoMovieCaptureRuntimeIdentity,
} from "@automovie/mcp";
import { TestValidator } from "@nestia/e2e";

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
  TestValidator.predicate(
    "structured capture identity round-trips through canonical JSON",
    JSON.stringify(parseAutoMovieCaptureRuntimeIdentity(canonical)) ===
      JSON.stringify(identity),
  );
  TestValidator.predicate(
    "capture identity rejects schema and canonical encoding drift",
    throws(
      () =>
        canonicalAutoMovieCaptureRuntimeIdentity(
          {} as IAutoMovieCaptureRuntimeIdentity,
        ),
      "Invalid AutoMovie",
    ) &&
      throws(() => parseAutoMovieCaptureRuntimeIdentity("{bad"), "not JSON") &&
      throws(
        () =>
          parseAutoMovieCaptureRuntimeIdentity(
            JSON.stringify(identity, null, 2),
          ),
        "not canonical",
      ),
  );

  const blank = structuredClone(identity);
  blank.graphics.renderer = " ";
  const notFinite = structuredClone(identity);
  notFinite.mode.deviceScaleFactor = Number.NaN;
  const notPositive = structuredClone(identity);
  notPositive.mode.deviceScaleFactor = 0;
  const invalidDigest = structuredClone(identity);
  invalidDigest.browser.executableDigest = "sha256:bad" as `sha256:${string}`;
  TestValidator.predicate(
    "capture identity rejects blank and dishonest raster fields",
    throws(
      () => canonicalAutoMovieCaptureRuntimeIdentity(blank),
      "non-blank",
    ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(notFinite),
        "finite and positive",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(notPositive),
        "finite and positive",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(invalidDigest),
        "exact SHA-256",
      ),
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
  TestValidator.predicate(
    "capture identity enforces provenance rules for each browser source",
    throws(
      () => canonicalAutoMovieCaptureRuntimeIdentity(packageWithoutRevision),
      "requires",
    ) &&
      throws(
        () =>
          canonicalAutoMovieCaptureRuntimeIdentity(packageWithBlankRevision),
        "requires",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(packageWithoutDigest),
        "requires",
      ) &&
      throws(
        () =>
          canonicalAutoMovieCaptureRuntimeIdentity(packageWithSystemProduct),
        "requires",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(configuredWithoutDigest),
        "exact executable",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(configuredWithRevision),
        "exact executable",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(systemWithProvenance),
        "must leave",
      ) &&
      throws(
        () => canonicalAutoMovieCaptureRuntimeIdentity(systemWithDigestOnly),
        "must leave",
      ) &&
      throws(
        () =>
          canonicalAutoMovieCaptureRuntimeIdentity(systemWithPackageProduct),
        "must leave",
      ),
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
