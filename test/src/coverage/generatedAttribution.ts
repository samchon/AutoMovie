import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

/**
 * Credit a generated project's execution to the repository source it copied.
 *
 * Twelve `packages/template/scaffold/scripts/*.ts` read zero percent while the
 * suite runs every one of them. The repository file is never the file that
 * executes: a fixture renders the scaffold into a temporary project and the
 * child runs that copy, so V8 records the copy's path and `isMeasuredScriptUrl`
 * drops it for sitting outside the repository. The temporary directory is gone
 * before c8 reports. Nothing about the reading is wrong; the address is.
 *
 * That was diagnosed wrongly once -- called "half a measurement defect" from a
 * first-uncovered-line of 1 -- and retracted when #2178 landed and the numbers
 * did not move. This time the records were read: a run's raw directory carries
 * `file:///.../automovie-sound-cache-life-drZ07V/generated/scripts/renderGcRuntime.ts`
 * and eleven siblings, so the coverage exists and only the attribution is lost.
 *
 * Crediting it is sound only if the bytes that ran are the repository's bytes,
 * and two facts make that checkable after the copy is gone.
 *
 * The first is measurable here and now: `renderScaffold` substitutes `{{name}}`
 * and `{{version:*}}` into every asset, and for all sixty `scripts/*.ts` its
 * output is byte-identical to the repository file. So the render is the
 * identity on this population, and `attributableScaffoldSources` re-checks that
 * per file on every run rather than trusting it -- the day one script starts
 * using a token, that script stops being creditable and the rest are unaffected.
 *
 * The second is a product invariant rather than a measurement. A generated
 * project fingerprints its own `scripts/` and refuses to run when they do not
 * match what it was compiled from; that refusal is what this repository met
 * when a driver was installed after a compile. A tampered copy therefore never
 * reaches execution, so a script that produced coverage at all produced it from
 * untampered bytes.
 */
export const digestText = (text: string): string =>
  crypto
    .createHash("sha256")
    .update(text.replaceAll("\r\n", "\n"))
    .digest("hex");

/** The scaffold-relative key a generated script URL would have come from. */
export const generatedScaffoldKey = (url: string): string | undefined => {
  const match = /\/(scripts\/[A-Za-z0-9._-]+\.[cm]?tsx?)$/u.exec(url);
  return match?.[1];
};

/**
 * Which scaffold scripts may be credited, and to which repository file.
 *
 * A key is admitted only when the rendered content and the repository file
 * agree byte for byte. Line endings are normalized because the render
 * normalizes them and a checkout does not; nothing else is forgiven.
 */
export const attributableScaffoldSources = (props: {
  read?: (file: string) => string;
  rendered: Readonly<Record<string, string>>;
  scaffoldRoot: string;
}): Map<string, string> => {
  const read = props.read ?? ((file: string) => fs.readFileSync(file, "utf8"));
  const admitted = new Map<string, string>();
  for (const [key, content] of Object.entries(props.rendered)) {
    if (key.startsWith("scripts/") === false) continue;
    const source = path.join(props.scaffoldRoot, key);
    let text;
    try {
      text = read(source);
    } catch {
      continue;
    }
    if (digestText(text) === digestText(content)) admitted.set(key, source);
  }
  return admitted;
};

/**
 * The `file://` form V8 writes, built rather than spelled.
 *
 * `pathToFileURL` and nothing hand-rolled: this repository has paid three times
 * for treating the scheme as string arithmetic, and `hostFileUrl.ts` refuses
 * both shapes in authored source for exactly that reason.
 */
export const pathToRecordUrl = (file: string): string =>
  pathToFileURL(file).href;

export interface IAttributionOutcome {
  /** Generated URLs credited to a repository source. */
  attributed: number;
  /** Generated URLs whose bytes no repository source vouches for. */
  refused: string[];
}

