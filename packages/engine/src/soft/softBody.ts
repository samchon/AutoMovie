import type {
  IAutoMovieSoftBodyBudget,
  IAutoMovieSoftBodyDomain,
  IAutoMovieSoftBodyState,
  IAutoMovieSoftCollider,
  IAutoMovieVector3,
} from "@automovie/interface";

/**
 * The eight lattice neighbours a particle gathers a correction from.
 *
 * Order is not incidental. The families are gathered as `((structuralU +
 * structuralV) + shear) + (bendU + bendV)`, and inside each family the two
 * mirror partners are added as one two-term sum. Mirroring a panel swaps the
 * partners and negates one coordinate, and a two-term sum is exactly
 * commutative in IEEE-754 while a four-term one is not, so this grouping is
 * what makes a symmetrically authored curtain stay symmetric to the last bit
 * instead of drifting by an ulp per step.
 */
const NEIGHBOURS: ReadonlyArray<
  readonly [column: number, row: number, family: 0 | 1 | 2]
> = [
  [-1, 0, 0],
  [1, 0, 0],
  [0, -1, 0],
  [0, 1, 0],
  [-1, -1, 1],
  [1, -1, 1],
  [-1, 1, 1],
  [1, 1, 1],
  [-2, 0, 2],
  [2, 0, 2],
  [0, -2, 2],
  [0, 2, 2],
];

/**
 * One hard anchor target resolved on the soft solver's fixed step.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Samples moving anchors on the same deterministic clock as cloth.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Carries an already resolved anchor boundary into one step.
 */
export interface IAutoMovieSoftBodyResolvedAnchor {
  /**
   * Anchored row-major particle index.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Keeps the authored cloth attachment identity.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Identifies the hard boundary particle.
   */
  particle: number;
  /**
   * World-space target sampled for this step.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Derives cloth motion from the resolved primary motion.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Supplies the selected moving boundary without inventing it.
   */
  position: IAutoMovieVector3;
}

/**
 * One resolved capsule using the validation proxy's segment-and-radius meaning.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Reuses the shared body collider representation.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Resolves cloth against a bounded moving capsule.
 */
export interface IAutoMovieSoftBodyResolvedCapsule {
  /**
   * Stable source capsule identity.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Keeps collider identity inspectable.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Preserves collider state across steps.
   */
  id: string;
  /**
   * First resolved segment endpoint.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Uses the current body proxy endpoint.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Supplies one moving capsule endpoint.
   */
  from: IAutoMovieVector3;
  /**
   * Second resolved segment endpoint.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Uses the current body proxy endpoint.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Supplies the other moving capsule endpoint.
   */
  to: IAutoMovieVector3;
  /**
   * Shared proxy radius in metres.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Does not create a second body volume.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Reuses the validation capsule radius.
   */
  radius: number;
}

/**
 * Complete moving boundary for one absolute fixed step.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Aligns primary-motion and secondary-motion samples.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Defines the per-step boundary handoff.
 */
export interface IAutoMovieSoftBodyBoundarySample {
  /**
   * Absolute solver step.
   *
   * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Fixes which primary-motion sample is consumed.
   * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Keeps seek deterministic.
   */
  step: number;
  /**
   * Resolved hard anchors for this step.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Drives attachments from declared motion.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Separates static and moving inputs.
   */
  anchors: readonly IAutoMovieSoftBodyResolvedAnchor[];
  /**
   * Resolved body capsules for this step.
   *
   * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-colliders Shares validation collision geometry.
   * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Applies current collider state.
   */
  capsules: readonly IAutoMovieSoftBodyResolvedCapsule[];
}

