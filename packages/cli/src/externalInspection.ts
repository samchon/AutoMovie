import {
  type AutoMovieExternalModelIngestProfile,
  type IAutoMovieExternalModelInspection,
  inspectAutoMovieExternalModelBytes,
} from "@automovie/ingest";
import type { AutoMovieContentDigest } from "@automovie/interface";
import { digestAutoMovieBytes } from "@automovie/production";
import path from "node:path";

const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/u;

/**
 * One POSIX-relative, normalized, root-bound project path: no drive or root
 * prefix, no backslash, no `.` or `..` segment, no empty segment, and equal to
 * its own normalization so two spellings cannot name one file.
 */
const isCanonicalProjectPath = (value: string): boolean =>
  path.posix.isAbsolute(value) === false &&
  /^[A-Za-z]:/u.test(value) === false &&
  value.includes("\\") === false &&
  value !== "." &&
  path.posix.normalize(value) === value &&
  value.split("/").every((segment) => segment.length > 0 && segment !== "..");

/**
 * One sidecar the inspection opened, identified by exact resident bytes.
 *
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Binds one glTF buffer or image dependency to the digest and length of the bytes the inspector actually read.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Carries the canonical locator, every declared URI that reached it, its byte length, and its content digest as one closure member.
 */
export interface IAutoMovieExternalProjectResource {
  /** Resident byte length of the sidecar. */
  bytes: number;
  /** Every URI the document declared that resolved to this path, in first-use order. */
  declaredUris: string[];
  /** SHA-256 digest of the resident sidecar bytes. */
  digest: AutoMovieContentDigest;
  /** Canonical project-relative sidecar path. */
  path: string;
}

/**
 * Deterministic inspection envelope the generated `external:inspect` command
 * prints: the primary source identity, the sidecar closure it opened, and the
 * inspector's structural facts.
 *
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Seals the inspected result to the exact primary and sidecar bytes it was computed from.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Publishes the finite closure the parser reached beside the facts derived from it.
 */
export interface IAutoMovieExternalProjectInspection {
  /** Structural facts returned by the ingest inspector under the fixed profile. */
  inspection: IAutoMovieExternalModelInspection;
  /** Sidecars opened during inspection, in the order the parser first reached them. */
  resources: IAutoMovieExternalProjectResource[];
  /** Primary source identity. */
  source: {
    /** Resident byte length of the primary source. */
    bytes: number;
    /** SHA-256 digest of the primary source bytes. */
    digest: AutoMovieContentDigest;
    /** Canonical project-relative source path. */
    path: string;
  };
}

/**
 * Resolve one glTF sidecar URI to its canonical project-relative path.
 *
 * The declared URI is data, never a location the tool may open on its own
 * terms: a scheme, network path, query, fragment, backslash, or malformed
 * escape is refused before decoding is trusted, and the decoded relative path
 * must land inside the project namespace as one canonical spelling.
 *
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-location-boundary Decides whether each declared locator stays inside the project asset root and refuses every escaping or host-switching form.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-locator-redirect-fence Computes the canonical target only inside the authorized project root and treats an undeclared protocol, network authority, or escape as a resolution error.
 * @evidence specifications/interchange-and-adoption/intake-authority-and-routing.md#interchange-source-authority-separation Keeps a document-declared URI an opaque schema field that cannot name a filesystem path outside the project.
 */
export const resolveAutoMovieExternalProjectResourcePath = (props: {
  /** Canonical project-relative model or motion path. */
  source: string;
  /** URI exactly as declared by the inspected glTF document. */
  uri: string;
}): string => {
  if (isCanonicalProjectPath(props.source) === false)
    throw new Error(
      `External inspection source ${JSON.stringify(props.source)} is not one canonical project-relative path.`,
    );
  if (
    props.uri.includes("?") ||
    props.uri.includes("#") ||
    SCHEME.test(props.uri) ||
    props.uri.startsWith("//")
  )
    throw new Error(
      `Sidecar URI ${JSON.stringify(props.uri)} must be a plain project-relative asset path.`,
    );
  let decoded: string;
  try {
    decoded = decodeURIComponent(props.uri);
  } catch {
    throw new Error(
      `Sidecar URI ${JSON.stringify(props.uri)} is not valid percent-encoding.`,
    );
  }
  if (
    decoded.startsWith("/") ||
    decoded.includes("\\") ||
    decoded.includes("?") ||
    decoded.includes("#") ||
    SCHEME.test(decoded)
  )
    throw new Error(
      `Sidecar URI ${JSON.stringify(props.uri)} must decode to one plain relative asset path.`,
    );
  const resolved = path.posix.join(path.posix.dirname(props.source), decoded);
  if (isCanonicalProjectPath(resolved) === false)
    throw new Error(
      `Sidecar URI ${JSON.stringify(props.uri)} escapes or aliases the project asset namespace.`,
    );
  return resolved;
};

/**
 * Inspect one project-owned asset and retain the exact byte closure it used.
 *
 * Every sidecar is read once through the injected project reader, keyed by its
 * canonical path so two declared spellings of one file share one identity, and
 * the envelope records the primary and sidecar digests beside the inspector's
 * facts. The function performs no semantic mapping and no adoption decision.
 *
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-media-dependencies Identifies every buffer and image dependency the inspection read and binds each to its digest.
 * @evidence requirements/external-inputs/resource-closure-and-acquisition.md#external-resource-location-boundary Resolves each declared sidecar through the canonical project-path law before the reader is asked for bytes.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-media-dependency-extraction Returns the closure the parser-declared dependency edges reached, each member with locator, declared URIs, length, and digest.
 * @evidence specifications/interchange-and-adoption/resource-closure-and-acquisition.md#interchange-locator-redirect-fence Reads only inside the project namespace the reader exposes and never reopens a remote locator.
 */
export const inspectAutoMovieExternalProjectBytes = (props: {
  /** Canonical project-relative source path. */
  source: string;
  /** Exact primary source bytes. */
  bytes: Uint8Array;
  /** Explicit fixed ingest profile. */
  profile: AutoMovieExternalModelIngestProfile;
  /** Read one canonical project-relative sidecar, or return null when absent. */
  readResource: (relative: string) => Uint8Array | null;
}): IAutoMovieExternalProjectInspection => {
  if (isCanonicalProjectPath(props.source) === false)
    throw new Error(
      `External inspection source ${JSON.stringify(props.source)} is not one canonical project-relative path.`,
    );
  const resources = new Map<
    string,
    IAutoMovieExternalProjectResource & { resident: Uint8Array }
  >();
  const inspection = inspectAutoMovieExternalModelBytes({
    path: props.source,
    bytes: props.bytes,
    profile: props.profile,
    resolveResource: (uri) => {
      const relative = resolveAutoMovieExternalProjectResourcePath({
        source: props.source,
        uri,
      });
      const prior = resources.get(relative);
      if (prior !== undefined) {
        if (prior.declaredUris.includes(uri) === false)
          prior.declaredUris.push(uri);
        return prior.resident;
      }
      const resident = props.readResource(relative);
      if (resident === null) return null;
      resources.set(relative, {
        bytes: resident.byteLength,
        declaredUris: [uri],
        digest: digestAutoMovieBytes(resident),
        path: relative,
        resident,
      });
      return resident;
    },
  });
  return {
    source: {
      path: props.source,
      bytes: props.bytes.byteLength,
      digest: digestAutoMovieBytes(props.bytes),
    },
    resources: [...resources.values()].map(
      ({ resident: _resident, ...resource }) => resource,
    ),
    inspection,
  };
};
