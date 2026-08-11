import type {
  IAutoMovieDefinedShotContract,
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  findAutoMovieProjectRoot,
} from "@automovie/mcp";

import config from "../automovie.config";
import { chorus } from "../src/formations/chorus";
import { production } from "../src/production";
import {
  answer,
  answerAcceptance,
  opening,
  openingAcceptance,
} from "../src/shots/opening";
import { chorusFar, chorusHero, chorusNear } from "../src/units/chorusHero";
import { soloist } from "../src/units/soloist";
import { plaza } from "../src/world/plaza";
import { productionArchetypes } from "./archetypes";

/**
 * Emit the tracked design records the compiler reads from the typed sources
 * that own them.
 *
 * A design record and its typed source are two representations of one fact, so
 * transcribing the second by hand is how they drift apart. Deriving it also
 * puts the authored surface in TypeScript, where a JSDoc `@evidence` tag can
 * cite the specification the subject answers for; a JSON record has nowhere to
 * carry that citation.
 *
 * This runs outside the compile sandbox on purpose: it performs filesystem I/O,
 * which a shot or film build function must never do.
 *
 * The workspace is located from the working directory the same way `npm run
 * compile` locates it, so running this from a subdirectory reaches the same
 * project rather than failing on a root it happened to be started in.
 */
const project = AutoMovieProductionProject.open(
  findAutoMovieProjectRoot(process.cwd()),
  config.productionId,
  productionArchetypes,
);

/**
 * Store one derived record where the compiler reads it, and say what moved.
 *
 * Which design tree an artifact belongs to is the project's to decide: a model,
 * a world and a formation are shared across productions while a shot contract
 * and an acceptance scenario are not. Computing a path here would restate that
 * layout in a second place and be wrong the moment it changes, so the record
 * goes through the same setter the compiler and the MCP surface use, and is
 * compared against what that setter last stored rather than against a file this
 * script guessed at.
 *
 * An unchanged record is not re-stored. A design mutation deliberately stales
 * every dependent shot and review, so re-committing an identical record would
 * invalidate the production for saying nothing new.
 */
const emit = (
  label: string,
  target: IAutoMovieDesignTarget,
  value: unknown,
  store: () => IAutoMovieDesignMutationOutput,
): void => {
  const current = project.design(target);
  if (current !== null && JSON.stringify(current) === JSON.stringify(value)) {
    process.stdout.write(`unchanged ${label}\n`);
    return;
  }
  const output = store();
  if (output.accepted === false)
    throw new Error(
      `Derived design "${label}" was refused: ${output.diagnostics
        .map((diagnostic) => diagnostic.message)
        .join(" ")}`,
    );
  process.stdout.write(
    `${current === null ? "created" : "updated"} ${label}\n`,
  );
};

// The production is stored before everything that is measured against it. A
// shot duration is only checked against the frame clock once this record
// exists, so emitting it last would accept contracts nothing had measured.
emit("production.json", { kind: "production" }, production, () =>
  project.setProductionDesign(production),
);

const soloistRecipe = soloist.design();
emit(
  "models/soloist.json",
  { kind: "model", id: soloistRecipe.id },
  soloistRecipe,
  () => project.setModelRecipe(soloistRecipe),
);

// The coarse tiers are stored before the recipe whose ladder names them. A
// model recipe is refused while a tier it references has no record, so emitting
// the hero first would fail on a project that has never been compiled.
const chorusNearRecipe = chorusNear.design();
emit(
  "models/chorus-near.json",
  { kind: "model", id: chorusNearRecipe.id },
  chorusNearRecipe,
  () => project.setModelRecipe(chorusNearRecipe),
);

const chorusFarRecipe = chorusFar.design();
emit(
  "models/chorus-far.json",
  { kind: "model", id: chorusFarRecipe.id },
  chorusFarRecipe,
  () => project.setModelRecipe(chorusFarRecipe),
);

const chorusHeroRecipe = chorusHero.design();
emit(
  "models/chorus-hero.json",
  { kind: "model", id: chorusHeroRecipe.id },
  chorusHeroRecipe,
  () => project.setModelRecipe(chorusHeroRecipe),
);

const chorusFormation = chorus.design();
emit(
  "formations/chorus.json",
  { kind: "formation", id: chorusFormation.id },
  chorusFormation,
  () => project.setFormationDesign(chorusFormation),
);

const world = plaza.design();
emit("world.json", { kind: "world" }, world, () =>
  project.setWorldDesign(world),
);

/**
 * Complete one shot registration into the contract record the compiler reads.
 *
 * `IAutoMovieDefinedShotContract` is exactly the tracked contract minus `id`
 * and `source`, so the registration already carries every measured field and
 * only the shot's own address is added here. That is what makes the derivation
 * possible at all: the compiler compares the registered contract against the
 * stored one and refuses the pair when they differ, and two hand-kept copies of
 * the same fields is the drift that refusal keeps reporting.
 *
 * `beat` is named before the rest is spread so the emitted record keeps the
 * contract's own field order, and a re-derived record therefore compares equal
 * to the one already stored instead of staling the production over key
 * positions.
 */
const shotContract = (
  defined: { id: string; contract: IAutoMovieDefinedShotContract },
  source: IAutoMovieShotContract["source"],
): IAutoMovieShotContract => {
  const { beat, ...measured } = defined.contract;
  return { id: defined.id, beat, source, ...measured };
};

// Where a shot is imported from is the one fact its own module cannot state: a
// module does not know the path anything reaches it by, and an export cannot
// read its own name. Both are written at the import that supplies the
// registration, which is the only place that already knows them.
const openingContract = shotContract(opening, {
  module: "src/shots/opening.ts",
  export: "opening",
});
emit(
  "shots/opening.json",
  { kind: "shot", id: openingContract.id },
  openingContract,
  () => project.setShotContract(openingContract),
);

const answerContract = shotContract(answer, {
  module: "src/shots/opening.ts",
  export: "answer",
});
emit(
  "shots/answer.json",
  { kind: "shot", id: answerContract.id },
  answerContract,
  () => project.setShotContract(answerContract),
);

// Scenarios follow the shots they target, because one naming a shot that has no
// record yet is refused rather than held.
for (const scenario of [...openingAcceptance, ...answerAcceptance])
  emit(
    `acceptance/${scenario.id}.json`,
    { kind: "acceptance", id: scenario.id },
    scenario,
    () => project.setAcceptanceScenario(scenario),
  );

// The screenplay index stays hand-authored, and this script deliberately leaves
// it alone.
//
// There is no screenplay design target and no setter for one. The project reads
// the index and nothing stores it, so a script could only place it by writing
// `screenplay/index.json` under a design tree it had located itself, which is
// the path-guessing every record above exists to avoid.
//
// Nor is its content derivable. The compiler already checks the index against
// the documents it indexes: a treatment beat must appear verbatim in its
// sequence document, and a scene's indexed title must match the heading it
// names. An index generated from those same documents would leave that check
// comparing them with themselves, and it would still have to invent the rest,
// because why a scene covers a beat, what a catalog entry binds to, and which
// scenario discharges a continuity claim are stated in no document. Deriving
// prose that only looks right is worse than transcribing prose that is read.
