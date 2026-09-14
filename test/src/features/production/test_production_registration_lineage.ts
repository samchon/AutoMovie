import { TestValidator } from "@nestia/e2e";
import path from "node:path";

import { loadSourceModule } from "../internal/loadSourceModule";
import { throwsError } from "../internal/predicates";

interface IRegistry {
  productions: readonly string[];
  layoutVersion: number;
  retiredLineage: boolean;
}

interface IPlan {
  publish: {
    version: 1;
    layoutVersion: number;
    productions: string[];
  } | null;
  discard: boolean;
  issue: boolean;
}

const { planAutoMovieProductionRegistration: plan } = loadSourceModule<{
  planAutoMovieProductionRegistration: (props: {
    registry: IRegistry | null;
    productionId: string;
    incarnationPresent: boolean;
    mutable: boolean;
  }) => IPlan;
}>(
  path.resolve(
    __dirname,
    "../../../../packages/production/src/production/planAutoMovieProductionRegistration.ts",
  ),
);

const tracked = (
  productions: readonly string[],
  retiredLineage = false,
): IRegistry => ({ productions, layoutVersion: 1, retiredLineage });

/**
 * The tracked registry is portable identity and a production incarnation is
 * one checkout's generation of its local namespace.
 *
 * A new clone inherits the registration and must issue its own incarnation
 * without rewriting the tracked record, while the origin checkout reopens with
 * no write at all. A registration of an id the registry does not name must
 * discard whatever incarnation an ended namespace left and issue a new one, so
 * no registry ever names a production beside a generation from its previous
 * life. Read-only opens never register or issue.
 *
 * Scenarios:
 *
 * 1. New clone: registry `[film]` without a resident incarnation publishes
 *    nothing, discards nothing, and issues; the origin checkout with its
 *    incarnation neither publishes nor issues.
 * 2. Retired inline lineage: the same registry still carrying `incarnations` is
 *    republished once in portable shape and the inline value is never adopted,
 *    while its twin without the member stays untouched.
 * 3. Sibling registration: `[alpha]` plus `Zeta` publishes the union in
 *    code-unit order (`Zeta` before `alpha`, which a locale collation reverses)
 *    and carries the resident layout version.
 * 4. Registration again after deletion: an id the registry no longer names
 *    discards the surviving incarnation and issues a new one, and its twin with
 *    no survivor discards nothing.
 * 5. Fresh project: no registry publishes the lone id at layout version 0 and
 *    issues; a stray incarnation beside no registry is discarded first.
 * 6. Read-only: a registered production with an incarnation plans no write even
 *    when retired lineage remains, a registered production without one is
 *    refused toward a build, and an unregistered id or missing registry is
 *    refused without registering.
 */
export const test_production_registration_lineage = (): void => {
  const mutable = (
    registry: IRegistry | null,
    productionId: string,
    incarnationPresent: boolean,
  ): IPlan =>
    plan({ registry, productionId, incarnationPresent, mutable: true });

  TestValidator.equals(
    "a new clone keeps the tracked registry and issues its own incarnation",
    mutable(tracked(["film"]), "film", false),
    { publish: null, discard: false, issue: true },
  );
  TestValidator.equals(
    "the origin checkout reopens without writing anything",
    mutable(tracked(["film"]), "film", true),
    { publish: null, discard: false, issue: false },
  );

  TestValidator.equals(
    "retired inline lineage is republished once and never adopted",
    mutable(tracked(["trailer", "film"], true), "film", false),
    {
      publish: {
        version: 1,
        layoutVersion: 1,
        productions: ["film", "trailer"],
      },
      discard: false,
      issue: true,
    },
  );
  TestValidator.equals(
    "retired lineage alongside a resident incarnation keeps that incarnation",
    mutable(tracked(["film"], true), "film", true),
    {
      publish: { version: 1, layoutVersion: 1, productions: ["film"] },
      discard: false,
      issue: false,
    },
  );

  TestValidator.equals(
    "a sibling registration publishes the code-unit ordered union",
    mutable(
      { productions: ["alpha"], layoutVersion: 1, retiredLineage: false },
      "Zeta",
      false,
    ),
    {
      publish: { version: 1, layoutVersion: 1, productions: ["Zeta", "alpha"] },
      discard: false,
      issue: true,
    },
  );

  TestValidator.equals(
    "registering an id again discards the ended namespace's incarnation",
    mutable(tracked(["trailer"]), "film", true),
    {
      publish: {
        version: 1,
        layoutVersion: 1,
        productions: ["film", "trailer"],
      },
      discard: true,
      issue: true,
    },
  );
  TestValidator.equals(
    "an empty registry registering an id with no survivor discards nothing",
    mutable(tracked([]), "film", false),
    {
      publish: { version: 1, layoutVersion: 1, productions: ["film"] },
      discard: false,
      issue: true,
    },
  );

  TestValidator.equals(
    "a fresh project publishes its first registration at layout zero",
    mutable(null, "film", false),
    {
      publish: { version: 1, layoutVersion: 0, productions: ["film"] },
      discard: false,
      issue: true,
    },
  );
  TestValidator.equals(
    "a stray incarnation beside no registry is discarded first",
    mutable(null, "film", true),
    {
      publish: { version: 1, layoutVersion: 0, productions: ["film"] },
      discard: true,
      issue: true,
    },
  );

  const readOnly = (
    registry: IRegistry | null,
    productionId: string,
    incarnationPresent: boolean,
  ): IPlan =>
    plan({ registry, productionId, incarnationPresent, mutable: false });
  TestValidator.equals(
    "read-only reuses the resident incarnation and never republishes",
    readOnly(tracked(["film"], true), "film", true),
    { publish: null, discard: false, issue: false },
  );
  TestValidator.predicate(
    "read-only refuses a clone that holds no incarnation yet",
    throwsError(
      () => readOnly(tracked(["film"]), "film", false),
      ['"film"', "incarnation", "npm run build"],
    ),
  );
  TestValidator.predicate(
    "read-only refuses an id the registry does not name",
    throwsError(
      () => readOnly(tracked(["trailer"]), "film", true),
      ['missing production "film"', "npm run build"],
    ),
  );
  TestValidator.predicate(
    "read-only refuses when no registry exists",
    throwsError(
      () => readOnly(null, "film", true),
      ['missing production "film"'],
    ),
  );
};
