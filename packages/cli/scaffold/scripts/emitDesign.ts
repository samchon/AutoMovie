import fs from "node:fs";
import path from "node:path";

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
const designRoot = path.resolve(
  process.cwd(),
  ".automovie",
  "design",
  config.productionId,
);

const emit = (relative: string, value: unknown): void => {
  const file = path.join(designRoot, ...relative.split("/"));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const rendered = `${JSON.stringify(value, null, 2)}\n`;
  const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
  if (current === rendered) {
    process.stdout.write(`unchanged ${relative}\n`);
    return;
  }
  fs.writeFileSync(file, rendered, "utf8");
  process.stdout.write(
    `${current === null ? "created" : "updated"} ${relative}\n`,
  );
};

emit("models/sentinel.json", sentinel.design());
emit("models/army-hero.json", armyHero());
emit("formations/army.json", army());
emit("world.json", signalField());
