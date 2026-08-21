<!--
@evidence principles/common.md#purpose-fit Specifies the reusable member recipes, distance tiers, and formation representation required for the chorus to read as one ordered subject.
@evidenceReview principles/common.md#purpose-fit #403e074 Compared principles/common.md#purpose-fit with "complete 020-chorus.md document"; confirmed that specifies the reusable member recipes, distance tiers, and formation representation required for the chorus to read as one ordered subject.
@evidence principles/common.md#layer-boundary Owns member geometry, tier radii, instance layout, and articulation interfaces while leaving crowd meaning, path timing, and shot placement elsewhere.
@evidenceReview principles/common.md#layer-boundary #cfb2a7f Compared principles/common.md#layer-boundary with "complete 020-chorus.md document"; confirmed that owns member geometry, tier radii, instance layout, and articulation interfaces while leaving crowd meaning, path timing, and shot placement elsewhere.
@evidence principles/common.md#declared-basis Labels tier radii, layout counts, spacing, seed, and LOD thresholds as chosen blocking values while deriving member height from SOLOIST.
@evidenceReview principles/common.md#declared-basis #4a10eec Compared principles/common.md#declared-basis with "complete 020-chorus.md document"; confirmed that labels tier radii, layout counts, spacing, seed, and LOD thresholds as chosen blocking values while deriving member height from SOLOIST.
@evidence principles/models.md#representation-contract Declares one articulated member ladder instanced by one formation and states its blocking-only fidelity ceiling.
@evidenceReview principles/models.md#representation-contract #b6d1be6 Compared principles/models.md#representation-contract with "complete 020-chorus.md document"; confirmed that declares one articulated member ladder instanced by one formation and states its blocking-only fidelity ceiling.
@evidence principles/models.md#spatial-convention Fixes formation anchor, facing, row and column axes, member height, spacing, and reach in metres.
@evidenceReview principles/models.md#spatial-convention #276a4af Compared principles/models.md#spatial-convention with "complete 020-chorus.md document"; confirmed that fixes formation anchor, facing, row and column axes, member height, spacing, and reach in metres without assigning motion ownership through this rule.
@evidence principles/models.md#reviewable-structure Names group edges, intervals, member gait silhouette, and tier transitions as the structures neutral views must test.
@evidenceReview principles/models.md#reviewable-structure #0cda6e1 Compared principles/models.md#reviewable-structure with "complete 020-chorus.md document"; confirmed that names group edges, intervals, member gait silhouette, and tier transitions as the structures neutral views must test.
-->

# CHORUS model

## Member and tier representation {#chorus-member-tier-representation}

<!--
@evidence settings/020-chorus.md#chorus-group-identity Represents a 1.7 m member only as a component of readable rows and columns, never as an independently followed character.
@evidenceReview settings/020-chorus.md#chorus-group-identity #cfc06d1 Compared settings/020-chorus.md#chorus-group-identity with "Member and tier representation {#chorus-member-tier-representation}"; confirmed that represents a 1.7 m member only as a component of readable rows and columns, never as an independently followed character.
@evidence settings/050-art-direction.md#art-palette-scale Uses exactly the desaturated `#8f9d74` CHORUS body swatch and derives the 1.7 m height as one chosen head below the 1.8 m reference.
@evidenceReview settings/050-art-direction.md#art-palette-scale #958a50f Compared settings/050-art-direction.md#art-palette-scale with "Member and tier representation {#chorus-member-tier-representation}"; confirmed that uses exactly `#8f9d74` for all tiers and derives their shared height against the 1.8 m reference.
@evidence obligations/models.md#reference-scale Checks the derived member height against the separately stated 1.7 m setting within a 1e-9 m numeric tolerance.
@evidenceReview obligations/models.md#reference-scale #d2b4b4b Compared obligations/models.md#reference-scale with "Member and tier representation {#chorus-member-tier-representation}"; confirmed that checks the derived member height against the separately stated 1.7 m setting within a 1e-9 m numeric tolerance.
-->

Provide one articulated hero `stickman` recipe with 1.7 m occupied height, derived as 0.1 m below the 1.8 m human reference, 0.14 m head radius, 0.05 m limb radius, and body color `#8f9d74`. The `near` recipe uses 0.15 m head and 0.065 m limb radii; the `far` recipe uses 0.17 m head and 0.085 m limb radii. All three recipes supply exactly one profile named `stride` with id `<recipe-id>-stride`, no controls, drivers, or limits, and the catalogue's canonical `walk` as its only gait. Near and far preserve height, color, and that articulated gait while thickening the silhouette to survive distance. Use hero through 5 m, near through 12 m, and far beyond; a tier transition must not change color, height, formation placement, or gait phase. An anonymous member exposes no independent dramatic capability.

