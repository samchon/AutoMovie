import { Quaternion } from "@automovie/engine";
/**
 * The MCP ⇄ engine motion bridge. The LLM JSON schema cannot express tuples, so
 * keyframe cubic-bezier controls cross the MCP boundary as named `{x1, y1, x2,
 * y2}` objects ({@link IAutoMovieMcpBezier}) and are converted to and from the
 * engine's `[x1, y1, x2, y2]` tuple here, the single place both directions
 * live, so they cannot drift apart.
 */
/**
 * Lower an MCP placement transform onto the engine's {@link IAutoMovieTransform}
 * (#723, D016): the semantic Euler rotation becomes a quaternion via
 * {@link Quaternion.fromEuler}, and an omitted/`null` rotation is identity, so
 * the LLM authors placements in degrees it understands and never emits a raw
 * quaternion. Translation and scale pass through unchanged.
 */
export const toEngineTransform = (transform) => ({
    translation: transform.translation,
    rotation: transform.rotation === undefined || transform.rotation === null
        ? Quaternion.identity()
        : Quaternion.fromEuler(transform.rotation),
    scale: transform.scale,
});
export const toMcpMotion = (motion) => ({
    ...motion,
    keyframes: motion.keyframes.map((keyframe) => ({
        ...keyframe,
        bezier: toMcpBezier(keyframe.bezier),
    })),
});
export const toMcpBezier = (bezier) => bezier === null
    ? null
    : {
        x1: bezier[0],
        y1: bezier[1],
        x2: bezier[2],
        y2: bezier[3],
    };
export const toEngineMotion = (motion) => ({
    ...motion,
    keyframes: motion.keyframes.map((keyframe) => ({
        ...keyframe,
        bezier: keyframe.bezier === null
            ? null
            : [
                keyframe.bezier.x1,
                keyframe.bezier.y1,
                keyframe.bezier.x2,
                keyframe.bezier.y2,
            ],
    })),
});
/**
 * Lower an MCP prop spec onto the engine's {@link IAutoMoviePropSpec}: the
 * driven drivers' named `{from, to}` ranges become the engine's `[from, to]`
 * pairs, and the gait-less MCP profile becomes a plain profile (a prop does not
 * locomote, so `gaits` is simply absent).
 */
export const toEnginePropSpec = (spec) => ({
    node: spec.node,
    model: spec.model,
    articulation: spec.articulation === null
        ? null
        : {
            nodes: spec.articulation.nodes,
            profile: toEnginePropProfile(spec.articulation.profile),
            binding: spec.articulation.binding,
        },
});
const toEnginePropProfile = (profile) => ({
    id: profile.id,
    name: profile.name,
    controls: profile.controls,
    drivers: profile.drivers.map(toEnginePropDriver),
    limits: profile.limits,
});
const toEnginePropDriver = (driver) => {
    if (driver.type !== "driven")
        return driver;
    // Strip the MCP-form ranges and re-add engine tuples only when present, a
    // curve-driven driver omits both, so it must not carry a dead range (#724).
    const { inRange, outRange, ...rest } = driver;
    return {
        ...rest,
        ...(inRange !== undefined
            ? { inRange: [inRange.from, inRange.to] }
            : {}),
        ...(outRange !== undefined
            ? { outRange: [outRange.from, outRange.to] }
            : {}),
    };
};
//# sourceMappingURL=convert.js.map