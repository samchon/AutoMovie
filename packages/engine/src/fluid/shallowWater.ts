import {
  IAutoMovieFluidBudget,
  IAutoMovieFluidDomain,
  IAutoMovieFluidState,
} from "@automovie/interface";

/**
 * Integrate a fluid domain to one **absolute** step of its fixed clock.
 *
 * ## The equations
 *
 * The domain is a shallow-water field on an Arakawa C grid: water depth `h` at
 * cell centres over a bed elevation `b`, and horizontal velocity on the faces
 * between cells. Writing the free surface as `η = b + h`, one step advances
 *
 * ```text
 *   ∂u/∂t = −g·∂η/∂x − k·u                  (x momentum, on x faces)
 *   ∂v/∂t = −g·∂η/∂z − k·v                  (z momentum, on z faces)
 *   ∂h/∂t = −∂(h·u)/∂x − ∂(h·v)/∂z + q      (continuity, at cell centres)
 * ```
 *
 * With `k` the linear drag and `q` the declared source/drain volume rate per
 * unit area. Momentum is linearized — advection `u·∂u/∂x` is deliberately
 * absent — which is the bounded first tier this project committed to: a
 * gravity-wave solver for basins, channels, jets and ledges, not a
 * Navier-Stokes CFD and not a breaking-wave research code.
 *
 * Continuity is solved in **flux form** with a first-order upwind depth: the
 * volume crossing a face is `u · h_donor · dz · dt`, taken from whichever cell
 * the velocity points away from. Every interior face appears once with each
 * sign, so the only ways the total volume can change are a declared source, a
 * declared drain, and an `open` edge — which is exactly the mass-balance
 * contract this domain promises.
 *
 * ## Why it stays well behaved
 *
 * - **Lake at rest is exact.** The pressure term reads the free surface `η`, not
 *   the depth, so a still pond over an uneven bed produces a numerically exact
 *   zero gradient: velocities stay at zero and depths never drift, however many
 *   steps are integrated.
 * - **Depth never goes negative.** After the fluxes are known, each cell's total
 *   outgoing volume — faces plus drain — is compared with the water it actually
 *   holds and, if it exceeds it, every one of that cell's outgoing fluxes is
 *   scaled by the same factor. A face has exactly one donor, so scaling by the
 *   donor's factor leaves the shared face single-valued and mass still exactly
 *   conserved.
 * - **Dry land is not climbed.** A face against a dry cell carries no flow unless
 *   the wet side's free surface actually stands above the dry side's ground.
 * - **A wall reflects.** A `wall` edge, and every face touching a solid cell,
 *   pins the velocity to zero: the reflecting boundary condition.
 * - **An open edge spills.** An `open` edge behaves as a permanently dry
 *   neighbour at the boundary cell's own bed height, so water pours off the
 *   rim, never seeps back in, and the volume that left is counted.
 *
 * ## Stability
 *
 * The explicit scheme is stable while the Courant number of the gravity wave `c
 * = √(g·H)` stays at or below one:
 *
 * ```text
 *   dt · √(g · referenceDepth) · √(1/dx² + 1/dz²) ≤ 1
 * ```
 *
 * That is what {@link fluidCourantNumber} returns and what
 * {@link validateFluidDomain} refuses to exceed.
 *
 * ## Determinism
 *
 * The state is a pure function of `(domain, step)`. Nothing is cached between
 * calls, so seeking backwards, forwards, or in scattered order returns exactly
 * the same numbers as playing straight through — there is no runtime object for
 * an accumulation to hide in. Only `+ − × ÷` and `Math.sqrt` are used, all of
 * which IEEE-754 specifies exactly, so a domain whose authored numbers are
 * binary-exact reproduces bit for bit on Windows and POSIX alike.
 *
 * The domain is assumed to have passed {@link validateFluidDomain}: that pass is
 * where an array of the wrong length, a depth past the design depth, a source
 * pouring into solid matter, or an unstable step are refused with a path, so
 * the integrator never has to guess what an inconsistent record meant.
 *
 * Throws when `step` is not an integer in `[0, solver.maxSteps]`, and when the
 * state leaves the reals — a non-finite bed or depth, or a genuinely runaway
 * solve, is named at the step it first appeared rather than quietly turning
 * into NaN frames a renderer would draw as nothing at all.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Reconstructs the requested absolute step from declared initial state.
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-volume-boundary Advances declared sources, drains, walls, open edges, and retained cell volume in physical volume units.
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-conservation-account Returns retained volume beside cumulative source, drain, and open-boundary outflow for the same solve.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-surface-and-flow-tier Implements the bounded flux-form surface state and its explicit volume-change account.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Produces the same bounded state for repeated and out-of-order seeks.
 * @evidence requirements/interior/water-and-fluid-features.md#interior-fluid-volume-level `simulateFluidDomain` computes bounded cell depths, retained volume, sources, drains, and open-boundary outflow for the requested deterministic step.
 */
