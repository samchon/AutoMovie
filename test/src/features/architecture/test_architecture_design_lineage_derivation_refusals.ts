import { validateDesignLineage } from "@automovie/engine";
import { TestValidator } from "@nestia/e2e";

import {
  brokenLineage,
  lineageDigest,
  refusesLineage as refuses,
} from "../internal/lineageFixtures";
import { namedFacts } from "../internal/predicates";

/** True when one edit away from the coherent fixture still validates. */
const accepts = (edit: Parameters<typeof brokenLineage>[0]): boolean =>
  validateDesignLineage({ lineage: brokenLineage(edit) }).success;

/**
 * Pin every way an alternative or a derived output can stop being trustworthy.
 *
 * Two families of defect live here. An alternative stops being an alternative
 * when it applies to a revision nobody recorded, when it edits one aspect of
 * one subject twice, or when a decision compares schemes that were never on the
 * same footing. A derived output stops being evidence when it stamps a
 * superseded revision, when it disagrees with the inputs it was computed from,
 * or when it claims a design identity as its own.
 *
 * Comparison fairness is checked rather than assumed. Two alternatives whose
 * comparison renders were baked under different configurations or at different
 * phases are comparing the configurations, so the pair is refused; the same two
 * moved onto one shared configuration or one shared phase are accepted, which
 * is what proves the rule tracks agreement instead of a fixed constant.
 *
 * Scenarios:
 *
 * 1. Alternative identity: blank and duplicated variant ids, a blank label, and a
 *    base revision nobody recorded.
 * 2. Change identity: blank and duplicated change ids, an unknown subject, a blank
 *    aspect, a blank rationale, and two edits of one subject's one aspect.
 * 3. Decision integrity: blank id and question, fewer than two options, an unknown
 *    option, a repeated option, options straddling two base revisions, and a
 *    selection that is not one of the options.
 * 4. Artifact identity: blank and duplicated artifact ids, and an artifact id
 *    squatting on a declared subject identity.
 * 5. Artifact inputs: no inputs at all, an unknown input, a repeated input, and a
 *    derivation cycle.
 * 6. Artifact stamps: malformed output and configuration digests, a superseded
 *    revision, an unknown variant, a variant belonging to another revision, an
 *    unknown phase, and a stamp disagreeing with an input's stamp.
 * 7. Comparison fairness is refused for a differing configuration and for a
 *    differing phase, and accepted once the pair agrees on either.
 * 8. An alternative that changes nothing is accepted: an empty change set is a
 *    scheme that keeps the base, not a malformed record.
 */
