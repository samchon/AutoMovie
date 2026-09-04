import {
  renderAutoMovieProductionInstructionCandidate,
  renderAutoMovieProductionRouter,
  validateAutoMovieInstructionDocumentLinks,
  validateAutoMovieInstructionLink,
  validateAutoMovieSkillRouterLinks,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

const SKILLS = [
  "contract",
  "evidence-graph",
  "production-lifecycle",
  "review-verification",
  "source-authoring",
] as const;
const SCRIPT_ROUTE = ["java", "script:alert%281%29"].join("");

interface ISource {
  path: string;
  content: string;
}

const router = (name: string, links: string = "[index](index.md#route)") =>
  `---\nname: ${name}\ndescription: Routes the ${name} procedure.\n# Frontmatter comments are inert.\n---\n\n# ${name}\n\n${links}\n`;

const validSources = (): ISource[] => [
  ...SKILLS.flatMap((name): ISource[] => [
    {
      path: `.agents/skills/${name}/SKILL.md`,
      content: router(
        name,
        `[self](#${name}) [index](index.md#route) [external](https://example.com/${name})${
          name === "contract" ? " [contracts](../../../docs/README.md)" : ""
        }`,
      ),
    },
    {
      path: `.agents/skills/${name}/index.md`,
      content: "# Procedure\n\n## Route {#route}\n",
    },
  ]),
  {
    path: ".agents/skills/evidence-graph/work-specific.md",
    content: "# Production-specific contract\n",
  },
  {
    path: ".agents/skills/production-lifecycle/production-kinds.md",
    content: "# Production kinds\n\n## Film\n\n## Brief\n\n## Library\n",
  },
  { path: "docs/README.md", content: "# Contracts\n" },
];

const replace = (
  sources: readonly ISource[],
  path: string,
  content: string,
): ISource[] =>
  sources.map((source) => (source.path === path ? { path, content } : source));

const messageOf = (sources: readonly ISource[]): string => {
  try {
    validateAutoMovieSkillRouterLinks(sources);
    return "accepted";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const evidence = (
  kind: "brief" | "film" | "library" | null,
): Parameters<typeof renderAutoMovieProductionRouter>[0] => ({
  packageName: "router-production",
  description: "",
  manifest: {
    kind,
    language: "english",
    populationScope: { mode: "complete-production" },
    branches: [],
    bindings: [],
  },
  designOwners: [],
  contracts: [],
});

/**
 * Generated instructions use one exact five-router, root-bound candidate.
 *
 * Scenarios:
 *
 * 1. The complete five-router publication accepts sibling, same-document,
 *    project-root, and HTTPS routes.
 * 2. Missing, extra, misnamed, undescribed, or duplicate skill inputs fail.
 * 3. Hidden anchors, malformed fragments, unsupported schemes, encoded or
 *    native absolute paths, root escapes, and malformed encoding fail.
 * 4. Initial creation and synchronization render the same pure candidate,
 *    overwrite stale entry bytes, and publish no unrelated source.
 * 5. Each selected production kind names only its own shape.
 */
export const test_cli_scaffold_skill_router_links = (): void => {
  const valid = validSources();
  TestValidator.equals(
    "valid exact router publication",
    messageOf(valid),
    "accepted",
  );

  const contract = ".agents/skills/contract/SKILL.md";
  const contractIndex = ".agents/skills/contract/index.md";
  const missing = valid.filter(
    (source) => !source.path.startsWith(".agents/skills/contract/"),
  );
  const extra = [
    ...valid,
    {
      path: ".agents/skills/extra/SKILL.md",
      content: router("extra"),
    },
  ];
  const nestedRouter = [
    ...valid,
    {
      path: ".agents/skills/contract/nested/SKILL.md",
      content: router("nested"),
    },
  ];
  const misnamed = replace(valid, contract, router("wrong"));
  const undescribed = replace(
    valid,
    contract,
    "---\nname: contract\n---\n\n# contract\n",
  );
  const missingFrontmatter = replace(valid, contract, "# contract\n");
  const unterminatedFrontmatter = replace(
    valid,
    contract,
    "---\nname: contract\ndescription: Route.\n# contract\n",
  );
  const repeatedFrontmatter = replace(
    valid,
    contract,
    "---\nname: contract\nname: contract\ndescription: Route.\n---\n\n# contract\n",
  );
  const nonMappingFrontmatter = replace(
    valid,
    contract,
    "---\n- contract\n---\n\n# contract\n",
  );
  const duplicate = [
    ...valid,
    {
      path: ".agents\\skills\\contract\\SKILL.md",
      content: router("contract"),
    },
  ];
  const sourceEscape = [
    ...valid,
    { path: "../outside.md", content: "# Outside\n" },
  ];
  let missingDocument = "accepted";
  try {
    validateAutoMovieInstructionDocumentLinks(valid, "missing.md");
  } catch (error) {
    missingDocument = error instanceof Error ? error.message : String(error);
  }
  let missingLinkSource = "accepted";
  try {
    validateAutoMovieInstructionLink(valid, "missing.md", "index.md");
  } catch (error) {
    missingLinkSource = error instanceof Error ? error.message : String(error);
  }
  TestValidator.equals(
    "the five router identities are exact",
    {
      missing: messageOf(missing).includes("required production skill"),
      extra: messageOf(extra).includes("unexpected production skill"),
      nested: messageOf(nestedRouter).includes("unexpected production skill"),
      name: messageOf(misnamed).includes("name must be contract"),
      description: messageOf(undescribed).includes("description is missing"),
      frontmatter: messageOf(missingFrontmatter).includes(
        "frontmatter is missing",
      ),
      unterminated: messageOf(unterminatedFrontmatter).includes(
        "frontmatter is unterminated",
      ),
      repeated: messageOf(repeatedFrontmatter).includes(
        "frontmatter is invalid",
      ),
      mapping: messageOf(nonMappingFrontmatter).includes("must be a mapping"),
      duplicate: messageOf(duplicate).includes("source is duplicated"),
      sourceEscape: messageOf(sourceEscape).includes(
        "source path must stay inside",
      ),
      missingDocument: missingDocument.includes("source is not published"),
      missingLinkSource: missingLinkSource.includes("source is not published"),
    },
    {
      missing: true,
      extra: true,
      nested: true,
      name: true,
      description: true,
      frontmatter: true,
      unterminated: true,
      repeated: true,
      mapping: true,
      duplicate: true,
      sourceEscape: true,
      missingDocument: true,
      missingLinkSource: true,
    },
  );

  const linkFailure = (destination: string, target: string): string =>
    messageOf(
      replace(
        replace(valid, contract, router("contract", `[route](${destination})`)),
        contractIndex,
        target,
      ),
    );
  TestValidator.equals(
    "invalid route classes fail independently",
    {
      fencedAnchor: linkFailure(
        "index.md#ghost",
        "# Procedure\n\n```md\n## Ghost {#ghost}\n```\n",
      ).includes("missing anchor"),
      commentedAnchor: linkFailure(
        "index.md#ghost",
        "# Procedure\n\n<!-- ## Ghost {#ghost} -->\n",
      ).includes("missing anchor"),
      extraFragment: linkFailure(
        "index.md#route#junk",
        "# Procedure\n\n## Route {#route}\n",
      ).includes("missing anchor"),
      encodedDrive: linkFailure("C%3A/outside.md", "# Procedure\n").includes(
        "escapes its project root",
      ),
      drive: linkFailure("C:/outside.md", "# Procedure\n").includes(
        "escapes its project root",
      ),
      backslashEscape: linkFailure(
        "..\\..\\..\\..\\outside.md",
        "# Procedure\n",
      ).includes("escapes its project root"),
      fileScheme: linkFailure("file:///outside.md", "# Procedure\n").includes(
        "unsupported scheme file",
      ),
      scriptScheme: linkFailure(SCRIPT_ROUTE, "# Procedure\n").includes(
        "unsupported scheme javascript",
      ),
      malformedEncoding: linkFailure("index%ZZ.md", "# Procedure\n").includes(
        "not valid percent-encoded text",
      ),
      emptyAnchor: linkFailure("index.md#", "# Procedure\n") === "accepted",
      repeatedImplicitAnchor:
        linkFailure(
          "index.md#repeat-1",
          "# Procedure\n\n## Repeat!\n\n## Repeat!\n",
        ) === "accepted",
      missingFile: linkFailure("missing.md", "# Procedure\n").includes(
        "missing target",
      ),
      directoryAnchor: linkFailure(
        "../../../docs#missing",
        "# Procedure\n",
      ).includes("anchor targets a directory"),
      extraHeading: messageOf(
        replace(valid, contract, `${router("contract")}\n## Body\n`),
      ).includes("H1-only"),
    },
    {
      fencedAnchor: true,
      commentedAnchor: true,
      extraFragment: true,
      encodedDrive: true,
      drive: true,
      backslashEscape: true,
      fileScheme: true,
      scriptScheme: true,
      malformedEncoding: true,
      emptyAnchor: true,
      repeatedImplicitAnchor: true,
      missingFile: true,
      directoryAnchor: true,
      extraHeading: true,
    },
  );

  const sourceMap = Object.fromEntries(
    valid.map((source) => [source.path, source.content]),
  );
  const first = renderAutoMovieProductionInstructionCandidate({
    evidence: evidence(null),
    sources: {
      ...sourceMap,
      "AGENTS.md": "stale root\n",
      "CLAUDE.md": "stale import\n",
      "unrelated.txt": "preserve outside the candidate\n",
    },
  });
  const synchronized = renderAutoMovieProductionInstructionCandidate({
    evidence: evidence(null),
    sources: sourceMap,
  });
  const candidateFailure = (sources: Record<string, string>): string => {
    try {
      renderAutoMovieProductionInstructionCandidate({
        evidence: evidence(null),
        sources,
      });
      return "accepted";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  TestValidator.equals(
    "creation and synchronization share one pure candidate",
    {
      equal: JSON.stringify(first) === JSON.stringify(synchronized),
      claude: first["CLAUDE.md"] === "@AGENTS.md\n",
      stale: first["AGENTS.md"] !== "stale root\n",
      unrelated: Object.hasOwn(first, "unrelated.txt"),
      duplicate: candidateFailure({
        ...sourceMap,
        ".agents\\skills\\contract\\SKILL.md": router("contract"),
      }).includes("source is duplicated"),
      escape: candidateFailure({
        ...sourceMap,
        "../outside.md": "# Outside\n",
      }).includes("escapes its project root"),
      currentDirectory: candidateFailure({
        ...sourceMap,
        ".": "# Outside\n",
      }).includes("escapes its project root"),
      parentDirectory: candidateFailure({
        ...sourceMap,
        "..": "# Outside\n",
      }).includes("escapes its project root"),
      absolute: candidateFailure({
        ...sourceMap,
        "/outside.md": "# Outside\n",
      }).includes("escapes its project root"),
    },
    {
      equal: true,
      claude: true,
      stale: true,
      unrelated: false,
      duplicate: true,
      escape: true,
      currentDirectory: true,
      parentDirectory: true,
      absolute: true,
    },
  );

  const shapes = {
    film: renderAutoMovieProductionRouter(evidence("film")),
    brief: renderAutoMovieProductionRouter(evidence("brief")),
    library: renderAutoMovieProductionRouter(evidence("library")),
  };
  TestValidator.equals(
    "the generated root names only its selected shape",
    {
      film:
        shapes.film.includes("Production kind `film`") &&
        shapes.film.includes("production-kinds.md#film") &&
        !shapes.film.includes("production-kinds.md#brief") &&
        !shapes.film.includes("production-kinds.md#library"),
      brief:
        shapes.brief.includes("Production kind `brief`") &&
        shapes.brief.includes("production-kinds.md#brief") &&
        !shapes.brief.includes("production-kinds.md#film") &&
        !shapes.brief.includes("production-kinds.md#library"),
      library:
        shapes.library.includes("Production kind `library`") &&
        shapes.library.includes("production-kinds.md#library") &&
        !shapes.library.includes("production-kinds.md#film") &&
        !shapes.library.includes("production-kinds.md#brief"),
    },
    { film: true, brief: true, library: true },
  );

  const rich = renderAutoMovieProductionRouter({
    packageName: "router-production",
    description: "A routed production.",
    manifest: {
      kind: "library",
      language: "english",
      populationScope: { mode: "complete-production" },
      branches: [
        { name: "models", stage: "review" },
        { name: "modelSources", stage: "draft" },
      ],
      bindings: [
        {
          branch: "models",
          stage: "review",
          enforced: true,
          claim: "model checklist",
          relationship: "checklist",
          host: {
            type: "markdown",
            root: "docs",
            files: ["models/**/*.md"],
            symbols: ["h2"],
          },
          target: {
            type: "contract",
            family: "principles",
            domain: "design",
            path: "principles/design/models.md",
            anchors: ["model-form"],
          },
        },
        {
          branch: "modelSources",
          stage: "draft",
          enforced: false,
          claim: "source `lineage`",
          relationship: "lineage",
          host: {
            type: "typescript",
            root: "src",
            files: ["models/**/*.ts"],
            symbols: [],
          },
          target: {
            type: "population",
            root: "docs",
            files: ["models/**/*.md"],
            symbols: ["h2"],
          },
        },
        {
          branch: "models",
          stage: "review",
          enforced: true,
          claim: "whole contract",
          relationship: "foundation",
          host: {
            type: "markdown",
            root: "docs",
            files: ["models/**/*.md"],
            symbols: ["h2"],
          },
          target: {
            type: "contract",
            family: "upstream",
            domain: "design",
            path: "upstream/design/models.md",
            anchors: [],
          },
        },
      ],
    },
    designOwners: [
      {
        branch: "models",
        path: "docs/models/hero file.md",
        title: "Hero [Model]",
        units: [{ anchor: "hero", title: "Hero Unit", digest: "digest-hero" }],
        sourceBinding: null,
      },
      {
        branch: "models",
        path: "docs/models/empty.md",
        title: "Empty Model",
        units: [],
        sourceBinding: {
          branch: "modelSources",
          stage: "draft",
          enforced: false,
          root: "src",
          files: ["models/**/*.ts"],
          symbols: ["type"],
          paths: ["src/models/hero.ts"],
        },
      },
    ],
    contracts: [
      {
        path: "docs/contracts/local file.md",
        title: "Local [Rule]",
        items: [
          { anchor: "local", title: "Local Item", digest: "digest-local" },
        ],
      },
      {
        path: "docs/contracts/empty.md",
        title: "Empty Contract",
        items: [],
      },
    ],
  });
  TestValidator.equals(
    "the root renders exact owners, bindings, and safe Markdown",
    {
      description: rich.includes("A routed production."),
      branches:
        rich.includes("`models` (`review`)") &&
        rich.includes("`modelSources` (`draft`)"),
      owner:
        rich.includes("docs/models/hero%20file.md#hero") &&
        rich.includes("Hero \\[Model\\]") &&
        rich.includes("source authorship has not started") &&
        rich.includes("selects 1 current source file(s)"),
      contract:
        rich.includes("docs/contracts/local%20file.md#local") &&
        rich.includes("has no H2 contract item"),
      bindings:
        rich.includes("contract `principles/design/models.md#model-form`") &&
        rich.includes("contract `upstream/design/models.md`") &&
        rich.includes("population root `docs`") &&
        rich.includes("symbols (none)") &&
        rich.includes("source %60lineage%60"),
    },
    {
      description: true,
      branches: true,
      owner: true,
      contract: true,
      bindings: true,
    },
  );
};