export const simulateFluidDomain = (
  domain: IAutoMovieFluidDomain,
  step: number,
): IAutoMovieFluidState => {
  if (!Number.isInteger(step) || step < 0)
    throw new Error(
      `fluid domain "${domain.id}" cannot be seeked to step ${step}: an absolute step must be a non-negative integer`,
    );
  if (step > domain.solver.maxSteps)
    throw new Error(
      `fluid domain "${domain.id}" cannot be seeked to step ${step}: the declared budget stops at ${domain.solver.maxSteps}`,
    );

  const columns = domain.grid.columns;
  const rows = domain.grid.rows;
  const cells = columns * rows;
  const dx = domain.grid.cellX;
  const dz = domain.grid.cellZ;
  const area = dx * dz;
  const dt = domain.solver.fixedStepSeconds;
  const gravity = domain.solver.gravity;
  const dry = domain.solver.dryDepth;
  const damping = 1 + dt * domain.solver.drag;

  const depth = Float64Array.from(domain.depth);
  const velocityX = new Float64Array((columns + 1) * rows);
  const velocityZ = new Float64Array(columns * (rows + 1));
  const fluxX = new Float64Array(velocityX.length);
  const fluxZ = new Float64Array(velocityZ.length);
  const donorX = new Int32Array(velocityX.length);
  const donorZ = new Int32Array(velocityZ.length);
  const sourceCell = new Float64Array(cells);
  const drainCell = new Float64Array(cells);
  const scale = new Float64Array(cells);

  let sourceVolume = 0;
  let drainVolume = 0;
  let outflowVolume = 0;

  for (let index = 0; index < step; ++index) {
    const time = index * dt;

    // ---- momentum and upwind flux on the x faces --------------------------
    for (let row = 0; row < rows; ++row)
      for (let column = 0; column <= columns; ++column) {
        const face = row * (columns + 1) + column;
        const left = column > 0 ? row * columns + column - 1 : -1;
        const right = column < columns ? row * columns + column : -1;
        const speed = faceSpeed({
          previous: velocityX[face],
          // An `open` edge is a permanently dry ghost cell at the interior
          // cell's own bed: water spills off the rim, nothing seeps back.
          blocked:
            (left < 0 && domain.boundaries.xMin === "wall") ||
            (right < 0 && domain.boundaries.xMax === "wall") ||
            (left >= 0 && domain.solid[left] === true) ||
            (right >= 0 && domain.solid[right] === true),
          bedBefore: left >= 0 ? domain.bed[left] : domain.bed[right],
          bedAfter: right >= 0 ? domain.bed[right] : domain.bed[left],
          depthBefore: left >= 0 ? depth[left] : 0,
          depthAfter: right >= 0 ? depth[right] : 0,
          dry,
          gravity,
          dt,
          span: dx,
          damping,
        });
        velocityX[face] = speed;
        const donor = speed > 0 ? left : speed < 0 ? right : -1;
        donorX[face] = donor;
        fluxX[face] = donor >= 0 ? speed * depth[donor] * dz * dt : 0;
      }

    // ---- momentum and upwind flux on the z faces --------------------------
    for (let row = 0; row <= rows; ++row)
      for (let column = 0; column < columns; ++column) {
        const face = row * columns + column;
        const back = row > 0 ? (row - 1) * columns + column : -1;
        const front = row < rows ? row * columns + column : -1;
        const speed = faceSpeed({
          previous: velocityZ[face],
          blocked:
            (back < 0 && domain.boundaries.zMin === "wall") ||
            (front < 0 && domain.boundaries.zMax === "wall") ||
            (back >= 0 && domain.solid[back] === true) ||
            (front >= 0 && domain.solid[front] === true),
          bedBefore: back >= 0 ? domain.bed[back] : domain.bed[front],
          bedAfter: front >= 0 ? domain.bed[front] : domain.bed[back],
          depthBefore: back >= 0 ? depth[back] : 0,
          depthAfter: front >= 0 ? depth[front] : 0,
          dry,
          gravity,
          dt,
          span: dz,
          damping,
        });
        velocityZ[face] = speed;
        const donor = speed > 0 ? back : speed < 0 ? front : -1;
        donorZ[face] = donor;
        fluxZ[face] = donor >= 0 ? speed * depth[donor] * dx * dt : 0;
      }

    // ---- declared sources and drains for this step ------------------------
    sourceCell.fill(0);
    drainCell.fill(0);
    for (const source of domain.sources) {
      if (active(source.start, source.end, time) === false) continue;
      sourceCell[source.row * columns + source.column] += source.flowRate * dt;
    }
    for (const drain of domain.drains) {
      if (active(drain.start, drain.end, time) === false) continue;
      const cell = drain.row * columns + drain.column;
      if (domain.bed[cell] + depth[cell] <= drain.sillLevel) continue;
      drainCell[cell] += drain.flowRate * dt;
    }

    // ---- positivity limiter ----------------------------------------------
    for (let row = 0; row < rows; ++row)
      for (let column = 0; column < columns; ++column) {
        const cell = row * columns + column;
        const westFace = row * (columns + 1) + column;
        const southFace = row * columns + column;
        let outgoing = drainCell[cell];
        if (fluxX[westFace] < 0) outgoing -= fluxX[westFace];
        if (fluxX[westFace + 1] > 0) outgoing += fluxX[westFace + 1];
        if (fluxZ[southFace] < 0) outgoing -= fluxZ[southFace];
        if (fluxZ[southFace + columns] > 0)
          outgoing += fluxZ[southFace + columns];
        const held = depth[cell] * area;
        scale[cell] = outgoing > held ? held / outgoing : 1;
      }
    for (let face = 0; face < fluxX.length; ++face)
      if (donorX[face] >= 0) fluxX[face] *= scale[donorX[face]];
    for (let face = 0; face < fluxZ.length; ++face)
      if (donorZ[face] >= 0) fluxZ[face] *= scale[donorZ[face]];

    // ---- the volume ledger ------------------------------------------------
    for (let cell = 0; cell < cells; ++cell) {
      drainCell[cell] *= scale[cell];
      drainVolume += drainCell[cell];
      sourceVolume += sourceCell[cell];
    }
    for (let row = 0; row < rows; ++row) {
      // A boundary face's donor is the ghost whenever the flow points inward,
      // and a ghost is dry, so a boundary flux is either zero or outward.
      outflowVolume -= fluxX[row * (columns + 1)];
      outflowVolume += fluxX[row * (columns + 1) + columns];
    }
    for (let column = 0; column < columns; ++column) {
      outflowVolume -= fluxZ[column];
      outflowVolume += fluxZ[rows * columns + column];
    }

    // ---- continuity --------------------------------------------------------
    for (let row = 0; row < rows; ++row)
      for (let column = 0; column < columns; ++column) {
        const cell = row * columns + column;
        const westFace = row * (columns + 1) + column;
        const southFace = row * columns + column;
        // Each axis is folded on its own before the two are added. Mirroring a
        // domain negates a face flux and swaps the pair, and a two-term sum is
        // exactly commutative in IEEE-754 while a four-term one is not: keeping
        // the axes apart is what makes a symmetric basin stay symmetric to the
        // last bit instead of drifting by an ulp per step.
        const netX = fluxX[westFace] - fluxX[westFace + 1];
        const netZ = fluxZ[southFace] - fluxZ[southFace + columns];
        const net = netX + netZ + (sourceCell[cell] - drainCell[cell]);
        const updated = (depth[cell] * area + net) / area;
        depth[cell] = updated > 0 ? updated : 0;
      }

    if (allFinite([depth, velocityX, velocityZ]) === false)
      throw new Error(
        `fluid domain "${domain.id}" produced a non-finite state at step ${index + 1}`,
      );
  }

  let volume = 0;
  for (let cell = 0; cell < cells; ++cell) volume += depth[cell] * area;
  return {
    domain: domain.id,
    step,
    time: step * dt,
    depth: Array.from(depth),
    velocityX: Array.from(velocityX),
    velocityZ: Array.from(velocityZ),
    volume,
    sourceVolume,
    drainVolume,
    outflowVolume,
  };
};

