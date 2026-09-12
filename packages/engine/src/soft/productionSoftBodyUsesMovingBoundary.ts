import { IAutoMovieSoftBodyDomain } from "@automovie/interface";

/**
 * Whether a domain requires primary-motion boundary samples at every step.
 *
 * An anchor bound to a node or bone, or a body capsule collider, moves with the
 * primary performance, so the domain can only be solved live against that
 * performance. A domain with neither stays on the static path.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Classifies bound anchors and body capsules as boundaries that must read the primary performance's sample.
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-static-compatibility Leaves a domain without moving anchors or body colliders on the unchanged static path.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Decides from the declared attachment and collision boundary whether a stale static volume would be used.
 */
export const productionSoftBodyUsesMovingBoundary = (
  domain: Pick<IAutoMovieSoftBodyDomain, "anchors" | "colliders">,
): boolean =>
  domain.anchors.some((anchor) => anchor.binding !== undefined) ||
  domain.colliders.some((collider) => collider.kind === "body-capsule");
