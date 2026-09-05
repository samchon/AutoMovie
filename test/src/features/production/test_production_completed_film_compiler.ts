import type {
  IAutoMovieDefinedShotContract,
  IAutoMovieDesignTarget,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
  canonicalizeAutoMovieJson,
  readAutoMovieFilmEffects,
} from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { namedFacts } from "../internal/predicates";
import { completedProductionFixture } from "./productionFixtures";

type DesignOwner = { id: string; design: () => unknown };
const { chorus } = loadSourceModule<{ chorus: DesignOwner }>(
  path.resolve(
    __dirname,
    "../../../fixtures/completed-film/src/formations/chorus.ts",
  ),
);
const { production } = loadSourceModule<{ production: { id: string } }>(
  path.resolve(__dirname, "../../../fixtures/completed-film/src/production.ts"),
);
const { answer, answerAcceptance, opening, openingAcceptance } =
  loadSourceModule<{
    answer: { id: string; contract: IAutoMovieDefinedShotContract };
    answerAcceptance: Array<{ id: string }>;
    opening: { id: string; contract: IAutoMovieDefinedShotContract };
    openingAcceptance: Array<{ id: string }>;
  }>(
    path.resolve(
      __dirname,
      "../../../fixtures/completed-film/src/shots/opening.ts",
    ),
  );
const { chorusFar, chorusHero, chorusNear } = loadSourceModule<{
  chorusFar: DesignOwner;
  chorusHero: DesignOwner;
  chorusNear: DesignOwner;
}>(
  path.resolve(
    __dirname,
    "../../../fixtures/completed-film/src/units/chorusHero.ts",
  ),
);
const { soloist } = loadSourceModule<{ soloist: DesignOwner }>(
  path.resolve(
    __dirname,
    "../../../fixtures/completed-film/src/units/soloist.ts",
  ),
);
const { plaza } = loadSourceModule<{ plaza: { design: () => unknown } }>(
  path.resolve(
    __dirname,
    "../../../fixtures/completed-film/src/world/plaza.ts",
  ),
);

interface DerivedDesignRecord {
  target: IAutoMovieDesignTarget;
  value: unknown;
}

const shotContract = (
  defined: { id: string; contract: IAutoMovieDefinedShotContract },
  exportName: "answer" | "opening",
): IAutoMovieShotContract => {
  const { beat, ...measured } = defined.contract;
  return {
    id: defined.id,
    beat,
    source: { module: "src/shots/opening.ts", export: exportName },
    ...measured,
  };
};

/** Execute every design-producing source owner represented by the fixture. */
const deriveCompletedFilmDesign = (): DerivedDesignRecord[] => {
  const namedProduction = {
    ...production,
    id: "fixture-film",
    title: "fixture-film",
  };
  const records: DerivedDesignRecord[] = [
    { target: { kind: "production" }, value: namedProduction },
    { target: { kind: "world" }, value: plaza.design() },
    { target: { kind: "model", id: soloist.id }, value: soloist.design() },
    {
      target: { kind: "model", id: chorusNear.id },
      value: chorusNear.design(),
    },
    { target: { kind: "model", id: chorusFar.id }, value: chorusFar.design() },
    {
      target: { kind: "model", id: chorusHero.id },
      value: chorusHero.design(),
    },
    { target: { kind: "formation", id: chorus.id }, value: chorus.design() },
    {
      target: { kind: "shot", id: opening.id },
      value: shotContract(opening, "opening"),
    },
    {
      target: { kind: "shot", id: answer.id },
      value: shotContract(answer, "answer"),
    },
    ...[...openingAcceptance, ...answerAcceptance].map((value) => ({
      target: { kind: "acceptance" as const, id: value.id },
      value,
    })),
  ];
  return records;
};

/**
 * The repository's completed film is one coherent authored compiler input.
 *
 * This scenario executes the design owners in-process, compares every result
 * with the checked-in design record, then sends the same complete project and
 * graph-derived evidence object through the public production compiler. A
 * stale JSON record therefore fails before compilation, while a stale or
 * missing source-owner binding is refused by the compiler itself.
 */
export const test_production_completed_film_compiler = (): void => {
  const fixture = completedProductionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const derived = deriveCompletedFilmDesign();
    const mismatches = derived.filter(({ target, value }) => {
      const checked = project.design(target);
      return (
        canonicalizeAutoMovieJson(checked) !== canonicalizeAutoMovieJson(value)
      );
    });
    const output = new AutoMovieProductionCompiler(
      project,
      fixture.evidence,
      () => fixture.evidence,
    ).compile({ scope: "source" });
    const compiled = AutoMovieProductionProject.open(fixture.root);
    const effects = readAutoMovieFilmEffects(
      compiled,
      compiled.generatedManifest()!.inputFingerprint,
    );

    const authored = fs.readFileSync(
      path.join(fixture.root, "src/shots/opening.ts"),
      "utf8",
    );
    fs.writeFileSync(
      path.join(fixture.root, "src/shots/opening.ts"),
      `${authored}\nexport const staleCompletedFilmCanary = true;\n`,
      "utf8",
    );
    const stale = new AutoMovieProductionCompiler(
      AutoMovieProductionProject.open(fixture.root),
      fixture.evidence,
    ).lint({ scope: "source" });

    TestValidator.equals(
      "completed film stays derived and compiles through its public boundary",
      namedFacts([
        ["all checked design is source-derived", () => mismatches.length === 0],
        ["the complete source compile succeeds", () => output.success],
        [
          "the compiler materializes real output",
          () => output.materialized.length > 0,
        ],
        [
          "the compiled film effects reopen from the generated manifest",
          () => Array.isArray(effects),
        ],
        [
          "a stale authored source is refused",
          () =>
            stale.success === false &&
            stale.diagnostics.some(
              (diagnostic) => diagnostic.code === "source-owner-mismatch",
            ),
        ],
      ]),
      {
        "all checked design is source-derived": true,
        "the complete source compile succeeds": true,
        "the compiler materializes real output": true,
        "the compiled film effects reopen from the generated manifest": true,
        "a stale authored source is refused": true,
      },
    );
  } finally {
    fixture.dispose();
  }
};
