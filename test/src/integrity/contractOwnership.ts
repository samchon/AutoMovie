import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const LAYERS = ["requirements", "specifications"] as const;
export type ContractLayer = (typeof LAYERS)[number];

interface IContractDocument {
  file: string;
  relative: string;
  text: string;
}

export interface IContractUnit {
  digest: string;
  file: string;
  section: string;
  target: string;
}

interface IContractOwner {
  kind: string;
  package?: string;
  reason?: string;
  supplies?: string[];
}

interface IContractDeclaration {
  obligations?: Record<string, { owner?: IContractOwner }>;
  owner?: IContractOwner;
  structural?: { reason?: unknown };
}

interface IContractLedger {
  declarations: Record<string, IContractDeclaration>;
  layer: unknown;
  legacy: Record<string, unknown>;
  version: unknown;
}

export interface IContractOwnershipInspection {
  declarations: Record<ContractLayer, number>;
  legacy: Record<ContractLayer, number>;
  stale: Record<ContractLayer, number>;
}

export interface IContractOwnershipQuery {
  status: string;
  target: string;
}

export interface IContractOwnershipWriter {
  write(message: string): unknown;
}

type ContractUnits = Map<string, IContractUnit>;
type Diagnostics = string[];
type PackageDirectories = Map<string, string>;
type JSDocCache = Map<string, string[]>;
/**
 * A workspace package name.
 *
 * Every library is scoped. The command-line entry point is not: it is published
 * as `automovie` so that the tool a user installs is named after the product
 * rather than after a folder inside it.
 */