/**
 * Integrate a soft-body domain to one **absolute** step of its fixed clock.
 *
 * ## The equations
 *
 * The panel is a lattice of particles carrying mass `m` and velocity `v`, tied
 * by distance constraints `C(a, b) = |p_b − p_a| − L(a, b)` whose rest length
 * `L` is the distance the same two particles hold in the authored rest mesh.
 * One step is the position-based scheme of Müller et al. (2007):
 *
 * ```text
 *   v ← (v + a(t)·dt) / (1 + dt·k)          predict, with implicit linear drag
 *   p̃ ← p + v·dt
 *   repeat `iterations` times:               Jacobi projection of every C
 *     Δp_i ← (1/n_i) · Σ_j s · (w_i/(w_i + w_j)) · ((d − L)/d) · (p̃_j − p̃_i)
 *     p̃_i ← p̃_i + Δp_i
 *   p̃ ← project(p̃, colliders)
 *   v ← (p̃ − p)/dt ,  p ← p̃
 * ```
 *
 * With `a(t)` the sum of gravity and the declared draught, `k` the linear drag,
 * `w = 1/m` the inverse mass (exactly `0` for an anchored particle), `s` the
 * family stiffness, `n_i` the number of constraints incident on particle `i`,
 * and `d = |p̃_j − p̃_i|`. Constraint families are the lattice's rows and
 * columns (structural), its diagonals (shear) and its second neighbours
 * (bend).
 *
 * The projection is deliberately **Jacobi**, not Gauss-Seidel: every correction
 * reads the same predicted positions, so the answer does not depend on the
 * order particles happen to be visited, which is the property a deterministic
 * engine needs and a sequential relaxation cannot offer.
 *
 * ## Why it stays well behaved
 *
 * - **Cloth at rest is exact.** A rest length is measured from the rest mesh with
 *   the same expression the solve measures `d` with, so an undisturbed panel
 *   produces `d − L = 0` exactly. With no gravity, no draught and unmoved
 *   anchors, every correction is exactly zero and the panel never drifts,
 *   however many steps are integrated.
 * - **A projection cannot explode.** Each correction moves a particle a fraction
 *   `s ≤ 1` of the way toward satisfying its constraint and is then divided by
 *   the particle's own valence, so a sweep is a contraction. Unlike an explicit
 *   spring force there is no stiffness that can overshoot.
 * - **An anchor is a hard boundary condition.** Its inverse mass is exactly zero,
 *   so it takes no share of any correction, and it is written back to its
 *   target with zero velocity after every step: no constraint and no collider
 *   can drag a curtain off its track.
 * - **A collider is escaped along its own geometry.** A half-space pushes along
 *   its normal, a ball along the radius, a box out of its least-penetrated
 *   face. Contacts are counted, so a panel that never touched anything says
 *   so.
 *
 * Two limits of that last point are stated rather than implied. Colliders are
 * resolved **once each, in the authored order**, so a particle wedged where two
 * colliders overlap can end the step satisfying only the later one; adding a
 * relaxation loop would trade a bounded step for an unbounded one, and the
 * bounded step is what this tier promised. And a particle exactly on a box's
 * mid-plane has no preferred face: the tie is broken toward the maximum side,
 * which is deterministic but is the one place a mirrored panel need not stay
 * mirrored. The constraint fold carries that property; a box collider whose
 * exact centre plane a particle lands on does not.
 *
 * ## Stability
 *
 * A position-based sweep is unconditionally stable, so the limit is not a
 * stiffness Courant number but a **travel** condition: within one step a
 * particle must not move further than the shortest constraint in the panel, or
 * it can cross a collider it should have hit and pull a constraint from the
 * wrong side.
 *
 * ```text
 *   dt · referenceSpeed / shortestRestLength ≤ 1
 * ```
 *
 * That is what {@link softBodyTravelNumber} returns and what
 * {@link validateSoftBodyDomain} refuses to exceed. `referenceSpeed` is the
 * author's declared design budget, exactly as a fluid domain declares the
 * deepest water it is meant for; {@link IAutoMovieSoftBodyState.maxSpeed}
 * reports what the solve actually reached, so the declaration can be checked
 * rather than believed.
 *
 * ## Determinism
 *
 * The state is a pure function of `(domain, step, state)`. Nothing is cached
 * between calls, so seeking backwards, forwards, or in scattered order returns
 * exactly the same numbers as playing straight through — there is no runtime
 * object for an accumulation to hide in. Only `+ − × ÷`, `Math.abs`,
 * `Math.floor` and `Math.sqrt` are used, all of which IEEE-754 specifies
 * exactly, so a domain whose authored numbers are binary-exact reproduces bit
 * for bit on Windows and POSIX alike.
 *
 * The domain is assumed to have passed {@link validateSoftBodyDomain}: that pass
 * is where an array of the wrong length, a zero-length rest edge, a particle
 * already buried in a collider or an unstable step are refused with a path, so
 * the integrator never has to guess what an inconsistent record meant.
 *
 * Throws when `step` is not an integer in `[0, solver.maxSteps]`, when `state`
 * names a state the domain does not declare, and when the state leaves the
 * reals — a genuinely runaway solve is named at the step it first appeared
 * rather than quietly turning into NaN frames a renderer would draw as
 * nothing.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Reconstructs the complete soft-body state at a declared absolute step.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Implements the bounded fixed-step transition of the soft solver.
 * @author Samchon
 */
export const simulateSoftBody = (
  domain: IAutoMovieSoftBodyDomain,
  step: number,
  state: string | null = null,
): IAutoMovieSoftBodyState => {
  if (domain.colliders.some((collider) => collider.kind === "body-capsule"))
    throw new Error(
      `soft body "${domain.id}" needs resolved moving boundaries for body capsules`,
    );
  return simulateSoftBodyCore(domain, step, state, null);
};

/**
 * Integrate cloth against a complete sequence of fixed-step moving boundaries.
 *
 * Samples must cover step zero through the requested step without gaps. Static
 * domain anchors and colliders remain valid and are combined with the moving
 * boundary, so omitting this API preserves the original curtain path byte for
 * byte.
 *
 * @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary Samples the actor boundary on the cloth fixed clock.
 * @evidence specifications/performance-motion-and-staging/kinematics-contact-and-interaction.md#performance-secondary-motion-boundary-choice Implements the explicitly selected moving-boundary path.
 */
