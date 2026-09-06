import type { AutoMovieContentDigest } from "@automovie/interface";
import { digestAutoMovieBytes } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";
import {
  type IRenderGcSnapshotFixture,
  renderGcDigest,
  renderGcHex,
  renderGcSnapshot,
} from "../internal/renderGcFixtures";

interface IReceipt {
  authority: string;
  basis: AutoMovieContentDigest;
  disposition: string;
  fingerprint: AutoMovieContentDigest | null;
  generation: string | null;
  kind: string;
  path: string;
  reason: string;
  stage: string;
  state: string;
  version: number;
}

interface IMarkerBase {
  contentFingerprint: AutoMovieContentDigest;
  kind: "directory" | "file";
  original: string;
  preserved: string;
  targetIdentity: string;
}

type IMarker = IMarkerBase &
  ({ version: 1 } | { adjudication: IReceipt; logical: string; version: 2 });

interface IEvidence {
  evidence: IRenderGcSnapshotFixture;
  marker: IMarker;
}

interface IQuarantineMarkerModule {
  createRenderQuarantineMarker: (
    props: IMarkerBase & { adjudication?: IReceipt },
  ) => IMarker;
  encodeRenderQuarantineMarker: (marker: IMarker) => Buffer;
  inventoryRenderQuarantineCandidates: (
    markers: readonly IRenderGcSnapshotFixture[],
    inspect: (marker: IRenderGcSnapshotFixture) => IEvidence,
  ) => ReadonlyArray<{
    adjudication: IReceipt | null;
    bytes: number;
    evidence: IRenderGcSnapshotFixture | null;
    fingerprint: AutoMovieContentDigest;
    marker: IRenderGcSnapshotFixture;
  }>;
  isRenderGcPreservedPath: (relative: string) => boolean;
  isRenderGcQuarantineMarkerPath: (relative: string) => boolean;
  parseRenderQuarantineMarker: (bytes: Uint8Array, label: string) => IMarker;
}

const unit = loadSourceModule<IQuarantineMarkerModule>(
  path.resolve(
    __dirname,
    "../../../../packages/template/scaffold/scripts/renderGcSnapshot.ts",
  ),
);

const base: IMarkerBase = {
  contentFingerprint: renderGcDigest("c"),
  kind: "file",
  original: `.automovie-chunk-${renderGcHex("5")}.proxy.${renderGcHex("a")}.publication.json`,
  preserved:
    ".gc-preserved-quarantine-evidence/00000000-0000-4000-8000-000000000000",
  targetIdentity: "dev\0inode",
};
const receipt: IReceipt = {
  authority: "exact-quarantine",
  basis: renderGcDigest("b"),
  disposition: "quarantine",
  fingerprint: base.contentFingerprint,
  generation: base.targetIdentity,
  kind: "chunk-pointer",
  path: `proxy/pointers/${renderGcHex("a")}`,
  reason:
    "the captured chunk pointer did not authenticate one complete receipt-bound tree",
  stage: "receipt",
  state: "integrity-failed",
  version: 1,
};
const canonical = (value: unknown): Buffer =>
  Buffer.from(`${JSON.stringify(value, null, 2)}\n`);
const parses = (value: unknown, fragment: string): boolean =>
  throwsError(
    () => unit.parseRenderQuarantineMarker(canonical(value), "marker"),
    fragment,
  );

/**
 * A quarantine marker is the public, canonical, self-describing record of one
 * private move: it is written in exactly one byte form, a version 2 marker
 * carries the GC receipt that ordered the move, and that receipt must name the
 * same target the marker preserves.
 *
 * Scenarios:
 *
 * 1. The two GC-owned directory rules: a preserved-prefix first segment and a
 *    top-level `quarantine` segment, on POSIX and Windows separators, and their
 *    negatives one segment deeper.
 * 2. A marker without a receipt is version 1, a marker with one is version 2
 *    carrying the receipt and its logical path, and both round-trip through
 *    encode and parse byte for byte.
 * 3. Parse refuses bytes that are not JSON, not an object, carry the wrong key
 *    set for their version, an unknown version, an invalid adjudication, an
 *    invalid kind, fingerprint, original, preserved, or target identity, and
 *    refuses a well-formed marker whose bytes are not canonical.
 * 4. A version 2 marker whose receipt names another logical path, another
 *    physical generation, or another content fingerprint does not bind.
 * 5. The candidate inventory reports a marker whose inspection fails without
 *    evidence, releases evidence two markers both claim, and binds unique
 *    evidence with the receipt it carried and one composite fingerprint over
 *    marker and evidence; bytes always sum marker plus bound evidence.
 */
