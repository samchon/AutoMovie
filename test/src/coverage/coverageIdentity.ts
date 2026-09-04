import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SOURCE_EXTENSION = /\.(?:[cm]?ts|tsx)$/u;

export const UNMEASURED_SOURCE_ROOTS: readonly string[] = [
  "build/",
  "packages/cli/",
  "packages/evidence/",
  "packages/playground/",
  "packages/template/build/",
  "packages/template/scaffold/",
  "test/src/coverage/",
  "test/src/integrity/",
];

const DECLARATION_FILE =
  /(?:^|\/)(?:lint\.config|vite\.config)\.[cm]?ts$|EvidenceExclusions\.ts$/u;

export const UNJUDGED_DECLARATION_GLOBS: readonly string[] = [
  "**/lint.config.ts",
  "**/vite.config.ts",
  "**/*EvidenceExclusions.ts",
];

const slash = (value: string): string => value.replaceAll("\\", "/");
const byCodeUnit = (left: string, right: string): number =>
  Number(left > right) - Number(left < right);

/** Preserve case where the host filesystem does, fold only on Windows. */
export const canonicalCoveragePath = (
  value: string,
  platform: NodeJS.Platform = process.platform,
): string => {
  const canonical = slash(path.resolve(value));
  return platform === "win32" ? canonical.toLowerCase() : canonical;
};

/** The single authored-source policy shared by c8 and raw-record attribution. */
export const isAuthoredExecutableSource = (relative: string): boolean => {
  const target = slash(relative);
  if (UNMEASURED_SOURCE_ROOTS.some((root) => target.startsWith(root)))
    return false;
  if (DECLARATION_FILE.test(target)) return false;
  const typedRepositoryTool =
    target.startsWith("test/src/coverage/") ||
    target.startsWith("test/src/integrity/");
  return !(
    SOURCE_EXTENSION.test(target) === false ||
    /\.d\.[cm]?ts$/u.test(target) ||
    (typedRepositoryTool === false &&
      (/(^|\/)(?:test|tests|__tests__|fixtures)(\/|$)/u.test(target) ||
        /(^|\/)coverage(\/|$)/u.test(target))) ||
    /(^|\/)(?:node_modules|dist|generated|\.cache)(\/|$)/u.test(target) ||
    /(?:\.test|\.spec|\.generated)\.[cm]?[jt]sx?$/u.test(target) ||
    /(^|\/)(?:index|bin)\.ts$/u.test(target)
  );
};

export interface ICoveragePosition {
  column?: number;
  line?: number;
}

export interface ICoverageSpan {
  end?: ICoveragePosition;
  start?: ICoveragePosition;
}

const position = (value: ICoveragePosition | undefined): string | null =>
  typeof value?.line === "number" && typeof value.column === "number"
    ? `${value.line}:${value.column}`
    : null;

/** A span is usable as identity only when both line and column are complete. */
export const coverageSpanIdentity = (
  span: ICoverageSpan | undefined,
): string | null => {
  const start = position(span?.start);
  const end = position(span?.end);
  return start === null || end === null ? null : `${start}-${end}`;
};

export const statementIdentity = (
  span: ICoverageSpan | undefined,
): string | null => {
  const location = coverageSpanIdentity(span);
  return location === null ? null : `statement:${location}`;
};

export const functionIdentity = (definition: {
  decl?: ICoverageSpan;
  loc?: ICoverageSpan;
  name?: string;
}): string | null => {
  const declaration = coverageSpanIdentity(definition.decl);
  const location = coverageSpanIdentity(definition.loc);
  return typeof definition.name !== "string" ||
    declaration === null ||
    location === null
    ? null
    : `function:${definition.name}:${declaration}:${location}`;
};

export const branchIdentity = (props: {
  arm: number;
  definition: {
    loc?: ICoverageSpan;
    locations?: ICoverageSpan[];
    type?: string;
  };
}): string | null => {
  const parent = coverageSpanIdentity(props.definition.loc);
  const location = coverageSpanIdentity(
    props.definition.locations?.[props.arm],
  );
  return typeof props.definition.type !== "string" ||
    parent === null ||
    location === null
    ? null
    : `branch:${props.definition.type}:${parent}:${props.arm}:${location}`;
};

export interface IMeasuredSource {
  lines: number;
  sha256: string;
}

export const sourceDigest = (bytes: Uint8Array): string =>
  crypto.createHash("sha256").update(bytes).digest("hex");

export interface ICoverageSourceAttribution {
  identity: string | null;
  reason: "ambiguous" | "excluded" | "malformed" | "measured";
}

/** Attribute one raw URL to exactly one authored source, or fail closed. */
export const coverageSourceAttribution = (props: {
  attributed?: readonly string[];
  repository: string;
  url: string;
}): ICoverageSourceAttribution => {
  let direct: string | null = null;
  try {
    const target = fileURLToPath(new URL(props.url));
    const relative = slash(path.relative(props.repository, target));
    if (
      relative.length !== 0 &&
      path.isAbsolute(relative) === false &&
      relative.startsWith("../") === false &&
      isAuthoredExecutableSource(relative)
    )
      direct = canonicalCoveragePath(path.resolve(props.repository, relative));
  } catch {
    return { identity: null, reason: "malformed" };
  }
  const candidates = new Set<string>();
  if (direct !== null) candidates.add(direct);
  for (const source of props.attributed ?? []) {
    const relative = slash(path.relative(props.repository, source));
    if (
      relative.length !== 0 &&
      path.isAbsolute(relative) === false &&
      relative.startsWith("../") === false &&
      isAuthoredExecutableSource(relative)
    )
      candidates.add(
        canonicalCoveragePath(path.resolve(props.repository, relative)),
      );
  }
  if (candidates.size === 1)
    return { identity: [...candidates][0]!, reason: "measured" };
  return {
    identity: null,
    reason: candidates.size > 1 ? "ambiguous" : "excluded",
  };
};

export const sameMeasuredSources = (
  left: Readonly<Record<string, IMeasuredSource>>,
  right: Readonly<Record<string, IMeasuredSource>>,
): boolean => {
  const leftKeys = Object.keys(left).sort(byCodeUnit);
  const rightKeys = Object.keys(right).sort(byCodeUnit);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key, index) =>
        key === rightKeys[index] &&
        left[key]?.lines === right[key]?.lines &&
        left[key]?.sha256 === right[key]?.sha256,
    )
  );
};

export const readMeasuredSource = (file: string): IMeasuredSource => {
  const bytes = fs.readFileSync(file);
  const text = bytes.toString("utf8");
  return {
    lines:
      text === "" ? 0 : text.split("\n").length - Number(text.endsWith("\n")),
    sha256: sourceDigest(bytes),
  };
};
