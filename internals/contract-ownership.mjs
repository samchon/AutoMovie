import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const LAYERS = ["requirements", "specifications"];
const PACKAGE_NAME = /^@automovie\/[a-z0-9-]+$/;
const PART_TARGET =
  /^(specifications\/[a-z0-9./-]+\.md#[a-z0-9-]+)::([a-z0-9-]+)$/;
const UNIT_TARGET =
  /^(requirements|specifications)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.md#[a-z0-9-]+$/;

/** A deterministic failure from the contract-ownership gate. */
export class ContractOwnershipError extends Error {
  constructor(diagnostics) {
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
export const collectContractUnits = (root, layer) => {
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

const collectUnitsFromDocuments = (documents) => {
  const units = new Map();
  for (const document of documents) {
    const lines = document.text.replaceAll("\r\n", "\n").split("\n");
    const headings = [];
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
export const digestContractUnit = (section) =>
  `sha256:${createHash("sha256").update(section.replaceAll("\r\n", "\n")).digest("hex")}`;

/**
 * Initialize one layer's migration ledger without permitting later rebasing.
 *
 * The snapshot is the tree as it stands, and the commit that adds the ledger is
 * its own provenance. Initialization runs once per layer: the command refuses an
 * existing ledger so nobody can launder accrued debt by taking a new snapshot.
 */
export const initializeContractOwnership = (root, layer) => {
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
export const inspectContractOwnership = (root) => {
  const diagnostics = [];
  const ledgers = new Map();
  const unitsByLayer = new Map();
  for (const layer of LAYERS) {
    const units = capture(diagnostics, () => collectContractUnits(root, layer));
    if (units !== undefined) unitsByLayer.set(layer, units);
    const ledger = capture(diagnostics, () => loadLedger(root, layer));
    if (ledger !== undefined) ledgers.set(layer, ledger);
  }
  if (diagnostics.length !== 0) throw new ContractOwnershipError(diagnostics);

  const packages = workspacePackages(root, diagnostics);
  const cache = new Map();
  for (const layer of LAYERS) {
    validateLayer(
      root,
      layer,
      unitsByLayer.get(layer),
      ledgers.get(layer),
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
        Object.keys(ledgers.get(layer).declarations).length,
      ]),
    ),
    legacy: Object.fromEntries(
      LAYERS.map((layer) => [
        layer,
        Object.keys(ledgers.get(layer).legacy).length,
      ]),
    ),
  };
};

/** Return the declared or migration status of every unit in one layer. */
export const queryContractOwnership = (root, layer, owner) => {
  assertLayer(layer);
  inspectContractOwnership(root);
  const ledger = loadLedger(root, layer);
  const results = [];
  for (const target of Object.keys(ledger.legacy)) {
    if (owner === undefined || owner === "legacy") {
      results.push({ target, status: "legacy" });
    }
  }
  for (const [target, declaration] of Object.entries(ledger.declarations)) {
    if (layer === "requirements") {
      if (ownerMatches(declaration.owner, owner)) {
        results.push({ target, status: ownerIdentity(declaration.owner) });
      }
      continue;
    }
    for (const [obligation, record] of Object.entries(
      declaration.obligations,
    )) {
      if (ownerMatches(record.owner, owner)) {
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
  root,
  layer,
  units,
  ledger,
  packages,
  diagnostics,
  cache,
) => {
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
  for (const [target, digest] of Object.entries(ledger.legacy)) {
    if (typeof digest !== "string" || !/^sha256:[a-f0-9]{64}$/.test(digest)) {
      diagnostics.push(`${target} has invalid legacy digest`);
      continue;
    }
    const actual = units.get(target)?.digest;
    if (actual !== undefined && actual !== digest) {
      diagnostics.push(
        `${target} changed since its legacy snapshot; declare its owner instead of rebasing '${digest}' to '${actual}'`,
      );
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
      if (declaration.owner?.kind === "package") {
        requirePackageEvidence(
          cache,
          root,
          declaration.owner.package,
          target,
          diagnostics,
        );
      }
    } else {
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
        if (record.owner?.kind === "package") {
          requirePackagePartEvidence(
            cache,
            root,
            record.owner.package,
            target,
            id,
            diagnostics,
          );
        }
      }
    }
  }
};

const validateSupplies = (unitsByLayer, ledgers, packages, diagnostics) => {
  const specifications = ledgers.get("specifications").declarations;
  const requirements = ledgers.get("requirements").declarations;
  const obligations = new Map();
  for (const [target, declaration] of Object.entries(specifications)) {
    for (const [id, record] of Object.entries(declaration.obligations ?? {})) {
      obligations.set(`${target}::${id}`, record.owner);
    }
  }

  const reachesPackage = (part, pathStack) => {
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
    if (owner.kind === "package") return packages.has(owner.package);
    if (owner.kind === "excluded") {
      diagnostics.push(
        `project-source supply '${part}' terminates at an exclusion`,
      );
      return false;
    }
    return owner.supplies
      .map((next) => reachesPackage(next, [...pathStack, part]))
      .every(Boolean);
  };

  for (const [target, declaration] of Object.entries(requirements)) {
    const owner = declaration.owner;
    if (owner?.kind !== "project-source") continue;
    for (const supply of owner.supplies) {
      const match = PART_TARGET.exec(supply);
      if (match !== null) {
        const specification = unitsByLayer.get("specifications").get(match[1]);
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

const validateOwner = (owner, target, packages, diagnostics) => {
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
      if (
        !owner.supplies.every(
          (value) => typeof value === "string" && PART_TARGET.test(value),
        )
      ) {
        diagnostics.push(`${target} has invalid project-source supply target`);
      }
      if (new Set(owner.supplies).size !== owner.supplies.length) {
        diagnostics.push(`${target} repeats a project-source supply`);
      }
      if (
        [...owner.supplies]
          .sort(compare)
          .some((value, index) => value !== owner.supplies[index])
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
  cache,
  root,
  packageName,
  target,
  diagnostics,
) => {
  const blocks = packageJSDocBlocks(cache, root, packageName);
  if (!blocks.some((block) => hasEvidenceTarget(block, target))) {
    diagnostics.push(
      `${target} names ${packageName}, but that package has no positive @evidence carrier`,
    );
  }
};

const requirePackagePartEvidence = (
  cache,
  root,
  packageName,
  target,
  obligation,
  diagnostics,
) => {
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
const packageJSDocBlocks = (cache, root, packageName) => {
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

const hasEvidenceTarget = (text, target) =>
  new RegExp(`@evidence\\s+${escapeRegExp(target)}(?:\\s|$)`).test(text);

const hasEvidencePart = (text, part) =>
  new RegExp(`@evidencePart\\s+${escapeRegExp(part)}(?:\\s|$)`).test(text);

const workspacePackages = (root, diagnostics) => {
  const result = new Map();
  const packagesRoot = path.join(root, "packages");
  for (const directory of childDirectories(packagesRoot)) {
    const manifest = path.join(directory, "package.json");
    if (!fs.existsSync(manifest)) continue;
    const value = capture(diagnostics, () =>
      JSON.parse(fs.readFileSync(manifest, "utf8")),
    );
    if (typeof value?.name === "string") result.set(value.name, directory);
  }
  return result;
};

const loadLedger = (root, layer) => {
  const location = ledgerPath(root, layer);
  if (!fs.existsSync(location)) {
    throw new ContractOwnershipError([
      `missing ownership ledger '${slash(path.relative(root, location))}'`,
    ]);
  }
  try {
    return JSON.parse(fs.readFileSync(location, "utf8").replace(/^\uFEFF/, ""));
  } catch (error) {
    throw new ContractOwnershipError([
      `cannot parse ownership ledger '${slash(path.relative(root, location))}': ${error instanceof Error ? error.message : String(error)}`,
    ]);
  }
};

const ledgerPath = (root, layer) =>
  path.join(root, "docs", "contract-ownership", `${layer}.json`);

const exactKeys = (value, keys, label, diagnostics) => {
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

const assertSortedKeys = (value, label, diagnostics) => {
  const actual = Object.keys(value);
  const sorted = [...actual].sort(compare);
  if (actual.some((key, index) => key !== sorted[index])) {
    diagnostics.push(`${label} keys must be sorted`);
  }
};

const ownerMatches = (owner, query) =>
  query === undefined || query === ownerIdentity(owner);

const ownerIdentity = (owner) =>
  owner.kind === "package" ? owner.package : owner.kind;

const childDirectories = (directory) => {
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

const walkFiles = (directory, predicate) => {
  const output = [];
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

const capture = (diagnostics, operation) => {
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

const plainObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const slash = (value) => value.replaceAll("\\", "/");
const compare = (left, right) => (left < right ? -1 : left > right ? 1 : 0);
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const assertLayer = (layer) => {
  if (!LAYERS.includes(layer)) {
    throw new ContractOwnershipError([
      `layer must be one of ${LAYERS.join(", ")}; received '${layer}'`,
    ]);
  }
};

const option = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const main = () => {
  const argv = process.argv.slice(2);
  const command =
    argv[0] === undefined || argv[0].startsWith("--") ? "check" : argv.shift();
  const args = argv;
  const root = path.resolve(option(args, "--root") ?? process.cwd());
  if (command === "initialize") {
    const layer = option(args, "--layer");
    assertLayer(layer);
    process.stdout.write(
      `${JSON.stringify(initializeContractOwnership(root, layer))}\n`,
    );
  } else if (command === "check") {
    process.stdout.write(`${JSON.stringify(inspectContractOwnership(root))}\n`);
  } else if (command === "query") {
    const layer = option(args, "--layer");
    assertLayer(layer);
    process.stdout.write(
      `${JSON.stringify(queryContractOwnership(root, layer, option(args, "--owner")), null, 2)}\n`,
    );
  } else {
    throw new ContractOwnershipError([
      `unknown command '${command}'; use check, initialize, or query`,
    ]);
  }
};

if (
  process.argv[1] !== undefined &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
