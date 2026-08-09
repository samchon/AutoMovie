import type {
  IAutoMovieDesignMutationOutput,
  IAutoMovieDesignTarget,
} from "@automovie/interface";
import {
  AutoMovieProductionProject,
  findAutoMovieProjectRoot,
} from "@automovie/mcp";

import config from "../automovie.config";
import { chorus } from "../src/formations/chorus";
import { chorusHero } from "../src/units/chorusHero";
import { soloist } from "../src/units/soloist";
import { plaza } from "../src/world/plaza";

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

const soloistRecipe = soloist.design();
emit(
  "models/soloist.json",
  { kind: "model", id: soloistRecipe.id },
  soloistRecipe,
  () => project.setModelRecipe(soloistRecipe),
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
