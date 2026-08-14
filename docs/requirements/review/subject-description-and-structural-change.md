# Subject Description and Structural Change

## Review Subject Description and Structural Change

### Describe a compiled subject {#review-subject-description}

Reviewers shall be able to ask what one compiled subject is without rendering a frame. The answer shall identify an element, part, reusable prototype, placed instance, compact instance set, or logical space by a stable subject id and the revision of the compiled artifact that supplied the answer. It shall report the subject's semantic kind, prototype and placement relationship, ownership, materials, members, transform, and measurable extent whenever those facts exist in compiled data.

Prototype and placement are different subjects. A reusable model or model part answers what geometry exists; a scene element, placed part, or compact instance answers where one use of that geometry stands. The answer shall preserve that distinction even when one placement is the only current use of its prototype.

### Measure compiled truth {#review-subject-compiled-truth}

Description shall derive from the compiled artifact that render and oracle consumers receive, not from a frame, a mutable authoring session, or a second handwritten inventory. Geometry bounds shall be measured from actual primitive or mesh content after the applicable part, rest-bone, and placement transforms. A logical space shall report its declared volume separately from the bounds of the content assigned to it, including descendant spaces; absence of either measurement is a valid explicit result.

Description shall not guess provenance. The artifact revision and stable ids are the join keys through which a caller may correlate the answer with separately compiled lineage or evidence records.

### Compare compiled subject structure {#review-subject-structural-change}

Reviewers shall be able to compare two compiled artifact revisions without rendering and receive structural changes grouped as added, removed, moved, and reshaped subjects. Movement includes a subject's placement transform, owner, or logical-space assignment. Reshaping includes changes to reusable geometry or to an instance set's prototype, population, layout, or variation law. A subject changed in both ways may appear in both groups; an unchanged subject shall appear in neither.

### Bound tolerance and prototype fan-out {#review-subject-diff-tolerance-fanout}

Numeric structural comparison shall use a caller-visible absolute tolerance. Differences exactly equal to the tolerance are unchanged, while a larger difference is a change. Equivalent unit quaternions with opposite signs shall compare as the same rotation.

A reusable prototype change shall be reported once at the prototype or part identity. Its consequence shall be a bounded fan-out summary giving affected element placements, compact instance sets, and individual instance counts; it shall not expand one prototype edit into one change record per use. An instance set shall likewise summarize changed per-slot prototype selection without emitting every member as a separate diff entry.
