import type {
  AutoMovieContentDigest,
  IAutoMovieProductionPublicationIdentity,
  IAutoMovieProductionRenderManifest,
} from "@automovie/interface";
import {
  type IAutoMovieProductionRenderJobPlan,
  type IAutoMovieProductionRenderTier,
  assertProductionRenderPublicationCurrent,
  canonicalAutoMovieJsonBytes,
  digestAutoMovieBytes,
  parseProductionRenderPublicationIdentity,
  probeProductionMedia,
  productionRenderLayersForPass,
  readAutoMovieProductionOwnedFile,
  verifyAutoMovieProductionSemanticMaskReceipt,
} from "@automovie/production";
import fs from "node:fs";
import path from "node:path";
import typia from "typia";

import type { IProxyBundleCapturedEvidence } from "./publishProxyBundle";
import {
  type IRenderGcTargetSnapshot,
  assertCapturedRenderGcFileEntry,
  assertCapturedRenderTarget,
  captureRenderGcTarget,
  readCapturedRenderGcFile,
} from "./renderGcSnapshot";

const PROXY_PUBLICATION_RECEIPT_MAX_BYTES = 8 * 1024 * 1024;

interface IPhysicalDirectory {
  device: string;
  inode: string;
  path: string;
  real: string;
  version: string;
}

interface IPhysicalFile {
  identity: string;
  path: string;
  relative: string;
}

interface IBundleDirectory {
  identity: IPhysicalDirectory;
  relative: string;
}

interface IPhysicalBundle {
  ancestry: IPhysicalDirectory[];
  directories: IBundleDirectory[];
  files: IPhysicalFile[];
}

export interface IVerifiedProxyPublication {
  compileFingerprint: AutoMovieContentDigest;
  editFingerprint: AutoMovieContentDigest;
  frameFormat: IAutoMovieProductionRenderJobPlan["frameFormat"];
  manifest: IAutoMovieProductionRenderManifest;
  publicationFingerprint: AutoMovieContentDigest;
  publicationIdentity: IAutoMovieProductionPublicationIdentity;
  sourceFrameFormat: IAutoMovieProductionRenderJobPlan["sourceFrameFormat"];
  tier: IAutoMovieProductionRenderTier;
  totalFrames: number;
  version: 1;
}

/** Refuse a proxy candidate semantically before any immutable path is created. */
export const assertProxyPublicationCandidate = (props: {
  bundle: string;
  expected: ReadonlyMap<string, Uint8Array>;
  plan: IAutoMovieProductionRenderJobPlan;
  receipt: Uint8Array;
}): IVerifiedProxyPublication => {
  const parsed = parseProxyPublication(props.receipt);
  assertProductionRenderPublicationCurrent({
    identity: parsed.publicationIdentity,
    plan: props.plan,
  });
  const facts = proxyManifestFiles(parsed, props.bundle);
  if (facts.size !== props.expected.size)
    throw new Error(
      "Proxy publication candidate does not match its manifest inventory.",
    );
  for (const [path, bytes] of props.expected) {
    if (path.startsWith(`${props.bundle}/`) === false)
      throw new Error(
        `Proxy publication candidate path "${path}" escapes "${props.bundle}".`,
      );
    const relative = path.slice(props.bundle.length + 1);
    const fact = facts.get(relative);
    if (
      fact === undefined ||
      fact.bytes !== bytes.byteLength ||
      fact.digest !== digestAutoMovieBytes(bytes)
    )
      throw new Error(
        `Proxy publication candidate file "${relative}" differs from its manifest.`,
      );
    assertProxySemanticFile(fact, bytes);
    if (
      fact.semanticMask !== undefined &&
      props.plan.chunks.some(
        (chunk) =>
          chunk.deliverable === fact.deliverable &&
          chunk.pass === "mask" &&
          chunk.frames.some(
            (frame) =>
              frame.globalFrame === fact.semanticMask!.frame &&
              productionRenderLayersForPass(frame, "mask").some(
                (layer) => layer.shot === fact.semanticMask!.shot,
              ),
          ),
      ) === false
    )
      throw new Error(
        `Proxy semantic sidecar "${relative}" is not owned by the current plan.`,
      );
  }
  return parsed;
};

