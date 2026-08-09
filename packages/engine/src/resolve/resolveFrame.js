import { applyChannelLimit, } from "./applyChannelLimit";
import { bindProfile } from "./bindProfile";
import { channelKey } from "./channel";
import { composeScene } from "./composeScene";
import { resolveDrivers } from "./resolveDrivers";
import { sampleClip, sampleClipSequence, } from "./sampleClip";
import { stepSpring, } from "./spring";
import { childrenIndex, resolveWorldDrivers } from "./worldDrivers";
import { readWorld } from "./worldShared";
/**
 * Resolve one frame of a scene: SAMPLE the clip, DRIVE the channel-space
 * drivers, CONSTRAIN the values to their channel limits, COMPOSE the node
 * hierarchy into world matrices, then run the world-space DRIVE pass
 * (aim/parent/two-bone and iterative ccd/fabrik IK) and, when the caller
 * threads `springs` state, STEP every spring driver.
 *
 * This is the engine's per-frame entry point and the deterministic core of
 * automovie: given the same scene, clip, limits, drivers, time (and spring
 * state) it always yields the same matrices, the property that makes the
 * renderer a reproducible diffusion alternative. Every solver runs on a fixed
 * budget, so nothing here is host-dependent; springs without a `springs` input
 * are the one thing still surfaced in `deferredDrivers`.
 *
 * @author Samchon
 */
export const resolveFrame = (input) => {
    const sampled = input.clip === null
        ? new Map()
        : Array.isArray(input.clip)
            ? sampleClipSequence(input.clip, input.seconds)
            : sampleClip(input.clip, input.seconds);
    // Bind applied profiles and merge: profile-bound limits/drivers first, the
    // caller's direct inputs after (the caller's word is final: a direct limit
    // clamps last; direct world drivers apply after profile-bound ones).
    const limitEntries = [];
    const drivers = [];
    for (const application of input.profiles ?? []) {
        const bound = bindProfile(application);
        for (const limit of bound.limits)
            limitEntries.push({ limit, profile: application.profile.id });
        drivers.push(...bound.drivers);
    }
    for (const limit of input.limits)
        limitEntries.push({ limit, profile: null });
    drivers.push(...(input.drivers ?? []));
    // DRIVE (channel-space): resolve copy/driven into the sampled map; collect the
    // world-space drivers the post-compose pass owns.
    const nodesById = new Map(input.nodes.map((n) => [n.id, n]));
    const worldSpaceDrivers = drivers.length > 0 ? resolveDrivers(drivers, sampled, nodesById) : [];
    validateSampledNodeChannels(sampled, nodesById);
    // CONSTRAIN: clamp each sampled channel that carries a limit, in place.
    const violations = [];
    for (const entry of limitEntries) {
        const key = channelKey(entry.limit.channel);
        const hit = sampled.get(key);
        if (hit === undefined)
            continue;
        const outcome = applyChannelLimit(hit.value, entry.limit);
        hit.value = outcome.value;
        for (const v of outcome.violations)
            violations.push(entry.profile === null
                ? { ...v, channel: key }
                : { ...v, channel: key, profile: entry.profile });
    }
    // Fold node-targeting samples into per-node transform overrides + weights.
    const overrides = new Map();
    const weights = new Map();
    for (const node of input.nodes) {
        const t = sampled.get(`node:${node.id}:translation`);
        const r = sampled.get(`node:${node.id}:rotation`);
        const s = sampled.get(`node:${node.id}:scale`);
        if (t !== undefined || r !== undefined || s !== undefined)
            overrides.set(node.id, {
                translation: t ? toVec3(t.value) : node.transform.translation,
                rotation: r ? toQuat(r.value) : node.transform.rotation,
                scale: s ? toVec3(s.value) : node.transform.scale,
            });
        const w = sampled.get(`node:${node.id}:weights`);
        if (w !== undefined)
            weights.set(node.id, w.value);
    }
    // COMPOSE, then the WORLD-SPACE DRIVE pass (aim/parent/analytic + iterative
    // IK) over the composed hierarchy; springs step afterward when state+dt are
    // threaded, and defer otherwise.
    const world = composeScene(input.nodes, overrides);
    const localById = new Map();
    for (const node of input.nodes)
        localById.set(node.id, overrides.get(node.id) ?? node.transform);
    const afterWorldPass = resolveWorldDrivers(worldSpaceDrivers, world, localById, childrenIndex(input.nodes));
    // STEP springs (the one stateful driver) inside the frame when the caller
    // provides the cross-frame state; colliders ride their nodes' world matrices.
    let deferredDrivers = afterWorldPass;
    if (input.springs !== undefined) {
        const spheres = (input.springs.colliders ?? []).map((c) => ({
            center: positionOf(readWorld(world, c.node, "spring collider")),
            radius: c.radius,
        }));
        deferredDrivers = [];
        for (const d of afterWorldPass)
            if (d.type === "spring") {
                seedSprungPositions(d.chain, world, input.springs.state);
                stepSpring(d, world, input.springs.state, input.springs.dt, localById, spheres);
            }
            else
                deferredDrivers.push(d);
    }
    return { world, weights, violations, deferredDrivers };
};
/**
 * Seed a spring chain's non-root joints from the state's post-spring positions
 * of the previous frame. A host loop carries its mutated world map across
 * steps; `resolveFrame` composes fresh from the animation every frame, so
 * without this the spring would restart from the animated pose each time and
 * never accumulate sag. Rotation/scale stay animated: spring only owns the
 * position, exactly like {@link stepSpring}'s own write.
 */
const seedSprungPositions = (chain, world, state) => {
    for (let i = 1; i < chain.length; ++i) {
        const id = chain[i];
        const carried = state.sprung.get(id);
        if (carried === undefined)
            continue;
        const m = readWorld(world, id, "spring chain");
        const next = [...m];
        next[12] = carried.x;
        next[13] = carried.y;
        next[14] = carried.z;
        world.set(id, next);
    }
};
/** Translation column of a column-major world matrix. */
const positionOf = (m) => ({ x: m[12], y: m[13], z: m[14] });
const toVec3 = (a) => ({ x: a[0], y: a[1], z: a[2] });
const toQuat = (a) => ({ x: a[0], y: a[1], z: a[2], w: a[3] });
const validateSampledNodeChannels = (sampled, nodesById) => {
    for (const [key, hit] of sampled) {
        if (hit.channel.kind !== "node")
            continue;
        if (!nodesById.has(hit.channel.node))
            throw new Error(`sampled channel "${key}" references missing node "${hit.channel.node}"`);
    }
};
//# sourceMappingURL=resolveFrame.js.map