export const test_cli_scaffold_render_gc_quarantine_marker = (): void => {
  TestValidator.equals(
    "GC-owned directories are recognized at the top of an ownership root only",
    {
      preserved: [
        ".gc-preserved-quarantine-evidence/x",
        ".gc-preserved-removal-staging\\y",
        "deliverables/.gc-preserved-removal-staging",
        "quarantine/x.json",
      ].map(unit.isRenderGcPreservedPath),
      markers: [
        "quarantine/x.json",
        "quarantine\\x.json",
        "quarantine",
        "deliverables/quarantine/x.json",
        "quarantined/x.json",
      ].map(unit.isRenderGcQuarantineMarkerPath),
    },
    {
      preserved: [true, true, false, false],
      markers: [true, true, true, false, false],
    },
  );

  const recovery = unit.createRenderQuarantineMarker(base);
  const adjudicated = unit.createRenderQuarantineMarker({
    ...base,
    adjudication: receipt,
  });
  TestValidator.equals(
    "markers carry their receipt exactly when GC ordered the move",
    {
      recovery,
      adjudicated,
      recoveryRoundTrip: unit.parseRenderQuarantineMarker(
        unit.encodeRenderQuarantineMarker(recovery),
        "marker",
      ),
      adjudicatedRoundTrip: unit.parseRenderQuarantineMarker(
        unit.encodeRenderQuarantineMarker(adjudicated),
        "marker",
      ),
      bytes: unit.encodeRenderQuarantineMarker(recovery).toString("utf8"),
    },
    {
      recovery: { version: 1, ...base },
      adjudicated: {
        version: 2,
        adjudication: receipt,
        logical: receipt.path,
        ...base,
      },
      recoveryRoundTrip: { version: 1, ...base },
      adjudicatedRoundTrip: {
        version: 2,
        adjudication: receipt,
        logical: receipt.path,
        ...base,
      },
      bytes: `${JSON.stringify({ version: 1, ...base }, null, 2)}\n`,
    },
  );

  const v2 = {
    version: 2,
    adjudication: receipt,
    logical: receipt.path,
    ...base,
  };
  TestValidator.equals(
    "every malformed marker is refused as invalid",
    {
      notJson: throwsError(
        () => unit.parseRenderQuarantineMarker(Buffer.from("{ nope"), "marker"),
        'Render quarantine marker "marker" is invalid.',
      ),
      notObject: parses([base], "is invalid"),
      extraKey: parses({ version: 1, ...base, logical: "x" }, "is invalid"),
      missingLogical: parses(
        { version: 2, adjudication: receipt, ...base },
        "is invalid",
      ),
      unknownVersion: parses({ version: 3, ...base }, "is invalid"),
      removeReceipt: parses(
        { ...v2, adjudication: { ...receipt, disposition: "remove" } },
        "is invalid",
      ),
      linkedKind: parses({ version: 1, ...base, kind: "link" }, "is invalid"),
      shortFingerprint: parses(
        { version: 1, ...base, contentFingerprint: "sha256:c" },
        "is invalid",
      ),
      absoluteOriginal: parses(
        { version: 1, ...base, original: "/pointer.json" },
        "is invalid",
      ),
      preservedOriginal: parses(
        { version: 1, ...base, original: ".gc-preserved-removal-staging/x" },
        "is invalid",
      ),
      unpreservedEvidence: parses(
        { version: 1, ...base, preserved: "evidence/x" },
        "is invalid",
      ),
      emptyIdentity: parses(
        { version: 1, ...base, targetIdentity: "" },
        "is invalid",
      ),
      notCanonical: throwsError(
        () =>
          unit.parseRenderQuarantineMarker(
            Buffer.from(JSON.stringify({ version: 1, ...base })),
            "marker",
          ),
        'Render quarantine marker "marker" is not canonical.',
      ),
    },
    {
      notJson: true,
      notObject: true,
      extraKey: true,
      missingLogical: true,
      unknownVersion: true,
      removeReceipt: true,
      linkedKind: true,
      shortFingerprint: true,
      absoluteOriginal: true,
      preservedOriginal: true,
      unpreservedEvidence: true,
      emptyIdentity: true,
      notCanonical: true,
    },
  );

  TestValidator.equals(
    "a receipt for another target is not evidence for this marker",
    {
      otherPath: parses(
        { ...v2, logical: "proxy/pointers/other" },
        "does not bind its adjudication receipt",
      ),
      otherGeneration: parses(
        { ...v2, targetIdentity: "dev\0other" },
        "does not bind its adjudication receipt",
      ),
      otherFingerprint: parses(
        { ...v2, contentFingerprint: renderGcDigest("d") },
        "does not bind its adjudication receipt",
      ),
    },
    { otherPath: true, otherGeneration: true, otherFingerprint: true },
  );

  const root = path.join("render-job");
  const marker = (name: string, bytes: number): IRenderGcSnapshotFixture =>
    renderGcSnapshot(root, path.join(root, "quarantine", name), {
      bytes,
      contentFingerprint: renderGcDigest(name.slice(0, 1)),
    });
  const evidence = (
    name: string,
    identity: string,
    bytes: number,
  ): IRenderGcSnapshotFixture =>
    renderGcSnapshot(
      root,
      path.join(root, ".gc-preserved-quarantine-evidence", name),
      {
        bytes,
        contentFingerprint: renderGcDigest(name.slice(0, 1)),
        targetIdentity: identity,
      },
    );
  const markers = [
    marker("1", 10),
    marker("2", 20),
    marker("3", 30),
    marker("4", 40),
  ];
  const bound = new Map<string, IEvidence>([
    [
      markers[1]!.target,
      { evidence: evidence("a", "shared", 100), marker: recovery },
    ],
    [
      markers[2]!.target,
      { evidence: evidence("b", "shared", 200), marker: recovery },
    ],
    [
      markers[3]!.target,
      { evidence: evidence("c", "unique", 300), marker: adjudicated },
    ],
  ]);
  TestValidator.equals(
    "evidence binds one marker and the receipt it carried",
    unit
      .inventoryRenderQuarantineCandidates(markers, (snapshot) => {
        const inspected = bound.get(snapshot.target);
        if (inspected === undefined)
          throw new Error(`marker "${snapshot.target}" is invalid`);
        return inspected;
      })
      .map((candidate) => ({
        marker: path.basename(candidate.marker.target),
        adjudication: candidate.adjudication,
        evidence:
          candidate.evidence === null
            ? null
            : path.basename(candidate.evidence.target),
        bytes: candidate.bytes,
        fingerprint: candidate.fingerprint,
      })),
    [
      {
        marker: "1",
        adjudication: null,
        evidence: null,
        bytes: 10,
        fingerprint: renderGcDigest("1"),
      },
      {
        marker: "2",
        adjudication: null,
        evidence: null,
        bytes: 20,
        fingerprint: renderGcDigest("2"),
      },
      {
        marker: "3",
        adjudication: null,
        evidence: null,
        bytes: 30,
        fingerprint: renderGcDigest("3"),
      },
      {
        marker: "4",
        adjudication: receipt,
        evidence: "c",
        bytes: 340,
        fingerprint: digestAutoMovieBytes(
          Buffer.from(`${renderGcDigest("4")}\0${renderGcDigest("c")}`),
        ),
      },
    ],
  );
};
