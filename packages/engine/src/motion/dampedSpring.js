const assertFinite = (label, value) => {
    if (!Number.isFinite(value))
        throw new Error(`${label} must be finite`);
};
/**
 * Advance a one-dimensional damped spring one fixed timestep (semi-implicit
 * Euler): a generic numeric integrator for **secondary motion**, a value that
 * lags, overshoots, and settles toward a moving target instead of snapping to
 * it. Driving a tail or ear joint's angle through this off the animated target
 * gives the follow-through a physics joint produces, while staying a pure,
 * deterministic function (same inputs → same output, replayable
 * frame-for-frame).
 *
 * `force = stiffness·(target − current) − damping·velocity`, integrated as
 * `velocity += force·dt; value += velocity·dt`. Unlike the world-space
 * {@link stepSpring} (VRM SpringBone, for the Node/Channel core), this works in
 * the humanoid pose path's angle space.
 *
 * @author Samchon
 */
export const dampedSpring = (current, velocity, target, params, dt) => {
    assertFinite("spring current", current);
    assertFinite("spring velocity", velocity);
    assertFinite("spring target", target);
    assertFinite("spring stiffness", params.stiffness);
    assertFinite("spring damping", params.damping);
    assertFinite("spring dt", dt);
    if (params.stiffness < 0)
        throw new Error("spring stiffness must be non-negative");
    if (params.damping < 0)
        throw new Error("spring damping must be non-negative");
    if (dt <= 0)
        throw new Error("spring dt must be positive");
    const force = params.stiffness * (target - current) - params.damping * velocity;
    const nextVelocity = velocity + force * dt;
    return { value: current + nextVelocity * dt, velocity: nextVelocity };
};
//# sourceMappingURL=dampedSpring.js.map