/** Verify one immutable proxy publication against its exact expected files. */
export const assertPublishedProxyBundle = (
  target: string,
  expected: ReadonlyMap<string, Uint8Array>,
): void => {
  const linked = fs.lstatSync(target);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`Proxy bundle "${target}" is not a physical directory.`);
  const root = physicalDirectory(target, "proxy bundle");
  const bundle = physicalBundle(root, []);
  const actualByPath = new Map(
    bundle.files.map((file) => [file.relative, file]),
  );
  assertExpectedBundleInventory(bundle, expected.keys());
  for (const [relative, bytes] of expected) {
    const observed = actualByPath.get(relative)!;
    const resident = readBundleFile(bundle, observed);
    if (
      resident.length !== bytes.length ||
      digestAutoMovieBytes(resident) !== digestAutoMovieBytes(bytes)
    )
      throw new Error(
        `Proxy bundle file "${relative}" changed resident bytes.`,
      );
  }
  assertExactBundle(root, bundle);
};

/** Reopen one stored proxy publication through its self-described manifest. */
export const inspectPublishedProxyBundle = (
  renderRoot: string,
  target: string,
): IVerifiedProxyPublication => {
  const linked = fs.lstatSync(target);
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`Proxy bundle "${target}" is not a physical directory.`);
  const physical = physicalDescendant(renderRoot, target);
  const bundle = physicalBundle(physical.target, physical.ancestry);
  const receipt = bundle.files.find(
    (file) => file.relative === "publication.json",
  );
  if (receipt === undefined)
    throw new Error(
      `Proxy bundle "${target}" has no root publication receipt.`,
    );
  const parsed = parseProxyPublication(readBundleFile(bundle, receipt));
  const bundlePath = path
    .relative(physical.ownership.path, physical.target.path)
    .replaceAll("\\", "/");
  const expected = proxyManifestFiles(parsed, bundlePath);
  assertExpectedBundleInventory(bundle, [
    "publication.json",
    ...expected.keys(),
  ]);
  const actualByPath = new Map(
    bundle.files.map((file) => [file.relative, file]),
  );
  for (const [relative, fact] of expected) {
    const resident = readBundleFile(bundle, actualByPath.get(relative)!);
    if (
      resident.length !== fact.bytes ||
      digestAutoMovieBytes(resident) !== fact.digest
    )
      throw new Error(
        `Proxy bundle file "${relative}" differs from its publication manifest.`,
      );
    assertProxySemanticFile(fact, resident);
  }
  assertExactBundle(physical.target, bundle);
  return parsed;
};

