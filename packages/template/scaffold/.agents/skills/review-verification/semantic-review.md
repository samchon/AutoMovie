# Independent semantic review

This procedure owns semantic evidence judgment. The evidence compiler owns structural validation and fingerprint issuance; it never writes a finding. Mechanical tooling may locate rows, report diagnostics and alarms, and append one verified fingerprint to an already-authored structural slot. A generator, codemod, formatter, or bulk rewrite must never create, complete, paraphrase, or normalize the semantic sentence.

Read the [conformance owner map](../evidence-graph/conformance.md) before repairing a semantic or structural evidence failure.

## Two-step transaction

Process one relationship at a time:

1. Resolve the exact target H2, complete host, necessary lineage, and configured host kind from the immutable revision under review. Record the submitted commit and target and host blob identities in the commit or pull-request chronology.
2. Leave the fingerprint slot empty. Read the target and host literally, perform the semantic pass below, write the finding, and inspect that prose while no fingerprint is present.
3. Freeze the accepted semantic row. Ask the compiler or a dedicated token inserter for the current fingerprint, then let that tool append only the token in the structural slot. Reject an operation that changes review prose or any protected authored byte.
4. Run evidence lint and verify the resulting row against the same immutable target and host blobs. A moved branch, changed blob, unresolved anchor, different population, or edited semantic row invalidates the transaction and requires a new literal read.

The durable Git commit or pull-request chronology records the fingerprint-empty semantic row, its author, the immutable revision and target and host identities, then the fingerprint insertion and proof that only the token slot changed. Do not create a repository approval, waiver, status, or review ledger. A private session path, `.wiki` note, or remembered context is not transferable provenance.

## Host-kind discriminator

Use the configured claim and ask only the subject that host kind owns:

| Host kind                             | Semantic subject                                                                                                 |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Authored H2, H3, or H4                | Whether this exact unit performs one principle, dependency, lineage, upstream, or observation predicate          |
| Authored file                         | What the complete selected file realizes for a file-level relation                                               |
| Population-obligation account         | One comparison over every selected population member and exactly one obligation                                  |
| Settings-coverage or topology account | The declared all-host, dense, sparse, or absent edge population                                                  |
| Work-contract H2                      | The unit, file, or population operation explicitly selected by its additive claim                                |
| Discovery carrier                     | What the complete production-specific search found and which existing owners make an additional rule unnecessary |
| Public TypeScript owner               | What the selected export's type, value, behavior, callers, and consequences implement                            |

An exclusion uses the negative scope configured by its claim. A unit-local upstream exclusion asks whether writing this exact child exposed a defect in its exact parent relation. A discovery or population exclusion asks whether the relation is absent from every selected host. Never substitute one scope for the other. Config decides mechanically knowable host kinds and attachment identities; literal review decides whether the prose answers them.

## Literal semantic pass

For every acknowledgement, exclusion, and review:

1. Read the complete cited H2 and state its subject in target terms without relying on the annotation or review already present.
2. Identify the configured host kind and claim family. State the host operation that could fill the target role without inferring it from document adjacency or generation order.
3. Read the complete host and necessary lineage. Locate literal support for each material actor, object, place, authority, operation, state change, and consequence. Verify every edge independently for a multi-host relation. For an exclusion, search its complete configured negative scope and name the concrete fact that rules the relation out.
4. Ask the target's literal predicate of that material. Specificity cannot pass voice, perspective cannot pass authority, and one local exit cannot pass a population distribution.
5. Test semantic role and grammatical attachment. Knowledge, agency, expression, authority, obligation, unit, file, and population are not interchangeable.
6. Select the weakest governed material, name the target-specific condition that would falsify compliance, and decide whether the host exhibits it.
7. Exchange the finding's predicate and dependent clauses with the nearest sibling under the same target. Exchange the target predicate across the nearest targets on the same host. If either exchanged finding remains true without changing its claimed observation, the prose has not demonstrated an independent comparison.
8. Write the host-specific finding from this read. Do not begin from a reusable frame and replace target or host nouns.

