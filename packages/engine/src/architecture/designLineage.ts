import {
  AutoMovieContentDigest,
  AutoMovieDesignLifecycleRole,
  AutoMovieDesignPresence,
  IAutoMovieDesignChange,
  IAutoMovieDesignComparison,
  IAutoMovieDesignDifference,
  IAutoMovieDesignImpact,
  IAutoMovieDesignLineage,
  IAutoMovieDesignPhaseSnapshot,
  IAutoMovieDesignPhaseState,
  IAutoMovieDesignStamp,
  IAutoMovieDesignVariant,
  IAutoMovieValidation,
} from "@automovie/interface";

import { autoMovieRenderDigest } from "../render/renderDigest";
import { compareCodeUnits } from "../text/compareCodeUnits";
import { ViolationCollector } from "../validation/violation";

/** A plain SHA-256 content digest as this project writes it. */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/;

/**
 * Validate one lineage record as a self-consistent phase, alternative, and
 * derivation graph.
 *
 * The record annotates identities other graphs own, so this validator checks
 * the annotation and never the building. What it refuses is exactly the set of
 * ways a lineage stops being able to answer its own questions: a construction
 * plan that requires itself, an alternative applying to a revision nobody
 * recorded, two edits of the same aspect inside one alternative, a subject
 * removed before it was ever installed, and a derived artifact still stamping a
 * superseded revision, reading imported bytes that have since been replaced, or
 * disagreeing with the inputs it was computed from.
 *
 * Staleness is a refusal rather than a warning, which makes the order of a
 * rebake explicit: ask {@link designLineageImpact} what a change reaches while
 * the record still describes the outputs on disk, then move the revision or the
 * imported digest and the outputs together. A record caught mid-rebake is
 * invalid on purpose; the alternative is serving an output nobody can check.
 *
 * Lifecycle coverage is total by the same reasoning
 * {@link IAutoMovieDesignLifecycle} states: a subject with no lifecycle would
 * have to be given a default, and every available default asserts something the
 * author did not, either that the thing predates the work or that it survives
 * it.
 *
 * Comparison fairness is a validation rule rather than a convention. When two
 * alternatives of one decision both carry a derived artifact of the same kind,
 * those artifacts must share a lowering configuration and a phase, because a
 * comparison shot under two cameras compares the cameras.
 */