/** Inspect only evidence bound to the proxy publication captured for GC. */
export const inspectCapturedProxyBundle = (
  snapshot: IRenderGcTargetSnapshot,
  evidence?: IProxyBundleCapturedEvidence,
): IVerifiedProxyPublication => {
  if (evidence !== undefined) assertProxyEvidence(snapshot, evidence);
  if (snapshot.kind !== "directory")
    throw new Error("Captured proxy publication is not a directory.");
  const receiptEntry = snapshot.entries.find(
    (entry) => entry.kind === "file" && entry.path === "publication.json",
  );
  if (receiptEntry === undefined)
    throw new Error("Captured proxy publication has no root receipt.");
  const parsed = parseProxyPublication(
    evidence !== undefined
      ? (() => {
          if (evidence.bytes === null)
            throw new Error(
              "Captured proxy publication has no bounded root receipt.",
            );
          return evidence.bytes;
        })()
      : (() => {
          const receiptSnapshot = captureRenderGcTarget(
            snapshot.base.path,
            path.join(snapshot.target, "publication.json"),
          );
          assertCapturedRenderGcFileEntry({
            directory: snapshot,
            file: receiptSnapshot,
            relative: "publication.json",
          });
          return readCapturedRenderGcFile(
            receiptSnapshot,
            PROXY_PUBLICATION_RECEIPT_MAX_BYTES,
          );
        })(),
  );
  const bundlePath = path
    .relative(snapshot.base.path, snapshot.target)
    .replaceAll("\\", "/");
  const expected = proxyManifestFiles(parsed, bundlePath);
  const expectedFiles = new Set(["publication.json", ...expected.keys()]);
  const expectedDirectories = new Set([""]);
  for (const relative of expectedFiles) {
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      expectedDirectories.add(segments.slice(0, length).join("/"));
  }
  const actual = new Map(snapshot.entries.map((entry) => [entry.path, entry]));
  if (
    snapshot.entries.length !== expectedFiles.size + expectedDirectories.size ||
    snapshot.entries.some((entry) =>
      entry.kind === "directory"
        ? expectedDirectories.has(entry.path) === false
        : expectedFiles.has(entry.path) === false,
    ) ||
    [...expected].some(([relative, fact]) => {
      const entry = actual.get(relative);
      return (
        entry?.kind !== "file" ||
        entry.bytes !== fact.bytes ||
        entry.digest !== fact.digest
      );
    })
  )
    throw new Error("Captured proxy publication has an invalid exact tree.");
  if (evidence === undefined) assertCapturedRenderTarget(snapshot);
  return parsed;
};

const assertProxyEvidence = (
  snapshot: IRenderGcTargetSnapshot,
  evidence: IProxyBundleCapturedEvidence,
): void => {
  if (
    evidence.baseIdentity !== snapshot.base.identity ||
    evidence.contentFingerprint !== snapshot.contentFingerprint ||
    evidence.namespaceFingerprint !== snapshot.namespaceFingerprint ||
    evidence.target !== snapshot.target ||
    evidence.targetIdentity !== snapshot.targetIdentity ||
    evidence.targetVersion !== snapshot.targetVersion
  )
    throw new Error("Proxy publication evidence belongs to another snapshot.");
};

const physicalDescendant = (
  renderRoot: string,
  target: string,
): {
  ancestry: IPhysicalDirectory[];
  ownership: IPhysicalDirectory;
  target: IPhysicalDirectory;
} => {
  const ownership = physicalDirectory(renderRoot, "proxy publication root");
  const absolute = path.resolve(target);
  const relative = path.relative(ownership.path, absolute);
  if (
    relative.length === 0 ||
    relative === ".." ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  )
    throw new Error(`Proxy bundle "${target}" escapes its publication root.`);
  const ancestry = [ownership];
  let cursor = ownership.path;
  const segments = relative.split(path.sep);
  for (let index = 0; index < segments.length; ++index) {
    cursor = path.join(cursor, segments[index]!);
    const current = physicalDirectory(cursor, "proxy bundle ancestry");
    if (inside(ownership.real, current.real) === false)
      throw new Error(
        `Proxy bundle ancestry "${cursor}" escapes its publication root.`,
      );
    if (index + 1 < segments.length) ancestry.push(current);
    else {
      for (const directory of ancestry)
        assertPhysicalDirectoryIdentity(directory, "proxy bundle ancestry");
      return { ancestry, ownership, target: current };
    }
  }
  throw new Error(`Proxy bundle "${target}" has no physical target.`);
};