/**
 * Sample a fluid domain at a shot second, snapping down to its fixed step.
 *
 * The snap is what makes playback frame-rate independent: captures at 24 and 30
 * fps read the same integrated state whenever they land inside the same step,
 * instead of each integrating a different number of times.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-seek-state Maps an arbitrary shot second to the declared absolute fluid step.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#fluid-seek-and-checkpoint-state Returns the repeatable state at the snapped seek boundary.
 */
export const sampleFluidDomain = (
  domain: IAutoMovieFluidDomain,
  time: number,
): IAutoMovieFluidState => {
  if (!Number.isFinite(time))
    throw new Error(
      `fluid domain "${domain.id}" cannot be sampled at a non-finite time`,
    );
  const clamped = time > 0 ? time : 0;
  return simulateFluidDomain(
    domain,
    Math.floor(clamped / domain.solver.fixedStepSeconds + 1e-9),
  );
};

/**
 * The Courant number of the domain's gravity wave: `dt·√(g·H)·√(1/dx² +
 * 1/dz²)`.
 *
 * At most `1` for a stable explicit solve. It is the single number that says
 * whether the authored step, cell size, gravity and design depth can be
 * integrated at all, which is why the validator reads it instead of guessing a
 * step on the author's behalf.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/fluids-and-water.md#effects-fluid-refusal Measures whether the authored explicit solve is numerically admissible.
 * @evidence specifications/simulation-effects-and-sound/fluids-water-and-world-coupling.md#world-coupling-invalidation-and-refusal Supplies the stability fact used to refuse an invalid fluid domain.
 */