export const validateDesignLineage = (props: {
  lineage: IAutoMovieDesignLineage;
}): IAutoMovieValidation => {
  const { lineage } = props;
  const out = new ViolationCollector();
  const root = "$input";

  nonEmpty(lineage.id, `${root}.id`, "design lineage id", out);
  if (lineage.version !== 1)
    out.push(
      "type",
      `${root}.version`,
      `design lineage schema version must be 1, but was ${lineage.version}`,
      lineage.version,
    );

  const subjectIds = collectIds(
    lineage.subjects,
    `${root}.subjects`,
    "lineage subject",
    out,
  );
  lineage.subjects.forEach((subject, index) => {
    const path = `${root}.subjects[${index}]`;
    nonEmpty(subject.graph, `${path}.graph`, "lineage subject graph", out);
    if (subject.digest !== null && !DIGEST_PATTERN.test(subject.digest))
      out.push(
        "type",
        `${path}.digest`,
        `lineage subject digest must be a lowercase "sha256:" hex digest, but was ${String(subject.digest)}`,
        subject.digest,
      );
  });

  const revisionIds = collectIds(
    lineage.revisions,
    `${root}.revisions`,
    "design revision",
    out,
  );
  if (lineage.revisions.length === 0)
    out.push(
      "range",
      `${root}.revisions`,
      "a design lineage must record at least one revision",
      lineage.revisions,
    );
  lineage.revisions.forEach((revision, index) => {
    const path = `${root}.revisions[${index}]`;
    if (revision.parent !== null && !revisionIds.has(revision.parent))
      out.push(
        "type",
        `${path}.parent`,
        `design revision parent "${revision.parent}" does not resolve`,
        revision.parent,
      );
    if (!DIGEST_PATTERN.test(revision.digest))
      out.push(
        "type",
        `${path}.digest`,
        `design revision digest must be a lowercase "sha256:" hex digest, but was ${String(revision.digest)}`,
        revision.digest,
      );
  });
  appendCycles(
    lineage.revisions.map((revision, index) => ({
      id: revision.id,
      links: revision.parent === null ? [] : [revision.parent],
      path: `${root}.revisions[${index}].parent`,
    })),
    "design revision",
    out,
  );
  if (!revisionIds.has(lineage.head))
    out.push(
      "type",
      `${root}.head`,
      `design lineage head revision "${lineage.head}" does not resolve`,
      lineage.head,
    );

  const phaseIds = collectIds(
    lineage.phases,
    `${root}.phases`,
    "construction phase",
    out,
  );
  lineage.phases.forEach((phase, index) => {
    const path = `${root}.phases[${index}]`;
    nonEmpty(phase.label, `${path}.label`, "construction phase label", out);
    validateReferences(
      phase.requires,
      phaseIds,
      `${path}.requires`,
      "construction phase",
      out,
    );
  });
  appendCycles(
    lineage.phases.map((phase, index) => ({
      id: phase.id,
      links: phase.requires,
      path: `${root}.phases[${index}].requires`,
    })),
    "construction phase",
    out,
  );

  const covered = new Set<string>();
  lineage.lifecycles.forEach((lifecycle, index) => {
    const path = `${root}.lifecycles[${index}]`;
    if (!subjectIds.has(lifecycle.subject))
      out.push(
        "type",
        `${path}.subject`,
        `lifecycle subject "${lifecycle.subject}" does not resolve`,
        lifecycle.subject,
      );
    if (covered.has(lifecycle.subject))
      out.push(
        "type",
        `${path}.subject`,
        `lifecycle subject "${lifecycle.subject}" already has a lifecycle`,
        lifecycle.subject,
      );
    covered.add(lifecycle.subject);
    for (const field of ["introducedIn", "removedIn"] as const) {
      const phase = lifecycle[field];
      if (phase !== null && !phaseIds.has(phase))
        out.push(
          "type",
          `${path}.${field}`,
          `lifecycle ${field} phase "${phase}" does not resolve`,
          phase,
        );
    }
    if (
      lifecycle.removedIn !== null &&
      phaseIds.has(lifecycle.removedIn) &&
      (lifecycle.introducedIn === null || phaseIds.has(lifecycle.introducedIn))
    ) {
      const before = phasesBefore(lineage, lifecycle.removedIn);
      if (
        lifecycle.introducedIn !== null &&
        !before.has(lifecycle.introducedIn)
      )
        out.push(
          "type",
          `${path}.removedIn`,
          `lifecycle subject "${lifecycle.subject}" is removed in phase "${lifecycle.removedIn}", which does not follow its introducing phase "${lifecycle.introducedIn}"`,
          lifecycle.removedIn,
        );
    }
  });
  lineage.subjects.forEach((subject, index) => {
    if (!covered.has(subject.id))
      out.push(
        "type",
        `${root}.subjects[${index}].id`,
        `lineage subject "${subject.id}" declares no lifecycle; every declared identity needs exactly one`,
        subject.id,
      );
  });

  const variantIds = collectIds(
    lineage.variants,
    `${root}.variants`,
    "design variant",
    out,
  );
  const changeIds = new Set<string>();
  lineage.variants.forEach((variant, index) => {
    const path = `${root}.variants[${index}]`;
    nonEmpty(variant.label, `${path}.label`, "design variant label", out);
    if (!revisionIds.has(variant.base))
      out.push(
        "type",
        `${path}.base`,
        `design variant base revision "${variant.base}" does not resolve`,
        variant.base,
      );
    const edited = new Set<string>();
    variant.changes.forEach((change, changeIndex) => {
      const changePath = `${path}.changes[${changeIndex}]`;
      nonEmpty(change.id, `${changePath}.id`, "design change id", out);
      if (changeIds.has(change.id))
        out.push(
          "type",
          `${changePath}.id`,
          `design change id "${change.id}" must be unique`,
          change.id,
        );
      changeIds.add(change.id);
      if (!subjectIds.has(change.subject))
        out.push(
          "type",
          `${changePath}.subject`,
          `design change subject "${change.subject}" does not resolve`,
          change.subject,
        );
      nonEmpty(
        change.aspect,
        `${changePath}.aspect`,
        "design change aspect",
        out,
      );
      nonEmpty(
        change.rationale,
        `${changePath}.rationale`,
        "design change rationale",
        out,
      );
      const key = record(change.subject, change.aspect);
      if (edited.has(key))
        out.push(
          "type",
          `${changePath}.aspect`,
          `design variant "${variant.id}" changes aspect "${change.aspect}" of subject "${change.subject}" twice`,
          change.aspect,
        );
      edited.add(key);
    });
  });

  collectIds(lineage.decisions, `${root}.decisions`, "design decision", out);
  lineage.decisions.forEach((decision, index) => {
    const path = `${root}.decisions[${index}]`;
    nonEmpty(
      decision.question,
      `${path}.question`,
      "design decision question",
      out,
    );
    if (decision.options.length < 2)
      out.push(
        "range",
        `${path}.options`,
        `a design decision compares at least two alternatives, but cited ${decision.options.length}`,
        decision.options,
      );
    validateReferences(
      decision.options,
      variantIds,
      `${path}.options`,
      "design variant",
      out,
    );
    const bases = new Set(
      decision.options.flatMap((option) => {
        const variant = lineage.variants.find(
          (candidate) => candidate.id === option,
        );
        return variant === undefined ? [] : [variant.base];
      }),
    );
    if (bases.size > 1)
      out.push(
        "type",
        `${path}.options`,
        `design decision "${decision.id}" compares alternatives on ${bases.size} different base revisions; a comparison needs one common basis`,
        decision.options,
      );
    if (
      decision.selected !== null &&
      !decision.options.includes(decision.selected)
    )
      out.push(
        "type",
        `${path}.selected`,
        `design decision selection "${decision.selected}" is not one of the compared alternatives`,
        decision.selected,
      );
  });

  const derivedIds = collectIds(
    lineage.derived,
    `${root}.derived`,
    "derived artifact",
    out,
  );
  const stampable = new Set<string>([...subjectIds, ...derivedIds]);
  const derivedById = new Map(
    lineage.derived.map((artifact) => [artifact.id, artifact] as const),
  );
  const subjectBytes = new Map(
    lineage.subjects.flatMap((subject) =>
      subject.digest === null ? [] : [[subject.id, subject.digest] as const],
    ),
  );
  lineage.derived.forEach((artifact, index) => {
    const path = `${root}.derived[${index}]`;
    if (subjectIds.has(artifact.id))
      out.push(
        "type",
        `${path}.id`,
        `derived artifact id "${artifact.id}" collides with a declared subject identity`,
        artifact.id,
      );
    nonEmpty(artifact.kind, `${path}.kind`, "derived artifact kind", out);
    if (artifact.inputs.length === 0)
      out.push(
        "range",
        `${path}.inputs`,
        "a derived artifact must cite at least one input identity",
        artifact.inputs,
      );
    validateReferences(
      artifact.inputs,
      stampable,
      `${path}.inputs`,
      "lineage identity",
      out,
    );
    if (!DIGEST_PATTERN.test(artifact.digest))
      out.push(
        "type",
        `${path}.digest`,
        `derived artifact digest must be a lowercase "sha256:" hex digest, but was ${String(artifact.digest)}`,
        artifact.digest,
      );
    if (!DIGEST_PATTERN.test(artifact.stamp.configuration))
      out.push(
        "type",
        `${path}.stamp.configuration`,
        `derived artifact configuration digest must be a lowercase "sha256:" hex digest, but was ${String(artifact.stamp.configuration)}`,
        artifact.stamp.configuration,
      );
    if (artifact.stamp.revision !== lineage.head)
      out.push(
        "type",
        `${path}.stamp.revision`,
        `derived artifact "${artifact.id}" is stale: it stamps revision "${artifact.stamp.revision}" while the work is on "${lineage.head}"`,
        artifact.stamp.revision,
      );
    if (artifact.stamp.variant !== null) {
      const variant = lineage.variants.find(
        (candidate) => candidate.id === artifact.stamp.variant,
      );
      if (variant === undefined)
        out.push(
          "type",
          `${path}.stamp.variant`,
          `derived artifact variant "${artifact.stamp.variant}" does not resolve`,
          artifact.stamp.variant,
        );
      else if (variant.base !== artifact.stamp.revision)
        out.push(
          "type",
          `${path}.stamp.variant`,
          `derived artifact "${artifact.id}" applies variant "${variant.id}" of revision "${variant.base}" to revision "${artifact.stamp.revision}"`,
          artifact.stamp.variant,
        );
    }
    if (artifact.stamp.phase !== null && !phaseIds.has(artifact.stamp.phase))
      out.push(
        "type",
        `${path}.stamp.phase`,
        `derived artifact phase "${artifact.stamp.phase}" does not resolve`,
        artifact.stamp.phase,
      );
    artifact.inputs.forEach((input, inputIndex) => {
      const upstream = derivedById.get(input);
      if (upstream !== undefined && !sameStamp(upstream.stamp, artifact.stamp))
        out.push(
          "type",
          `${path}.inputs[${inputIndex}]`,
          `derived artifact "${artifact.id}" is stale against input "${input}", which was computed under a different revision, variant, phase, or configuration`,
          input,
        );
    });
    const importedInputs = new Set(
      artifact.inputs.filter((input) => subjectBytes.has(input)),
    );
    const cited = new Set<string>();
    artifact.assets.forEach((citation, citationIndex) => {
      const citationPath = `${path}.assets[${citationIndex}]`;
      const current = subjectBytes.get(citation.subject);
      if (!importedInputs.has(citation.subject))
        out.push(
          "type",
          `${citationPath}.subject`,
          `derived artifact "${artifact.id}" cites bytes for "${citation.subject}", which is not one of its inputs carrying imported bytes`,
          citation.subject,
        );
      else if (cited.has(citation.subject))
        out.push(
          "type",
          `${citationPath}.subject`,
          `derived artifact "${artifact.id}" cites the bytes of "${citation.subject}" twice`,
          citation.subject,
        );
      else if (citation.digest !== current)
        out.push(
          "type",
          `${citationPath}.digest`,
          `derived artifact "${artifact.id}" is stale against imported input "${citation.subject}": it was computed from ${citation.digest} while that identity now carries ${String(current)}`,
          citation.digest,
        );
      cited.add(citation.subject);
    });
    // In input order, like every other per-artifact complaint above; the set
    // was filled from `artifact.inputs`, so iterating it keeps that order.
    [...importedInputs]
      .filter((input) => !cited.has(input))
      .forEach((input) =>
        out.push(
          "type",
          `${path}.assets`,
          `derived artifact "${artifact.id}" reads imported input "${input}" without citing the bytes it read`,
          artifact.assets,
        ),
      );
  });
  appendCycles(
    lineage.derived.map((artifact, index) => ({
      id: artifact.id,
      links: artifact.inputs,
      path: `${root}.derived[${index}].inputs`,
    })),
    "derived artifact",
    out,
  );

  lineage.decisions.forEach((decision) => {
    const options = new Set(decision.options);
    const seen = new Map<
      string,
      { configuration: string; phase: string | null }
    >();
    lineage.derived.forEach((artifact, artifactIndex) => {
      if (
        artifact.stamp.variant === null ||
        !options.has(artifact.stamp.variant)
      )
        return;
      const previous = seen.get(artifact.kind);
      if (previous === undefined)
        seen.set(artifact.kind, {
          configuration: artifact.stamp.configuration,
          phase: artifact.stamp.phase,
        });
      else if (
        previous.configuration !== artifact.stamp.configuration ||
        previous.phase !== artifact.stamp.phase
      )
        out.push(
          "type",
          `${root}.derived[${artifactIndex}].stamp`,
          `derived artifact "${artifact.id}" compares alternatives of decision "${decision.id}" under a different configuration or phase than another "${artifact.kind}" artifact of the same decision`,
          artifact.stamp,
        );
    });
  });

  return out.toValidation();
};

