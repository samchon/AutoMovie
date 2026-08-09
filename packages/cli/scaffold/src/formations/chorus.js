import { AutoMovieSubjectGroup, } from "@automovie/engine";
import { chorusHero } from "../units/chorusHero";
/**
 * The chorus as one subject, not as two thousand authored actors.
 *
 * A group is where arrangement lives. The members it holds state what one of
 * them is; this states how many there are, how they stand, and what the whole
 * can do. Count, layout, anchor, facing and seed derive every member, so the
 * compiler stores bounded chunks instead of scene nodes and the rows regenerate
 * from index and seed alone.
 *
 * The seed is declared here rather than chosen in source, so the same design
 * always materializes the same chorus.
 */
export class Chorus extends AutoMovieSubjectGroup {
    id = "chorus";
    /**
     * How many members stand in the group.
     *
     * Authored rather than derived from rows times columns, because the last row
     * is deliberately short: a group whose every row is exactly full reads as a
     * lattice, and the silhouette this specification asks for is a real edge.
     *
     * Typed `number` rather than left to infer `2049`. A measurement is not the
     * one value it currently holds, and a literal type says a specialisation of
     * this group may never state a different one, which is the composition the
     * class layer exists for.
     */
    count = 2049;
    /** Rows deep, front to back. */
    ranks = 33;
    /** Members across one row. */
    files = 64;
    /**
     * The interval between members, in metres.
     *
     * The specification says anything that destroys the interval destroys the
     * subject, which makes this the group's load-bearing measurement rather than
     * a layout convenience.
     */
    spacing = {
        lateral: 0.5,
        depth: 1,
    };
    /** The deterministic seed every per-member variation is drawn from. */
    seed = 1415;
    /**
     * Where the front of the group stands, in metres.
     *
     * A field rather than a literal inside the record, because the place that
     * holds the group has to know it: {@link reach} measures from here, and
     * reaching into `design()` for one number would run the record's own
     * validation to read a coordinate.
     */
    anchor = {
        x: 0,
        y: 0,
        z: -5,
    };
    /** Which way the rows face, in degrees. */
    facingDeg = 180;
    /**
     * How far the group steps forward when a shot puts it in motion, in metres.
     *
     * The group owns the distance rather than each shot choosing one, because the
     * place it stands on has to be large enough to hold the step and a plaza
     * sized to a number no shot agreed to is a plaza the group walks off.
     *
     * Like every measured fact here it carries no citation of its own, because
     * `@ttsc/evidence` does not yet select a class field as a unit
     * (samchon/ttsc#1121). The instance's tag answers for it until then.
     */
    advanceMetres = 2;
    members() {
        return [chorusHero];
    }
    /**
     * The formation record the compiler materializes members from.
     *
     * No `dressing` tolerance is declared. This group is specified as in order
     * while the cue is given and still in order after it, so a deviation here
     * would be a dramatic event nobody authored.
     *
     * The constraint is checked here rather than in a constructor. A subclass
     * that overrides a measurement sets its own fields after the base constructor
     * has already run, so a constructor would validate numbers the subject no
     * longer has. `design()` is where the record leaves the class, which makes it
     * the one place every construction has to pass through.
     *
     * @evidence docs/characters/chorus.md States the rows stay in order and that
     *   any loosening must be authored as a dramatic event.
     */
    design() {
        const slots = this.ranks * this.files;
        if (this.count <= slots - this.files || this.count > slots)
            throw new Error(`docs/characters/chorus.md requires rows and columns legible as rows and columns, so a count of ${this.count} cannot stand in ${this.ranks} rows of ${this.files}: that leaves ${this.count > slots ? `${this.count - slots} with no slot` : "the last row empty"}. Choose a count above ${slots - this.files} and at most ${slots}.`);
        return {
            id: this.id,
            modelRecipe: chorusHero.id,
            count: this.count,
            layout: {
                kind: "line",
                ranks: this.ranks,
                files: this.files,
                spacing: this.spacing,
            },
            anchor: this.anchor,
            facingDeg: this.facingDeg,
            seed: this.seed,
            capabilities: ["advance", "break"],
            heroOverrides: [
                { slot: 31, actor: "lead" },
                { slot: 1055, actor: "second" },
            ],
        };
    }
    /**
     * Move the whole group forward without changing its intervals.
     *
     * Advancing is the one motion that must not loosen the group, so the spacing
     * scale is held at one on both ends rather than left to whatever the caller
     * passes.
     *
     * The distance is the group's own {@link advanceMetres} rather than a caller's
     * choice, because the place it stands on is sized to hold it. A shot free to
     * pick a farther one would walk the rows off ground nobody widened.
     *
     * @evidence docs/characters/chorus.md States the rows remain in order while
     *   the cue is given and after it.
     */
    advance(props) {
        const held = { lateral: 1, depth: 1 };
        return {
            id: props.id,
            formation: this.id,
            action: "advance",
            start: props.start,
            end: props.end,
            from: {
                translation: { x: 0, y: 0, z: 0 },
                facingOffsetDeg: 0,
                spacingScale: held,
            },
            to: {
                translation: { x: 0, y: 0, z: -this.advanceMetres },
                facingOffsetDeg: 0,
                spacingScale: held,
            },
            easing: "easeInOut",
        };
    }
    /**
     * Open the intervals, which is the authored loosening.
     *
     * The specification permits this only as a dramatic event, so it is a
     * separate method with an explicit scale rather than an option on
     * {@link advance}: a caller has to say it meant to break the group.
     *
     * Unlike {@link advanceMetres}, the scale is the caller's, so the place is not
     * sized for it in advance: a plaza cannot pre-hold every loosening a story
     * might author. A break that pushes the rows past the ground the shot staged
     * is refused at compile time, naming the corner, and widening the place is
     * the answer.
     *
     * @evidence docs/characters/chorus.md States any loosening is a dramatic
     *   event and must be authored as one, never left to chance.
     */
    break(props) {
        return {
            id: props.id,
            formation: this.id,
            action: "break",
            start: props.start,
            end: props.end,
            from: {
                translation: { x: 0, y: 0, z: 0 },
                facingOffsetDeg: 0,
                spacingScale: { lateral: 1, depth: 1 },
            },
            to: {
                translation: { x: 0, y: 0, z: 0 },
                facingOffsetDeg: 0,
                spacingScale: { lateral: props.scale, depth: props.scale },
            },
            easing: "easeOut",
        };
    }
    /**
     * How wide and deep the group stands, in metres.
     *
     * A utility the camera needs and the record does not state: framing the whole
     * group means knowing its footprint, and computing it at each call site is
     * how two shots end up disagreeing about where the edge is.
     *
     * @evidence docs/characters/chorus.md States the group reads by its edges,
     *   which is the measurement this returns.
     */
    footprint() {
        return {
            width: (this.files - 1) * this.spacing.lateral,
            depth: (this.ranks - 1) * this.spacing.depth,
        };
    }
    /**
     * How far the group reaches from the world origin, along either axis.
     *
     * The footprint says how big the group is; this says where it ends, which is
     * the question a place has to answer. Depth is measured from the anchor
     * outward rather than centred, because a row forms up behind its anchor
     * rather than around it, and the sign of the facing cannot make it reach less
     * far, and it carries {@link advanceMetres} because a place has to hold the
     * group where it goes rather than only where it forms up.
     *
     * @evidence docs/characters/chorus.md States the group reads by its edges,
     *   which is what this measures against the ground it stands on.
     */
    reach() {
        const footprint = this.footprint();
        return Math.max(Math.abs(this.anchor.x) + footprint.width / 2, Math.abs(this.anchor.z) + footprint.depth + this.advanceMetres);
    }
    /**
     * The group standing as designed, contributing no cue of its own.
     *
     * A shot that wants the group to move calls {@link advance} or {@link break}
     * and merges the cue; standing still is the default because the specification
     * treats motion as an event rather than a state.
     *
     * @evidence docs/characters/chorus.md States the rows are in order while the
     *   cue is given, which is a group that holds rather than moves.
     */
    render(context) {
        return super.render(context);
    }
}
/**
 * The production's one chorus.
 *
 * Carries the subject's citation until a class can carry its own
 * (samchon/ttsc#1121).
 *
 * @evidence docs/characters/chorus.md Implements the rows-and-columns
 *   silhouette and the cohesion that specification requires while the cue is
 *   given.
 */
export const chorus = new Chorus();
//# sourceMappingURL=chorus.js.map