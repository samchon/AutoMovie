import { TestValidator } from "@nestia/e2e";

import {
  portraitEyeShape,
  portraitEyeSockets,
} from "../../subjects/generated-korean-girl-01/configuration";
import { referenceControlNet } from "../../subjects/generated-korean-girl-01/controlNet";
import {
  type IPortraitEyeShape,
  appendPortraitEyeMargins,
  createPortraitEyeComponent,
} from "../../subjects/generated-korean-girl-01/eyes";
import { buildPortraitHead } from "../../subjects/generated-korean-girl-01/head";
import type { IPortraitLowerLidProfile } from "../../subjects/generated-korean-girl-01/lowerLidSection";
import { nclose, throwsError } from "../internal/predicates";

/**
 * Lower tissue detail reaches the actual shared eyelid and surrounding skin.
 * It changes its own section while retaining the aperture and upper controls.
 *
 * Scenarios:
 * 1. Both anatomical sides admit independently authored profiles and change
 *    lower rows, while original upper controls and remote chin remain fixed.
 * 2. Canthi and the inner aperture are fixed in standalone shared attachment;
 *    the separate handedness scenario verifies medial-to-lateral orientation.
 * 3. Standalone attachment resolves the same optional profile. Component input
 *    mutation cannot alter its owned detail; an empty supplied profile refuses.
 */
export const test_subject_lower_lid_component = (): void => {
  const point = (offset: number, projection: number) => ({
    offset,
    projection,
  });
  const profile: IPortraitLowerLidProfile = {
    sections: [0, 1].map((at) => ({
      at,
      section: {
        margin: point(0.25, 0.2),
        pretarsalCrest: point(1.8, 0.6 + at),
        pretarsalLower: point(3.3, 0.3),
        subtarsalInner: point(4, -0.1),
        subtarsalOuter: point(4.5, -0.1),
        preseptal: point(6, 0),
        attachment: 8,
      },
    })),
  };
  const shape: IPortraitEyeShape = {
    ...portraitEyeShape,
    aegyoSal: undefined,
    lowerLidProfile: undefined,
    lidContact: undefined,
    browFibres: 0,
    upperLashes: 1,
    sampling: { eyeColumns: 8, eyeRows: 4, irisColumns: 12, irisRows: 3 },
  };
  const host = { ...referenceControlNet };
  for (const socket of portraitEyeSockets) {
    const make = (s: IPortraitEyeShape) =>
      buildPortraitHead(host, [createPortraitEyeComponent(socket, s)], 1);
    const basic = make(shape),
      component = createPortraitEyeComponent(socket, {
        ...shape,
        lowerLidProfile: profile,
      });
    const detailed = buildPortraitHead(host, [component], 1);
    TestValidator.predicate(
      "detail changes lower skin",
      socket.bottom
        .slice(1, -1)
        .some(
          (id) =>
            !nclose(
              basic.refined.positions[id][1],
              detailed.refined.positions[id][1],
            ),
        ),
    );
    TestValidator.equals(
      "remote chin fixed",
      detailed.refined.positions[152],
      basic.refined.positions[152],
    );
    for (const id of socket.top)
      TestValidator.equals(
        "upper fitting targets fixed",
        detailed.source[id],
        basic.source[id],
      );
    const attach = (s: IPortraitEyeShape) => {
      const cage = {
        positions: referenceControlNet.positions.map((p) => [...p]),
        indices: [] as number[],
        groups: [] as number[],
      };
      const margin = appendPortraitEyeMargins(
        cage,
        referenceControlNet.positions,
        socket,
        s,
      );
      return { cage, margin };
    };
    const plain = attach(shape),
      detail = attach({ ...shape, lowerLidProfile: profile });
    for (const id of [...socket.top, ...socket.bottom])
      TestValidator.equals(
        "inner aperture retained",
        detail.cage.positions[detail.margin.get(id)!],
        plain.cage.positions[plain.margin.get(id)!],
      );
    TestValidator.predicate(
      "standalone detail reaches rows",
      detail.cage.positions.some((p, i) =>
        p.some((v, axis) => !nclose(v, plain.cage.positions[i][axis])),
      ),
    );
    const remembered = JSON.stringify(detailed.refined);
    const first = profile.sections[0].section.pretarsalCrest.projection;
    profile.sections[0].section.pretarsalCrest.projection = 100;
    TestValidator.equals(
      "component owns detail",
      JSON.stringify(buildPortraitHead(host, [component], 1).refined),
      remembered,
    );
    profile.sections[0].section.pretarsalCrest.projection = first;
  }
  TestValidator.predicate(
    "invalid supplied profile refuses",
    throwsError(() =>
      createPortraitEyeComponent(portraitEyeSockets[0], {
        ...shape,
        lowerLidProfile: { sections: [] },
      }),
    ),
  );
};
