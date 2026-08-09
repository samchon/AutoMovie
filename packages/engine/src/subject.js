const CONTRIBUTION_KEYS = [
    "actors",
    "clips",
    "formationMotions",
    "formationSlotMotions",
    "effectCues",
    "landmarks",
    "surfaces",
    "routes",
    "effectRecipes",
    "effectZones",
    "instanceSets",
];
/**
 * Merge what several subjects contribute into one contribution.
 *
 * Order is the order given, so a group that lists its members in a stable order
 * merges to the same bytes every run. Nothing is deduplicated: two subjects
 * claiming the same id is a defect for the compiler's own uniqueness checks to
 * report, and silently collapsing it here would hide the collision from the
 * gate that owns it.
 */
export const mergeAutoMovieSubjectContributions = (contributions) => {
    const merged = {};
    for (const contribution of contributions)
        for (const key of CONTRIBUTION_KEYS) {
            const values = contribution[key];
            if (values === undefined || values.length === 0)
                continue;
            const bucket = (merged[key] ??= []);
            for (const value of values)
                bucket.push(value);
        }
    return merged;
};
/**
 * One thing in a production: a performer, a prop, a place, or a population.
 *
 * A subject owns four obligations that were previously scattered. Its
 * constraints are checked where it is built rather than asserted in a comment;
 * its motions are methods rather than strings in a `capabilities` array; its
 * utilities answer questions about it rather than living as free functions the
 * caller has to locate; and its `render` states what it puts into a shot.
 *
 * `design` is the wire. A class is an authoring surface and never reaches the
 * compile sandbox, so everything the compiler stores and validates leaves
 * through this one method as the plain record it already understands. Two
 * constructions with the same inputs must produce byte-identical records, which
 * is what keeps the same design compiling to the same frames.
 *
 * Utilities delegate to the engine functions that already compute their
 * answers. Reimplementing that arithmetic here would produce a second answer
 * that can disagree with the first, which is the failure mode the whole
 * one-owner rule exists to prevent.
 */
export class AutoMovieSubject {
}
/**
 * A subject that is a collection of subjects.
 *
 * A cluster holds figures, a group holds clusters, a village holds buildings, a
 * map holds everything standing on it. The shape is the same at every level,
 * which is what makes a line battle authorable: a group advancing is one call
 * rather than two thousand.
 *
 * `render` composes its members by default, so a group states what it holds and
 * how it is arranged, not how to draw it. A group that needs to add something
 * of its own (a banner, a dust cue, a shared route) overrides `render` and
 * merges its own contribution with `super.render`, rather than replacing what
 * its members said.
 */
export class AutoMovieSubjectGroup extends AutoMovieSubject {
    render(context) {
        return mergeAutoMovieSubjectContributions(this.members().map((member) => member.render(context)));
    }
}
//# sourceMappingURL=subject.js.map