export const fluidCourantNumber = (domain: IAutoMovieFluidDomain): number =>
  domain.solver.fixedStepSeconds *
  Math.sqrt(domain.solver.gravity * domain.solver.referenceDepth) *
  Math.sqrt(
    1 / (domain.grid.cellX * domain.grid.cellX) +
      1 / (domain.grid.cellZ * domain.grid.cellZ),
  );

/**
 * The bounded cost a fluid domain adds to a shot, derived from the record
 * alone.
 *
 * Nothing here integrates a step: a production is refused for an unaffordable
 * water feature before the first solve, and the same numbers ride into the
 * compiler's report so a reviewer sees what the water cost.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/budgets-and-bounded-work.md#effects-per-frame-shot-budget Exposes the fluid work contributed across the declared shot horizon.
 * @evidence specifications/simulation-effects-and-sound/budget-admission.md#budget-frame-shot-sequence-composition Computes the domain cost before any fluid step executes.
 */
export const fluidDomainBudget = (
  domain: IAutoMovieFluidDomain,
): IAutoMovieFluidBudget => {
  const cells = domain.grid.columns * domain.grid.rows;
  const faces =
    (domain.grid.columns + 1) * domain.grid.rows +
    domain.grid.columns * (domain.grid.rows + 1);
  let sprayParticleCap = 0;
  for (const spray of domain.sprays) sprayParticleCap += spray.maxParticles;
  return {
    domain: domain.id,
    cells,
    faces,
    stateBytes: 8 * (cells + faces),
    maxSteps: domain.solver.maxSteps,
    worstCaseCellUpdates: cells * domain.solver.maxSteps,
    sprayParticleCap,
    courant: fluidCourantNumber(domain),
  };
};

/**
 * A stable 32-bit FNV-1a digest of one fluid state's exact bytes, as lowercase
 * hex.
 *
 * Two states digest alike only when every depth, velocity and ledger value is
 * bit-identical, so it is the compact evidence that a replay, a reordered seek,
 * or a second machine reproduced the reference state rather than merely a close
 * one.
 *
 * @author Samchon
 * @evidence requirements/effects-and-simulation/clock-seek-and-determinism.md#effects-platform-determinism Records exact replay equality rather than an approximate visual match.
 * @evidence specifications/simulation-effects-and-sound/clocks-ordering-seek-and-checkpoints.md#numeric-platform-repeatability-class Provides a stable byte-level receipt for repeatability checks.
 */
export const fluidStateDigest = (state: IAutoMovieFluidState): string => {
  const values = [
    state.step,
    ...state.depth,
    ...state.velocityX,
    ...state.velocityZ,
    state.volume,
    state.sourceVolume,
    state.drainVolume,
    state.outflowVolume,
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
 * One face's velocity after this step's momentum update.
 *
 * `before`/`after` are the two cells the face separates in increasing index
 * order, an absent one already substituted by its dry ghost. The face is silent
 * — exactly zero, so a still lake stays still — when a wall or solid blocks it,
 * when neither side holds water, and when the only water present would have to
 * climb onto ground standing above its own free surface.
 */
const faceSpeed = (props: {
  previous: number;
  blocked: boolean;
  bedBefore: number;
  bedAfter: number;
  depthBefore: number;
  depthAfter: number;
  dry: number;
  gravity: number;
  dt: number;
  span: number;
  damping: number;
}): number => {
  if (props.blocked) return 0;
  const etaBefore = props.bedBefore + props.depthBefore;
  const etaAfter = props.bedAfter + props.depthAfter;
  const wetBefore = props.depthBefore > props.dry;
  const wetAfter = props.depthAfter > props.dry;
  if (wetBefore === false && etaAfter <= etaBefore) return 0;
  if (wetAfter === false && etaBefore <= etaAfter) return 0;
  return (
    (props.previous -
      (props.dt * props.gravity * (etaAfter - etaBefore)) / props.span) /
    props.damping
  );
};

/** Whether a declared source or drain is open at this step's start time. */
const active = (start: number, end: number | null, time: number): boolean =>
  time >= start && (end === null || time < end);

/** Whether every value of every array is a real number. */
const allFinite = (arrays: Float64Array[]): boolean => {
  for (const values of arrays)
    for (let index = 0; index < values.length; ++index)
      if (Number.isFinite(values[index]) === false) return false;
  return true;
};
