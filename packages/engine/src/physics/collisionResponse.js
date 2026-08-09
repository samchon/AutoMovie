import { resolveImpact, } from "./impact";
import { impactRecoil, impulseToRecoilPush, } from "./impactRecoil";
/**
 * Suggest how a collision resolves: run {@link resolveImpact} for the impulse,
 * bridge it to a recoil push, and (when a struck `chain` + `skeleton` are
 * given) bound that push by joint ROM into a flinch pose via
 * {@link impactRecoil}. This is the reusable core the pipeline (and
 * {@link detectBodyCollision}) attaches to a contact warning; it wires together
 * resolveImpact and impactRecoil, whose consumer was previously missing.
 *
 * @author Samchon
 */
export const suggestCollisionResponse = (props) => {
    const impact = resolveImpact(props.a, props.b, props.normal);
    const push = impulseToRecoilPush(impact.impulse, props.gainDegPerImpulse);
    const recoil = props.chain !== undefined && props.skeleton !== undefined
        ? impactRecoil(push, props.chain, props.skeleton, props.falloff)
        : null;
    return { impact, push, recoil };
};
//# sourceMappingURL=collisionResponse.js.map