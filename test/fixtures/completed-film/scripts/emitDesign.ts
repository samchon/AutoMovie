import {
  AUTOMOVIE_PRIMITIVE_ARCHETYPES,
  createAutoMovieArchetypeRegistry,
} from "@automovie/archetypes";
import type {
  IAutoMovieDefinedShotContract,
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
  IAutoMovieShotContract,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  compareCodeUnits,
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

/** Repository-only emitter that keeps the completed regression film derivable. */
const project = AutoMovieProductionProject.open(
  findAutoMovieProjectRoot(process.cwd()),
  config.productionId,
  createAutoMovieArchetypeRegistry(AUTOMOVIE_PRIMITIVE_ARCHETYPES),
);

const address = (target: IAutoMovieDesignTarget): string =>
  target.kind === "production" || target.kind === "world"
    ? target.kind
    : `${target.kind} "${target.id}"`;

const derived = new Set<string>();
const emit = (
  label: string,
  target: IAutoMovieDesignTarget,
  value: unknown,
  store: () => IAutoMovieDesignMutationOutput,
): void => {
  derived.add(address(target));
  const current = project.design(target);
  if (current !== null && JSON.stringify(current) === JSON.stringify(value)) {
    process.stdout.write(`unchanged ${label}\n`);
    return;
  }
  const output = store();
  if (output.accepted === false)
    throw new Error(
      `Derived design "${label}" was refused: ${output.diagnostics.map((diagnostic) => diagnostic.message).join(" ")}`,
    );
  process.stdout.write(
    `${current === null ? "created" : "updated"} ${label}\n`,
  );
};

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

const shotContract = (
  defined: { id: string; contract: IAutoMovieDefinedShotContract },
  source: IAutoMovieShotContract["source"],
): IAutoMovieShotContract => {
  const { beat, ...measured } = defined.contract;
  return { id: defined.id, beat, source, ...measured };
};

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

for (const scenario of [...openingAcceptance, ...answerAcceptance])
  emit(
    `acceptance/${scenario.id}.json`,
    { kind: "acceptance", id: scenario.id },
    scenario,
    () => project.setAcceptanceScenario(scenario),
  );

const inventory = project.inventory();
const resident: IAutoMovieDesignTarget[] = [
  ...(inventory.production ? [{ kind: "production" } as const] : []),
  ...(inventory.world ? [{ kind: "world" } as const] : []),
  ...inventory.models.map((id) => ({ kind: "model", id }) as const),
  ...inventory.formations.map((id) => ({ kind: "formation", id }) as const),
  ...inventory.shots.map((id) => ({ kind: "shot", id }) as const),
  ...inventory.acceptance.map((id) => ({ kind: "acceptance", id }) as const),
];
const orphaned = resident
  .filter((target) => derived.has(address(target)) === false)
  .map(
    (target) => `  ${project.designRecordPath(target)}  (${address(target)})`,
  )
  .sort(compareCodeUnits);
if (orphaned.length !== 0)
  throw new Error(
    [
      `${orphaned.length} resident design record(s) are derived by no fixture source:`,
      ...orphaned,
    ].join("\n"),
  );