export const simulateSoftBodyWithBoundaries = (
  domain: IAutoMovieSoftBodyDomain,
  step: number,
  boundaries: readonly IAutoMovieSoftBodyBoundarySample[],
  state: string | null = null,
): IAutoMovieSoftBodyState => {
  if (boundaries.length !== step + 1)
    throw new Error(
      `soft body "${domain.id}" needs one moving boundary for every step from 0 through ${step}`,
    );
  const movingAnchorParticles = new Set(
    domain.anchors
      .filter((anchor) => anchor.binding !== undefined)
      .map((anchor) => anchor.particle),
  );
  const bodyCapsuleIds = new Set(
    domain.colliders
      .filter((collider) => collider.kind === "body-capsule")
      .map((collider) => collider.id),
  );
  for (let index = 0; index < boundaries.length; ++index) {
    const boundary = boundaries[index]!;
    if (boundary.step !== index)
      throw new Error(
        `soft body "${domain.id}" moving boundary[${index}] must name absolute step ${index}`,
      );
    const particles = new Set<number>();
    for (const anchor of boundary.anchors) {
      if (
        !Number.isSafeInteger(anchor.particle) ||
        anchor.particle < 0 ||
        anchor.particle >= domain.lattice.columns * domain.lattice.rows
      )
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] has an invalid anchor particle`,
        );
      if (!movingAnchorParticles.has(anchor.particle))
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] particle ${anchor.particle} is not an authored moving anchor`,
        );
      if (particles.has(anchor.particle))
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] repeats anchor particle ${anchor.particle}`,
        );
      particles.add(anchor.particle);
      assertVector(anchor.position, `moving boundary[${index}] anchor`);
    }
    for (const particle of movingAnchorParticles)
      if (!particles.has(particle))
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] is missing authored moving anchor particle ${particle}`,
        );
    const capsules = new Set<string>();
    for (const capsule of boundary.capsules) {
      if (capsule.id.trim().length === 0)
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] capsule id must not be blank`,
        );
      if (capsules.has(capsule.id))
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] repeats capsule "${capsule.id}"`,
        );
      if (!bodyCapsuleIds.has(capsule.id))
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] capsule "${capsule.id}" is not an authored body capsule`,
        );
      capsules.add(capsule.id);
      assertVector(capsule.from, `moving boundary[${index}] capsule from`);
      assertVector(capsule.to, `moving boundary[${index}] capsule to`);
      if (!Number.isFinite(capsule.radius) || capsule.radius <= 0)
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] capsule radius must be finite and positive`,
        );
    }
    for (const id of bodyCapsuleIds)
      if (!capsules.has(id))
        throw new Error(
          `soft body "${domain.id}" moving boundary[${index}] is missing authored body capsule "${id}"`,
        );
  }
  return simulateSoftBodyCore(domain, step, state, boundaries);
};