/**
 * Check a lineage against the identities its host graphs actually publish.
 *
 * Self-consistency is not enough: a lineage annotates ids it does not own, so a
 * renamed wall leaves a phase plan quietly talking about nothing. The caller
 * hands over every stable id its graphs publish, which is why this stays a
 * separate function; binding lineage to one named graph would make it useless
 * to the next fold that lands.
 *
 * A host id absent from the lineage is not an error. Lineage is additive, and a
 * production may phase one wing and leave the rest unannotated. The refusals
 * run the other way: a declared subject that resolves to nothing, and a derived
 * artifact id that squats on a design identity.
 */
export const validateDesignLineageBinding = (props: {
  lineage: IAutoMovieDesignLineage;
  known: readonly string[];
}): IAutoMovieValidation => {
  const { lineage, known } = props;
  const out = new ViolationCollector();
  const root = "$input";
  const published = new Set(known);
  lineage.subjects.forEach((subject, index) => {
    if (!published.has(subject.id))
      out.push(
        "type",
        `${root}.subjects[${index}].id`,
        `lineage subject "${subject.id}" resolves to no published identity`,
        subject.id,
      );
  });
  lineage.derived.forEach((artifact, index) => {
    if (published.has(artifact.id))
      out.push(
        "type",
        `${root}.derived[${index}].id`,
        `derived artifact "${artifact.id}" collides with a published design identity`,
        artifact.id,
      );
  });
  return out.toValidation();
};