const parseProxyPublication = (
  bytes: Uint8Array,
): IVerifiedProxyPublication => {
  const value = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
  if (isRecord(value) === false)
    throw new Error("Proxy publication receipt is not an object.");
  const receipt = value as Record<string, unknown>;
  const publicationIdentity = parseProductionRenderPublicationIdentity(
    receipt.publicationIdentity,
  );
  const manifestValidation =
    typia.validateEquals<IAutoMovieProductionRenderManifest>(receipt.manifest);
  if (
    Object.keys(receipt).sort(compare).join(",") !==
      "compileFingerprint,editFingerprint,frameFormat,manifest,publicationFingerprint,publicationIdentity,sourceFrameFormat,tier,totalFrames,version" ||
    receipt.version !== 1 ||
    validDigest(receipt.publicationFingerprint) === false ||
    validDigest(receipt.compileFingerprint) === false ||
    validDigest(receipt.editFingerprint) === false ||
    validRenderTier(receipt.tier) === false ||
    validFrameFormat(receipt.frameFormat) === false ||
    validFrameFormat(receipt.sourceFrameFormat) === false ||
    typeof receipt.totalFrames !== "number" ||
    Number.isSafeInteger(receipt.totalFrames) === false ||
    receipt.totalFrames <= 0 ||
    manifestValidation.success === false ||
    manifestValidation.data.compileFingerprint !== receipt.compileFingerprint ||
    receipt.publicationFingerprint !== publicationIdentity.fingerprint ||
    publicationIdentity.tier.kind !== "proxy" ||
    publicationIdentity.compileFingerprint !== receipt.compileFingerprint ||
    publicationIdentity.editFingerprint !== receipt.editFingerprint ||
    Buffer.from(
      canonicalAutoMovieJsonBytes(manifestValidation.data.publication),
    ).equals(Buffer.from(canonicalAutoMovieJsonBytes(publicationIdentity))) ===
      false ||
    Buffer.from(canonicalAutoMovieJsonBytes(receipt.tier)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(publicationIdentity.tier)),
    ) === false ||
    Buffer.from(canonicalAutoMovieJsonBytes(receipt.frameFormat)).equals(
      Buffer.from(canonicalAutoMovieJsonBytes(publicationIdentity.frameFormat)),
    ) === false ||
    Buffer.from(canonicalAutoMovieJsonBytes(receipt.sourceFrameFormat)).equals(
      Buffer.from(
        canonicalAutoMovieJsonBytes(publicationIdentity.sourceFrameFormat),
      ),
    ) === false ||
    receipt.totalFrames !== publicationIdentity.totalFrames
  )
    throw new Error("Proxy publication receipt has an invalid identity.");
  return {
    version: 1,
    compileFingerprint: publicationIdentity.compileFingerprint,
    editFingerprint: publicationIdentity.editFingerprint,
    frameFormat: structuredClone(publicationIdentity.frameFormat),
    manifest: manifestValidation.data,
    publicationFingerprint: publicationIdentity.fingerprint,
    publicationIdentity,
    sourceFrameFormat: structuredClone(publicationIdentity.sourceFrameFormat),
    tier: structuredClone(publicationIdentity.tier),
    totalFrames: publicationIdentity.totalFrames,
  };
};

const proxyManifestFiles = (
  receipt: IVerifiedProxyPublication,
  bundle: string,
): Map<string, IProxyManifestFile> => {
  const expectedBundle = `deliverables/proxy/${receipt.publicationFingerprint.slice(7)}`;
  if (bundle !== expectedBundle)
    throw new Error(
      `Proxy publication receipt belongs to "${expectedBundle}", not "${bundle}".`,
    );
  const files = new Map<string, IProxyManifestFile>();
  for (const deliverable of receipt.manifest.deliverables) {
    if (validRenderedDeliverable(deliverable) === false)
      throw new Error("Proxy publication manifest has an invalid deliverable.");
    for (const value of deliverable.files) {
      if (
        isRecord(value) === false ||
        typeof value.path !== "string" ||
        validDigest(value.digest) === false ||
        typeof value.bytes !== "number" ||
        Number.isSafeInteger(value.bytes) === false ||
        value.bytes <= 0 ||
        typeof value.mediaType !== "string" ||
        value.mediaType.length === 0 ||
        value.path.startsWith(`${bundle}/`) === false
      )
        throw new Error("Proxy publication manifest has an invalid file fact.");
      const relative = value.path.slice(bundle.length + 1);
      assertRelativeFile(relative);
      if (relative === "publication.json")
        throw new Error(
          "Proxy publication manifest cannot claim its own receipt.",
        );
      if (files.has(relative))
        throw new Error(
          `Proxy publication manifest repeats file "${relative}".`,
        );
      files.set(relative, {
        bytes: value.bytes,
        deliverable: deliverable.id,
        digest: value.digest as AutoMovieContentDigest,
        kind: deliverable.kind,
        mediaType: value.mediaType,
        path: value.path,
        semanticMask: value.semanticMask,
      });
    }
  }
  if (files.size === 0)
    throw new Error("Proxy publication manifest has no payload files.");
  return files;
};