const simulateSoftBodyCore = (
  domain: IAutoMovieSoftBodyDomain,
  step: number,
  state: string | null,
  boundaries: readonly IAutoMovieSoftBodyBoundarySample[] | null,
): IAutoMovieSoftBodyState => {
  if (!Number.isInteger(step) || step < 0)
    throw new Error(
      `soft body "${domain.id}" cannot be seeked to step ${step}: an absolute step must be a non-negative integer`,
    );
  if (step > domain.solver.maxSteps)
    throw new Error(
      `soft body "${domain.id}" cannot be seeked to step ${step}: the declared budget stops at ${domain.solver.maxSteps}`,
    );

  const columns = domain.lattice.columns;
  const rows = domain.lattice.rows;
  const count = columns * rows;
  const dt = domain.solver.fixedStepSeconds;
  const damping = 1 + dt * domain.solver.drag;
  const stiffness = [
    domain.solver.stiffness.structural,
    domain.solver.stiffness.shear,
    domain.solver.stiffness.bend,
  ];

  // Anchors are resolved once: a named state is a boundary condition held for
  // the whole solve, not a keyframe that moves while it is being integrated.
  const position = restConfiguration(domain, state);
  if (boundaries !== null)
    applyResolvedAnchors(position, boundaries[0]!.anchors);
  const velocity = new Float64Array(count * 3);
  const predicted = new Float64Array(count * 3);
  const correction = new Float64Array(count * 3);
  const inverseMass = new Float64Array(count);
  const valence = new Int32Array(count);
  const restLength = new Float64Array(count * NEIGHBOURS.length);

  for (let particle = 0; particle < count; ++particle)
    inverseMass[particle] = 1 / domain.mass[particle];
  for (const anchor of domain.anchors) inverseMass[anchor.particle] = 0;

  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column) {
      const particle = row * columns + column;
      for (let at = 0; at < NEIGHBOURS.length; ++at) {
        const other = neighbourOf(columns, rows, column, row, at);
        if (other < 0) {
          restLength[particle * NEIGHBOURS.length + at] = -1;
          continue;
        }
        restLength[particle * NEIGHBOURS.length + at] = distance(
          domain.rest,
          particle,
          other,
        );
        ++valence[particle];
      }
    }

  const gravity = domain.solver.gravity;
  const draught = windAxis(domain);
  let contacts = 0;

  for (let index = 0; index < step; ++index) {
    const boundary = boundaries?.[index + 1] ?? null;
    if (boundary !== null) applyResolvedAnchors(position, boundary.anchors);
    const gust = windAcceleration(domain, index * dt);
    contacts = 0;

    for (let particle = 0; particle < count; ++particle) {
      const base = particle * 3;
      if (inverseMass[particle] === 0) {
        const moving = boundary?.anchors.find(
          (anchor) => anchor.particle === particle,
        );
        predicted[base] = moving?.position.x ?? position[base];
        predicted[base + 1] = moving?.position.y ?? position[base + 1];
        predicted[base + 2] = moving?.position.z ?? position[base + 2];
        continue;
      }
      velocity[base] =
        (velocity[base] + (gravity.x + draught.x * gust) * dt) / damping;
      velocity[base + 1] =
        (velocity[base + 1] + (gravity.y + draught.y * gust) * dt) / damping;
      velocity[base + 2] =
        (velocity[base + 2] + (gravity.z + draught.z * gust) * dt) / damping;
      predicted[base] = position[base] + velocity[base] * dt;
      predicted[base + 1] = position[base + 1] + velocity[base + 1] * dt;
      predicted[base + 2] = position[base + 2] + velocity[base + 2] * dt;
    }

    for (let sweep = 0; sweep < domain.solver.iterations; ++sweep) {
      gather({
        columns,
        rows,
        predicted,
        correction,
        inverseMass,
        valence,
        restLength,
        stiffness,
      });
      for (let value = 0; value < predicted.length; ++value)
        predicted[value] += correction[value];
    }

    for (let particle = 0; particle < count; ++particle) {
      if (inverseMass[particle] === 0) continue;
      contacts += resolveContacts(domain.colliders, predicted, particle);
      if (boundary !== null)
        contacts += resolveCapsuleContacts(
          boundary.capsules,
          predicted,
          particle,
        );
    }

    for (let particle = 0; particle < count; ++particle) {
      const base = particle * 3;
      if (inverseMass[particle] === 0) {
        velocity[base] = 0;
        velocity[base + 1] = 0;
        velocity[base + 2] = 0;
        position[base] = predicted[base];
        position[base + 1] = predicted[base + 1];
        position[base + 2] = predicted[base + 2];
        continue;
      }
      velocity[base] = (predicted[base] - position[base]) / dt;
      velocity[base + 1] = (predicted[base + 1] - position[base + 1]) / dt;
      velocity[base + 2] = (predicted[base + 2] - position[base + 2]) / dt;
      position[base] = predicted[base];
      position[base + 1] = predicted[base + 1];
      position[base + 2] = predicted[base + 2];
    }

    if (allFinite(position) === false || allFinite(velocity) === false)
      throw new Error(
        `soft body "${domain.id}" produced a non-finite state at step ${index + 1}`,
      );
  }

  let maxSpeed = 0;
  for (let particle = 0; particle < count; ++particle) {
    const base = particle * 3;
    const speed = Math.sqrt(
      velocity[base] * velocity[base] +
        velocity[base + 1] * velocity[base + 1] +
        velocity[base + 2] * velocity[base + 2],
    );
    if (speed > maxSpeed) maxSpeed = speed;
  }

  let maxStrain = 0;
  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column) {
      const particle = row * columns + column;
      // The first four neighbour slots are the structural family; strain is a
      // statement about stretch, and a diagonal or a second neighbour bending
      // is not stretch.
      for (let at = 0; at < 4; ++at) {
        const rest = restLength[particle * NEIGHBOURS.length + at];
        if (rest < 0) continue;
        const other = neighbourOf(columns, rows, column, row, at);
        const strain =
          Math.abs(distance(position, particle, other) - rest) / rest;
        if (strain > maxStrain) maxStrain = strain;
      }
    }

  return {
    domain: domain.id,
    state,
    step,
    time: step * dt,
    positions: Array.from(position),
    velocities: Array.from(velocity),
    maxSpeed,
    maxStrain,
    contacts,
  };
};

/**
 * The configuration a panel is in before a single step is integrated: the
 * authored rest mesh with every anchor's own target written in, and one named
 * state's poses written over that.
 *
 * The rest mesh alone is not where the panel hangs. An anchor may hold its
 * particle somewhere else entirely, a named state moves it again, and both are
 * boundary conditions no sweep ever relaxes. Anything that must know where the
 * cloth actually starts — a containment check against the room a furnishing
 * binds it to, a bounding volume drawn before the first frame — reads this
 * rather than {@link IAutoMovieSoftBodyDomain.rest}, or it answers for a shape
 * the panel is never in.
 *
 * An anchor whose particle index falls outside the lattice writes nothing, the
 * same way the solver drops it: an out-of-range anchor is refused on its own
 * path by {@link validateSoftBodyDomain}, and inventing a particle for it here
 * would lengthen the very array whose length is the record's contract.
 *
 * Throws when `state` names a state the domain does not declare, exactly as
 * {@link simulateSoftBody} does.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-anchors Applies the declared anchor constraints to the selected rest configuration.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-static-moving-anchor-input Resolves the step-zero state from static anchor inputs.
 * @author Samchon
 */
export const softBodyRestConfiguration = (
  domain: IAutoMovieSoftBodyDomain,
  state: string | null = null,
): number[] => Array.from(restConfiguration(domain, state));