/**
 * Order the construction plan deterministically.
 *
 * The plan is a graph, so many orders satisfy it and the authoring order is not
 * one of them: reordering a source array must not reorder a schedule. Ready
 * phases are therefore taken in ascending id order, which makes the answer a
 * function of the plan alone.
 */
export const designLineagePhaseOrder = (
  lineage: IAutoMovieDesignLineage,
): string[] => {
  requireValidLineage(lineage);
  const pending = [...lineage.phases].sort((a, b) =>
    compareCodeUnits(a.id, b.id),
  );
  const emitted = new Set<string>();
  const order: string[] = [];
  while (order.length < pending.length) {
    const next = pending.find(
      (phase) =>
        !emitted.has(phase.id) &&
        phase.requires.every((required) => emitted.has(required)),
    )!;
    emitted.add(next.id);
    order.push(next.id);
  }
  return order;
};

/**
 * Report every declared subject's role and presence once a phase completes.
 *
 * This is the single answer a phased scene, drawing, schedule, and render all
 * read. Four consumers computing "what is standing" four times is four chances
 * to disagree, and a demolition drawing that contradicts the demolition render
 * is worse than neither existing.
 *
 * A null phase asks for the completed work: everything the plan ever removes is
 * gone and everything else stands. That is also the only sensible answer for a
 * lineage that records alternatives without recording a construction sequence.
 */
