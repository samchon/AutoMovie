import fs from "node:fs";
import path from "node:path";

const SOURCE_EXTENSION = /\.(?:[cm]?ts|tsx)$/u;
const EVIDENCE_TAG =
  /@(evidence|evidenceExclude)\s+((?:requirements|specifications)\/[^\s*]+)/gu;

export interface IEvidenceClaimDefinition {
  contracts: string[];
  name: string;
}

export interface IEvidenceGraphDefinition {
  claims: IEvidenceClaimDefinition[];
  excludeIndex: boolean;
  package: string;
  sourceGlob: string;
}

export interface IEvidenceCitation {
  kind: "evidence" | "evidenceExclude";
  reference: string;
}

export interface IEvidenceCarrier {
  citations: IEvidenceCitation[];
  file: string;
  line: number;
}

export interface IEvidencePopulationClaim {
  citations: number;
  exclusions: number;
  hosts: number;
  name: string;
  positive: number;
}

export interface IEvidencePopulationGraph {
  carrierFiles: number;
  /** Selected sources carrying no citation at all. */
  unpaid: number;
  carriers: number;
  claims: IEvidencePopulationClaim[];
  package: string;
  sources: number;
}

export interface IRepositoryEvidencePopulationResult {
  diagnostics: string[];
  graphs: IEvidencePopulationGraph[];
}

export const GRAPH_DEFINITIONS: IEvidenceGraphDefinition[] = [
  {
    package: "production",
    excludeIndex: true,
    sourceGlob: '"src/**/*.ts", "!src/**/index.ts"',
    claims: [
      {
        name: "public production exports implement requirements",
        contracts: [
          "requirements/operations-and-recovery/concurrent-runs-and-locking.md",
          "requirements/production-design/continuity-change-and-deliverables.md",
          "requirements/repaint/providers-models-and-credentials.md",
          "requirements/repaint/retries-seeds-and-variation.md",
          "requirements/repaint/sequence-continuity-and-publication.md",
          "requirements/review/subject-inspection.md",
        ],
      },
      {
        name: "public production exports implement specifications",
        contracts: [
          "specifications/asset-and-representation/generated-assets-and-repaint-handoff.md",
          "specifications/execution-and-recovery/concurrent-ownership-and-locking.md",
          "specifications/narrative-and-intent/budgets-continuity-and-deliverables.md",
          "specifications/review-and-acceptance/subject-surface-and-inspection.md",
          "specifications/review-and-acceptance/README.md",
        ],
      },
    ],
  },
  {
    package: "playground",
    excludeIndex: false,
    sourceGlob: 'files: ["src/**/*.ts"]',
    claims: [
      {
        name: "playground demonstrations realize prototype requirements",
        contracts: ["requirements/product/prototype-quality.md"],
      },
      {
        name: "playground demonstrations realize prototype specifications",
        contracts: [
          "specifications/authoring-and-authority/prototype-determinism-and-fidelity.md",
        ],
      },
    ],
  },
];

const compare = (left: string, right: string): number =>
  left.localeCompare(right);

/**
 * Every package whose lint configuration turns the contract graph on.
 *
 * Derived rather than listed. The two packages this gate was written for were
 * named in `GRAPH_DEFINITIONS`, and eleven others enabled the same graph
 * without being measured -- which is precisely the opaque boolean this guard
 * exists to prevent, arrived at from the other side. A list is where the next
 * package goes missing; a derivation is where it cannot.
 */
export const graphEnabledPackages = (
  root: string,
  readText: ReadText = (file) => fs.readFileSync(file, "utf8"),
): string[] => {
  const packages = path.join(root, "packages");
  if (fs.existsSync(packages) === false) return [];
  return fs
    .readdirSync(packages, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => {
      const config = path.join(packages, name, "lint.config.ts");
      // Read plainly after the existence check. A read that fails anyway is an
      // instrument problem worth surfacing, and a guard here would be an
      // alternative nothing can reach that could only be covered by pretending.
      return (
        fs.existsSync(config) && readText(config).includes('"evidence/graph"')
      );
    })
    .sort(compare);
};
const slash = (value: string): string => value.replaceAll(path.sep, "/");