/**
 * The absolute step one shot second snaps down to, or `null` when that second
 * is not a real number.
 *
 * The snap is what makes playback frame-rate independent: captures at 24 and 30
 * fps read the same integrated state whenever they land inside the same step,
 * instead of each integrating a different number of times. A second before the
 * clock starts snaps to `0`, since a panel has no history earlier than its own
 * rest configuration.
 *
 * Stated apart from {@link sampleSoftBody} so a caller that must report rather
 * than throw — a lowering answering for a whole shot — can ask which step a
 * second wants before asking whether the declared budget reaches it.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Maps shot time to the soft solver's absolute fixed-step state.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Selects the exact transition boundary without advancing hidden state.
 * @author Samchon
 */
export const softBodyStepAt = (
  domain: IAutoMovieSoftBodyDomain,
  time: number,
): number | null => {
  if (!Number.isFinite(time)) return null;
  const clamped = time > 0 ? time : 0;
  return Math.floor(clamped / domain.solver.fixedStepSeconds + 1e-9);
};

/**
 * Sample a soft-body domain at a shot second, snapping down to its fixed step.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Returns the repeatable state at the requested shot time.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Applies the bounded transition sequence through the snapped step.
 * @author Samchon
 */
export const sampleSoftBody = (
  domain: IAutoMovieSoftBodyDomain,
  time: number,
  state: string | null = null,
): IAutoMovieSoftBodyState => {
  const step = softBodyStepAt(domain, time);
  if (step === null)
    throw new Error(
      `soft body "${domain.id}" cannot be sampled at a non-finite time`,
    );
  return simulateSoftBody(domain, step, state);
};

/**
 * The travel number of the panel: `dt · referenceSpeed / shortestRestLength`.
 *
 * At most `1` for a projection that cannot tunnel. It is the single number that
 * says whether the authored step, lattice spacing and design speed can be
 * integrated at all, which is why the validator reads it instead of guessing a
 * step on the author's behalf. A lattice with no constraint at all — a single
 * particle — has nothing to cross and returns `0`.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-fidelity-boundary Measures whether the declared step can honor the bounded no-tunneling tier.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-failure-and-fidelity-boundary Supplies the numeric condition used to refuse unsupported soft motion.
 * @author Samchon
 */
export const softBodyTravelNumber = (
  domain: IAutoMovieSoftBodyDomain,
): number => {
  const shortest = shortestRestLength(domain);
  if (shortest === Infinity) return 0;
  return (
    (domain.solver.fixedStepSeconds * domain.solver.referenceSpeed) / shortest
  );
};

/**
 * The bounded cost a soft-body domain adds to a shot, derived from the record
 * alone.
 *
 * Nothing here integrates a step: a production is refused for an unaffordable
 * panel before the first solve, and the same numbers ride into the compiler's
 * report so a reviewer sees what the fabric cost.
 *
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget Prices soft-body work across the declared shot horizon.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#budget-frame-shot-sequence-composition Supplies the particle, constraint, and iteration cost for composition.
 * @author Samchon
 */
export const softBodyBudget = (
  domain: IAutoMovieSoftBodyDomain,
): IAutoMovieSoftBodyBudget => {
  const columns = domain.lattice.columns;
  const rows = domain.lattice.rows;
  const particles = columns * rows;
  const span = (length: number, reach: number): number =>
    length > reach ? length - reach : 0;
  const quads = span(columns, 1) * span(rows, 1);
  const structural = span(columns, 1) * rows + columns * span(rows, 1);
  const shear = 2 * quads;
  const bend = span(columns, 2) * rows + columns * span(rows, 2);
  return {
    domain: domain.id,
    particles,
    triangles: 2 * quads,
    structural,
    shear,
    bend,
    colliders: domain.colliders.length,
    stateBytes: 8 * 6 * particles,
    maxSteps: domain.solver.maxSteps,
    worstCaseGathers:
      2 *
      (structural + shear + bend) *
      domain.solver.iterations *
      domain.solver.maxSteps,
    travel: softBodyTravelNumber(domain),
  };
};

/**
 * A stable 32-bit FNV-1a digest of one soft-body state's exact bytes, as
 * lowercase hex.
 *
 * Two states digest alike only when every position, velocity and measurement is
 * bit-identical, so it is the compact evidence that a replay, a reordered seek,
 * or a second machine reproduced the reference state rather than merely a close
 * one.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-solver-state Records exact equality of one computed soft-body state.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-collider-and-solver-transition Provides the repeatability receipt for a fixed-step transition result.
 * @author Samchon
 */
