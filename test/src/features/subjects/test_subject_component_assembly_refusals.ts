import { TestValidator } from "@nestia/e2e";

import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import type {
  IPortraitComponent,
  IPortraitComponentPlan,
} from "../../subjects/portraitComponents";
import { throwsError } from "../internal/predicates";

/**
 * A replaceable part may supply geometry, but cannot silently erase another
 * part's cut or emit skin with a material group the host will drop.
 *
 * Scenarios:
 * 1. A component with no cut or displacement can register an unused region and
 *    finish normally. An empty component list also remains a valid substrate.
 * 2. Invalid refinement levels, duplicate component IDs, overlapping cuts and
 *    nonresident triangle ordinals are refused at their owning boundary.
 * 3. Repeated region IDs and unregistered material groups are refused before
 *    subdivision and region extraction could hide the malformed skin.
 */
export const test_subject_component_assembly_refusals = (): void => {
  const host = {
    positions: referenceControlNet.positions,
    indices: referenceControlNet.indices,
    viewRay: referenceControlNet.viewRay,
  };
  const plan: IPortraitComponentPlan = {
    constraints: [],
    cutFaces: [],
    attach: () => ({ openings: [], finish: () => [] }),
  };
  const part: IPortraitComponent = { id: "test-part", fit: () => plan };
  buildPortraitHead(host, [], 0);
  buildPortraitHead(
    host,
    [
      {
        ...part,
        fit: () => ({
          ...plan,
          attach: (_cage, _source, region) => {
            region("unused-preview-region", "skin");
            return { openings: [], finish: () => [] };
          },
        }),
      },
    ],
    0,
  );
  for (const rounds of [-1, 0.5, 5, NaN])
    TestValidator.predicate(
      "invalid refinement refused",
      throwsError(() => buildPortraitHead(host, [], rounds)),
    );
  TestValidator.predicate(
    "duplicate component identity",
    throwsError(() => buildPortraitHead(host, [part, part], 0)),
  );
  const cut = {
    ...part,
    fit: () => ({
      ...plan,
      cutFaces: [0],
      attach: () => ({
        openings: [host.indices.slice(0, 3)],
        finish: () => [],
      }),
    }),
  };
  buildPortraitHead(host, [cut], 0);
  TestValidator.predicate(
    "overlapping component cuts",
    throwsError(() =>
      buildPortraitHead(host, [cut, { ...cut, id: "other" }], 0),
    ),
  );
  for (const triangle of [-1, 0.5, host.indices.length / 3])
    TestValidator.predicate(
      "nonresident cut refused",
      throwsError(() =>
        buildPortraitHead(
          host,
          [{ ...part, fit: () => ({ ...plan, cutFaces: [triangle] }) }],
          0,
        ),
      ),
    );
  TestValidator.predicate(
    "duplicate material region",
    throwsError(() =>
      buildPortraitHead(
        host,
        [
          {
            ...part,
            fit: () => ({
              ...plan,
              attach: (_cage, _source, region) => {
                region("repeat", "skin");
                region("repeat", "skin");
                return { openings: [], finish: () => [] };
              },
            }),
          },
        ],
        0,
      ),
    ),
  );
  TestValidator.predicate(
    "unregistered region refused",
    throwsError(() =>
      buildPortraitHead(
        host,
        [
          {
            ...part,
            fit: () => ({
              ...plan,
              attach: (cage) => {
                cage.groups[0] = 999;
                return { openings: [], finish: () => [] };
              },
            }),
          },
        ],
        0,
      ),
    ),
  );
  TestValidator.predicate(
    "missing triangle region refused",
    throwsError(() =>
      buildPortraitHead(
        host,
        [
          {
            ...part,
            fit: () => ({
              ...plan,
              attach: (cage) => {
                cage.groups.pop();
                return { openings: [], finish: () => [] };
              },
            }),
          },
        ],
        0,
      ),
    ),
  );
  TestValidator.predicate(
    "undeclared cut refused",
    throwsError(() =>
      buildPortraitHead(
        host,
        [{ ...part, fit: () => ({ ...plan, cutFaces: [0] }) }],
        0,
      ),
    ),
  );
};
