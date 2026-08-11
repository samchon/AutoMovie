import { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import typia from "typia";

import { canonicalizeAutoMovieJson } from "./contentIdentity";

/**
 * Current structured capture-runtime identity protocol.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Versions the runtime closure recorded with captured pixels.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-capture-runtime-identity Makes the capture environment identity protocol explicit.
 */
export const AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL =
  "automovie.capture-runtime.v1";

/**
 * Validate and canonically encode one capture runtime identity.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Requires complete browser, platform, graphics, and capture-mode identity.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-capture-runtime-identity Canonicalizes supported runtime facts without claiming cross-platform byte equality.
 */
export const canonicalAutoMovieCaptureRuntimeIdentity = (
  identity: IAutoMovieCaptureRuntimeIdentity,
): string => {
  const validation =
    typia.validateEquals<IAutoMovieCaptureRuntimeIdentity>(identity);
  if (validation.success === false)
    throw new Error(
      `Invalid AutoMovie capture runtime identity: ${validation.errors
        .map((error) => `${error.path} expects ${error.expected}`)
        .join("; ")}`,
    );
  const text = [
    identity.playwright.version,
    identity.browser.version,
    identity.platform.os,
    identity.platform.arch,
    identity.graphics.requestedBackend,
    identity.graphics.vendor,
    identity.graphics.renderer,
  ];
  if (text.some((value) => value.trim().length === 0))
    throw new Error(
      "AutoMovie capture runtime identity text fields must be non-blank.",
    );
  if (
    Number.isFinite(identity.mode.deviceScaleFactor) === false ||
    identity.mode.deviceScaleFactor <= 0
  )
    throw new Error(
      "AutoMovie capture runtime deviceScaleFactor must be finite and positive.",
    );
  if (
    identity.browser.executableDigest !== null &&
    /^sha256:[0-9a-f]{64}$/.test(identity.browser.executableDigest) === false
  )
    throw new Error(
      "AutoMovie capture runtime executableDigest must be one exact SHA-256 digest.",
    );
  if (
    identity.browser.source === "package-owned" &&
    (identity.browser.product !== "chromium" ||
      identity.browser.revision === null ||
      identity.browser.revision.trim().length === 0 ||
      identity.browser.executableDigest === null)
  )
    throw new Error(
      "Package-owned capture identity requires the Chromium product, a non-blank Playwright revision, and an exact executable digest. Run npm run capture:install and npm run capture:doctor.",
    );
  if (
    identity.browser.source === "configured-executable" &&
    (identity.browser.revision !== null ||
      identity.browser.executableDigest === null)
  )
    throw new Error(
      "Configured capture executable identity requires a null Playwright revision and an exact executable digest.",
    );
  if (
    identity.browser.source === "system-channel" &&
    (identity.browser.product === "chromium" ||
      identity.browser.revision !== null ||
      identity.browser.executableDigest !== null)
  )
    throw new Error(
      "System-channel capture identity requires Chrome or Edge and must leave package revision and executable digest null.",
    );
  return canonicalizeAutoMovieJson(validation.data);
};

/**
 * Parse one exact canonical identity embedded in a v3 render manifest.
 *
 * @evidence requirements/rendering/headless-and-platform-determinism.md#rendering-runtime-identity Refuses incomplete or noncanonical runtime evidence.
 * @evidence specifications/editorial-render-and-delivery/render-schedule-state-and-headless.md#spec-render-capture-runtime-identity Recovers only the validated environment identity carried by a render artifact.
 */
export const parseAutoMovieCaptureRuntimeIdentity = (
  encoded: string,
): IAutoMovieCaptureRuntimeIdentity => {
  let value: unknown;
  try {
    value = JSON.parse(encoded) as unknown;
  } catch (error) {
    throw new Error(
      `Capture runtime identity is not JSON: ${String(error)}. Return canonical structured identity from the capture adapter.`,
    );
  }
  const canonical = canonicalAutoMovieCaptureRuntimeIdentity(
    value as IAutoMovieCaptureRuntimeIdentity,
  );
  if (canonical !== encoded)
    throw new Error(
      "Capture runtime identity is not canonical JSON. Encode it with canonicalAutoMovieCaptureRuntimeIdentity.",
    );
  return value as IAutoMovieCaptureRuntimeIdentity;
};
