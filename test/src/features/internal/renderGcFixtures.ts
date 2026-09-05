import type { AutoMovieContentDigest } from "@automovie/interface";
import path from "node:path";

/** The captured-target shape the scaffold GC modules exchange, mirrored for fakes. */
export interface IRenderGcSnapshotFixture {
  base: { identity: string; path: string; real: string; version: string };
  bytes: number;
  contentFingerprint: AutoMovieContentDigest;
  entries: Array<{
    bytes?: number;
    digest?: AutoMovieContentDigest;
    identity: string;
    kind: "directory" | "file";
    path: string;
  }>;
  fileDigest: AutoMovieContentDigest | null;
  kind: "directory" | "file";
  namespaceFingerprint: AutoMovieContentDigest;
  target: string;
  targetIdentity: string;
  targetVersion: string;
}

/** The subset of `fs.Dirent` the scaffold GC scans read. */
export interface IRenderGcDirentFixture {
  name: string;
  isDirectory: () => boolean;
  isFile: () => boolean;
  isSymbolicLink: () => boolean;
}

/** The typed cleanup observation a GC candidate carries. */
export interface IRenderGcObservationFixture {
  authority: string;
  reason: string;
  stage: string;
  state: string;
}

/** The GC candidate the production planner consumes. */
export interface IRenderGcCandidateFixture {
  bytes: number | null;
  digest: AutoMovieContentDigest | null;
  fingerprint: AutoMovieContentDigest | null;
  generation: string | null;
  kind: string;
  observation: IRenderGcObservationFixture | null;
  path: string;
}

/** A well-formed digest whose 64 hex characters repeat one fill. */
export const renderGcDigest = (fill: string): AutoMovieContentDigest =>
  `sha256:${fill.repeat(64).slice(0, 64)}`;

/** The 64-character hex body of {@link renderGcDigest}. */
export const renderGcHex = (fill: string): string =>
  fill.repeat(64).slice(0, 64);

/** One captured target under `base`, exact and reproducible. */
export const renderGcSnapshot = (
  base: string,
  target: string,
  overrides: Partial<IRenderGcSnapshotFixture> = {},
): IRenderGcSnapshotFixture => ({
  base: { identity: `dev\0${base}`, path: base, real: base, version: "1" },
  bytes: 1,
  contentFingerprint: renderGcDigest("c"),
  entries: [],
  fileDigest: null,
  kind: "file",
  namespaceFingerprint: renderGcDigest("e"),
  target,
  targetIdentity: `identity:${path.basename(target)}`,
  targetVersion: "1",
  ...overrides,
});

/** One directory entry of the given physical kind. */
export const renderGcDirent = (
  name: string,
  kind: "directory" | "file" | "other" | "symlink",
): IRenderGcDirentFixture => ({
  name,
  isDirectory: () => kind === "directory",
  isFile: () => kind === "file",
  isSymbolicLink: () => kind === "symlink",
});

/**
 * A `readdirSync` that answers only the directories it was given.
 *
 * A listing value of `null` stands for a directory that refuses to list, and
 * an unknown directory is an ENOENT-style refusal, so a scan that reaches a
 * path the fixture did not anticipate fails the case instead of reading an
 * empty directory.
 */
export const renderGcReaddir =
  (listings: Record<string, readonly IRenderGcDirentFixture[] | null>) =>
  (directory: string, options?: { withFileTypes?: boolean }) => {
    const listed = listings[directory];
    if (listed === undefined)
      throw new Error(`fixture has no directory "${directory}"`);
    if (listed === null) throw new Error(`fixture refuses "${directory}"`);
    return options?.withFileTypes === true
      ? [...listed]
      : listed.map((entry) => entry.name);
  };