export const designLineagePhaseSnapshot = (
  lineage: IAutoMovieDesignLineage,
  phase: string | null,
): IAutoMovieDesignPhaseSnapshot => {
  requireValidLineage(lineage);
  requirePhase(lineage, phase);
  const reached =
    phase === null
      ? new Set<string>()
      : new Set<string>([phase, ...phasesBefore(lineage, phase)]);
  const graphs = new Map(
    lineage.subjects.map((subject) => [subject.id, subject.graph] as const),
  );
  const states: IAutoMovieDesignPhaseState[] = lineage.lifecycles
    .map((lifecycle) => {
      const removed = lifecycle.removedIn !== null;
      const existing = lifecycle.introducedIn === null;
      const role: AutoMovieDesignLifecycleRole = existing
        ? removed
          ? "demolished"
          : "retained"
        : removed
          ? "temporary"
          : "new";
      const installed =
        phase === null ||
        lifecycle.introducedIn === null ||
        reached.has(lifecycle.introducedIn);
      const gone =
        lifecycle.removedIn !== null &&
        (phase === null || reached.has(lifecycle.removedIn));
      const presence: AutoMovieDesignPresence = gone
        ? "removed"
        : installed
          ? "present"
          : "pending";
      return {
        subject: lifecycle.subject,
        graph: graphs.get(lifecycle.subject)!,
        role,
        presence,
      };
    })
    .sort((a, b) => compareCodeUnits(a.subject, b.subject));
  return { phase, states };
};

/**
 * Keep only the records that stand at one phase.
 *
 * The filter is generic over anything carrying a stable id, which is the whole
 * mechanism: a set piece list, a drawing's element filter, a schedule, and a
 * render's draw list are phased by the same call, so the four cannot drift.
 *
 * An id this lineage never declared passes through untouched. A partially
 * annotated production must not be silently emptied by adding a phase plan for
 * one wing, and {@link validateDesignLineageBinding} is where a typo is caught
 * instead.
 */
export const designLineageProject = <T extends { id: string }>(
  lineage: IAutoMovieDesignLineage,
  phase: string | null,
  records: readonly T[],
): T[] => {
  const snapshot = designLineagePhaseSnapshot(lineage, phase);
  const presence = new Map(
    snapshot.states.map((state) => [state.subject, state.presence] as const),
  );
  return records.filter((entry) => {
    const state = presence.get(entry.id);
    return state === undefined || state === "present";
  });
};

/**
 * Compare two alternatives on the revision they share.
 *
 * Every difference names one subject id both schemes carry, which is the proof
 * that comparing alternatives did not fork the building. Alternatives on
 * different base revisions are refused rather than compared, because the
 * differences would then mix the two schemes with everything the revision
 * changed underneath them.
 */