const walkSources = (directory: string): string[] =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const target = path.join(directory, entry.name);
      return entry.isDirectory()
        ? walkSources(target)
        : entry.isFile() &&
            SOURCE_EXTENSION.test(entry.name) &&
            entry.name.endsWith(".d.ts") === false
          ? [target]
          : [];
    })
    .sort(compare);

// A split always yields at least one piece, so the first is the file part
// whether or not the reference carries an anchor.
const contractFile = (reference: string): string => reference.split("#", 1)[0]!;
type ReadText = (file: string) => string;

/**
 * Every explicitly anchored controlled heading in a claim's contract files.
 *
 * The evidence-graph skill gives both H2 and H3 an explicit unique anchor, and
 * a source may cite either, so resolution accepts both levels. Reading one
 * level per file is what produced this function's last defect: the default was
 * H3, the six requirement documents this repository's production claim cites
 * anchor their whole-document unit at H2, and all twelve of those citations
 * were therefore reported as missing references while every anchor was in fact
 * present. That had already been met once with a per-file level override for a
 * README whose only anchors are H2, which patched one document and left the
 * class open.
 *
 * Widening this set weakens nothing. It answers only whether a cited anchor
 * exists, so a citation naming an anchor no document declares still fails.
 */
const contractReferences = (
  root: string,
  claim: IEvidenceClaimDefinition,
  readText: ReadText,
): string[] =>
  claim.contracts.flatMap((contract) => {
    const heading = /^#{2,3}\s+.+?\s*\{#([^}]+)\}\s*$/u;
    return readText(path.join(root, "docs", contract))
      .split(/\r?\n/u)
      .flatMap((line) => {
        const matched = heading.exec(line);
        return matched?.[1] === undefined ? [] : [`${contract}#${matched[1]}`];
      });
  });