/**
 * Rewrite one raw V8 record's generated URLs to their repository sources.
 *
 * The record is edited in place and the `source-map-cache` key travels with the
 * URL it belongs to, because c8 looks the cache up by url and a rewritten url
 * with a stranded cache entry reads as a file with no map at all.
 */
/** One `source-map-cache` value, as V8 writes it. */
interface ISourceMapEntry {
  data?: { sources?: unknown[] };
  url?: unknown;
}

/**
 * Move a cache entry, and everything inside it that still names the copy.
 *
 * Rewriting only the record's `url` is not enough, and believing it was is what
 * made the first attempt report twelve credited entries while the scaffold
 * still read zero. c8 resolves a range through the source map, and the map
 * carries its own `url` and its own `sources`, so those decide the address the
 * report finally uses. The record's url decides which map is consulted; the
 * map decides where the coverage lands.
 */
const attributeSourceMap = (props: {
  cache: Record<string, unknown>;
  from: string;
  sources: ReadonlyMap<string, string>;
  to: string;
}): void => {
  if (Object.hasOwn(props.cache, props.from) === false) return;
  const entry = props.cache[props.from] as ISourceMapEntry | null;
  props.cache[props.to] = entry;
  delete props.cache[props.from];
  if (typeof entry !== "object" || entry === null) return;
  if (typeof entry.url === "string") entry.url = props.to;
  const listed = entry.data?.sources;
  if (Array.isArray(listed) === false) return;
  for (const [index, one] of listed.entries()) {
    if (typeof one !== "string") continue;
    const key = generatedScaffoldKey(one);
    const target = key === undefined ? undefined : props.sources.get(key);
    if (target !== undefined) listed[index] = pathToRecordUrl(target);
  }
};

export const attributeRecordUrls = (props: {
  isRepository: (url: string) => boolean;
  record: {
    result?: Array<{ url?: string }>;
    "source-map-cache"?: Record<string, unknown>;
  };
  sources: ReadonlyMap<string, string>;
}): IAttributionOutcome => {
  const refused: string[] = [];
  let attributed = 0;
  const cache = props.record["source-map-cache"];
  for (const entry of props.record.result ?? []) {
    const url = entry.url;
    if (typeof url !== "string" || props.isRepository(url)) continue;
    const key = generatedScaffoldKey(url);
    if (key === undefined) continue;
    const source = props.sources.get(key);
    if (source === undefined) {
      refused.push(url);
      continue;
    }
    const replacement = pathToRecordUrl(source);
    if (cache !== undefined)
      attributeSourceMap({
        cache,
        from: url,
        sources: props.sources,
        to: replacement,
      });
    entry.url = replacement;
    attributed++;
  }
  return { attributed, refused };
};

/** Read one record back, so a caller never has to know the encoding. */
export const recordUrlToPath = (url: string): string => fileURLToPath(url);

/**
 * The repository file a vanished fixture-linked workspace build came from.
 *
 * A generated project receives the repository's built packages by copy:
 * `linkWorkspacePackage` rebuilds a stale one, then `fs.cpSync(build, target)`.
 * The child then requires that copy, and V8 records it at the fixture's own
 * path. The fixture is deleted on the way out, so by the time the report runs
 * the file is gone -- which is what the run has been printing all along as
 * `219 of them gone from disk at report time`.
 *
 * c8 must read a script to place its ranges. A script it cannot read is not
 * merely unmapped: the whole reading is dropped, and its source map with it, so
 * nothing reaches the `src` the map names. That is why `--exclude-after-remap`
 * alone moved nothing when it was tried: the flag reorders filtering, and the
 * reading here dies of absence rather than of filtering.
 *
 * Re-addressing it to the repository's own copy of the same build is what makes
 * the file readable again. The bytes are the same bytes: the copy is taken from
 * `packages/<name>/lib` in the same run, and #2183's freshness gate refuses a
 * build older than the source it claims to be.
 */
