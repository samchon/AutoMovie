import { parseAutoMovieEvidenceMarkdownHeadings } from "@automovie/evidence";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript-compiler";

const LAYERS = ["requirements", "specifications"] as const;
export type ContractLayer = (typeof LAYERS)[number];

export interface IContractDocument {
  file: string;
  relative: string;
  text: string;
}

export interface IContractUnit {
  depth: 2 | 3;
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
type ContractEvidenceSymbol = "function" | "property" | "type";

export interface IContractEvidenceReference {
  files: readonly string[];
  symbols: readonly string[];
}

export interface IContractEvidenceClaim {
  files: readonly string[];
  references: readonly IContractEvidenceReference[];
  symbols: readonly ContractEvidenceSymbol[];
}

export interface IContractEvidenceSource {
  path: string;
  source: string;
}

const PART_TARGET =
  /^(specifications\/[a-z0-9./-]+\.md#[a-z0-9-]+)::([a-z0-9-]+)$/;
const UNIT_TARGET =
  /^(requirements|specifications)\/(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.md#[a-z0-9-]+$/;

/**
 * The sentence a thrown value contributes to a diagnostic.
 *
 * Written inline it was three copies of one branch whose `String` alternative
 * nothing in this repository can reach, which is a defensive path that can only
 * ever be covered by pretending. As one function it is an ordinary unit with an
 * ordinary pair of cases. An `Error` contributes its message rather than its
 * class name, so a command's stderr stays the diagnostic rather than
 * `ContractOwnershipError: ` followed by it.
 *
 * The changed-coverage and coverage-population gates state the same sentence,
 * and they import it from here rather than restating it. `isProcessEntry` is
 * duplicated in `build/tgz.ts` because that file is outside this package's
 * `tsconfig.json` root and cannot share a definition; these three callers are
 * all inside `test/src`, so no such boundary excuses a second copy.
 */
export const describeThrown = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** A deterministic failure from the manual contract-ownership inspection. */
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
  return collectContractUnitsFromDocuments(
    files.map((file) => ({
      file,
      relative: slash(path.relative(path.join(root, "docs"), file)),
      text: fs.readFileSync(file, "utf8"),
    })),
  );
};

export const collectContractUnitsFromDocuments = (
  documents: readonly IContractDocument[],
): ContractUnits => {
  const units: ContractUnits = new Map();
  for (const document of documents) {
    const lines = document.text.replaceAll("\r\n", "\n").split("\n");
    const headings = parseAutoMovieEvidenceMarkdownHeadings(document.text)
      .filter(
        (
          heading,
        ): heading is typeof heading & {
          anchor: string;
          depth: 2 | 3;
        } =>
          (heading.depth === 2 || heading.depth === 3) &&
          heading.anchor !== undefined &&
          /^[a-z0-9][a-z0-9-]*$/u.test(heading.anchor),
      )
      .map((heading) => ({
        anchor: heading.anchor,
        depth: heading.depth,
        index: heading.line - 1,
      }));
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
        depth: heading.depth,
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
 * Collect positive evidence carriers from the exact file, symbol, and Markdown
 * reference populations declared by package lint claims.
 *
 * The ownership query asks the same question as the native graph: a citation
 * counts only when its file and public declaration kind are selected by a claim
 * whose Markdown reference selects the requested target. Private declarations,
 * excluded files, and a citation carried under another claim are not owners.
 */
export const collectContractEvidenceCarrierBlocks = (
  sources: readonly IContractEvidenceSource[],
  claims: readonly IContractEvidenceClaim[],
  target: string,
  depth: 2 | 3,
): string[] => {
  const file = target.split("#", 1)[0]!;
  const targetSymbol = `h${depth}`;
  const blocks: string[] = [];
  for (const source of sources) {
    const symbols = new Set<ContractEvidenceSymbol>();
    for (const claim of claims) {
      if (!matchesConfiguredFiles(source.path, claim.files)) continue;
      if (
        claim.references.some(
          (reference) =>
            reference.symbols.includes(targetSymbol) &&
            matchesConfiguredFiles(file, reference.files),
        )
      ) {
        for (const symbol of claim.symbols) symbols.add(symbol);
      }
    }
    if (symbols.size !== 0)
      blocks.push(...publicEvidenceBlocks(source.source, symbols));
  }
  return blocks;
};

/** Resolve one ordered native-graph file population. */
export const matchesConfiguredFiles = (
  file: string,
  patterns: readonly string[],
): boolean => {
  const normalized = stripCurrentDirectoryPrefix(slash(file));
  let selected = false;
  for (const declared of patterns) {
    const negative = declared.startsWith("!");
    const pattern = stripCurrentDirectoryPrefix(
      slash(negative ? declared.slice(1) : declared),
    );
    if (globRegExp(pattern).test(normalized)) selected = !negative;
  }
  return selected;
};

const globRegExp = (pattern: string): RegExp => {
  let source = "^";
  for (let index = 0; index < pattern.length; index++) {
    const character = pattern[index]!;
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        index++;
        if (pattern[index + 1] === "/") {
          index++;
          source += "(?:.*/)?";
        } else source += ".*";
      } else source += "[^/]*";
    } else if (character === "?") source += "[^/]";
    else source += escapeRegExp(character);
  }
  return new RegExp(`${source}$`, "u");
};

const publicEvidenceBlocks = (
  source: string,
  symbols: ReadonlySet<ContractEvidenceSymbol>,
): string[] => {
  const file = ts.createSourceFile(
    "carrier.ts",
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
  const blocks = new Map<number, string>();
  collectPublicStatementBlocks(file, file.statements, symbols, blocks);
  return [...blocks.entries()]
    .sort(([left], [right]) => left - right)
    .map(([, block]) => block);
};

const collectPublicStatementBlocks = (
  file: ts.SourceFile,
  statements: ts.NodeArray<ts.Statement>,
  symbols: ReadonlySet<ContractEvidenceSymbol>,
  blocks: Map<number, string>,
): void => {
  const listed = new Set<string>();
  for (const statement of statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      statement.moduleSpecifier !== undefined
    )
      continue;
    if (
      statement.exportClause === undefined ||
      !ts.isNamedExports(statement.exportClause)
    )
      continue;
    for (const element of statement.exportClause.elements)
      listed.add((element.propertyName ?? element.name).text);
  }
  for (const statement of statements) {
    if (!isPublicStatement(statement, listed)) continue;
    if (hasHiddenDocumentation(file, statement)) continue;
    collectSupportedNodeBlocks(file, statement, symbols, blocks);
    if (ts.isModuleDeclaration(statement))
      collectPublicModuleBlocks(file, statement.body, symbols, blocks);
  }
};

const collectPublicModuleBlocks = (
  file: ts.SourceFile,
  body: ts.ModuleBody | undefined,
  symbols: ReadonlySet<ContractEvidenceSymbol>,
  blocks: Map<number, string>,
): void => {
  if (body === undefined) return;
  if (ts.isModuleBlock(body))
    collectPublicStatementBlocks(file, body.statements, symbols, blocks);
  else if (ts.isModuleDeclaration(body)) {
    if (hasHiddenDocumentation(file, body)) return;
    collectSupportedNodeBlocks(file, body, symbols, blocks);
    collectPublicModuleBlocks(file, body.body, symbols, blocks);
  }
};

const isPublicStatement = (
  statement: ts.Statement,
  listed: ReadonlySet<string>,
): boolean => {
  if (hasModifier(statement, ts.SyntaxKind.ExportKeyword)) return true;
  return declaredNames(statement).some((name) => listed.has(name));
};

const declaredNames = (statement: ts.Statement): string[] => {
  if (
    ts.isClassDeclaration(statement) ||
    ts.isEnumDeclaration(statement) ||
    ts.isFunctionDeclaration(statement) ||
    ts.isInterfaceDeclaration(statement) ||
    ts.isModuleDeclaration(statement) ||
    ts.isTypeAliasDeclaration(statement)
  )
    return statement.name === undefined ? [] : [statement.name.text];
  if (ts.isVariableStatement(statement))
    return statement.declarationList.declarations.flatMap((declaration) =>
      ts.isIdentifier(declaration.name) ? [declaration.name.text] : [],
    );
  return [];
};

const collectSupportedNodeBlocks = (
  file: ts.SourceFile,
  node: ts.Node,
  symbols: ReadonlySet<ContractEvidenceSymbol>,
  output: Map<number, string>,
): void => {
  const comments = ts
    .getJSDocCommentsAndTags(node)
    .filter(ts.isJSDoc)
    .map((comment) => ({ comment, text: comment.getFullText(file) }));
  if (comments.some(({ text }) => hasHiddenDocumentationTag(text))) return;
  const kinds = contractEvidenceSymbolKinds(node);
  if (kinds.some((kind) => symbols.has(kind)))
    for (const { comment, text } of comments) output.set(comment.pos, text);
  if (
    ts.isClassDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isTypeLiteralNode(node)
  ) {
    for (const member of node.members) {
      if (
        !hasModifier(member, ts.SyntaxKind.PrivateKeyword) &&
        !hasModifier(member, ts.SyntaxKind.ProtectedKeyword) &&
        (member.name === undefined || !ts.isPrivateIdentifier(member.name))
      )
        collectSupportedNodeBlocks(file, member, symbols, output);
    }
  } else if (
    ts.isTypeAliasDeclaration(node) &&
    ts.isTypeLiteralNode(node.type)
  ) {
    collectSupportedNodeBlocks(file, node.type, symbols, output);
  } else if (ts.isEnumDeclaration(node)) {
    for (const member of node.members)
      collectSupportedNodeBlocks(file, member, symbols, output);
  }
};

const contractEvidenceSymbolKinds = (
  node: ts.Node,
): ContractEvidenceSymbol[] => {
  if (
    ts.isClassDeclaration(node) ||
    ts.isEnumDeclaration(node) ||
    ts.isInterfaceDeclaration(node) ||
    ts.isModuleDeclaration(node) ||
    ts.isTypeAliasDeclaration(node)
  )
    return ["type"];
  if (
    ts.isCallSignatureDeclaration(node) ||
    ts.isConstructSignatureDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isFunctionDeclaration(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isMethodSignature(node)
  )
    return ["function"];
  if (
    ts.isEnumMember(node) ||
    ts.isGetAccessorDeclaration(node) ||
    ts.isPropertyDeclaration(node) ||
    ts.isPropertySignature(node) ||
    ts.isSetAccessorDeclaration(node)
  )
    return ["property"];
  if (ts.isVariableStatement(node)) {
    const kinds = new Set<ContractEvidenceSymbol>();
    const constant =
      (node.declarationList.flags & ts.NodeFlags.Const) !== ts.NodeFlags.None;
    for (const declaration of node.declarationList.declarations)
      kinds.add(
        constant &&
          ts.isIdentifier(declaration.name) &&
          declaration.initializer !== undefined &&
          (ts.isArrowFunction(declaration.initializer) ||
            ts.isFunctionExpression(declaration.initializer))
          ? "function"
          : "property",
      );
    return [...kinds];
  }
  return [];
};

const hasHiddenDocumentationTag = (comment: string): boolean =>
  comment
    .replace(/^\s*\/\*\*/u, "")
    .replace(/\*\/\s*$/u, "")
    .split(/\r?\n/u)
    .some((line) =>
      /^@(?:hidden|ignore|internal)(?:\s|$)/u.test(
        line.trim().replace(/^\*\s?/u, ""),
      ),
    );

const hasHiddenDocumentation = (file: ts.SourceFile, node: ts.Node): boolean =>
  ts
    .getJSDocCommentsAndTags(node)
    .filter(ts.isJSDoc)
    .some((comment) => hasHiddenDocumentationTag(comment.getFullText(file)));

const stripCurrentDirectoryPrefix = (value: string): string => {
  while (value.startsWith("./")) value = value.slice(2);
  return value;
};

const hasModifier = (node: ts.Node, kind: ts.SyntaxKind): boolean =>
  ts.canHaveModifiers(node) &&
  (ts.getModifiers(node)?.some((modifier) => modifier.kind === kind) ?? false);

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
 * a manufactured owner is worse than a counted debt. What the manual inspection
 * does refuse is a unit that is new or gone, because those are decisions
 * somebody made.
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
    // `inspectContractOwnership` above accepted the ledger, so a specification
    // declaration that is not structural carries obligations.
    for (const [obligation, record] of Object.entries(
      declaration.obligations!,
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
      const unit = units.get(target);
      if (
        owner?.kind === "package" &&
        typeof owner.package === "string" &&
        unit !== undefined
      ) {
        requirePackageEvidence(
          cache,
          root,
          owner.package,
          target,
          unit.depth,
          diagnostics,
        );
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
        const unit = units.get(target);
        if (
          owner?.kind === "package" &&
          typeof owner.package === "string" &&
          unit !== undefined
        ) {
          requirePackagePartEvidence(
            cache,
            root,
            owner.package,
            target,
            id,
            unit.depth,
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
  // A ledger whose declarations are not an object has already been reported by
  // `validateLayer`, which stops reading it at that point. This pass runs after
  // that one regardless, so it has to stop reading it too: walking the missing
  // map turned a hand-edited ledger's honest diagnostic into `Cannot convert
  // undefined or null to object`, which names neither the file nor the fault.
  const declarationsOf = (
    layer: ContractLayer,
  ): Record<string, IContractDeclaration> => {
    const declarations: unknown = ledgers.get(layer)!.declarations;
    return plainObject(declarations)
      ? (declarations as Record<string, IContractDeclaration>)
      : {};
  };
  const specifications = declarationsOf("specifications");
  const requirements = declarationsOf("requirements");
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
      owner.package.trim().length === 0
    ) {
      diagnostics.push(`${target} has invalid package owner`);
    } else if (!isContractPackageOwner(owner.package, packages)) {
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

/** Decide package ownership from the manifests actually present in a workspace. */
export const isContractPackageOwner = (
  packageName: string,
  packages: ReadonlyMap<string, string>,
): boolean => packages.has(packageName);

const requirePackageEvidence = (
  cache: JSDocCache,
  root: string,
  packageName: string,
  target: string,
  depth: 2 | 3,
  diagnostics: Diagnostics,
): void => {
  const blocks = packageJSDocBlocks(cache, root, packageName, target, depth);
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
  depth: 2 | 3,
  diagnostics: Diagnostics,
): void => {
  const part = `${target}::${obligation}`;
  const blocks = packageJSDocBlocks(cache, root, packageName, target, depth);
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
  target: string,
  depth: 2 | 3,
): string[] => {
  const key = `${packageName}\u0000${target}\u0000${depth}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;
  const directory = workspacePackages(root, []).get(packageName);
  const blocks =
    directory === undefined
      ? []
      : collectContractEvidenceCarrierBlocks(
          walkFiles(path.join(directory, "src"), (file) =>
            file.endsWith(".ts"),
          ).map((file) => ({
            path: slash(path.relative(directory, file)),
            source: fs.readFileSync(file, "utf8"),
          })),
          loadPackageEvidenceClaims(root, directory),
          target,
          depth,
        );
  cache.set(key, blocks);
  return blocks;
};

const loadPackageEvidenceClaims = (
  root: string,
  directory: string,
): IContractEvidenceClaim[] => {
  const location = path.join(directory, "lint.config.ts");
  if (!fs.existsSync(location)) return [];
  const imported: unknown = require(location);
  const configuration =
    plainObject(imported) && plainObject(imported.default)
      ? imported.default
      : imported;
  if (!plainObject(configuration) || !plainObject(configuration.rules))
    return [];
  const rule = configuration.rules["evidence/graph"];
  if (!Array.isArray(rule) || !plainObject(rule[1])) return [];
  const claims = rule[1].claims;
  if (!Array.isArray(claims)) return [];
  return claims.flatMap((claim): IContractEvidenceClaim[] => {
    if (
      !plainObject(claim) ||
      claim.type !== "typescript" ||
      claim.disabled === true
    )
      return [];
    const claimRoot =
      typeof claim.root === "string"
        ? path.resolve(directory, claim.root)
        : directory;
    if (claimRoot !== directory) return [];
    const files = stringList(claim.files);
    if (files.length === 0) return [];
    const symbols = contractEvidenceSymbols(claim.symbol);
    const declaredReferences = Array.isArray(claim.reference)
      ? claim.reference
      : [claim.reference];
    const references = declaredReferences.flatMap(
      (reference): IContractEvidenceReference[] => {
        if (!plainObject(reference) || reference.type !== "markdown") return [];
        const referenceRoot =
          typeof reference.root === "string"
            ? path.resolve(directory, reference.root)
            : directory;
        if (referenceRoot !== path.join(root, "docs")) return [];
        const referenceFiles = stringList(reference.files);
        if (referenceFiles.length === 0) return [];
        return [
          {
            files: referenceFiles,
            symbols: markdownEvidenceSymbols(reference.symbol),
          },
        ];
      },
    );
    return references.length === 0 ? [] : [{ files, references, symbols }];
  });
};

const stringList = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string")
    : [];

const contractEvidenceSymbols = (value: unknown): ContractEvidenceSymbol[] => {
  const values = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  if (values.length === 0) return ["type", "function", "property"];
  return values.filter(
    (entry): entry is ContractEvidenceSymbol =>
      entry === "type" || entry === "function" || entry === "property",
  );
};

const markdownEvidenceSymbols = (value: unknown): string[] => {
  const values = Array.isArray(value)
    ? value
    : value === undefined
      ? []
      : [value];
  return values.length === 0
    ? ["file", "h1", "h2", "h3", "h4"]
    : values.filter((entry): entry is string => typeof entry === "string");
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
      `cannot parse ownership ledger '${slash(path.relative(root, location))}': ${describeThrown(error)}`,
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
  // Only reachable after `inspectContractOwnership` accepted the ledger, which
  // refuses a package owner whose `package` is not a string.
  owner.kind === "package" ? owner.package! : owner.kind;

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
    else diagnostics.push(describeThrown(error));
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
    errorOutput.write(`${describeThrown(error)}\n`);
    return 1;
  }
};

/**
 * Whether the process was started on this module rather than on an importer.
 *
 * Split out for the same reason the coverage command's entry predicate was: an
 * `if` at module scope is a branch only a real invocation can take, so the
 * binding between the command and its own resolved path is the one part of the
 * wiring nothing can inspect. Here it is a value, and the wrapper below is a
 * unit both booleans can be handed.
 */
export const contractOwnershipProcessIsEntry = (
  entry: string | undefined,
): boolean => path.resolve(entry ?? "") === path.resolve(__filename);

/** Execute the command only for the direct TypeScript entry module. */
export const runContractOwnershipCli = (
  isEntry: boolean,
  run: () => number,
  setExitStatus: (status: number) => void,
): void => {
  if (isEntry === false) return;
  setExitStatus(run());
};

export const setContractOwnershipExitStatus = (status: number): void => {
  process.exitCode = status;
};

runContractOwnershipCli(
  contractOwnershipProcessIsEntry(process.argv[1]),
  runContractOwnership.bind(undefined, process.argv.slice(2)),
  setContractOwnershipExitStatus,
);