interface IProxyManifestFile {
  bytes: number;
  deliverable: string;
  digest: AutoMovieContentDigest;
  kind: IAutoMovieProductionRenderManifest["deliverables"][number]["kind"];
  mediaType: string;
  path: string;
  semanticMask?: NonNullable<
    IAutoMovieProductionRenderManifest["deliverables"][number]["files"][number]["semanticMask"]
  >;
}

const assertProxySemanticFile = (
  fact: IProxyManifestFile,
  bytes: Uint8Array,
): void => {
  const probe = probeProductionMedia({
    kind: fact.kind,
    mediaType: fact.mediaType,
    bytes,
  });
  if (fact.semanticMask === undefined) {
    if (probe.kind === "semantic-mask")
      throw new Error(
        `Proxy semantic sidecar "${fact.path}" has no semantic receipt.`,
      );
    return;
  }
  const semantic = fact.semanticMask;
  if (
    fact.kind !== "guide-pass" ||
    probe.kind !== "semantic-mask" ||
    semantic.sidecar.path !== fact.path
  )
    throw new Error(
      `Proxy semantic sidecar "${fact.path}" has an invalid guide-pass owner.`,
    );
  verifyAutoMovieProductionSemanticMaskReceipt({
    receipt: semantic,
    expectedFrame: semantic.frame,
    expectedShot: semantic.shot,
    evidence: {
      version: 1,
      shot: semantic.shot,
      mask: probe.mask,
      coverage: semantic.coverage,
    },
    resident: { path: fact.path, bytes },
  });
};

const assertExpectedBundleInventory = (
  bundle: IPhysicalBundle,
  relatives: Iterable<string>,
): void => {
  const files = new Set<string>();
  const directories = new Set([""]);
  for (const relative of relatives) {
    assertRelativeFile(relative);
    files.add(relative);
    const segments = relative.split("/");
    for (let length = 1; length < segments.length; ++length)
      directories.add(segments.slice(0, length).join("/"));
  }
  if (
    bundle.files.length !== files.size ||
    bundle.files.some((file) => files.has(file.relative) === false) ||
    bundle.directories.length !== directories.size ||
    bundle.directories.some(
      (directory) => directories.has(directory.relative) === false,
    )
  )
    throw new Error("Proxy bundle has an unexpected exact inventory.");
};

const readBundleFile = (
  bundle: IPhysicalBundle,
  observed: IPhysicalFile,
): Buffer => {
  assertRelativeFile(observed.relative);
  const root = bundle.directories.find(
    (directory) => directory.relative === "",
  )!.identity;
  const file = path.join(root.real, ...observed.relative.split("/"));
  assertBundleIdentities(bundle);
  const resident = Buffer.from(
    readAutoMovieProductionOwnedFile({
      root: root.real,
      directory: path.dirname(file),
      relative: path.basename(file),
    }),
  );
  assertPhysicalFile(observed);
  assertBundleIdentities(bundle);
  return resident;
};

const assertRelativeFile = (relative: string): void => {
  const segments = relative.split("/");
  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        segment.length === 0 ||
        segment === "." ||
        segment === ".." ||
        segment.includes("\\") ||
        segment.includes("\0"),
    )
  )
    throw new Error(`Proxy bundle file "${relative}" is not relative.`);
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const validDigest = (value: unknown): value is AutoMovieContentDigest =>
  typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);