## Formation representation {#chorus-formation-representation}

<!--
@evidence settings/020-chorus.md#chorus-advance-capability Builds one formation whose stable row and column intervals can translate without changing spacing.
@evidenceReview settings/020-chorus.md#chorus-advance-capability #ea566f7 Compared settings/020-chorus.md#chorus-advance-capability with "Formation representation {#chorus-formation-representation}"; confirmed that builds one formation whose stable row and column intervals can translate without changing spacing.
@evidence settings/020-chorus.md#chorus-hold-capability Keeps root, facing, and both interval channels stable at any authored held state.
@evidenceReview settings/020-chorus.md#chorus-hold-capability #3a5ff68 Compared settings/020-chorus.md#chorus-hold-capability with "Formation representation {#chorus-formation-representation}"; confirmed that keeps root, facing, and both interval channels stable at any authored held state.
@evidence settings/020-chorus.md#chorus-break-capability Exposes only uniform lateral-and-depth interval scaling and no member-level rerouting.
@evidenceReview settings/020-chorus.md#chorus-break-capability #84105c2 Compared settings/020-chorus.md#chorus-break-capability with "Formation representation {#chorus-formation-representation}"; confirmed that exposes only uniform lateral-and-depth interval scaling and no member-level rerouting.
@evidence settings/040-plaza.md#plaza-ground-landmark Anchors the formation on the shared level ground so its derived reach can size the plaza rather than overflow an unrelated surface.
@evidenceReview settings/040-plaza.md#plaza-ground-landmark #196da0d Compared settings/040-plaza.md#plaza-ground-landmark with "Formation representation {#chorus-formation-representation}"; confirmed that anchors the formation on the shared level ground so its derived reach can size the plaza rather than overflow an unrelated surface.
@evidence obligations/models.md#articulation-ownership Assigns member skeleton profiles to the tier recipes and formation translation and spacing-scale channels to the formation interface.
@evidenceReview obligations/models.md#articulation-ownership #c4a2e99 Compared obligations/models.md#articulation-ownership with "Formation representation {#chorus-formation-representation}"; confirmed that assigns member skeleton profiles to the tier recipes and formation translation and spacing-scale channels to the formation interface.
-->

Construct one deterministic instance formation named `chorus` from 2,049 members in 33 ranks of at most 64 files, leaving a deliberately short final rank. Use 0.5 m lateral spacing, 1 m depth spacing, anchor `{0, 0, -5}`, facing 180 degrees, and seed 1415. Assign hero overrides at slot 31 as `lead` and slot 1055 as `second`; no other member gains an individual identity. Its local lateral and depth axes remain orthogonal on the plaza plane. The formation exposes only `hold`, `advance`, and `break`: translation moves its root, while a break changes only the two explicit spacing-scale channels.

## Neutral review views {#chorus-neutral-review-views}

<!--
@evidence settings/050-art-direction.md#art-delivery-review-condition Uses the delivered widest-view threshold after neutral formation inspection proves structure independent of shot composition.
@evidenceReview settings/050-art-direction.md#art-delivery-review-condition #c9d7e44 Compared settings/050-art-direction.md#art-delivery-review-condition with "Neutral review views {#chorus-neutral-review-views}"; confirmed that uses the delivered widest-view threshold after neutral formation inspection proves structure independent of shot composition.
@evidence obligations/models.md#model-review-set Extends the shared neutral set with front, side, elevated three-quarter, and tier-threshold comparisons of the complete formation.
@evidenceReview obligations/models.md#model-review-set #9da18ef Compared obligations/models.md#model-review-set with "Neutral review views {#chorus-neutral-review-views}"; confirmed that extends the shared neutral set with front, side, elevated three-quarter, and tier-threshold comparisons of the complete formation.
-->

Inspect front, side, and elevated three-quarter views of the full formation at rest, plus paired frames immediately before and after each LOD threshold. Fail if a tier pop changes scale or color, a row or column interval collapses, group edges become ambiguous, a member loses planted contact, or the 1.7 m height differs from the 1.8 m reference minus 0.1 m by more than the chosen 1 nanometre numeric tolerance.
