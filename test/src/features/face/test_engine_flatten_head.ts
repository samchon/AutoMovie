import { flattenHead } from "@autofilm/engine";
import { IAutoFilmHead } from "@autofilm/interface";
import { TestValidator } from "@nestia/e2e";

/**
 * `flattenHead` projects an anatomy-grouped head document onto flat morph
 * weights: present fields map to their morph name, undefined fields and omitted
 * groups are skipped, and the empty document yields the empty record.
 *
 * Scenario: a doc with three groups (some leaves set, some undefined) and four
 * groups omitted exercises both the group-skip and field-skip branches; the
 * empty doc confirms the all-omitted path.
 */
export const test_engine_flatten_head = (): void => {
  const doc: IAutoFilmHead = {
    shape: { width: 0.5, oval: -1 },
    eyes: { size: 1, epicanthus: 0.8, fold: -0.5 },
    jaw: { width: -0.7, chinProjection: -0.3 },
  };
  TestValidator.equals(
    "grouped leaves map to flat morph names",
    flattenHead(doc),
    {
      faceWidth: 0.5,
      faceOval: -1,
      eyeSize: 1,
      epicanthus: 0.8,
      eyeFold: -0.5,
      jawWidth: -0.7,
      chinProject: -0.3,
    },
  );
  TestValidator.equals(
    "empty document yields empty record",
    flattenHead({}),
    {},
  );
};