const validRenderTier = (
  value: unknown,
): value is IAutoMovieProductionRenderTier =>
  isRecord(value) &&
  value.kind === "proxy" &&
  typeof value.resolutionScale === "number" &&
  Number.isFinite(value.resolutionScale) &&
  value.resolutionScale > 0 &&
  value.resolutionScale <= 1 &&
  typeof value.frameStep === "number" &&
  Number.isSafeInteger(value.frameStep) &&
  value.frameStep > 0;

const validFrameFormat = (
  value: unknown,
): value is IAutoMovieProductionRenderJobPlan["frameFormat"] =>
  isRecord(value) &&
  typeof value.width === "number" &&
  Number.isSafeInteger(value.width) &&
  value.width > 0 &&
  typeof value.height === "number" &&
  Number.isSafeInteger(value.height) &&
  value.height > 0 &&
  typeof value.fps === "number" &&
  Number.isFinite(value.fps) &&
  value.fps > 0;

const validRenderedDeliverable = (
  value: unknown,
): value is IAutoMovieProductionRenderManifest["deliverables"][number] =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.id.trim().length > 0 &&
  (value.kind === "preview" ||
    value.kind === "feature" ||
    value.kind === "guide-pass" ||
    value.kind === "captions" ||
    value.kind === "audio-mix") &&
  Array.isArray(value.files) &&
  (value.runtimeSeconds === null ||
    (typeof value.runtimeSeconds === "number" &&
      Number.isFinite(value.runtimeSeconds) &&
      value.runtimeSeconds >= 0)) &&
  (value.frameCount === null ||
    (typeof value.frameCount === "number" &&
      Number.isSafeInteger(value.frameCount) &&
      value.frameCount >= 0)) &&
  (value.codec === null ||
    (typeof value.codec === "string" && value.codec.length > 0)) &&
  (value.rendition === undefined || validRendition(value.rendition));

const validRendition = (
  value: unknown,
): value is NonNullable<
  IAutoMovieProductionRenderManifest["deliverables"][number]["rendition"]
> =>
  isRecord(value) &&
  value.version === 2 &&
  value.kind === "visual-lanes" &&
  validDigest(value.memberSetDigest) &&
  (value.observationDigest === null || validDigest(value.observationDigest)) &&
  (value.observation === null || isRecord(value.observation)) &&
  Array.isArray(value.shots) &&
  value.shots.every(
    (shot) =>
      isRecord(shot) &&
      typeof shot.occurrence === "string" &&
      shot.occurrence.length > 0 &&
      typeof shot.shot === "string" &&
      shot.shot.length > 0 &&
      typeof shot.path === "string" &&
      shot.path.length > 0 &&
      validDigest(shot.digest) &&
      validDigest(shot.sourceDigest) &&
      (shot.lane === "deterministic"
        ? shot.receiptDigest === null && shot.selectionDigest === null
        : shot.lane === "repainted" &&
          validDigest(shot.receiptDigest) &&
          validDigest(shot.selectionDigest) &&
          typeof shot.selectionId === "string" &&
          shot.selectionId.length > 0 &&
          typeof shot.requestId === "string" &&
          shot.requestId.length > 0 &&
          typeof shot.attemptId === "string" &&
          shot.attemptId.length > 0),
  );

const physicalBundle = (
  root: IPhysicalDirectory,
  ancestry: IPhysicalDirectory[],
): IPhysicalBundle => {
  const directories: IBundleDirectory[] = [];
  const files: IPhysicalFile[] = [];
  const visit = (directory: string): void => {
    const identity = physicalDirectory(directory, "proxy bundle directory");
    if (inside(root.real, identity.real) === false)
      throw new Error(
        `Proxy bundle directory "${directory}" escapes its physical root.`,
      );
    directories.push({
      identity,
      relative: path.relative(root.real, identity.real).replaceAll("\\", "/"),
    });
    for (const name of fs
      .readdirSync(identity.real)
      .sort((left, right) => (left < right ? -1 : left > right ? 1 : 0))) {
      const file = path.join(identity.real, name);
      const status = fs.lstatSync(file, { bigint: true });
      if (status.isSymbolicLink())
        throw new Error(`Proxy bundle refuses linked entry "${file}".`);
      if (status.isDirectory()) visit(file);
      else if (status.isFile())
        files.push({
          identity: physicalVersion(status),
          path: file,
          relative: path.relative(root.real, file).replaceAll("\\", "/"),
        });
      else throw new Error(`Proxy bundle entry "${file}" is not physical.`);
    }
    assertPhysicalDirectory(identity, "proxy bundle directory");
  };
  visit(root.real);
  assertPhysicalDirectory(root, "proxy bundle");
  return { ancestry, directories, files };
};

