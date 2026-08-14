import { resolveAutoMovieSubjectReviewUnit } from "@automovie/engine";
import {
  IAutoMovieSubjectDescription,
  IAutoMovieSubjectReviewUnit,
} from "@automovie/interface";
import { TestValidator } from "@nestia/e2e";

import { throwsError } from "../internal/predicates";
import {
  subjectInspectionArtifact,
  subjectInspectionInstanceSet,
} from "../internal/subjectInspectionFixtures";

/**
 * Subject review resolves the compiled subject identity instead of rebuilding
 * a parallel element, part, prototype, instance, or space index.
 *
 * Structural subjects are the population this case owns. Subject review also
 * admits the separately compiled formation record, which is not a structural
 * description and carries no prototype, placement, or owner link, so the
 * projection filters that role out instead of asserting fields it never has.
 *
 * Scenarios:
 *
 * 1. Prototype, placed part, compact instance, and space targets retain the
 *    exact description identity, revision, role, and composition links exposed
 *    by compiled-subject inspection.
 * 2. Every resolved unit assigns viewpoint authority to inspection and is
 *    structurally ineligible as delivery evidence.
 * 3. A missing subject fails through the shared compiled-subject resolver
 *    rather than producing an empty review unit.
 */
export const test_inspection_subject_review_identity = (): void => {
  const artifact = subjectInspectionArtifact({
    instanceSets: [
      subjectInspectionInstanceSet({
        id: "banner-field",
        model: "solar-oriel-model",
        count: 2,
      }),
    ],
  });
  const ids = [
    "prototype:guard-rack-west-pole-0-model",
    "element-part:castle/guard-rack-west-pole-0/body",
    "instance:banner-field:slot:000001",
    "space:castle/hall",
  ];
  const units = ids
    .map((subject) =>
      resolveAutoMovieSubjectReviewUnit(artifact, {
        shot: "inspection-shot",
        subject,
      }),
    )
    .filter(isStructuralSubjectReviewUnit);
  TestValidator.equals(
    "review units preserve the shared compiled-subject identities",
    units.map((unit) => ({
      version: unit.version,
      target: unit.target,
      revision: unit.description.revision,
      kind: unit.description.kind,
      prototype: unit.description.prototype,
      placement: unit.description.placement,
      owner: unit.description.owner,
      viewpointOwner: unit.viewpointOwner,
      deliveryEvidenceEligible: unit.deliveryEvidenceEligible,
    })),
    [
      {
        version: 1,
        target: {
          shot: "inspection-shot",
          subject: "prototype:guard-rack-west-pole-0-model",
        },
        revision: "sha256:inspection-a",
        kind: "prototype",
        prototype: null,
        placement: null,
        owner: null,
        viewpointOwner: "inspection",
        deliveryEvidenceEligible: false,
      },
      {
        version: 1,
        target: {
          shot: "inspection-shot",
          subject: "element-part:castle/guard-rack-west-pole-0/body",
        },
        revision: "sha256:inspection-a",
        kind: "part",
        prototype: "prototype-part:guard-rack-west-pole-0-model/body",
        placement: "element-part:castle/guard-rack-west-pole-0/body",
        owner: "element:castle/guard-rack-west-pole-0",
        viewpointOwner: "inspection",
        deliveryEvidenceEligible: false,
      },
      {
        version: 1,
        target: {
          shot: "inspection-shot",
          subject: "instance:banner-field:slot:000001",
        },
        revision: "sha256:inspection-a",
        kind: "instance",
        prototype: "prototype:solar-oriel-model",
        placement: "instance:banner-field:slot:000001",
        owner: "instance-set:banner-field",
        viewpointOwner: "inspection",
        deliveryEvidenceEligible: false,
      },
      {
        version: 1,
        target: {
          shot: "inspection-shot",
          subject: "space:castle/hall",
        },
        revision: "sha256:inspection-a",
        kind: "space",
        prototype: null,
        placement: "space:castle/hall",
        owner: null,
        viewpointOwner: "inspection",
        deliveryEvidenceEligible: false,
      },
    ],
  );
  TestValidator.equals(
    "a missing compiled subject cannot become a review unit",
    throwsError(
      () =>
        resolveAutoMovieSubjectReviewUnit(artifact, {
          shot: "inspection-shot",
          subject: "element:castle/missing",
        }),
      "does not exist",
    ),
    true,
  );
};

/**
 * True when a resolved unit carries the shared structural description.
 *
 * Filtering rather than casting keeps the formation role from silently
 * answering a structural-identity assertion: a formation unit drops out of the
 * projected array and the comparison fails on the missing entry.
 */
const isStructuralSubjectReviewUnit = (
  unit: IAutoMovieSubjectReviewUnit,
): unit is IAutoMovieSubjectReviewUnit & {
  description: IAutoMovieSubjectDescription;
} => unit.description.kind !== "formation";
