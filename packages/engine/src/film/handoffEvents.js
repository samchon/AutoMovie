/** Canonical time key for an interaction event id: six-decimal seconds. */
export const eventTimeKey = (time) => time.toFixed(6);
/**
 * The four scripted-cue events an `attachTo` handoff emits: the child is
 * grabbed and attached at `start`, then detached and released at `end`. One
 * place for the shared envelope (source, actor/target/object, null point and
 * reaction) the coupling rides, kept in its own module so the mapped-literal
 * construction stays clear of {@link performShot}'s hot body.
 */
export const handoffEvents = (child, parent, start, end, actionIndex) => [
    ["grab", start],
    ["attach", start],
    ["detach", end],
    ["release", end],
].map(([kind, time]) => ({
    id: `${kind}:${child}:${parent}:${eventTimeKey(time)}`,
    kind,
    source: "scriptedCue",
    time,
    actor: child,
    target: parent,
    object: child,
    point: null,
    actionIndex,
    reaction: null,
}));
//# sourceMappingURL=handoffEvents.js.map