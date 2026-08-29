import { AutoMovieProductionProject } from "@automovie/production";
import { TestValidator } from "@nestia/e2e";
import fs from "node:fs";
import path from "node:path";

import {
  formationDesign,
  productionFixture,
} from "../production/productionFixtures";

/**
 * A project inventory follows stored design records through deletion.
 *
 * Scenarios:
 *
 * 1. Storing a formation publishes it through the project inventory and maps
 *    it to an existing project-relative design record.
 * 2. Deleting that exact record removes it from the inventory.
 */
export const test_cli_scaffold_design_residue = (): void => {
  const fixture = productionFixture();
  try {
    const project = AutoMovieProductionProject.open(fixture.root);
    const formation = formationDesign();
    TestValidator.equals(
      "a formation record can be stored into the fixture",
      project.setFormationDesign(formation).accepted,
      true,
    );
    TestValidator.equals(
      "the stored formation appears in the live inventory",
      project.inventory().formations.includes(formation.id),
      true,
    );
    const target = { kind: "formation", id: formation.id } as const;
    const relative = project.designRecordPath(target);
    TestValidator.equals(
      "the inventory entry resolves to its stored record",
      fs.existsSync(path.join(fixture.root, relative)),
      true,
    );
    fs.rmSync(path.join(fixture.root, relative));
    TestValidator.equals(
      "deleting the record removes it from the live inventory",
      project.inventory().formations.includes(formation.id),
      false,
    );
  } finally {
    fixture.dispose();
  }
};