const PACKAGE_NAME = /^(?:automovie|@automovie\/[a-z0-9-]+)$/;
const PART_TARGET =
  /^(specifications\/[a-z0-9./-]+\.md#[a-z0-9-]+)::([a-z0-9-]+)$/;
const UNIT_TARGET =
  /^(requirements|specifications)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.md#[a-z0-9-]+$/;

/** A deterministic failure from the contract-ownership gate. */
export class ContractOwnershipError extends Error {
  public readonly diagnostics: readonly string[];

  public constructor(diagnostics: readonly string[]) {
    super(diagnostics.join("\n"));
    this.name = "ContractOwnershipError";
    this.diagnostics = diagnostics;
  }
}

/**
 * Collect every explicitly anchored H2/H3 contract unit in one document layer.
 *
 * A unit digest covers its heading and own prose up to the next explicit H2/H3,
 * with line endings normalized to LF. A child is a separately owned unit, so a
 * child edit must not manufacture a migration obligation for its parent too.
 */
export const collectContractUnits = (
  root: string,
  layer: ContractLayer,
): ContractUnits => {
  assertLayer(layer);
  const layerRoot = path.join(root, "docs", layer);
  const files = walkFiles(layerRoot, (file) => file.endsWith(".md"));
  return collectUnitsFromDocuments(
    files.map((file) => ({
      file,
      relative: slash(path.relative(path.join(root, "docs"), file)),
      text: fs.readFileSync(file, "utf8"),
    })),
  );
};

const collectUnitsFromDocuments = (
  documents: readonly IContractDocument[],
): ContractUnits => {
  const units: ContractUnits = new Map();
  for (const document of documents) {
    const lines = document.text.replaceAll("\r\n", "\n").split("\n");
    const headings: Array<{ anchor: string; index: number; level: number }> =
      [];
    for (let index = 0; index < lines.length; index++) {
      const match = /^(#{2,3})\s+.+?\s+\{#([a-z0-9][a-z0-9-]*)\}\s*$/.exec(
        lines[index],
      );
      if (match !== null)
        headings.push({ anchor: match[2], index, level: match[1].length });
    }
    for (const [headingIndex, heading] of headings.entries()) {
      const next = headings[headingIndex + 1];
      const section = lines
        .slice(heading.index, next?.index ?? lines.length)
        .join("\n");
      const target = `${document.relative}#${heading.anchor}`;
      if (units.has(target)) {
        throw new ContractOwnershipError([
          `duplicate contract unit '${target}'`,
        ]);
      }
      units.set(target, {
        digest: digestContractUnit(section),
        file: document.file,
        section,
        target,
      });
    }
  }
  return units;
};

/** Hash one normalized contract section for the touch-to-migrate ledger. */
export const digestContractUnit = (section: string): string =>
  `sha256:${createHash("sha256").update(section.replaceAll("\r\n", "\n")).digest("hex")}`;

/**
 * Initialize one layer's migration ledger without permitting later rebasing.
 *
 * The snapshot is the tree as it stands, and the commit that adds the ledger is
 * its own provenance. Initialization runs once per layer: the command refuses an
 * existing ledger so nobody can launder accrued debt by taking a new snapshot.
 */
export const initializeContractOwnership = (
  root: string,
  layer: ContractLayer,
): { layer: ContractLayer; legacy: number; location: string } => {
  assertLayer(layer);
  const location = ledgerPath(root, layer);
  if (fs.existsSync(location)) {
    throw new ContractOwnershipError([
      `refusing to replace existing ownership ledger '${slash(path.relative(root, location))}'`,
    ]);
  }
  const units = collectContractUnits(root, layer);
  const ledger = {
    version: 1,
    layer,
    declarations: {},
    legacy: Object.fromEntries(
      [...units]
        .sort(([left], [right]) => compare(left, right))
        .map(([target, unit]) => [target, unit.digest]),
    ),
  };
  fs.mkdirSync(path.dirname(location), { recursive: true });
  fs.writeFileSync(location, `${JSON.stringify(ledger, null, 2)}\n`, "utf8");
  return { layer, legacy: units.size, location };
};

/**
 * Inspect both ledgers and fail on unowned, stale, circular, or false ownership.
 */
export const inspectContractOwnership = (
  root: string,
): IContractOwnershipInspection => {
  const diagnostics: Diagnostics = [];
  const ledgers = new Map<ContractLayer, IContractLedger>();
  const unitsByLayer = new Map<ContractLayer, ContractUnits>();
  for (const layer of LAYERS) {
    const units = capture(diagnostics, () => collectContractUnits(root, layer));
    if (units !== undefined) unitsByLayer.set(layer, units);
    const ledger = capture(diagnostics, () => loadLedger(root, layer));
    if (ledger !== undefined) ledgers.set(layer, ledger);
  }
  if (diagnostics.length !== 0) throw new ContractOwnershipError(diagnostics);

  const packages = workspacePackages(root, diagnostics);
  const cache: JSDocCache = new Map();
  for (const layer of LAYERS) {
    validateLayer(
      root,
      layer,
      unitsByLayer.get(layer)!,
      ledgers.get(layer)!,
      packages,
      diagnostics,
      cache,
    );
  }
  validateSupplies(unitsByLayer, ledgers, packages, diagnostics);
  if (diagnostics.length !== 0) throw new ContractOwnershipError(diagnostics);
  return {
    declarations: Object.fromEntries(
      LAYERS.map((layer) => [
        layer,
        Object.keys(ledgers.get(layer)!.declarations).length,
      ]),
    ),
    legacy: Object.fromEntries(
      LAYERS.map((layer) => [
        layer,
        Object.keys(ledgers.get(layer)!.legacy).length,
      ]),
    ),
    stale: Object.fromEntries(
      LAYERS.map((layer) => [
        layer,
        countStaleLegacy(unitsByLayer.get(layer)!, ledgers.get(layer)!),
      ]),
    ),
  } as IContractOwnershipInspection;
};

/**
 * Count the recorded debts whose prose moved since the ledger snapshot.
 *
 * Drift is reported rather than refused. A legacy unit is exactly the unit
 * nobody has been able to assign yet, so failing an unrelated prose edit until
 * someone names an owner buys a declaration written to clear a diagnostic, and
 * a manufactured owner is worse than a counted debt. What the gate does refuse
 * is a unit that is new or gone, because those are decisions somebody made.
 */
const countStaleLegacy = (
  units: ContractUnits,
  ledger: IContractLedger,
): number =>
  Object.entries(ledger.legacy).filter(
    ([target, digest]) =>
      units.has(target) && units.get(target)!.digest !== digest,
  ).length;

/**
 * Return the declared or migration status of every unit in one layer.
 *
 * A legacy unit whose prose has moved reports `stale` rather than `legacy`, so
 * the drift `check` counts can also be named. The count on its own says how much
 * debt this change disturbed and not which debt, and the rule that reads it
 * ("read that count when you touch a legacy unit and decide whether this is the
 * change that should declare its owners") cannot be followed without the
 * identities. Finding two moved units among fifty-one otherwise costs a
 * throwaway script that re-derives every digest at the merge base.
 *
 * `--owner legacy` still selects the whole recorded debt, drifted or not,
 * because a stale unit has not stopped being legacy; `--owner stale` narrows it
 * to the units this working tree moved.
 */
export const queryContractOwnership = (
  root: string,
  layer: ContractLayer,
  owner?: string,
): IContractOwnershipQuery[] => {
  assertLayer(layer);
  inspectContractOwnership(root);
  const ledger = loadLedger(root, layer);
  const units = collectContractUnits(root, layer);
  const results: IContractOwnershipQuery[] = [];
  for (const [target, digest] of Object.entries(ledger.legacy)) {
    // `inspectContractOwnership` above already refused a ledger entry naming a
    // unit the documents do not have, so every recorded target resolves here.
    const status = units.get(target)!.digest === digest ? "legacy" : "stale";
    if (owner === undefined || owner === "legacy" || owner === status) {
      results.push({ target, status });
    }
  }
  for (const [target, declaration] of Object.entries(ledger.declarations)) {
    if (layer === "requirements") {
      if (
        declaration.owner !== undefined &&
        ownerMatches(declaration.owner, owner)
      ) {
        results.push({ target, status: ownerIdentity(declaration.owner) });
      }
      continue;
    }
    if (Object.hasOwn(declaration, "structural")) {
      if (owner === undefined || owner === "structural") {
        results.push({ target, status: "structural" });
      }
      continue;
    }
    for (const [obligation, record] of Object.entries(
      declaration.obligations ?? {},
    )) {
      if (record.owner !== undefined && ownerMatches(record.owner, owner)) {
        results.push({
          target: `${target}::${obligation}`,
          status: ownerIdentity(record.owner),
        });
      }
    }
  }
  return results.sort((left, right) => compare(left.target, right.target));
};

const validateLayer = (
  root: string,
  layer: ContractLayer,
  units: ContractUnits,
  ledger: IContractLedger,
  packages: PackageDirectories,
  diagnostics: Diagnostics,
  cache: JSDocCache,
): void => {
  exactKeys(
    ledger,
    ["declarations", "layer", "legacy", "version"],
    `${layer} ledger`,
    diagnostics,
  );
  if (ledger.version !== 1)
    diagnostics.push(`${layer} ledger version must be 1`);
  if (ledger.layer !== layer)
    diagnostics.push(`${layer} ledger declares layer '${ledger.layer}'`);
  if (!plainObject(ledger.declarations))
    diagnostics.push(`${layer} declarations must be an object`);
  if (!plainObject(ledger.legacy))
    diagnostics.push(`${layer} legacy must be an object`);
  if (!plainObject(ledger.declarations) || !plainObject(ledger.legacy)) return;

  assertSortedKeys(ledger.declarations, `${layer} declarations`, diagnostics);
  assertSortedKeys(ledger.legacy, `${layer} legacy`, diagnostics);
  for (const target of units.keys()) {
    const declared = Object.hasOwn(ledger.declarations, target);
    const legacy = Object.hasOwn(ledger.legacy, target);
    if (declared === legacy) {
      diagnostics.push(
        `${target} must appear in exactly one of declarations or legacy`,
      );
    }
  }
  for (const target of [
    ...Object.keys(ledger.declarations),
    ...Object.keys(ledger.legacy),
  ]) {
    if (!units.has(target))
      diagnostics.push(`${layer} ledger names missing unit '${target}'`);
    if (!target.startsWith(`${layer}/`) || !UNIT_TARGET.test(target)) {
      diagnostics.push(`${layer} ledger has invalid target '${target}'`);
    }
  }
  for (const digest of Object.values(ledger.legacy)) {
    if (typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
      diagnostics.push(`${layer} legacy has an invalid snapshot digest`);
    }
  }
  for (const [target, declaration] of Object.entries(ledger.declarations)) {
    if (!plainObject(declaration)) {
      diagnostics.push(`${target} declaration must be an object`);
      continue;
    }
    if (layer === "requirements") {
      exactKeys(declaration, ["owner"], target, diagnostics);
      validateOwner(declaration.owner, target, packages, diagnostics);
      const owner = declaration.owner as IContractOwner | undefined;
      if (owner?.kind === "package" && typeof owner.package === "string") {
        requirePackageEvidence(cache, root, owner.package, target, diagnostics);
      }
    } else {
      if (Object.hasOwn(declaration, "structural")) {
        exactKeys(declaration, ["structural"], target, diagnostics);
        validateStructural(declaration.structural, target, diagnostics);
        continue;
      }
      exactKeys(declaration, ["obligations"], target, diagnostics);
      if (
        !plainObject(declaration.obligations) ||
        Object.keys(declaration.obligations).length === 0
      ) {
        diagnostics.push(`${target} must declare at least one obligation`);
        continue;
      }
      assertSortedKeys(
        declaration.obligations,
        `${target} obligations`,
        diagnostics,
      );
      for (const [id, record] of Object.entries(declaration.obligations)) {
        const part = `${target}::${id}`;
        if (!/^[a-z0-9][a-z0-9-]*$/.test(id))
          diagnostics.push(`${part} has invalid obligation id`);
        if (!plainObject(record)) {
          diagnostics.push(`${part} declaration must be an object`);
          continue;
        }
        exactKeys(record, ["owner"], part, diagnostics);
        validateOwner(record.owner, part, packages, diagnostics);
        const owner = record.owner as IContractOwner | undefined;
        if (owner?.kind === "package" && typeof owner.package === "string") {
          requirePackagePartEvidence(
            cache,
            root,
            owner.package,
            target,
            id,
            diagnostics,
          );
        }
      }
    }
  }
};

/**
 * Validate a specification heading that only groups independently payable
 * descendants.
 *
 * Structural is a unit classification, not an owner kind or an obligation. It
 * keeps the heading in the exhaustive unit ledger without manufacturing a
 * source payment or misreporting decided document structure as legacy debt.
 */
const validateStructural = (
  structural: unknown,
  target: string,
  diagnostics: Diagnostics,
): void => {
  if (!plainObject(structural)) {
    diagnostics.push(`${target} structural classification must be an object`);
    return;
  }
  exactKeys(structural, ["reason"], `${target} structural`, diagnostics);
  if (
    typeof structural.reason !== "string" ||
    structural.reason.trim().length === 0
  ) {
    diagnostics.push(`${target} structural classification must state a reason`);
  }
};

const validateSupplies = (
  unitsByLayer: ReadonlyMap<ContractLayer, ContractUnits>,
  ledgers: ReadonlyMap<ContractLayer, IContractLedger>,
  packages: PackageDirectories,
  diagnostics: Diagnostics,
): void => {
  const specifications = ledgers.get("specifications")!.declarations;
  const requirements = ledgers.get("requirements")!.declarations;
  const obligations = new Map<string, IContractOwner | undefined>();
  for (const [target, declaration] of Object.entries(specifications)) {
    for (const [id, record] of Object.entries(declaration.obligations ?? {})) {
      obligations.set(`${target}::${id}`, record.owner);
    }
  }

  const reachesPackage = (
    part: string,
    pathStack: readonly string[],
  ): boolean => {
    if (pathStack.includes(part)) {
      diagnostics.push(
        `project-source supply cycle: ${[...pathStack, part].join(" -> ")}`,
      );
      return false;
    }
    const owner = obligations.get(part);
    if (owner === undefined) {
      diagnostics.push(
        `project-source supply '${part}' does not name a declared obligation`,
      );
      return false;
    }
    if (owner.kind === "package")
      return typeof owner.package === "string" && packages.has(owner.package);
    if (owner.kind === "excluded") {
      diagnostics.push(
        `project-source supply '${part}' terminates at an exclusion`,
      );
      return false;
    }
    return (owner.supplies ?? [])
      .map((next) => reachesPackage(next, [...pathStack, part]))
      .every(Boolean);
  };

  for (const [target, declaration] of Object.entries(requirements)) {
    const owner = declaration.owner;
    if (owner?.kind !== "project-source") continue;
    for (const supply of owner.supplies ?? []) {
      const match = PART_TARGET.exec(supply);
      if (match !== null) {
        const specification = unitsByLayer.get("specifications")!.get(match[1]);
        if (
          specification !== undefined &&
          !hasEvidenceTarget(specification.section, target)
        ) {
          diagnostics.push(
            `${supply} does not refine project-source requirement '${target}' with positive @evidence`,
          );
        }
      }
      reachesPackage(supply, [`requirement:${target}`]);
    }
  }
  for (const [part, owner] of obligations) {
    if (owner?.kind === "project-source") reachesPackage(part, []);
  }
};

const validateOwner = (
  owner: unknown,
  target: string,
  packages: PackageDirectories,
  diagnostics: Diagnostics,
): void => {
  if (!plainObject(owner) || typeof owner.kind !== "string") {
    diagnostics.push(`${target} must declare one owner object`);
    return;
  }
  if (owner.kind === "package") {
    exactKeys(owner, ["kind", "package"], `${target} owner`, diagnostics);
    if (
      typeof owner.package !== "string" ||
      !PACKAGE_NAME.test(owner.package)
    ) {
      diagnostics.push(`${target} has invalid package owner`);
    } else if (!packages.has(owner.package)) {
      diagnostics.push(
        `${target} names unknown package owner '${owner.package}'`,
      );
    }
  } else if (owner.kind === "project-source") {
    exactKeys(owner, ["kind", "supplies"], `${target} owner`, diagnostics);
    if (!Array.isArray(owner.supplies) || owner.supplies.length === 0) {
      diagnostics.push(
        `${target} project-source owner must name product supplies`,
      );
    } else {
      const supplies = owner.supplies;
      if (
        !supplies.every(
          (value) => typeof value === "string" && PART_TARGET.test(value),
        )
      ) {
        diagnostics.push(`${target} has invalid project-source supply target`);
      }
      if (new Set(supplies).size !== supplies.length) {
        diagnostics.push(`${target} repeats a project-source supply`);
      }
      if (
        [...supplies]
          .sort(compare)
          .some((value, index) => value !== supplies[index])
      ) {
        diagnostics.push(`${target} project-source supplies must be sorted`);
      }
    }
  } else if (owner.kind === "excluded") {
    exactKeys(owner, ["kind", "reason"], `${target} owner`, diagnostics);
    if (typeof owner.reason !== "string" || owner.reason.trim().length === 0) {
      diagnostics.push(`${target} exclusion must state a reason`);
    }
  } else {
    diagnostics.push(`${target} has unknown owner kind '${owner.kind}'`);
  }
};

const requirePackageEvidence = (
  cache: JSDocCache,
  root: string,
  packageName: string,
  target: string,
  diagnostics: Diagnostics,
): void => {
  const blocks = packageJSDocBlocks(cache, root, packageName);
  if (!blocks.some((block) => hasEvidenceTarget(block, target))) {
    diagnostics.push(
      `${target} names ${packageName}, but that package has no positive @evidence carrier`,
    );
  }
};

const requirePackagePartEvidence = (
  cache: JSDocCache,
  root: string,
  packageName: string,
  target: string,
  obligation: string,
  diagnostics: Diagnostics,
): void => {
  const part = `${target}::${obligation}`;
  const blocks = packageJSDocBlocks(cache, root, packageName);
  if (
    !blocks.some(
      (block) =>
        hasEvidenceTarget(block, target) && hasEvidencePart(block, part),
    )
  ) {
    diagnostics.push(
      `${part} names ${packageName}, but no one JSDoc block carries both positive @evidence '${target}' and @evidencePart '${part}'`,
    );
  }
};

/**
 * Read one package's JSDoc blocks once per inspection.
 *
 * Thousands of declarations name a few packages, so re-walking a source tree per
 * declaration turns a linear check into a quadratic one. The cache lives for one
 * inspection and is discarded with it, so a later run still reads the tree.
 */
const packageJSDocBlocks = (
  cache: JSDocCache,
  root: string,
  packageName: string,
): string[] => {
  const cached = cache.get(packageName);
  if (cached !== undefined) return cached;
  const directory = workspacePackages(root, []).get(packageName);
  const blocks =
    directory === undefined
      ? []
      : walkFiles(path.join(directory, "src"), (file) =>
          file.endsWith(".ts"),
        ).flatMap(
          (file) =>
            fs.readFileSync(file, "utf8").match(/\/\*\*[\s\S]*?\*\//g) ?? [],
        );
  cache.set(packageName, blocks);
  return blocks;
};

const hasEvidenceTarget = (text: string, target: string): boolean =>
  new RegExp(`@evidence\\s+${escapeRegExp(target)}(?:\\s|$)`).test(text);

const hasEvidencePart = (text: string, part: string): boolean =>
  new RegExp(`@evidencePart\\s+${escapeRegExp(part)}(?:\\s|$)`).test(text);

const workspacePackages = (
  root: string,
  diagnostics: Diagnostics,
): PackageDirectories => {
  const result: PackageDirectories = new Map();
  const packagesRoot = path.join(root, "packages");
  for (const directory of childDirectories(packagesRoot)) {
    const manifest = path.join(directory, "package.json");
    if (!fs.existsSync(manifest)) continue;
    const value = capture(
      diagnostics,
      () => JSON.parse(fs.readFileSync(manifest, "utf8")) as unknown,
    );
    if (plainObject(value) && typeof value.name === "string")
      result.set(value.name, directory);
  }
  return result;
};

const loadLedger = (root: string, layer: ContractLayer): IContractLedger => {
  const location = ledgerPath(root, layer);
  if (!fs.existsSync(location)) {
    throw new ContractOwnershipError([
      `missing ownership ledger '${slash(path.relative(root, location))}'`,
    ]);
  }
  try {
    return JSON.parse(
      fs.readFileSync(location, "utf8").replace(/^\uFEFF/, ""),
    ) as IContractLedger;
  } catch (error) {
    throw new ContractOwnershipError([
      `cannot parse ownership ledger '${slash(path.relative(root, location))}': ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
};

const ledgerPath = (root: string, layer: ContractLayer): string =>
  path.join(root, "docs", "contract-ownership", `${layer}.json`);

const exactKeys = (
  value: unknown,
  keys: readonly string[],
  label: string,
  diagnostics: Diagnostics,
): void => {
  if (!plainObject(value)) return;
  const actual = Object.keys(value).sort(compare);
  const expected = [...keys].sort(compare);
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    diagnostics.push(`${label} keys must be exactly ${expected.join(", ")}`);
  }
};

const assertSortedKeys = (
  value: Record<string, unknown>,
  label: string,
  diagnostics: Diagnostics,
): void => {
  const actual = Object.keys(value);
  const sorted = [...actual].sort(compare);
  if (actual.some((key, index) => key !== sorted[index])) {
    diagnostics.push(`${label} keys must be sorted`);
  }
};

const ownerMatches = (owner: IContractOwner, query?: string): boolean =>
  query === undefined || query === ownerIdentity(owner);

const ownerIdentity = (owner: IContractOwner): string =>
  owner.kind === "package" ? (owner.package ?? "package") : owner.kind;

const childDirectories = (directory: string): string[] => {
  try {
    return fs
      .readdirSync(directory, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => path.join(directory, entry.name))
      .sort(compare);
  } catch {
    return [];
  }
};

const walkFiles = (
  directory: string,
  predicate: (file: string) => boolean,
): string[] => {
  const output: string[] = [];
  for (const child of childDirectories(directory))
    output.push(...walkFiles(child, predicate));
  try {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.isFile()) {
        const file = path.join(directory, entry.name);
        if (predicate(file)) output.push(file);
      }
    }
  } catch {
    return output;
  }
  return output.sort(compare);
};

const capture = <Value>(
  diagnostics: Diagnostics,
  operation: () => Value,
): Value | undefined => {
  try {
    return operation();
  } catch (error) {
    if (error instanceof ContractOwnershipError)
      diagnostics.push(...error.diagnostics);
    else
      diagnostics.push(error instanceof Error ? error.message : String(error));
    return undefined;
  }
};

const plainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const slash = (value: string): string => value.replaceAll("\\", "/");
const compare = (left: string, right: string): number =>
  left < right ? -1 : left > right ? 1 : 0;
const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertLayer: (layer: unknown) => asserts layer is ContractLayer = (
  layer,
) => {
  if (
    typeof layer !== "string" ||
    LAYERS.includes(layer as ContractLayer) === false
  ) {
    throw new ContractOwnershipError([
      `layer must be one of ${LAYERS.join(", ")}; received '${layer}'`,
    ]);
  }
};

const option = (args: readonly string[], name: string): string | undefined => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

/** Execute the ownership command through an injectable typed CLI boundary. */
export const runContractOwnership = (
  arguments_: readonly string[],
  cwd: string = process.cwd(),
  output: IContractOwnershipWriter = process.stdout,
  errorOutput: IContractOwnershipWriter = process.stderr,
): number => {
  try {
    const args = [...arguments_];
    const command =
      args[0] === undefined || args[0].startsWith("--")
        ? "check"
        : args.shift();
    const root = path.resolve(option(args, "--root") ?? cwd);
    if (command === "initialize") {
      const layer = option(args, "--layer");
      assertLayer(layer);
      output.write(
        `${JSON.stringify(initializeContractOwnership(root, layer))}\n`,
      );
    } else if (command === "check") {
      output.write(`${JSON.stringify(inspectContractOwnership(root))}\n`);
    } else if (command === "query") {
      const layer = option(args, "--layer");
      assertLayer(layer);
      output.write(
        `${JSON.stringify(queryContractOwnership(root, layer, option(args, "--owner")), null, 2)}\n`,
      );
    } else {
      throw new ContractOwnershipError([
        `unknown command '${command}'; use check, initialize, or query`,
      ]);
    }
    return 0;
  } catch (error) {
    errorOutput.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    return 1;
  }
};

if (path.resolve(process.argv[1] ?? "") === path.resolve(__filename))
  process.exitCode = runContractOwnership(process.argv.slice(2));