export const linkedWorkspaceLibraryPath = (props: {
  root: string;
  url: string;
}): string | undefined => {
  const match = /\/node_modules\/@automovie\/([a-z0-9-]+)\/lib\/(.+)$/u.exec(
    props.url.replaceAll("\\", "/"),
  );
  if (match === null) return undefined;
  return path.join(props.root, "packages", match[1]!, "lib", match[2]!);
};

/**
 * Re-address every vanished linked build in one record to the repository's.
 *
 * Only a URL whose file is actually gone is moved. A linked build that still
 * exists is readable where it stands, and moving it would claim the two are the
 * same copy on no evidence beyond the path shape.
 */
export const attributeLinkedLibraries = (props: {
  exists?: (file: string) => boolean;
  record: { result?: Array<{ url?: string }> };
  root: string;
}): number => {
  const exists = props.exists ?? ((file: string) => fs.existsSync(file));
  let attributed = 0;
  for (const entry of props.record.result ?? []) {
    const url = entry.url;
    if (typeof url !== "string") continue;
    const target = linkedWorkspaceLibraryPath({ root: props.root, url });
    if (target === undefined) continue;
    let vanished;
    try {
      vanished = exists(fileURLToPath(url)) === false;
    } catch {
      continue;
    }
    if (vanished === false || exists(target) === false) continue;
    entry.url = pathToRecordUrl(target);
    attributed++;
  }
  return attributed;
};

export interface IAttributionPass {
  /** Generated URLs credited to a repository source, across every record. */
  attributed: number;
  /** Vanished linked workspace builds re-addressed to the repository's copy. */
  linked: number;
  /** Records whose bytes were rewritten. */
  records: number;
  /** Distinct generated URLs no repository source vouched for. */
  refused: string[];
}

/**
 * Re-address every raw record in one directory before it is reported.
 *
 * A pass rather than a filter at report time: c8 reads the file each URL names
 * to place its ranges, so the URL has to be the repository's before the report
 * runs, not after. Records that name nothing generated are left untouched and
 * not rewritten, because rewriting a file to its own bytes is a modification
 * time a later freshness check would read as a change.
 */
export const attributeGeneratedRecords = (props: {
  directory: string;
  exists?: (file: string) => boolean;
  isRepository: (url: string) => boolean;
  list?: (directory: string) => string[];
  read?: (file: string) => string;
  root?: string;
  sources: ReadonlyMap<string, string>;
  write?: (file: string, text: string) => void;
}): IAttributionPass => {
  const list = props.list ?? ((directory: string) => fs.readdirSync(directory));
  const read = props.read ?? ((file: string) => fs.readFileSync(file, "utf8"));
  const write =
    props.write ??
    ((file: string, text: string) => fs.writeFileSync(file, text, "utf8"));
  const refused = new Set<string>();
  let attributed = 0;
  let linked = 0;
  let records = 0;
  let entries: string[];
  try {
    entries = list(props.directory);
  } catch {
    return { attributed, linked, records, refused: [] };
  }
  for (const entry of entries) {
    if (entry.endsWith(".json") === false) continue;
    const file = path.join(props.directory, entry);
    let record;
    try {
      record = JSON.parse(read(file));
    } catch {
      continue;
    }
    const outcome = attributeRecordUrls({
      isRepository: props.isRepository,
      record,
      sources: props.sources,
    });
    for (const url of outcome.refused) refused.add(url);
    const moved =
      props.root === undefined
        ? 0
        : attributeLinkedLibraries({
            exists: props.exists,
            record,
            root: props.root,
          });
    linked += moved;
    if (outcome.attributed === 0 && moved === 0) continue;
    attributed += outcome.attributed;
    records++;
    write(file, JSON.stringify(record));
  }
  return {
    attributed,
    linked,
    records,
    refused: [...refused].sort((left, right) => left.localeCompare(right)),
  };
};