const assertBundleIdentities = (bundle: IPhysicalBundle): void => {
  for (const directory of bundle.ancestry)
    assertPhysicalDirectory(directory, "proxy bundle ancestry");
  for (const directory of bundle.directories)
    assertPhysicalDirectory(directory.identity, "proxy bundle directory");
  for (const file of bundle.files) assertPhysicalFile(file);
};

const assertExactBundle = (
  root: IPhysicalDirectory,
  expected: IPhysicalBundle,
): void => {
  assertBundleIdentities(expected);
  const current = physicalBundle(root, expected.ancestry);
  if (bundleFingerprint(current) !== bundleFingerprint(expected))
    throw new Error(`Proxy bundle "${root.path}" changed exact inventory.`);
  assertBundleIdentities(expected);
};

const bundleFingerprint = (bundle: IPhysicalBundle): string =>
  JSON.stringify({
    directories: bundle.directories.map((directory) => ({
      identity: directory.identity.version,
      relative: directory.relative,
    })),
    files: bundle.files.map((file) => ({
      identity: file.identity,
      relative: file.relative,
    })),
  });

const assertPhysicalFile = (expected: IPhysicalFile): void => {
  const current = fs.lstatSync(expected.path, { bigint: true });
  if (
    current.isSymbolicLink() ||
    current.isFile() === false ||
    physicalVersion(current) !== expected.identity
  )
    throw new Error(
      `Proxy bundle file "${expected.relative}" changed physical identity.`,
    );
};

const physicalDirectory = (
  directory: string,
  label: string,
): IPhysicalDirectory => {
  const namespacePath = path.resolve(directory);
  const linked = fs.lstatSync(namespacePath, { bigint: true });
  if (linked.isSymbolicLink() || linked.isDirectory() === false)
    throw new Error(`${label} "${namespacePath}" is not physical.`);
  const real = fs.realpathSync(namespacePath);
  const status = fs.statSync(real, { bigint: true });
  const linkedVersion = physicalVersion(linked);
  const statusVersion = physicalVersion(status);
  if (
    status.isDirectory() === false ||
    status.dev !== linked.dev ||
    status.ino !== linked.ino ||
    statusVersion !== linkedVersion
  )
    throw new Error(`${label} "${namespacePath}" changed while resolved.`);
  return {
    device: status.dev.toString(),
    inode: status.ino.toString(),
    path: namespacePath,
    real,
    version: statusVersion,
  };
};

const assertPhysicalDirectory = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (
    current.device !== expected.device ||
    current.inode !== expected.inode ||
    current.real !== expected.real ||
    current.version !== expected.version
  )
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const assertPhysicalDirectoryIdentity = (
  expected: IPhysicalDirectory,
  label: string,
): void => {
  const current = physicalDirectory(expected.path, label);
  if (
    current.device !== expected.device ||
    current.inode !== expected.inode ||
    current.real !== expected.real
  )
    throw new Error(`${label} "${expected.path}" changed physical identity.`);
};

const physicalVersion = (status: fs.BigIntStats): string =>
  `${status.dev}\0${status.ino}\0${status.size}\0${status.mtimeNs}\0${status.ctimeNs}`;

const inside = (root: string, candidate: string): boolean => {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (path.isAbsolute(relative) === false &&
      relative !== ".." &&
      relative.startsWith(`..${path.sep}`) === false)
  );
};