export const softBodyStateDigest = (state: IAutoMovieSoftBodyState): string => {
  const values = [
    state.step,
    ...state.positions,
    ...state.velocities,
    state.maxSpeed,
    state.maxStrain,
    state.contacts,
  ];
  const view = new DataView(new ArrayBuffer(8));
  let hash = 0x811c9dc5;
  for (const value of values) {
    view.setFloat64(0, value, true);
    for (let byte = 0; byte < 8; ++byte) {
      hash = (hash ^ view.getUint8(byte)) >>> 0;
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
  }
  return hash.toString(16).padStart(8, "0");
};

/**
 * The shortest structural rest edge, or `Infinity` when there is none.
 *
 * A lattice whose rest array does not hold exactly one coordinate triple per
 * particle has no answerable shortest edge and is reported as having none. That
 * is not politeness: the walk is over the **declared** lattice, so a record
 * claiming a billion columns would otherwise be walked a billion times by the
 * very validator that exists to refuse it, and by every budget report anybody
 * asked for on the way. The length mismatch is refused on its own path.
 *
 * @evidence requirements/effects-and-simulation/soft-bodies-and-deformation.md#effects-soft-fidelity-boundary Measures the spatial bound that makes the fixed-step tier supportable.
 * @evidence specifications/simulation-effects-and-sound/soft-bodies-and-deformation.md#soft-failure-and-fidelity-boundary Returns no fabricated length when the authored lattice is inconsistent.
 */
export const shortestRestLength = (
  domain: IAutoMovieSoftBodyDomain,
): number => {
  const columns = domain.lattice.columns;
  const rows = domain.lattice.rows;
  if (domain.rest.length !== columns * rows * 3) return Infinity;
  let shortest = Infinity;
  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column) {
      const particle = row * columns + column;
      if (column + 1 < columns) {
        const length = distance(domain.rest, particle, particle + 1);
        if (length < shortest) shortest = length;
      }
      if (row + 1 < rows) {
        const length = distance(domain.rest, particle, particle + columns);
        if (length < shortest) shortest = length;
      }
    }
  return shortest;
};

/**
 * {@link softBodyRestConfiguration} as the solver's own working buffer.
 *
 * The exported form hands back a plain array, which is what a validator and a
 * consumer want; the solve integrates in place and would otherwise copy the
 * whole panel twice per seek for nothing.
 */
const restConfiguration = (
  domain: IAutoMovieSoftBodyDomain,
  state: string | null,
): Float64Array => {
  const position = Float64Array.from(domain.rest);
  const poses = resolveState(domain, state);
  for (const anchor of domain.anchors) {
    const moved = poses.get(anchor.id);
    const target = moved ??
      anchor.position ?? {
        x: domain.rest[anchor.particle * 3],
        y: domain.rest[anchor.particle * 3 + 1],
        z: domain.rest[anchor.particle * 3 + 2],
      };
    position[anchor.particle * 3] = target.x;
    position[anchor.particle * 3 + 1] = target.y;
    position[anchor.particle * 3 + 2] = target.z;
  }
  return position;
};

/** The anchor poses one named state applies, or an empty map for the default. */
const resolveState = (
  domain: IAutoMovieSoftBodyDomain,
  state: string | null,
): Map<string, IAutoMovieVector3> => {
  const poses = new Map<string, IAutoMovieVector3>();
  if (state === null) return poses;
  const named = domain.states.find((candidate) => candidate.id === state);
  if (named === undefined)
    throw new Error(
      `soft body "${domain.id}" does not declare a named state "${state}"`,
    );
  for (const pose of named.anchors) poses.set(pose.anchor, pose.position);
  return poses;
};

/** Row-major index of one lattice neighbour, or `-1` when it falls outside. */
const neighbourOf = (
  columns: number,
  rows: number,
  column: number,
  row: number,
  at: number,
): number => {
  const neighbourColumn = column + NEIGHBOURS[at][0];
  const neighbourRow = row + NEIGHBOURS[at][1];
  if (neighbourColumn < 0 || neighbourColumn >= columns) return -1;
  if (neighbourRow < 0 || neighbourRow >= rows) return -1;
  return neighbourRow * columns + neighbourColumn;
};

/** Distance between two particles of a flat `[x, y, z, ...]` position array. */
const distance = (values: ArrayLike<number>, a: number, b: number): number => {
  const dx = values[b * 3] - values[a * 3];
  const dy = values[b * 3 + 1] - values[a * 3 + 1];
  const dz = values[b * 3 + 2] - values[a * 3 + 2];
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
};

/**
 * One Jacobi sweep: every particle gathers its own correction from every
 * incident constraint, in the mirror-exact family order {@link NEIGHBOURS}
 * documents.
 *
 * Gathering costs each constraint twice — once from each end — and buys the
 * property that the summation order a particle sees is fixed by its own
 * neighbourhood rather than by a global constraint list, which is what makes
 * the fold mirror-exact at all.
 */
const gather = (props: {
  columns: number;
  rows: number;
  predicted: Float64Array;
  correction: Float64Array;
  inverseMass: Float64Array;
  valence: Int32Array;
  restLength: Float64Array;
  stiffness: number[];
}): void => {
  const { columns, rows, predicted, correction, inverseMass } = props;
  // Six mirror-partner slots of three components each, in the order the family
  // fold below adds them: structural along the lattice's two axes, the lower
  // and upper diagonal pairs, and bending along the two axes.
  const fold = new Float64Array(18);
  for (let row = 0; row < rows; ++row)
    for (let column = 0; column < columns; ++column) {
      const particle = row * columns + column;
      const base = particle * 3;
      if (inverseMass[particle] === 0 || props.valence[particle] === 0) {
        correction[base] = 0;
        correction[base + 1] = 0;
        correction[base + 2] = 0;
        continue;
      }
      fold.fill(0);
      for (let at = 0; at < NEIGHBOURS.length; ++at) {
        const rest = props.restLength[particle * NEIGHBOURS.length + at];
        if (rest < 0) continue;
        const other = neighbourOf(columns, rows, column, row, at);
        const dx = predicted[other * 3] - predicted[base];
        const dy = predicted[other * 3 + 1] - predicted[base + 1];
        const dz = predicted[other * 3 + 2] - predicted[base + 2];
        const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (length === 0) continue;
        const share =
          inverseMass[particle] / (inverseMass[particle] + inverseMass[other]);
        const factor =
          (props.stiffness[NEIGHBOURS[at][2]] * share * (length - rest)) /
          length;
        const slot = 3 * foldSlot(NEIGHBOURS[at]);
        fold[slot] += factor * dx;
        fold[slot + 1] += factor * dy;
        fold[slot + 2] += factor * dz;
      }
      const inverse = 1 / props.valence[particle];
      for (let axis = 0; axis < 3; ++axis)
        correction[base + axis] =
          (fold[axis] +
            fold[3 + axis] +
            (fold[6 + axis] + fold[9 + axis]) +
            (fold[12 + axis] + fold[15 + axis])) *
          inverse;
    }
};

