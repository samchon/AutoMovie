import {
  autoMovieContractTargetSources,
  parseAutoMovieContractBaseline,
  planAutoMovieContractMigration,
  planAutoMovieContractMigrationPublication,
  planAutoMovieDeliveryTocPublication,
  planAutoMovieProjectDeliveryTocs,
  renderAutoMovieContractBaseline,
} from "@automovie/template";
import { TestValidator } from "@nestia/e2e";

/**
 * Contract baselines and delivery indexes close their complete pure project
 * inventory before a CLI performs any filesystem mutation.
 */
export const test_cli_scaffold_contract_maintenance = (): void => {
  const refuses = (closure: () => unknown): boolean => {
    try {
      closure();
      return false;
    } catch {
      return true;
    }
  };
  const sources = autoMovieContractTargetSources({
    "docs/contracts/local.md": "# Local\n",
    "docs/discovery/core/common.md": "# Discovery\n",
    "docs/language/principles/common.md": "# Language\n",
    "docs/obligations/core/common.md": "# Obligation\n",
    "docs/principles/core/common.md": "# Principle\n",
    "docs/upstream/story/scripts.md": "# Upstream\n",
  });
  const baseline = JSON.parse(
    renderAutoMovieContractBaseline({
      files: sources,
      language: "english",
      version: "0.2.0",
    }),
  ) as {
    files: readonly { path: string }[];
    language: string;
    version: string;
  };
  TestValidator.equals(
    "the baseline owns every shared and selected language contract but no local rule",
    {
      language: baseline.language,
      paths: baseline.files.map((file) => file.path),
      version: baseline.version,
    },
    {
      language: "english",
      paths: [
        "docs/discovery/core/common.md",
        "docs/language/principles/common.md",
        "docs/obligations/core/common.md",
        "docs/principles/core/common.md",
        "docs/upstream/story/scripts.md",
      ],
      version: "0.2.0",
    },
  );

  const previousSources = {
    "docs/discovery/core/common.md": "# Discovery\n\n## Rule {#rule}\n\nOld.\n",
  };
  const nextSources = {
    "docs/discovery/core/common.md": "# Discovery\n\n## Rule {#rule}\n\nNew.\n",
  };
  const previousBaseline = parseAutoMovieContractBaseline(
    renderAutoMovieContractBaseline({
      files: previousSources,
      language: "english",
      version: "0.1.0",
    }),
  );
  const nextBaseline = parseAutoMovieContractBaseline(
    renderAutoMovieContractBaseline({
      files: nextSources,
      language: "english",
      version: "0.2.0",
    }),
  );
  const migration = planAutoMovieContractMigration({
    current: previousSources,
    from: previousBaseline,
    targetSources: nextSources,
    to: nextBaseline,
  });
  const publication = planAutoMovieContractMigrationPublication({
    current: previousSources,
    observed: previousSources,
    plan: migration,
  });
  TestValidator.equals(
    "migration publication closes target bytes before mutation",
    { removals: publication.removals, writes: { ...publication.writes } },
    { removals: [], writes: nextSources },
  );
  TestValidator.predicate(
    "migration publication refuses a source edited after planning",
    refuses(() =>
      planAutoMovieContractMigrationPublication({
        current: previousSources,
        observed: {
          "docs/discovery/core/common.md": "concurrent authored edit",
        },
        plan: migration,
      }),
    ),
  );
  const renamedSource = {
    "docs/discovery/core/old.md": "# Contract\n\n## Rule {#rule}\n",
  };
  const renamedTarget = {
    "docs/discovery/core/new.md": renamedSource["docs/discovery/core/old.md"],
  };
  const renamePlan = planAutoMovieContractMigration({
    current: renamedSource,
    from: parseAutoMovieContractBaseline(
      renderAutoMovieContractBaseline({
        files: renamedSource,
        language: "english",
        version: "0.1.0",
      }),
    ),
    targetSources: renamedTarget,
    to: parseAutoMovieContractBaseline(
      renderAutoMovieContractBaseline({
        files: renamedTarget,
        language: "english",
        version: "0.2.0",
      }),
    ),
  });
  const renamePublication = planAutoMovieContractMigrationPublication({
    current: renamedSource,
    observed: renamedSource,
    plan: renamePlan,
  });
  TestValidator.equals(
    "rename publication writes its target before retiring the exact source",
    {
      removals: renamePublication.removals,
      writes: { ...renamePublication.writes },
    },
    {
      removals: [
        {
          after: renamedTarget["docs/discovery/core/new.md"],
          before: renamedSource["docs/discovery/core/old.md"],
          path: "docs/discovery/core/old.md",
          target: "docs/discovery/core/new.md",
        },
      ],
      writes: renamedTarget,
    },
  );
  const occupiedRename = { ...renamedSource, ...renamedTarget };
  const recoveredRename = planAutoMovieContractMigrationPublication({
    current: occupiedRename,
    observed: occupiedRename,
    plan: planAutoMovieContractMigration({
      current: occupiedRename,
      from: parseAutoMovieContractBaseline(
        renderAutoMovieContractBaseline({
          files: renamedSource,
          language: "english",
          version: "0.1.0",
        }),
      ),
      targetSources: renamedTarget,
      to: parseAutoMovieContractBaseline(
        renderAutoMovieContractBaseline({
          files: renamedTarget,
          language: "english",
          version: "0.2.0",
        }),
      ),
    }),
  });
  TestValidator.equals(
    "an already published rename target is adopted without rewriting it",
    {
      removals: recoveredRename.removals.length,
      writes: Object.keys(recoveredRename.writes),
    },
    { removals: 1, writes: [] },
  );

  const validFiles = {
    "docs/scripts/001-act/index.md": "# Act\n",
    "docs/scripts/001-act/001-opening.md": "# Opening\n",
    "docs/screenplays/001-act/index.md": "# Act\n",
    "docs/screenplays/001-act/001-opening.md": "# Opening\n",
  };
  const generated = planAutoMovieProjectDeliveryTocs({ files: validFiles });
  const checked = planAutoMovieProjectDeliveryTocs({
    check: true,
    files: generated.files,
  });
  TestValidator.equals(
    "generation and check share one canonical project rendering",
    {
      diagnostics: checked.diagnostics,
      script: checked.files["docs/scripts/001-act/index.md"],
      screenplay: checked.files["docs/screenplays/001-act/index.md"],
    },
    {
      diagnostics: [],
      script: generated.files["docs/scripts/001-act/index.md"],
      screenplay: generated.files["docs/screenplays/001-act/index.md"],
    },
  );
  const tocWrites = planAutoMovieDeliveryTocPublication({
    current: validFiles,
    observed: validFiles,
    planned: generated.files,
  });
  TestValidator.equals(
    "TOC publication contains only the complete stale index candidate",
    Object.keys(tocWrites),
    ["docs/scripts/001-act/index.md", "docs/screenplays/001-act/index.md"],
  );
  TestValidator.predicate(
    "TOC publication refuses an index edited after planning",
    refuses(() =>
      planAutoMovieDeliveryTocPublication({
        current: validFiles,
        observed: {
          ...validFiles,
          "docs/scripts/001-act/index.md": "# Concurrent\n",
        },
        planned: generated.files,
      }),
    ),
  );
  TestValidator.predicate(
    "TOC publication refuses a non-index target from an invalid planner",
    refuses(() =>
      planAutoMovieDeliveryTocPublication({
        current: { "docs/scripts/001-act/001-unit.md": "old" },
        observed: { "docs/scripts/001-act/001-unit.md": "old" },
        planned: { "docs/scripts/001-act/001-unit.md": "new" },
      }),
    ),
  );

  const invalid = planAutoMovieProjectDeliveryTocs({
    check: true,
    files: {
      "docs/scripts/001-missing/001-unit.md": "# Unit\n",
      "docs/scripts/002-empty/index.md": "# Empty\n",
      "docs/screenplays/not-numbered/index.md": "# Invalid\n",
    },
  });
  TestValidator.predicate(
    "missing, empty, and malformed delivery groups are refused before writing",
    invalid.diagnostics.length === 3 &&
      invalid.diagnostics.some((message) => message.includes("is missing")) &&
      invalid.diagnostics.some((message) => message.includes("no numbered")) &&
      invalid.diagnostics.some((message) => message.includes("not a valid")),
  );
  const mismatched = planAutoMovieProjectDeliveryTocs({
    check: true,
    files: {
      "docs/scripts/001-act/index.md": "# Act\n",
      "docs/scripts/001-act/001-opening.md": "# Opening\n",
      "docs/screenplays/001-act/index.md": "# Act\n",
      "docs/screenplays/001-act/002-renamed.md": "# Opening\n",
    },
  });
  TestValidator.predicate(
    "script and screenplay delivery inventories must remain mirrored",
    mismatched.diagnostics.some((message) => message.includes("differs")),
  );
};