export const designLineageCompare = (
  lineage: IAutoMovieDesignLineage,
  left: string,
  right: string,
): IAutoMovieDesignComparison => {
  requireValidLineage(lineage);
  const first = requireVariant(lineage, left);
  const second = requireVariant(lineage, right);
  if (first.base !== second.base)
    throw new Error(
      `design lineage "${lineage.id}" cannot compare variant "${left}" of revision "${first.base}" with variant "${right}" of revision "${second.base}"`,
    );
  const leftValues = new Map(
    first.changes.map(
      (change) => [record(change.subject, change.aspect), change] as const,
    ),
  );
  const rightValues = new Map(
    second.changes.map(
      (change) => [record(change.subject, change.aspect), change] as const,
    ),
  );
  const differences: IAutoMovieDesignDifference[] = [];
  for (const key of new Set([...leftValues.keys(), ...rightValues.keys()])) {
    const leftChange = leftValues.get(key);
    const rightChange = rightValues.get(key);
    const leftValue = leftChange === undefined ? null : leftChange.value;
    const rightValue = rightChange === undefined ? null : rightChange.value;
    if (leftValue === rightValue) continue;
    const sample = (leftChange ?? rightChange)!;
    differences.push({
      subject: sample.subject,
      aspect: sample.aspect,
      left: leftValue,
      right: rightValue,
    });
  }
  differences.sort(
    (a, b) =>
      compareCodeUnits(a.subject, b.subject) ||
      compareCodeUnits(a.aspect, b.aspect),
  );
  const touched = new Set(
    [...first.changes, ...second.changes].map((change) => change.subject),
  );
  return {
    revision: first.base,
    left,
    right,
    common: lineage.subjects
      .map((subject) => subject.id)
      .filter((id) => !touched.has(id))
      .sort(compareCodeUnits),
    differences,
  };
};

/**
 * Compare every pair of alternatives one decision holds open.
 *
 * Pairs come out in ascending option order so a three-way study reads the same
 * way twice. A settled decision is compared exactly like an open one: the
 * rejected schemes are still on the record, and the reason a choice was made is
 * the comparison that produced it.
 */
export const designLineageDecisionComparisons = (
  lineage: IAutoMovieDesignLineage,
  decision: string,
): IAutoMovieDesignComparison[] => {
  requireValidLineage(lineage);
  const found = lineage.decisions.find(
    (candidate) => candidate.id === decision,
  );
  if (found === undefined)
    throw new Error(
      `design lineage "${lineage.id}" has no decision "${decision}"`,
    );
  const options = [...found.options].sort(compareCodeUnits);
  const comparisons: IAutoMovieDesignComparison[] = [];
  for (let index = 0; index < options.length; ++index)
    for (let other = index + 1; other < options.length; ++other)
      comparisons.push(
        designLineageCompare(lineage, options[index]!, options[other]!),
      );
  return comparisons;
};

/**
 * Name exactly the derived artifacts a set of changed identities invalidates.
 *
 * Impact walks the declared derivation edges backwards, so changing one opening
 * reaches the wall mesh cut around it, the finish pieces cut to that wall, the
 * door leaf hosted in it, the schedule line counting them, and the render that
 * drew them, and reaches nothing else. The untouched artifacts are returned
 * beside the invalidated ones because "only these" is a claim about the
 * complement, and a report naming one side alone cannot be checked.
 */
export const designLineageImpact = (
  lineage: IAutoMovieDesignLineage,
  changed: readonly string[],
): IAutoMovieDesignImpact => {
  requireValidLineage(lineage);
  const known = new Set([
    ...lineage.subjects.map((subject) => subject.id),
    ...lineage.derived.map((artifact) => artifact.id),
  ]);
  for (const id of changed)
    if (!known.has(id))
      throw new Error(
        `design lineage "${lineage.id}" has no identity "${id}" to trace`,
      );
  const dependents = new Map<string, string[]>();
  for (const artifact of lineage.derived)
    for (const input of artifact.inputs)
      dependents.set(input, [...(dependents.get(input) ?? []), artifact.id]);
  const derivedIds = new Set(lineage.derived.map((artifact) => artifact.id));
  const invalidated = new Set<string>();
  const visited = new Set<string>();
  const queue = [...changed];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    if (derivedIds.has(current)) invalidated.add(current);
    for (const dependent of dependents.get(current) ?? [])
      queue.push(dependent);
  }
  return {
    changed: [...new Set(changed)].sort(compareCodeUnits),
    invalidated: [...invalidated].sort(compareCodeUnits),
    unaffected: [...derivedIds]
      .filter((id) => !invalidated.has(id))
      .sort(compareCodeUnits),
  };
};

