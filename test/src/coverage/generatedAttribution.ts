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
    if (cache !== undefined && Object.hasOwn(cache, url)) {
      cache[replacement] = cache[url];
      delete cache[url];
    }
    entry.url = replacement;
    attributed++;
  }
  return { attributed, refused };
};

/** Read one record back, so a caller never has to know the encoding. */
export const recordUrlToPath = (url: string): string => fileURLToPath(url);

export interface IAttributionPass {
  /** Generated URLs credited to a repository source, across every record. */
  attributed: number;
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
  isRepository: (url: string) => boolean;
  list?: (directory: string) => string[];
  read?: (file: string) => string;
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
  let records = 0;
  let entries: string[];
  try {
    entries = list(props.directory);
  } catch {
    return { attributed, records, refused: [] };
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
    if (outcome.attributed === 0) continue;
    attributed += outcome.attributed;
    records++;
    write(file, JSON.stringify(record));
  }
  return {
    attributed,
    records,
    refused: [...refused].sort((left, right) => left.localeCompare(right)),
  };
};
