# Human face investigation

Use this procedure for numerical facial shape, expression, skin, hair and their shared attachments. Read it through the 3D modeling skill before a face investigation or implementation. This is a development procedure, not a likeness approval or a new anatomical capability promise.

## Establish the actual state

Read the [human README](../../../packages/human/README.md), its linked requirements and specifications, the task's issue and latest pull-request chronology, the selected numerical documents and their artifact-specific reviews. Apply the user's current scope and priorities explicitly. An older issue description or historical review does not override a later instruction.

Record the source revision, local modifications, document and reference identities, runtime, actual export, renderer, camera, lighting and expression for the investigation. Resolve the gallery's selected artifact rather than assuming that the newest directory or an old screenshot represents current source. Separate authored observations from estimated hidden geometry and distinguish source colour from illumination.

## Diagnose the complete face before editing

Inspect the complete requested subject population and all views required by the [facial review contract](../../../docs/specifications/asset-and-representation/facial-authoring/contract.md#face-spec-review), together with the expressions affected by the task. Use the [viewer-verification procedure](../viewer-verification/SKILL.md) for rendering. Complete this observation pass before correcting its individual symptoms. A missing view or untested expression remains a named coverage gap, not a passing observation.

Collect observations in the task's existing issue or working knowledge base, with a stable artifact/view locator, expected result, measured or visible deviation, affected anatomical group, confidence, and any known counterexample. Record a suspected cause separately from a reproduced cause. Preserve unfavorable measurements and rejected candidates with the reason for rejection; do not create a product finding service or substitute a new ledger for the repository's review chronology.

Group the observations by shared cause and consequence. Trace the real path from document resolution through host formation, component fitting, shared boundary construction, subdivision, surface shaping, contact, interior construction, export and display. Determine the first stage at which each observed invariant ceases to hold. Existing named features or valid scalar inputs do not prove that the required combined shape is representable.

## Design a repair for the cause group

Before implementation, write the affected group's shared constraints and acceptance conditions together. Include the properties that must improve and those that must remain true in neighboring parts, other subjects and expressions. For example, the oral group needs aperture shape, enamel placement, enclosure and performed contact considered together; the ocular group needs globe identity, wet aperture, tissue sections, skin attachment and gaze considered together.

Choose the owner of every boundary, coordinate transform and formula. Distinguish a representation deficiency from incorrect measurements, bad parameter selection, incorrect assembly order and a renderer discrepancy. Replace a deficient representation at its owning layer when that is the verified cause; neither a larger parameter search nor higher tessellation can be assumed to supply a missing degree of freedom.

The repair design covers the whole cause group. Its implementation may proceed in small reviewable commits, but each commit remains accountable to the group's joint conditions. Do not postpone reasoning about already observed side effects until they become the next visible failure. Apply the development skill's [Logic source structure](../development/SKILL.md#logic-source-structure) and documentation skill's [Logic-file context](../documentation/SKILL.md#logic-file-context) throughout.

## Use experiments to discriminate causes

State the hypothesis, competing explanation, fixed quantities, changed quantity and rejection condition before an experiment. Use a small independent analytic case where possible, then the actual source consumer and the affected subjects. If several quantities change, describe a structural comparison rather than claiming a single-variable A/B. Experiments driven through an authoring agent additionally use the [experiment skill](../experiment/SKILL.md).

Measure the assembled surface that the renderer receives, not only a pre-subdivision cage or a copied formula. Test the measurement against an independent known case and state its uncertainty: landmark detections, finite collision samples, triangle-normal angles and thresholded image masks answer different questions. A lower residual in one proxy does not establish geometric validity or overall likeness. Record which observations would refute the proposed cause.

If an experiment reveals a new coupled defect, update the group's diagnosis and joint conditions before another product correction. Do not adopt a candidate solely because its primary metric improved. A repeated failure class calls for revisiting its representation or constraint owner, not another unbounded loop over isolated scalar values.

## Integrate and hand off

Validate the joint conditions against the same declared population, views and expression states after a repair. Rebuild derivatives when their source basis changes. Preserve caller-owned data and separately verify normal, invalid and recovery paths through the real document/editor/export consumers. Numerical admission, deterministic replay, capture completeness, direct inspection and likeness remain distinct outcomes.

The [review skill](../review/SKILL.md) owns fresh whole-surface Self-Review, and the [pull-request skill](../pull-request/SKILL.md) owns publication and merge gates. A complete observation pass is not that Self-Review, and local experiments do not replace it.

A handoff states what is established, what is only a hypothesis, what failed, what has not been inspected, and the first action the next agent must take. Include source and artifact locators, reproduction commands, the current revision's check results and preserved user constraints. Put enough primary observations in the issue for a new checkout to understand the problem; identify local-only data and its recovery path without making private temporary files the sole explanation.