/**
 * Digest the whole lineage record.
 *
 * Serialization is length-prefixed and sorted by code unit, never by locale and
 * never in authoring order, so the same authored lineage digests identically on
 * Windows and POSIX and after any reshuffle of its arrays. Every separator is
 * written here rather than taken from the platform, which is why no newline
 * convention can reach the bytes.
 */
export const designLineageDigest = (
  lineage: IAutoMovieDesignLineage,
): AutoMovieContentDigest => {
  requireValidLineage(lineage);
  const lines: string[] = [
    record("lineage", lineage.id, String(lineage.version), lineage.head),
    ...[...lineage.subjects]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .map((subject) =>
        record("subject", subject.id, subject.graph, subject.digest ?? ""),
      ),
    ...[...lineage.revisions]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .map((revision) =>
        record("revision", revision.id, revision.parent ?? "", revision.digest),
      ),
    ...[...lineage.phases]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .map((phase) =>
        record(
          "phase",
          phase.id,
          phase.label,
          ...[...phase.requires].sort(compareCodeUnits),
        ),
      ),
    ...[...lineage.lifecycles]
      .sort((a, b) => compareCodeUnits(a.subject, b.subject))
      .map((lifecycle) =>
        record(
          "lifecycle",
          lifecycle.subject,
          lifecycle.introducedIn ?? "",
          lifecycle.removedIn ?? "",
        ),
      ),
    ...[...lineage.variants]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .flatMap((variant) => [
        record("variant", variant.id, variant.label, variant.base),
        ...[...variant.changes]
          .sort((a, b) => compareCodeUnits(a.id, b.id))
          .map((change) =>
            record(
              "change",
              variant.id,
              change.id,
              change.subject,
              change.aspect,
              change.value,
              change.rationale,
            ),
          ),
      ]),
    ...[...lineage.decisions]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .map((decision) =>
        record(
          "decision",
          decision.id,
          decision.question,
          decision.selected ?? "",
          ...[...decision.options].sort(compareCodeUnits),
        ),
      ),
    // An artifact's asset citations are deliberately not digested. This runs
    // only on a validated record, and there a citation exists for exactly the
    // inputs that carry imported bytes, at exactly the digests those subjects
    // declare; both facts are already in the subject and derived lines. Two
    // valid lineages therefore cannot differ in citations without differing in
    // something serialized here, so digesting them would certify nothing new.
    ...[...lineage.derived]
      .sort((a, b) => compareCodeUnits(a.id, b.id))
      .map((artifact) =>
        record(
          "derived",
          artifact.id,
          artifact.kind,
          artifact.digest,
          artifact.stamp.revision,
          artifact.stamp.variant ?? "",
          artifact.stamp.phase ?? "",
          artifact.stamp.configuration,
          ...[...artifact.inputs].sort(compareCodeUnits),
        ),
      ),
  ];
  return autoMovieRenderDigest(lines.join("\n"));
};

/**
 * Digest one view of the design: a revision, an alternative, and a phase.
 *
 * This is the replay handle every derived artifact should have been produced
 * against. Two runs of the same alternative at the same phase digest
 * identically, two alternatives of the same revision digest differently, and a
 * texture whose bytes changed moves the digest even though not one line of the
 * design moved, because a subject's own content digest is part of the view.
 */
export const designLineageViewDigest = (
  lineage: IAutoMovieDesignLineage,
  view: { variant: string | null; phase: string | null },
): AutoMovieContentDigest => {
  const snapshot = designLineagePhaseSnapshot(lineage, view.phase);
  const variant =
    view.variant === null ? null : requireVariant(lineage, view.variant);
  const revision =
    variant === null
      ? lineage.revisions.find((candidate) => candidate.id === lineage.head)!
      : lineage.revisions.find((candidate) => candidate.id === variant.base)!;
  const digests = new Map(
    lineage.subjects.map(
      (subject) => [subject.id, subject.digest ?? ""] as const,
    ),
  );
  const applied: IAutoMovieDesignChange[] =
    variant === null ? [] : [...variant.changes];
  applied.sort(
    (a, b) =>
      compareCodeUnits(a.subject, b.subject) ||
      compareCodeUnits(a.aspect, b.aspect),
  );
  const lines: string[] = [
    record(
      "view",
      lineage.id,
      revision.id,
      revision.digest,
      variant === null ? "" : variant.id,
      view.phase ?? "",
    ),
    ...applied.map((change) =>
      record("apply", change.subject, change.aspect, change.value),
    ),
    ...snapshot.states.map((state) =>
      record(
        "state",
        state.subject,
        state.graph,
        state.role,
        state.presence,
        digests.get(state.subject)!,
      ),
    ),
  ];
  return autoMovieRenderDigest(lines.join("\n"));
};

