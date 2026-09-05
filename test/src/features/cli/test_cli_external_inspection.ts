import { TestValidator } from "@nestia/e2e";
import { createHash } from "node:crypto";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts, throwsError } from "../internal/predicates";

const unit = loadSourceModule<{
  resolveAutoMovieExternalProjectResourcePath: (props: {
    source: string;
    uri: string;
  }) => string;
  inspectAutoMovieExternalProjectBytes: (props: {
    source: string;
    bytes: Uint8Array;
    profile: "gltf-motion-v1";
    readResource: (relative: string) => Uint8Array | null;
  }) => {
    source: { path: string; bytes: number; digest: string };
    resources: Array<{
      path: string;
      bytes: number;
      digest: string;
      declaredUris: string[];
    }>;
    inspection: { motion?: { takes: unknown[] } };
  };
}>(
  path.resolve(__dirname, "../../../../packages/cli/src/externalInspection.ts"),
);

const digest = (bytes: Uint8Array): string =>
  `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const fixture = (revision: string) => {
  const payload = Buffer.from(
    new Float32Array([0, 1, 0, 0, 0, 1, 0, 0, 0, 1]).buffer,
  );
  const document = {
    asset: { version: "2.0", generator: `${revision}\n` },
    buffers: [
      { byteLength: payload.byteLength, uri: "motion.bin" },
      { byteLength: 1, uri: "z.bin" },
      { byteLength: 1, uri: "a.bin" },
      { byteLength: payload.byteLength, uri: "./motion.bin" },
      { byteLength: payload.byteLength, uri: "motion.bin" },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 8 },
      { buffer: 0, byteOffset: 8, byteLength: 32 },
    ],
    accessors: [
      { bufferView: 0, componentType: 5126, count: 2, type: "SCALAR" },
      { bufferView: 1, componentType: 5126, count: 2, type: "VEC4" },
    ],
    nodes: [{}],
    animations: [
      {
        name: "take",
        samplers: [{ input: 0, output: 1, interpolation: "LINEAR" }],
        channels: [{ sampler: 0, target: { node: 0, path: "rotation" } }],
      },
    ],
  };
  return { bytes: Buffer.from(JSON.stringify(document), "utf8"), payload };
};

/**
 * Validate the project-local external-inspection bridge without filesystem I/O.
 *
 * Scenarios:
 * 1. A canonical source and sidecar produce primary and closure digests beside
 *    the parser-observed motion facts.
 * 2. Changing only the source revision changes primary identity while the
 *    unchanged sidecar retains its identity.
 * 3. Scheme, query, fragment, backslash, encoded alias, malformed escape, and
 *    escaping URI forms fail before a resource reader runs.
 */
export const test_cli_external_inspection = (): void => {
  const first = fixture("first");
  const reads: string[] = [];
  const inspected = unit.inspectAutoMovieExternalProjectBytes({
    source: "public/motion/walk.gltf",
    bytes: first.bytes,
    profile: "gltf-motion-v1",
    readResource: (relative) => {
      reads.push(relative);
      return relative === "public/motion/motion.bin"
        ? first.payload
        : relative === "public/motion/a.bin" ||
            relative === "public/motion/z.bin"
          ? Buffer.from([1])
          : null;
    },
  });
  TestValidator.equals(
    "inspection publishes exact primary and resource closure identities",
    {
      source: inspected.source,
      resources: inspected.resources,
      reads,
      takes: inspected.inspection.motion?.takes.length,
    },
    {
      source: {
        path: "public/motion/walk.gltf",
        bytes: first.bytes.length,
        digest: digest(first.bytes),
      },
      resources: [
        {
          path: "public/motion/motion.bin",
          bytes: first.payload.length,
          digest: digest(first.payload),
          declaredUris: ["motion.bin", "./motion.bin"],
        },
        {
          path: "public/motion/z.bin",
          bytes: 1,
          digest: digest(Buffer.from([1])),
          declaredUris: ["z.bin"],
        },
        {
          path: "public/motion/a.bin",
          bytes: 1,
          digest: digest(Buffer.from([1])),
          declaredUris: ["a.bin"],
        },
      ],
      reads: [
        "public/motion/motion.bin",
        "public/motion/z.bin",
        "public/motion/a.bin",
      ],
      takes: 1,
    },
  );
  const second = fixture("second");
  const changed = unit.inspectAutoMovieExternalProjectBytes({
    source: "public/motion/walk.gltf",
    bytes: second.bytes,
    profile: "gltf-motion-v1",
    readResource: (relative) =>
      relative.endsWith("motion.bin") ? second.payload : Buffer.from([1]),
  });
  TestValidator.predicate(
    "source identity changes independently of an unchanged sidecar",
    changed.source.digest !== inspected.source.digest &&
      changed.resources[0]!.digest === inspected.resources[0]!.digest,
  );
  TestValidator.equals(
    "invalid source identity and missing closure fail before inspection",
    namedFacts([
      [
        "invalidSourceEnvelope",
        () =>
          throwsError(
            () =>
              unit.inspectAutoMovieExternalProjectBytes({
                source: "../walk.gltf",
                bytes: first.bytes,
                profile: "gltf-motion-v1",
                readResource: () => first.payload,
              }),
            "canonical project-relative",
          ),
      ],
      [
        "absoluteSourceEnvelope",
        () =>
          throwsError(
            () =>
              unit.inspectAutoMovieExternalProjectBytes({
                source: "/walk.gltf",
                bytes: first.bytes,
                profile: "gltf-motion-v1",
                readResource: () => first.payload,
              }),
            "canonical project-relative",
          ),
      ],
      [
        "missingSidecar",
        () =>
          throwsError(
            () =>
              unit.inspectAutoMovieExternalProjectBytes({
                source: "public/motion/walk.gltf",
                bytes: first.bytes,
                profile: "gltf-motion-v1",
                readResource: () => null,
              }),
            "no compiler-resolved resident bytes",
          ),
      ],
    ]),
    {
      absoluteSourceEnvelope: true,
      invalidSourceEnvelope: true,
      missingSidecar: true,
    },
  );
  const resolve = (uri: string): string =>
    unit.resolveAutoMovieExternalProjectResourcePath({
      source: "public/motion/walk.gltf",
      uri,
    });
  TestValidator.equals(
    "sidecar path admission refuses every noncanonical locator class",
    namedFacts([
      [
        "plainRelative",
        () =>
          resolve("buffers/motion.bin") === "public/motion/buffers/motion.bin",
      ],
      [
        "scheme",
        () =>
          throwsError(
            () => resolve("https://example.com/a.bin"),
            "plain project-relative",
          ),
      ],
      [
        "networkPath",
        () =>
          throwsError(
            () => resolve("//server/a.bin"),
            "plain project-relative",
          ),
      ],
      [
        "query",
        () => throwsError(() => resolve("a.bin?v=1"), "plain project-relative"),
      ],
      [
        "fragment",
        () =>
          throwsError(() => resolve("a.bin#part"), "plain project-relative"),
      ],
      [
        "backslash",
        () => throwsError(() => resolve("buffers\\a.bin"), "plain relative"),
      ],
      [
        "encodedBackslash",
        () => throwsError(() => resolve("buffers%5Ca.bin"), "plain relative"),
      ],
      [
        "encodedAbsolute",
        () => throwsError(() => resolve("%2Foutside.bin"), "plain relative"),
      ],
      [
        "encodedQuery",
        () => throwsError(() => resolve("a.bin%3Fv=1"), "plain relative"),
      ],
      [
        "encodedFragment",
        () => throwsError(() => resolve("a.bin%23part"), "plain relative"),
      ],
      [
        "encodedScheme",
        () => throwsError(() => resolve("http%3Aasset.bin"), "plain relative"),
      ],
      [
        "badEscape",
        () => throwsError(() => resolve("bad%2.bin"), "percent-encoding"),
      ],
      [
        "escape",
        () =>
          throwsError(
            () => resolve("../../../outside.bin"),
            "escapes or aliases",
          ),
      ],
      [
        "invalidSource",
        () =>
          throwsError(
            () =>
              unit.resolveAutoMovieExternalProjectResourcePath({
                source: "../walk.gltf",
                uri: "motion.bin",
              }),
            "canonical project-relative",
          ),
      ],
      [
        "driveSource",
        () =>
          throwsError(
            () =>
              unit.resolveAutoMovieExternalProjectResourcePath({
                source: "C:/walk.gltf",
                uri: "motion.bin",
              }),
            "canonical project-relative",
          ),
      ],
      [
        "backslashSource",
        () =>
          throwsError(
            () =>
              unit.resolveAutoMovieExternalProjectResourcePath({
                source: "public\\walk.gltf",
                uri: "motion.bin",
              }),
            "canonical project-relative",
          ),
      ],
      [
        "dotSource",
        () =>
          throwsError(
            () =>
              unit.resolveAutoMovieExternalProjectResourcePath({
                source: ".",
                uri: "motion.bin",
              }),
            "canonical project-relative",
          ),
      ],
      [
        "normalizedSource",
        () =>
          throwsError(
            () =>
              unit.resolveAutoMovieExternalProjectResourcePath({
                source: "public/./walk.gltf",
                uri: "motion.bin",
              }),
            "canonical project-relative",
          ),
      ],
    ]),
    {
      backslash: true,
      badEscape: true,
      backslashSource: true,
      encodedAbsolute: true,
      encodedBackslash: true,
      encodedFragment: true,
      encodedQuery: true,
      encodedScheme: true,
      escape: true,
      dotSource: true,
      driveSource: true,
      fragment: true,
      invalidSource: true,
      networkPath: true,
      normalizedSource: true,
      plainRelative: true,
      query: true,
      scheme: true,
    },
  );
};