A quotation is optional and must be exact and complete. Otherwise give a stable locator and describe the host's own rendering. Mid-word slices, truncated quotations, nonexistent rows, converted notation, and a heading offered as body support fail. Reread an asserted absence against its complete configured negative scope every time.

When literal support fails, define the mismatch class from the failed field and relationship, not from a filename prefix. Audit that class across both the target's complete host population and the host's complete target set. Record the immutable basis, literal locations, mismatched actor, object, site, authority, operation, state, or consequence, reproducible class membership, and every affected edge in the pull-request review. Repair the earliest true owner and propagate every consequence before restarting the transaction.

For a population obligation, read every selected unit. The account identifies the population, enumerates or groups every member, performs the required comparison, cites exactly one obligation, and carries exactly one review. A list of local observations is not a population classification.

## Evidence-gate audit

At `evidence -> review`, no review rows exist yet. Apply steps 1 through 6 of the literal semantic pass to the complete acknowledgement and exclusion population. Then read one exact target across its complete host population and one complete host across its exact target set. A mismatch triggers the same class-wide audit and earliest-owner repair before the layer may enter `review`.

## Completing-population audit

Before completing evidence review, reread the immutable population on both axes:

- one exact target across its complete host population;
- one complete host across its exact target set.

For each axis, exchange predicates and dependent clauses with the nearest siblings. Review alarms may report repeated frames, copied target questions, repeated n-grams, slot-normalized skeletons, uniform lengths, or high review-to-body ratios. These are inputs that trigger complete literal inspection, never scores, sampling instructions, or semantic verdicts.

When the audit confirms a reusable frame, report the affected target and host population, a reproducible membership rule, every matching member, and the target-specific falsifier or literal comparison that the frame failed to establish. Sweep the entire class and require a fresh two-step transaction. Paraphrasing, synonym replacement, noun substitution, and new fingerprints do not repair it. Repeated terminology passes only when each exact target question, host-specific literal support, and target-specific falsifier was independently established.

## Acceptance matrix

Use these cases when reviewing the harness or a production's completed evidence population:

| Case                                                                           | Expected result                                                                                                                    |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Generic majority or slotted nouns                                              | Fail with the reusable predicate or clause skeleton and every class member.                                                        |
| Category or semantic-role substitution                                         | Fail at the literal predicate or host-role check.                                                                                  |
| Unit evidence offered for a file or population relation                        | Fail because the host operation cannot answer the configured subject.                                                              |
| Complete population account                                                    | Pass the structural discriminator only when it covers every selected member once, then continue literal and exchange checks.       |
| Exact lineage relation versus a sibling's result                               | Pass only the exact child-parent edge and fail the exchanged attachment.                                                           |
| Discovery or population exclusion contradicted by one selected host            | Fail the exclusion and report the complete contradicted class.                                                                     |
| False quotation, converted notation, or asserted absence without a full search | Fail literal support.                                                                                                              |
| Cross-event fact, wrong authority, or premature consequence                    | Fail even when the address and fingerprint are current.                                                                            |
| Generic rows with current unique fingerprints                                  | Fail because attachment freshness cannot satisfy semantic independence.                                                            |
| One tool writes findings and fingerprints                                      | Fail because the same operation owns both sides of the transaction.                                                                |
| Metadata rewrite changes any protected authored byte                           | Fail before semantic judgment; restore the protected projection and restart from the immutable basis.                              |
| Loud repetition alarms with exact independent findings                         | Pass only after both complete axes establish the literal host facts and target-specific falsifiers; alarm volume is not a verdict. |
| Honest similarity                                                              | Pass only when both axes establish distinct literal host facts and target-specific falsifiers.                                     |
| Target, host, population, or semantic-row edit after judgment                  | Invalidate the judgment and restart from a new immutable basis.                                                                    |

Run the complete matrix with current compiler-issued fingerprints where applicable so fingerprint freshness cannot decide the semantic result. A harness passes only when identical immutable inputs produce identical alarm membership and every semantic verdict still comes from literal review.