export const test_architecture_design_lineage_derivation_refusals =
  (): void => {
    TestValidator.equals(
      "alternative and decision refusals",
      namedFacts([
        [
          "a blank variant id is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.id = "";
            }, "$input.variants[0].id"),
        ],
        [
          "a duplicated variant id is refused",
          () =>
            refuses((draft) => {
              draft.variants[1]!.id = "warm-oak";
            }, "$input.variants[1].id"),
        ],
        [
          "a variant with no label is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.label = " ";
            }, "$input.variants[0].label"),
        ],
        [
          "an alternative applying to a revision nobody recorded is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.base = "r7";
            }, "$input.variants[0].base"),
        ],
        [
          "a blank change id is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.changes[0]!.id = "";
            }, "$input.variants[0].changes[0].id"),
        ],
        [
          "a change id reused by another alternative is refused",
          () =>
            refuses((draft) => {
              draft.variants[1]!.changes[0]!.id = "warm-floor";
            }, "$input.variants[1].changes[0].id"),
        ],
        [
          "a change about an unknown subject is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.changes[0]!.subject = "wall-east";
            }, "$input.variants[0].changes[0].subject"),
        ],
        [
          "a change with no aspect is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.changes[0]!.aspect = "";
            }, "$input.variants[0].changes[0].aspect"),
        ],
        [
          "a change with no rationale is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.changes[0]!.rationale = "  ";
            }, "$input.variants[0].changes[0].rationale"),
        ],
        [
          "one alternative editing one aspect of one subject twice is refused",
          () =>
            refuses((draft) => {
              draft.variants[0]!.changes[1]!.subject = "floor-oak";
              draft.variants[0]!.changes[1]!.aspect = "material";
            }, "$input.variants[0].changes[1].aspect"),
        ],
        [
          "a blank decision id is refused",
          () =>
            refuses((draft) => {
              draft.decisions[0]!.id = "";
            }, "$input.decisions[0].id"),
        ],
        [
          "a decision with no question is refused",
          () =>
            refuses((draft) => {
              draft.decisions[0]!.question = "";
            }, "$input.decisions[0].question"),
        ],
        [
          "a decision holding fewer than two alternatives is refused",
          () =>
            refuses(
              (draft) => {
                draft.decisions[0]!.options = ["warm-oak"];
              },
              "$input.decisions[0].options",
              "range",
            ),
        ],
        [
          "a decision naming an unknown alternative is refused",
          () =>
            refuses((draft) => {
              draft.decisions[0]!.options = ["warm-oak", "brutalist"];
            }, "$input.decisions[0].options[1]"),
        ],
        [
          "a decision naming one alternative twice is refused",
          () =>
            refuses((draft) => {
              draft.decisions[0]!.options = ["warm-oak", "warm-oak"];
            }, "$input.decisions[0].options[1]"),
        ],
        [
          "a decision straddling two base revisions is refused",
          () =>
            refuses((draft) => {
              draft.decisions[0]!.options = ["warm-oak", "legacy-scheme"];
            }, "$input.decisions[0].options"),
        ],
        [
          "a selection that is not one of the compared alternatives is refused",
          () =>
            refuses((draft) => {
              draft.decisions[0]!.selected = "legacy-scheme";
            }, "$input.decisions[0].selected"),
        ],
        [
          "an alternative that changes nothing is accepted",
          () =>
            accepts((draft) => {
              draft.variants[2]!.changes = [];
            }),
        ],
      ]),
      {
        "a blank variant id is refused": true,
        "a duplicated variant id is refused": true,
        "a variant with no label is refused": true,
        "an alternative applying to a revision nobody recorded is refused": true,
        "a blank change id is refused": true,
        "a change id reused by another alternative is refused": true,
        "a change about an unknown subject is refused": true,
        "a change with no aspect is refused": true,
        "a change with no rationale is refused": true,
        "one alternative editing one aspect of one subject twice is refused": true,
        "a blank decision id is refused": true,
        "a decision with no question is refused": true,
        "a decision holding fewer than two alternatives is refused": true,
        "a decision naming an unknown alternative is refused": true,
        "a decision naming one alternative twice is refused": true,
        "a decision straddling two base revisions is refused": true,
        "a selection that is not one of the compared alternatives is refused": true,
        "an alternative that changes nothing is accepted": true,
      },
    );

    TestValidator.equals(
      "derived artifact refusals",
      namedFacts([
        [
          "a blank artifact id is refused",
          () =>
            refuses((draft) => {
              draft.derived[0]!.id = "";
            }, "$input.derived[0].id"),
        ],
        [
          "a duplicated artifact id is refused",
          () =>
            refuses((draft) => {
              draft.derived[1]!.id = "mesh-wall-north";
            }, "$input.derived[1].id"),
        ],
        [
          "an artifact squatting on a declared subject identity is refused",
          () =>
            refuses((draft) => {
              draft.derived[0]!.id = "wall-north";
            }, "$input.derived[0].id"),
        ],
        [
          "an artifact with no output family is refused",
          () =>
            refuses((draft) => {
              draft.derived[0]!.kind = " ";
            }, "$input.derived[0].kind"),
        ],
        [
          "an artifact citing no input at all is refused",
          () =>
            refuses(
              (draft) => {
                draft.derived[1]!.inputs = [];
              },
              "$input.derived[1].inputs",
              "range",
            ),
        ],
        [
          "an artifact citing an unknown input is refused",
          () =>
            refuses((draft) => {
              draft.derived[1]!.inputs = ["wall-east"];
            }, "$input.derived[1].inputs[0]"),
        ],
        [
          "an artifact citing one input twice is refused",
          () =>
            refuses((draft) => {
              draft.derived[1]!.inputs = ["wall-west", "wall-west"];
            }, "$input.derived[1].inputs[1]"),
        ],
        [
          "a derivation cycle is refused",
          () =>
            refuses((draft) => {
              draft.derived[0]!.inputs = [
                "wall-north",
                "opening-door",
                "render-lobby",
              ];
            }, "$input.derived"),
        ],
        [
          "a malformed artifact digest is refused",
          () =>
            refuses((draft) => {
              draft.derived[0]!.digest = "sha256:short";
            }, "$input.derived[0].digest"),
        ],
        [
          "a malformed configuration digest is refused",
          () =>
            refuses((draft) => {
              draft.derived[0]!.stamp.configuration = "sha256:short";
            }, "$input.derived[0].stamp.configuration"),
        ],
        [
          "an artifact still stamping a superseded revision is refused as stale",
          () =>
            refuses((draft) => {
              draft.derived[0]!.stamp.revision = "r1";
            }, "$input.derived[0].stamp.revision"),
        ],
        [
          "an artifact stamping an unknown alternative is refused",
          () =>
            refuses((draft) => {
              draft.derived[9]!.stamp.variant = "brutalist";
            }, "$input.derived[9].stamp.variant"),
        ],
        [
          "an artifact applying another revision's alternative is refused",
          () =>
            refuses((draft) => {
              draft.derived[9]!.stamp.variant = "legacy-scheme";
            }, "$input.derived[9].stamp.variant"),
        ],
        [
          "an artifact stamping an unknown phase is refused",
          () =>
            refuses((draft) => {
              draft.derived[8]!.stamp.phase = "topping-out";
            }, "$input.derived[8].stamp.phase"),
        ],
        [
          "an artifact disagreeing with the input it was computed from is refused",
          () =>
            refuses((draft) => {
              draft.derived[6]!.stamp.configuration = lineageDigest("de");
            }, "$input.derived[6].inputs[0]"),
        ],
        [
          "two comparison renders under different configurations are refused",
          () =>
            refuses((draft) => {
              draft.derived[10]!.stamp.configuration = lineageDigest("de");
            }, "$input.derived[10].stamp"),
        ],
        [
          "two comparison renders at different phases are refused",
          () =>
            refuses((draft) => {
              draft.derived[10]!.stamp.phase = "finishes";
            }, "$input.derived[10].stamp"),
        ],
        [
          "the same pair moved onto one shared configuration is accepted",
          () =>
            accepts((draft) => {
              draft.derived[9]!.stamp.configuration = lineageDigest("de");
              draft.derived[10]!.stamp.configuration = lineageDigest("de");
            }),
        ],
        [
          "the same pair moved onto one shared phase is accepted",
          () =>
            accepts((draft) => {
              draft.derived[9]!.stamp.phase = "finishes";
              draft.derived[10]!.stamp.phase = "finishes";
            }),
        ],
      ]),
      {
        "a blank artifact id is refused": true,
        "a duplicated artifact id is refused": true,
        "an artifact squatting on a declared subject identity is refused": true,
        "an artifact with no output family is refused": true,
        "an artifact citing no input at all is refused": true,
        "an artifact citing an unknown input is refused": true,
        "an artifact citing one input twice is refused": true,
        "a derivation cycle is refused": true,
        "a malformed artifact digest is refused": true,
        "a malformed configuration digest is refused": true,
        "an artifact still stamping a superseded revision is refused as stale": true,
        "an artifact stamping an unknown alternative is refused": true,
        "an artifact applying another revision's alternative is refused": true,
        "an artifact stamping an unknown phase is refused": true,
        "an artifact disagreeing with the input it was computed from is refused": true,
        "two comparison renders under different configurations are refused": true,
        "two comparison renders at different phases are refused": true,
        "the same pair moved onto one shared configuration is accepted": true,
        "the same pair moved onto one shared phase is accepted": true,
      },
    );
  };