const requireValidLineage = (lineage: IAutoMovieDesignLineage): void => {
  const validated = validateDesignLineage({ lineage });
  if (validated.success === false) {
    const first = validated.violations[0]!;
    throw new Error(
      `design lineage "${lineage.id}" is invalid at ${first.path}: ${first.expected}`,
    );
  }
};

const requirePhase = (
  lineage: IAutoMovieDesignLineage,
  phase: string | null,
): void => {
  if (phase !== null && !lineage.phases.some((entry) => entry.id === phase))
    throw new Error(
      `design lineage "${lineage.id}" has no construction phase "${phase}"`,
    );
};

const requireVariant = (
  lineage: IAutoMovieDesignLineage,
  variant: string,
): IAutoMovieDesignVariant => {
  const found = lineage.variants.find((entry) => entry.id === variant);
  if (found === undefined)
    throw new Error(
      `design lineage "${lineage.id}" has no design variant "${variant}"`,
    );
  return found;
};

/** Every phase that must complete strictly before the given one. */
const phasesBefore = (
  lineage: IAutoMovieDesignLineage,
  phase: string,
): Set<string> => {
  const byId = new Map(
    lineage.phases.map((entry) => [entry.id, entry] as const),
  );
  const before = new Set<string>();
  const queue = [...byId.get(phase)!.requires];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (before.has(current)) continue;
    before.add(current);
    // A prerequisite naming no phase is reported on its own path; walking it
    // further would only repeat that one defect as an ordering complaint.
    const next = byId.get(current);
    if (next !== undefined) queue.push(...next.requires);
  }
  return before;
};

const sameStamp = (
  a: IAutoMovieDesignStamp,
  b: IAutoMovieDesignStamp,
): boolean =>
  a.revision === b.revision &&
  a.variant === b.variant &&
  a.phase === b.phase &&
  a.configuration === b.configuration;

/** Length-prefix every field so no authored text can forge a separator. */
const record = (...fields: readonly string[]): string =>
  fields.map((field) => `${field.length}:${field}`).join("|");

const collectIds = <T extends { id: string }>(
  records: readonly T[],
  path: string,
  label: string,
  collector: ViolationCollector,
): Set<string> => {
  const ids = new Set<string>();
  records.forEach((entry, index) => {
    nonEmpty(entry.id, `${path}[${index}].id`, `${label} id`, collector);
    if (ids.has(entry.id))
      collector.push(
        "type",
        `${path}[${index}].id`,
        `${label} id "${entry.id}" must be unique`,
        entry.id,
      );
    ids.add(entry.id);
  });
  return ids;
};

const validateReferences = (
  references: readonly string[],
  targets: ReadonlySet<string>,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  const seen = new Set<string>();
  references.forEach((reference, index) => {
    if (!targets.has(reference))
      collector.push(
        "type",
        `${path}[${index}]`,
        `${label} "${reference}" does not resolve`,
        reference,
      );
    if (seen.has(reference))
      collector.push(
        "type",
        `${path}[${index}]`,
        `${label} "${reference}" is duplicated`,
        reference,
      );
    seen.add(reference);
  });
};

const appendCycles = (
  nodes: readonly { id: string; links: readonly string[]; path: string }[],
  label: string,
  collector: ViolationCollector,
): void => {
  const byId = new Map(nodes.map((node) => [node.id, node] as const));
  const states = new Map<string, "visiting" | "visited">();
  const visit = (node: {
    id: string;
    links: readonly string[];
    path: string;
  }): void => {
    const state = states.get(node.id);
    if (state === "visited") return;
    if (state === "visiting") {
      collector.push(
        "type",
        node.path,
        `${label} graph must be acyclic`,
        node.links,
      );
      return;
    }
    states.set(node.id, "visiting");
    for (const link of node.links) {
      const next = byId.get(link);
      if (next !== undefined) visit(next);
    }
    states.set(node.id, "visited");
  };
  nodes.forEach(visit);
};

const nonEmpty = (
  value: string,
  path: string,
  label: string,
  collector: ViolationCollector,
): void => {
  if (value.trim().length === 0)
    collector.push("type", path, `${label} must be non-empty`, value);
};