/** Every JSDoc block that actually carries a positive or exclusion citation. */
export const evidenceCarriers = (
  root: string,
  definition: IEvidenceGraphDefinition,
  readText: ReadText = (file) => fs.readFileSync(file, "utf8"),
): { carriers: IEvidenceCarrier[]; files: string[] } => {
  const sourceRoot = path.join(root, "packages", definition.package, "src");
  const files = walkSources(sourceRoot).filter(
    (file) =>
      definition.excludeIndex === false || path.basename(file) !== "index.ts",
  );
  const carriers: IEvidenceCarrier[] = [];
  for (const file of files) {
    const text = readText(file);
    for (const block of text.matchAll(/\/\*\*[\s\S]*?\*\//gu)) {
      const citations: IEvidenceCitation[] = [];
      for (const match of block[0].matchAll(EVIDENCE_TAG)) {
        const kind = match[1];
        const reference = match[2];
        if (
          (kind === "evidence" || kind === "evidenceExclude") &&
          reference !== undefined
        )
          citations.push({ kind, reference });
      }
      if (citations.length === 0) continue;
      // Every `matchAll` result carries the offset it was found at.
      const line = text.slice(0, block.index!).split("\n").length;
      carriers.push({
        file: slash(path.relative(root, file)),
        line,
        citations,
      });
    }
  }
  return { files, carriers };
};

/**
 * Selected sources that answer nothing, pinned per package.
 *
 * The evidence-graph skill settles which of #2171's two forks this is. It
 * forbids the other outright -- "Select the complete public export surface
 * rather than narrowing files or symbol kinds to avoid obligations" -- and
 * names where the missing half belongs: "`evidence/graph` runs its obligation
 * from the reference toward the claim, so a new file carrying a wrong citation
 * is an error while a new file carrying none at all is silent... Until the
 * contributor grows a per-host lower bound, that bound belongs to a structural
 * guard... Record the unpaid edge instead of reporting the population as
 * self-enforcing."
 *
 * This is that guard and that record. Measured on the tree that added it:
 *
 * | package | selected | answering | unpaid |
 * | --- | --- | --- | --- |
 * | `production` | 58 | 11 | 47 |
 * | `playground` | 25 | 1 | 24 |
 * | `engine` | 219 | 216 | 3 |
 *
 * and every one of the other ten packages at zero, which is the reason the rule
 * is stated as a rule rather than an aspiration: eleven of thirteen packages
 * already meet it. `production` carries the largest surfaces in the repository
 * among the unpaid -- a 1,767-line oracle service, a 1,260-line repaint
 * service, a 1,233-line legacy importer -- so `requirements/repaint/*` reads
 * green from three citing files while the repaint service answers nothing.
 *
 * A count, deliberately, and never a list of file names. A name list makes
 * "owes no evidence" the standing answer for the file that joins it and reports
 * nothing when one does; a count refuses the next unpaid file the moment it
 * arrives. It is compared for equality rather than as a ceiling, because the
 * skill asks the same of the reachability ledger: "any increase, decrease,
 * target substitution, or reclassification requires the ledger to be reread and
 * updated rather than drifting silently." Paying one of these down is a change
 * to this number, made deliberately, in the commit that pays it.
 *
 * Resumption: the debt closes when each package's authored surfaces cite the
 * requirements they implement. That is its own work, not a toll on the next
 * unrelated change, and it is owned by #2171 rather than absorbed here.
 */
export const ACCEPTED_UNPAID_HOSTS: Readonly<Record<string, number>> = {
  engine: 3,
  playground: 24,
  // 48 rather than 47 since `residentCodecs.ts` joined: it defers the media
  // codec load until a resident generation is bound, and no specification
  // states that deferral, so it answers nothing for the same reason the other
  // forty-seven do. Reaching for a nearby anchor would have failed the
  // exchange test -- "supplies the parsers the inspection reads" stays true on
  // every module that touches them.
  production: 48,
};

/**
 * Compare one package's unpaid population against the pinned ledger.
 *
 * Both directions are diagnosed. A rise is new debt; a fall is a payment the
 * ledger has not recorded, and letting it pass silently is how a pinned number
 * stops meaning anything.
 */
export const unpaidHostDiagnostic = (props: {
  accepted: number;
  package: string;
  unpaid: number;
}): string | undefined => {
  if (props.unpaid === props.accepted) return undefined;
  const subject =
    props.unpaid === 1
      ? "1 selected source answers"
      : `${props.unpaid} selected sources answer`;
  return props.unpaid > props.accepted
    ? `${props.package}: ${subject} nothing, ${props.accepted} accepted; a selected host owes a citation`
    : `${props.package}: ${subject} nothing where ${props.accepted} are accepted; record the payment in ACCEPTED_UNPAID_HOSTS`;
};

/**
 * Measure the configured repository graphs without turning a lint pass into an
 * opaque boolean. The TypeScript compiler remains the authority for graph
 * cardinality; this guard makes the selected source and real citation
 * population visible and refuses an empty or disconnected claim.
 */
export const inspectRepositoryEvidencePopulations = (
  root: string,
  definitions: IEvidenceGraphDefinition[] = GRAPH_DEFINITIONS,
  readText: ReadText = (file) => fs.readFileSync(file, "utf8"),
): IRepositoryEvidencePopulationResult => {
  const diagnostics: string[] = [];
  const graphs: IEvidencePopulationGraph[] = [];
  for (const definition of definitions) {
    const packageRoot = path.join(root, "packages", definition.package);
    const configFile = path.join(packageRoot, "lint.config.ts");
    if (fs.existsSync(configFile) === false) {
      diagnostics.push(`${definition.package}: missing lint.config.ts`);
      continue;
    }
    const config = readText(configFile);
    if (config.includes('"evidence/graph"') === false)
      diagnostics.push(`${definition.package}: evidence/graph is not enabled`);
    if (config.includes(definition.sourceGlob) === false)
      diagnostics.push(
        `${definition.package}: configured source population is not the reviewed ${definition.sourceGlob}`,
      );

    const population = evidenceCarriers(root, definition, readText);
    const carrierFiles = new Set(
      population.carriers.map((carrier) => carrier.file),
    );
    if (population.files.length === 0)
      diagnostics.push(`${definition.package}: source population is empty`);
    if (population.carriers.length === 0)
      diagnostics.push(
        `${definition.package}: evidence carrier population is empty`,
      );

    const claims = definition.claims.map((claim) => {
      if (config.includes(`name: "${claim.name}"`) === false)
        diagnostics.push(
          `${definition.package}: missing graph claim '${claim.name}'`,
        );
      for (const contract of claim.contracts)
        if (config.includes(`"${contract}"`) === false)
          diagnostics.push(
            `${definition.package}: claim '${claim.name}' omits '${contract}'`,
          );

      const contracts = new Set(claim.contracts);
      const availableReferences = new Set(
        contractReferences(root, claim, readText),
      );
      const hosts = new Set();
      let positive = 0;
      let exclusions = 0;
      for (const carrier of population.carriers)
        for (const citation of carrier.citations)
          if (contracts.has(contractFile(citation.reference))) {
            hosts.add(`${carrier.file}:${carrier.line}`);
            if (availableReferences.has(citation.reference) === false)
              diagnostics.push(
                `${definition.package}: claim '${claim.name}' cites missing reference '${citation.reference}'`,
              );
            if (citation.kind === "evidence") positive++;
            else exclusions++;
          }
      if (hosts.size === 0)
        diagnostics.push(
          `${definition.package}: claim '${claim.name}' has no citation host`,
        );
      if (positive === 0)
        diagnostics.push(
          `${definition.package}: claim '${claim.name}' has no positive citation`,
        );
      return {
        name: claim.name,
        hosts: hosts.size,
        citations: positive + exclusions,
        positive,
        exclusions,
      };
    });

    const unpaid = population.files.length - carrierFiles.size;
    const unpaidDiagnostic = unpaidHostDiagnostic({
      accepted: ACCEPTED_UNPAID_HOSTS[definition.package] ?? 0,
      package: definition.package,
      unpaid,
    });
    if (unpaidDiagnostic !== undefined) diagnostics.push(unpaidDiagnostic);
    graphs.push({
      package: definition.package,
      sources: population.files.length,
      carrierFiles: carrierFiles.size,
      unpaid,
      carriers: population.carriers.length,
      claims,
    });
  }
  // Every other package that runs the same graph, counted rather than trusted.
  // The deep claim checks stay where they are written; what this adds is the
  // one question no package may escape -- did the configured graph select
  // anything at all.
  const named = new Set(definitions.map((definition) => definition.package));
  for (const name of graphEnabledPackages(root, readText)) {
    if (named.has(name)) continue;
    const population = evidenceCarriers(
      root,
      { claims: [], excludeIndex: true, package: name, sourceGlob: "" },
      readText,
    );
    if (population.carriers.length === 0)
      diagnostics.push(
        `${name}: evidence/graph is enabled and selected no citation host`,
      );
    const answering = new Set(
      population.carriers.map((carrier) => carrier.file),
    ).size;
    const unpaid = population.files.length - answering;
    const unpaidDiagnostic = unpaidHostDiagnostic({
      accepted: ACCEPTED_UNPAID_HOSTS[name] ?? 0,
      package: name,
      unpaid,
    });
    if (unpaidDiagnostic !== undefined) diagnostics.push(unpaidDiagnostic);
    graphs.push({
      package: name,
      sources: population.files.length,
      carrierFiles: answering,
      unpaid,
      carriers: population.carriers.length,
      claims: [],
    });
  }
  return { graphs, diagnostics };
};

/** Print the measured carrier and per-claim host populations. */
export const reportRepositoryEvidencePopulations = (
  result: IRepositoryEvidencePopulationResult,
  write: (line: string) => void = console.log,
): void => {
  for (const graph of result.graphs) {
    write(
      `${graph.package}: ${graph.sources} source files, ${graph.carrierFiles} carrier files, ${graph.carriers} JSDoc carriers, ${graph.unpaid} answering nothing`,
    );
    for (const claim of graph.claims)
      write(
        `  ${claim.name}: ${claim.hosts} hosts, ${claim.citations} citations (${claim.positive} positive, ${claim.exclusions} exclusions)`,
      );
  }
  for (const diagnostic of result.diagnostics) write(`ERROR: ${diagnostic}`);
};

export const runRepositoryEvidencePopulationGate = (
  root: string,
  write: (line: string) => void = console.log,
): number => {
  const result = inspectRepositoryEvidencePopulations(root);
  reportRepositoryEvidencePopulations(result, write);
  return result.diagnostics.length === 0 ? 0 : 1;
};