/**
 * Which mirror-partner slot one neighbour offset folds into.
 *
 * Exactly two offsets share a slot, and they are each other's image under the
 * mirror their family can be reflected by, which is what makes the two-term sum
 * inside a slot exactly commutative.
 */
const foldSlot = (
  neighbour: readonly [column: number, row: number, family: 0 | 1 | 2],
): number => {
  if (neighbour[2] === 1) return neighbour[1] < 0 ? 2 : 3;
  const axis = neighbour[0] === 0 ? 1 : 0;
  return neighbour[2] === 0 ? axis : 4 + axis;
};

/** Push one particle out of every collider it currently violates. */
const resolveContacts = (
  colliders: IAutoMovieSoftCollider[],
  predicted: Float64Array,
  particle: number,
): number => {
  const base = particle * 3;
  let resolved = 0;
  for (const collider of colliders) {
    const wasX = predicted[base];
    const wasY = predicted[base + 1];
    const wasZ = predicted[base + 2];
    if (collider.kind === "plane") escapePlane(collider, predicted, base);
    else if (collider.kind === "sphere")
      escapeSphere(collider, predicted, base);
    else if (collider.kind === "box") escapeBox(collider, predicted, base);
    if (
      predicted[base] !== wasX ||
      predicted[base + 1] !== wasY ||
      predicted[base + 2] !== wasZ
    )
      ++resolved;
  }
  return resolved;
};

/** Write resolved hard targets into the working position buffer. */
const applyResolvedAnchors = (
  position: Float64Array,
  anchors: readonly IAutoMovieSoftBodyResolvedAnchor[],
): void => {
  for (const anchor of anchors) {
    const base = anchor.particle * 3;
    position[base] = anchor.position.x;
    position[base + 1] = anchor.position.y;
    position[base + 2] = anchor.position.z;
  }
};

/** Push one particle out of every resolved body capsule. */
const resolveCapsuleContacts = (
  capsules: readonly IAutoMovieSoftBodyResolvedCapsule[],
  predicted: Float64Array,
  particle: number,
): number => {
  const base = particle * 3;
  let resolved = 0;
  for (const capsule of capsules) {
    const wasX = predicted[base];
    const wasY = predicted[base + 1];
    const wasZ = predicted[base + 2];
    escapeCapsule(capsule, predicted, base);
    if (
      predicted[base] !== wasX ||
      predicted[base + 1] !== wasY ||
      predicted[base + 2] !== wasZ
    )
      ++resolved;
  }
  return resolved;
};

/** Project one point to the surface of a resolved segment-and-radius capsule. */
const escapeCapsule = (
  capsule: IAutoMovieSoftBodyResolvedCapsule,
  predicted: Float64Array,
  base: number,
): void => {
  const sx = capsule.to.x - capsule.from.x;
  const sy = capsule.to.y - capsule.from.y;
  const sz = capsule.to.z - capsule.from.z;
  const span = sx * sx + sy * sy + sz * sz;
  const along =
    span === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((predicted[base] - capsule.from.x) * sx +
              (predicted[base + 1] - capsule.from.y) * sy +
              (predicted[base + 2] - capsule.from.z) * sz) /
              span,
          ),
        );
  const closestX = capsule.from.x + sx * along;
  const closestY = capsule.from.y + sy * along;
  const closestZ = capsule.from.z + sz * along;
  let dx = predicted[base] - closestX;
  let dy = predicted[base + 1] - closestY;
  let dz = predicted[base + 2] - closestZ;
  let distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (distance >= capsule.radius) return;
  if (distance === 0) {
    if (span === 0) {
      dx = 0;
      dy = 1;
      dz = 0;
    } else {
      // Cross the segment with the least-aligned cardinal axis, so the escape
      // direction is radial even for a vertical capsule.
      const length = Math.sqrt(span);
      const nx = sx / length;
      const ny = sy / length;
      const nz = sz / length;
      if (Math.abs(nx) <= Math.abs(ny) && Math.abs(nx) <= Math.abs(nz)) {
        dx = 0;
        dy = nz;
        dz = -ny;
      } else if (Math.abs(ny) <= Math.abs(nz)) {
        dx = -nz;
        dy = 0;
        dz = nx;
      } else {
        dx = ny;
        dy = -nx;
        dz = 0;
      }
      distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
    }
    distance = distance === 0 ? 1 : distance;
  }
  const factor = capsule.radius / distance;
  predicted[base] = closestX + dx * factor;
  predicted[base + 1] = closestY + dy * factor;
  predicted[base + 2] = closestZ + dz * factor;
};

