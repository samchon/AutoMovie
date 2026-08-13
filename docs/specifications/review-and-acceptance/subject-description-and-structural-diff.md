# Subject Description and Structural Diff

## Review-System Subject Description and Structural Diff

### Subject description record {#review-system-subject-description-record}

<!-- @evidence requirements/review/subject-description-and-structural-change.md#review-subject-description Defines the portable record and stable role-specific identity for compiled subject inspection. -->
<!-- @evidence requirements/review/subject-inspection.md#review-subject-identity Preserves stable identity, revision, composition, and the prototype-placement distinction. -->

The review system shall expose a deterministic description record over one compiled shot artifact. The record carries schema version, artifact revision, stable subject id, subject kind, semantic kind, display name, prototype id, placement id, owner id, model id, logical-space id, transform, bounds, materials, and a bounded member summary. Subject ids are namespaced by their role: `prototype:<model>`, `prototype-part:<model>/<part>`, `element:<node>`, `element-part:<node>/<part>`, `instance-set:<set>`, `instance:<set>:slot:<six-digit-index>` or `instance:<set>:<explicit-id>`, and `space:<environment>/<space>`.

Enumeration returns prototypes, prototype parts, elements, instance sets, and spaces in code-unit id order. Potentially large individual-instance and placed-part populations remain addressable by their deterministic ids but are not expanded during enumeration.

### Subject bounds and compiled authority {#review-system-subject-description-bounds}

<!-- @evidence requirements/review/subject-description-and-structural-change.md#review-subject-compiled-truth Defines deterministic geometry measurement over compiled content and separate declared space extent. -->

Prototype and prototype-part content boxes are measured in model coordinates from tessellated primitives or resident mesh positions. Rigid bone attachment uses the skeleton's rest transform; a scene element, placed part, or individual instance then applies its world transform and reports a world-coordinate content box. A compact instance set reports the compiled placement-origin bounds. A logical space reports a declared box derived from shell vertices or finite convex-cell vertices and a separate content box derived from assigned elements and populations, including descendant spaces. Missing or empty geometry yields `null` rather than a fabricated zero box.

The description record copies no guessed provenance. Its artifact revision and stable subject ids provide deterministic correlation keys for separately compiled lineage and evidence ledgers.

### Structural diff categories {#review-system-subject-structural-diff}

<!-- @evidence requirements/review/subject-description-and-structural-change.md#review-subject-structural-change Defines the added, removed, moved, reshaped, and unchanged comparison categories. -->

The structural diff shall compare two enumerated subject inventories. Added and removed records are exclusive. For a common id, placement state consists of transform, owner, logical-space assignment, and referenced prototype; shape state consists of the reusable model or part, the logical-space declaration, or the compact instance set's count, layout, prototype inventory, variation, and route snapshot. A common record may therefore be both moved and reshaped. A bounded summary records common ids that changed in neither category.

### Tolerance and aggregate fan-out {#review-system-subject-diff-tolerance-fanout}

<!-- @evidence requirements/review/subject-description-and-structural-change.md#review-subject-diff-tolerance-fanout Defines inclusive tolerance and bounded aggregate prototype consequence reporting. -->

The diff accepts a finite non-negative absolute tolerance and defaults to `1e-6`. Recursive numeric comparison treats `abs(before - after) <= tolerance` as equal. Quaternion comparison normalizes both values and treats `q` and `-q` as the same orientation before applying the tolerance.

One changed prototype or prototype part yields one change record with aggregate counts for referencing elements and instance slots and a bounded summary of referencing instance-set ids. One changed instance set yields one change record and a count of slots whose selected prototype changed across the common slot range, plus the absolute count difference. Neither calculation emits member-sized change arrays.
