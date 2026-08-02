import path from "node:path";

interface IProxyBundleContainer {
  files: Array<{ bytes: string; path: string }>;
  version: 1;
}

/** Cached bytes bound to the exact publication snapshot that supplied them. */
export interface IProxyBundleCapturedEvidence {
  baseIdentity: string;
  bytes: Uint8Array;
  contentFingerprint: string;
  namespaceFingerprint: string;
  target: string;
  targetIdentity: string;
  targetVersion: string;
}

/** Serialize a proxy bundle into one deterministic regular-file container. */
export const encodeProxyBundleContainer = (
  files: ReadonlyMap<string, Uint8Array>,
): Uint8Array => {
  const seen = new Set<string>();
  const entries = [...files]
    .map(([relative, bytes]) => {
      const canonical = canonicalProxyBundlePath(relative);
      if (seen.has(canonical))
        throw new Error(`Proxy bundle repeats path "${canonical}".`);
      seen.add(canonical);
      return { path: canonical, bytes: Buffer.from(bytes).toString("base64") };
    })
    .sort((left, right) => compare(left.path, right.path));
  return Buffer.from(
    `${JSON.stringify({
      version: 1,
      files: entries,
    } satisfies IProxyBundleContainer)}\n`,
    "utf8",
  );
};

/** Parse one strict proxy container without trusting duplicate or alias paths. */
export const decodeProxyBundleContainer = (
  bytes: Uint8Array,
): ReadonlyMap<string, Uint8Array> => {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value) ||
    Object.keys(value).sort().join(",") !== "files,version" ||
    (value as { version?: unknown }).version !== 1 ||
    Array.isArray((value as { files?: unknown }).files) === false
  )
    throw new Error("Proxy bundle container is malformed or unsupported.");
  const output = new Map<string, Uint8Array>();
  for (const entry of (value as { files: unknown[] }).files) {
    if (
      typeof entry !== "object" ||
      entry === null ||
      Array.isArray(entry) ||
      Object.keys(entry).sort().join(",") !== "bytes,path" ||
      typeof (entry as { path?: unknown }).path !== "string" ||
      typeof (entry as { bytes?: unknown }).bytes !== "string"
    )
      throw new Error("Proxy bundle container entry is malformed.");
    const relative = canonicalProxyBundlePath((entry as { path: string }).path);
    const encoded = (entry as { bytes: string }).bytes;
    const decoded = Buffer.from(encoded, "base64");
    if (decoded.toString("base64") !== encoded || output.has(relative))
      throw new Error("Proxy bundle container has aliased or duplicate bytes.");
    output.set(relative, decoded);
  }
  if (output.has("publication.json") === false)
    throw new Error("Proxy bundle container has no publication receipt.");
  return output;
};

const canonicalProxyBundlePath = (relative: string): string => {
  const canonical = relative.replaceAll("\\", "/");
  const segments = canonical.split("/");
  if (
    canonical.length === 0 ||
    path.posix.normalize(canonical) !== canonical ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\0"),
    )
  )
    throw new Error(`Proxy bundle path "${relative}" is not canonical.`);
  return canonical;
};

const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
