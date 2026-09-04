import { IAutoMovieCaptureRuntimeIdentity } from "@automovie/interface";
import typia from "typia";

import {
  canonicalizeAutoMovieJson,
  digestAutoMovieBytes,
} from "./contentIdentity";

/**
 * Current structured capture-runtime identity protocol.
 */
export const AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL =
  "automovie.capture-runtime.v2" satisfies IAutoMovieCaptureRuntimeIdentity["protocolVersion"];

/**
 * Validate and canonically encode one capture runtime identity.
 */
export const canonicalAutoMovieCaptureRuntimeIdentity = (
  identity: IAutoMovieCaptureRuntimeIdentity,
): string => {
  if (
    (identity as { protocolVersion?: unknown }).protocolVersion !==
    AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL
  )
    throw new Error(
      `Unsupported AutoMovie capture runtime identity protocol ${JSON.stringify(
        (identity as { protocolVersion?: unknown }).protocolVersion,
      )}; expected ${AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL}.`,
    );
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
  const digest = /^sha256:[0-9a-f]{64}$/u;
  const packages = identity.runtimeClosure.packages;
  const sortedPackages = [...packages].sort((left, right) =>
    compareCodeUnits(
      `${left.package}\0${left.version}\0${left.contentDigest}`,
      `${right.package}\0${right.version}\0${right.contentDigest}`,
    ),
  );
  if (
    identity.runtimeClosure.protocolVersion !==
      "automovie.capture-runtime-closure.v1" ||
    digest.test(identity.runtimeClosure.contentDigest) === false ||
    packages.length === 0 ||
    packages.some(
      (entry, index) =>
        entry.package.trim().length === 0 ||
        entry.package !== entry.package.trim() ||
        entry.version.trim().length === 0 ||
        entry.version !== entry.version.trim() ||
        digest.test(entry.contentDigest) === false ||
        Number.isSafeInteger(entry.files) === false ||
        entry.files <= 0 ||
        Number.isSafeInteger(entry.bytes) === false ||
        entry.bytes <= 0 ||
        entry.package !== sortedPackages[index]?.package ||
        entry.version !== sortedPackages[index]?.version ||
        entry.contentDigest !== sortedPackages[index]?.contentDigest,
    ) ||
    new Set(
      packages.map(
        (entry) => `${entry.package}\0${entry.version}\0${entry.contentDigest}`,
      ),
    ).size !== packages.length ||
    [
      "vite",
      "@automovie/viewer",
      "@automovie/engine",
      "three",
      "playwright",
      "playwright-core",
    ].some(
      (required) =>
        packages.some((entry) => entry.package === required) === false,
    )
  )
    throw new Error(
      "AutoMovie capture runtime package closure must be complete, canonical, non-empty, and content addressed.",
    );
  const browserSupport = identity.runtimeClosure.browserSupport;
  if (
    (browserSupport.status === "content-sealed" &&
      (digest.test(browserSupport.contentDigest) === false ||
        Number.isSafeInteger(browserSupport.files) === false ||
        browserSupport.files <= 0 ||
        Number.isSafeInteger(browserSupport.bytes) === false ||
        browserSupport.bytes <= 0)) ||
    (identity.browser.source === "system-channel") !==
      (browserSupport.status === "system-channel-unsealed") ||
    browserSupport.source !== identity.browser.source
  )
    throw new Error(
      "AutoMovie capture runtime browser support closure does not match the selected browser source.",
    );
  const closureDigest = digestAutoMovieBytes(
    Buffer.from(
      canonicalizeAutoMovieJson({
        protocolVersion: identity.runtimeClosure.protocolVersion,
        packages: identity.runtimeClosure.packages,
        browserSupport: identity.runtimeClosure.browserSupport,
      }),
      "utf8",
    ),
  );
  if (closureDigest !== identity.runtimeClosure.contentDigest)
    throw new Error(
      "AutoMovie capture runtime closure digest does not match its package and browser support identities.",
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
    digest.test(identity.browser.executableDigest) === false
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

const compareCodeUnits = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;

/**
 * Parse one exact canonical identity embedded in a current render manifest.
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
  if (value === null || typeof value !== "object" || Array.isArray(value))
    throw new Error(
      "Capture runtime identity must decode to one versioned JSON object.",
    );
  const protocolVersion = (value as Record<string, unknown>).protocolVersion;
  if (protocolVersion !== AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL)
    throw new Error(
      `Unsupported AutoMovie capture runtime identity protocol ${JSON.stringify(
        protocolVersion,
      )}; expected ${AUTOMOVIE_CAPTURE_RUNTIME_IDENTITY_PROTOCOL}.`,
    );
  const canonical = canonicalAutoMovieCaptureRuntimeIdentity(
    value as IAutoMovieCaptureRuntimeIdentity,
  );
  if (canonical !== encoded)
    throw new Error(
      "Capture runtime identity is not canonical JSON. Encode it with canonicalAutoMovieCaptureRuntimeIdentity.",
    );
  return value as IAutoMovieCaptureRuntimeIdentity;
};
