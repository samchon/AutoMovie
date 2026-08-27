import {
  AutoMovieProductionCompiler,
  AutoMovieProductionProject,
} from "@automovie/production";

import config from "../automovie.config";

/**
 * The scope this lint runs at, `review` unless `--scope <name>` says otherwise.
 *
 * `review` is the right default: it is the gate a finished production must
 * pass, and answering "is this film deliverable" is what `npm run lint` is for.
 * It is the wrong question for most of a production's life, though. A film
 * being built sequence by sequence has, by construction, shots whose reviews
 * are not complete, so a review-scope lint fails on the incomplete queue and
 * says nothing about whether the work so far is structurally sound. Without a
 * choice here the only in-progress check left is `lint:source`, which is a
 * TypeScript pass and runs none of the `automovie` rules.
 *
 * A scope selects which gates run; it is not a filter over the `phase` field a
 * diagnostic carries. `phase` names the pipeline stage that owns the
 * correction, so a consumed model asset is reported at the `source` phase
 * because a source import is what the author must stop, and that label says
 * nothing about which scope raised it. Measured on a freshly generated
 * project: `review` scope reports `review-evidence-missing` for the shot and
 * for each consumed model, and `source` scope reports neither, because the
 * evidence gate runs only at `review` and `final`.
 */
const scope = ((): "design" | "source" | "review" | "final" => {
  const index = process.argv.indexOf("--scope");
  if (index === -1) return "review";
  const requested = process.argv[index + 1];
  if (
    requested === "design" ||
    requested === "source" ||
    requested === "review" ||
    requested === "final"
  )
    return requested;
  process.stderr.write(
    `Unknown lint scope ${JSON.stringify(requested ?? "")}. Use design, source, review, or final.\n`,
  );
  process.exit(1);
})();

const project = AutoMovieProductionProject.open(
  process.cwd(),
  config.productionId,
);
const output = new AutoMovieProductionCompiler(project).lint({ scope });
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
if (output.success === false) process.exitCode = 1;
