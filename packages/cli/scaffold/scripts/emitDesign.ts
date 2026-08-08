import type {
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
} from "@automovie/interface";
import { AutoMovieProductionProject } from "@automovie/mcp";

import config from "../automovie.config";
import { army } from "../src/formations/army";
import { armyHero } from "../src/units/armyHero";
import { sentinel } from "../src/units/sentinel";
import { signalField } from "../src/world/signalField";

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
 */
const project = AutoMovieProductionProject.open(
  process.cwd(),
  config.productionId,
);

/**
 * Store one derived record where the compiler reads it, and say what moved.
 *
 * Which design tree an artifact belongs to is the project's to decide: a model,
 * a world and a formation are shared across productions while a shot contract
 * is not. Computing a path here would restate that layout in a second place and
 * be wrong the moment it changes, so the record goes through the same setter
 * the compiler and the MCP surface use, and is compared against what that
 * setter last stored rather than against a file this script guessed at.
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

const sentinelRecipe = sentinel.design();
emit(
  "models/sentinel.json",
  { kind: "model", id: sentinelRecipe.id },
  sentinelRecipe,
  () => project.setModelRecipe(sentinelRecipe),
);

const armyHeroRecipe = armyHero.design();
emit(
  "models/army-hero.json",
  { kind: "model", id: armyHeroRecipe.id },
  armyHeroRecipe,
  () => project.setModelRecipe(armyHeroRecipe),
);

const armyFormation = army.design();
emit(
  "formations/army.json",
  { kind: "formation", id: armyFormation.id },
  armyFormation,
  () => project.setFormationDesign(armyFormation),
);

const world = signalField.design();
emit("world.json", { kind: "world" }, world, () =>
  project.setWorldDesign(world),
);