/** Keep a particle on the allowed side of a half-space. */
const escapePlane = (
  collider: IAutoMovieSoftCollider.IPlane,
  predicted: Float64Array,
  base: number,
): void => {
  const normal = collider.normal;
  const length = Math.sqrt(
    normal.x * normal.x + normal.y * normal.y + normal.z * normal.z,
  );
  const nx = normal.x / length;
  const ny = normal.y / length;
  const nz = normal.z / length;
  const signed =
    nx * predicted[base] + ny * predicted[base + 1] + nz * predicted[base + 2];
  if (signed >= collider.offset) return;
  const push = collider.offset - signed;
  predicted[base] += nx * push;
  predicted[base + 1] += ny * push;
  predicted[base + 2] += nz * push;
};

/** Push a particle out to the surface of a ball. */
const escapeSphere = (
  collider: IAutoMovieSoftCollider.ISphere,
  predicted: Float64Array,
  base: number,
): void => {
  const dx = predicted[base] - collider.center.x;
  const dy = predicted[base + 1] - collider.center.y;
  const dz = predicted[base + 2] - collider.center.z;
  const length = Math.sqrt(dx * dx + dy * dy + dz * dz);
  if (length >= collider.radius) return;
  if (length === 0) {
    // A particle exactly at the centre has no radius to escape along. It leaves
    // upward, which is where furniture pushes fabric in a gravity field, and it
    // is stated rather than left to whichever axis happened to be first.
    predicted[base + 1] = collider.center.y + collider.radius;
    return;
  }
  const factor = collider.radius / length;
  predicted[base] = collider.center.x + dx * factor;
  predicted[base + 1] = collider.center.y + dy * factor;
  predicted[base + 2] = collider.center.z + dz * factor;
};

/**
 * Push a particle out of an axis-aligned box by its least-penetrated face.
 *
 * The axis is chosen by strict comparison, so the first axis wins a tie between
 * axes and the maximum side wins a tie between the two faces of one axis. Both
 * are deterministic; the second is the one degenerate configuration a mirrored
 * panel does not survive, and it is documented on {@link simulateSoftBody}
 * rather than hidden here.
 */
const escapeBox = (
  collider: IAutoMovieSoftCollider.IBox,
  predicted: Float64Array,
  base: number,
): void => {
  const min = [collider.min.x, collider.min.y, collider.min.z];
  const max = [collider.max.x, collider.max.y, collider.max.z];
  for (let axis = 0; axis < 3; ++axis)
    if (
      predicted[base + axis] <= min[axis] ||
      predicted[base + axis] >= max[axis]
    )
      return;
  let bestAxis = 0;
  let bestDepth = Infinity;
  let bestTarget = 0;
  for (let axis = 0; axis < 3; ++axis) {
    const low = predicted[base + axis] - min[axis];
    const high = max[axis] - predicted[base + axis];
    const depth = low < high ? low : high;
    if (depth < bestDepth) {
      bestDepth = depth;
      bestAxis = axis;
      bestTarget = low < high ? min[axis] : max[axis];
    }
  }
  predicted[base + bestAxis] = bestTarget;
};

/** The unit direction of the declared draught, or a zero vector for still air. */
const windAxis = (domain: IAutoMovieSoftBodyDomain): IAutoMovieVector3 => {
  const wind = domain.wind;
  if (wind === null) return { x: 0, y: 0, z: 0 };
  const length = Math.sqrt(
    wind.direction.x * wind.direction.x +
      wind.direction.y * wind.direction.y +
      wind.direction.z * wind.direction.z,
  );
  return {
    x: wind.direction.x / length,
    y: wind.direction.y / length,
    z: wind.direction.z / length,
  };
};

/**
 * The draught's signed acceleration at one step's start time.
 *
 * The gust is a triangle wave `4·|φ − ½| − 1` over the unit phase `φ = f·t −
 * ⌊f·t⌋`, so it runs from `+1` at the start of a period down to `−1` at its
 * middle and back. Every operation is exactly specified, which a sinusoid is
 * not; a curtain must billow the same way on every machine.
 */
const windAcceleration = (
  domain: IAutoMovieSoftBodyDomain,
  time: number,
): number => {
  const wind = domain.wind;
  if (wind === null) return 0;
  const cycles = wind.gustHz * time;
  const phase = cycles - Math.floor(cycles);
  return (
    wind.acceleration + wind.gustAcceleration * (4 * Math.abs(phase - 0.5) - 1)
  );
};

/** Refuse a non-finite resolved moving-boundary vector. */
const assertVector = (value: IAutoMovieVector3, label: string): void => {
  if (
    !Number.isFinite(value.x) ||
    !Number.isFinite(value.y) ||
    !Number.isFinite(value.z)
  )
    throw new Error(`${label} must contain finite coordinates`);
};

/** Whether every value of the array is a real number. */
const allFinite = (values: Float64Array): boolean => {
  for (let index = 0; index < values.length; ++index)
    if (Number.isFinite(values[index]) === false) return false;
  return true;
};
