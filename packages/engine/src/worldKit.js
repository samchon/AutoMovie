import { productionRuntimeModelId } from "./productionIdentity";
/**
 * Build one box-proxy wall or building from a grounded base and size.
 *
 * The emitted recipe names an archetype the production must have registered. It
 * defaults to the shipped `primitive-prop` builder and its `box` shape, because
 * that is what this helper's parameters describe; a production whose catalogue
 * spells the same static primitive differently passes its own id.
 */
export const worldBlock = (input) => {
    assertText(input.id, "World block id");
    for (const [name, value] of Object.entries(input.size))
        if (Number.isFinite(value) === false || value <= 0)
            throw new Error(`World block "${input.id}" size.${name} must be positive.`);
    assertVector(input.base, `World block "${input.id}" base`);
    if (/^#[0-9a-f]{6}$/i.test(input.color) === false)
        throw new Error(`World block "${input.id}" color must be #RRGGBB.`);
    const recipe = {
        id: input.id,
        role: "set",
        archetype: input.archetype ?? "primitive-prop",
        parameters: {
            shape: "box",
            width: input.size.x,
            height: input.size.y,
            depth: input.size.z,
        },
        palette: { structure: input.color },
        lod: [{ tier: "near", maxDistance: null, recipe: input.id }],
        capabilities: [],
        attachments: [],
    };
    return {
        id: input.id,
        kind: input.kind,
        recipe,
        node: {
            id: input.id,
            model: productionRuntimeModelId(input.id),
            transform: {
                translation: {
                    x: input.base.x,
                    y: input.base.y + input.size.y / 2,
                    z: input.base.z,
                },
                rotation: { x: 0, y: 0, z: 0, w: 1 },
                scale: { x: 1, y: 1, z: 1 },
            },
            motion: null,
            pose: null,
        },
        bounds: {
            min: {
                x: input.base.x - input.size.x / 2,
                y: input.base.y,
                z: input.base.z - input.size.z / 2,
            },
            max: {
                x: input.base.x + input.size.x / 2,
                y: input.base.y + input.size.y,
                z: input.base.z + input.size.z / 2,
            },
        },
    };
};
/** Build one flat terrain primitive from an explicit world-XZ footprint. */
export const worldTerrain = (input) => ({
    id: input.id,
    polygon: structuredClone(input.polygon),
    height: { kind: "constant", value: input.height },
    walkable: input.walkable,
});
/** Build one rectangular ramp surface from a centerline and explicit rise. */
export const worldRamp = (input) => {
    assertText(input.id, "World ramp id");
    const dx = input.to.x - input.from.x;
    const dz = input.to.z - input.from.z;
    const lengthSquared = dx * dx + dz * dz;
    if (Number.isFinite(input.width) === false ||
        input.width <= 0 ||
        Number.isFinite(input.baseHeight) === false ||
        Number.isFinite(input.rise) === false ||
        Number.isFinite(lengthSquared) === false ||
        lengthSquared <= 0)
        throw new Error(`World ramp "${input.id}" requires finite distinct endpoints, positive width, and finite baseHeight/rise.`);
    const length = Math.sqrt(lengthSquared);
    const offset = {
        x: (-dz / length) * (input.width / 2),
        z: (dx / length) * (input.width / 2),
    };
    return {
        id: input.id,
        polygon: [
            { x: input.from.x + offset.x, z: input.from.z + offset.z },
            { x: input.to.x + offset.x, z: input.to.z + offset.z },
            { x: input.to.x - offset.x, z: input.to.z - offset.z },
            { x: input.from.x - offset.x, z: input.from.z - offset.z },
        ],
        height: {
            kind: "plane",
            originHeight: input.baseHeight -
                (input.rise * (dx * input.from.x + dz * input.from.z)) / lengthSquared,
            slopeX: (input.rise * dx) / lengthSquared,
            slopeZ: (input.rise * dz) / lengthSquared,
        },
        walkable: input.walkable,
    };
};
/**
 * Build one heightfield terrain surface by sampling a height function.
 *
 * The relief a production wants is almost always a rule — a slope that eases
 * off, a terrace, a bank falling to a river — and transcribing that rule into a
 * flat array by hand is where a hill acquires a step nobody meant. The function
 * is evaluated once per lattice point, in row-major order, and only its results
 * are kept: the compiled design carries numbers, so nothing at render time
 * depends on the function still existing or still answering the same way.
 *
 * That makes determinism the caller's to keep for exactly one thing: `height`
 * must be a pure function of the point it is given. A sampler that reads a
 * clock, a counter or unseeded randomness bakes one machine's terrain into the
 * design, which is the one way this can produce different frames elsewhere.
 */
export const worldHeightfield = (input) => {
    assertText(input.id, "World heightfield id");
    if (Number.isFinite(input.spacing.x) === false ||
        input.spacing.x <= 0 ||
        Number.isFinite(input.spacing.z) === false ||
        input.spacing.z <= 0 ||
        Number.isFinite(input.origin.x) === false ||
        Number.isFinite(input.origin.z) === false)
        throw new Error(`World heightfield "${input.id}" requires a finite origin and positive spacing.`);
    if (Number.isSafeInteger(input.columns) === false ||
        Number.isSafeInteger(input.rows) === false ||
        input.columns < 2 ||
        input.rows < 2)
        throw new Error(`World heightfield "${input.id}" requires at least two sample columns and rows.`);
    const samples = [];
    for (let row = 0; row < input.rows; ++row)
        for (let column = 0; column < input.columns; ++column) {
            const height = input.height({
                x: input.origin.x + column * input.spacing.x,
                z: input.origin.z + row * input.spacing.z,
            });
            if (Number.isFinite(height) === false)
                throw new Error(`World heightfield "${input.id}" sampled a non-finite height at column ${column}, row ${row}.`);
            samples.push(height);
        }
    return {
        id: input.id,
        polygon: structuredClone(input.polygon),
        height: {
            kind: "heightfield",
            originX: input.origin.x,
            originZ: input.origin.z,
            spacingX: input.spacing.x,
            spacingZ: input.spacing.z,
            columns: input.columns,
            rows: input.rows,
            samples,
        },
        walkable: input.walkable,
    };
};
/** Build one deterministic rectangular instance placement. */
export const worldGrid = (base, layout) => ({
    ...structuredClone(base),
    layout: structuredClone(layout),
});
/** Build one deterministic disk-scatter instance placement. */
export const worldScatter = (base, layout) => ({
    ...structuredClone(base),
    layout: structuredClone(layout),
});
/** Build one deterministic route-following instance placement. */
export const worldAlongRoute = (base, layout) => ({
    ...structuredClone(base),
    layout: structuredClone(layout),
});
/**
 * Reject material world-layout contradictions before shot construction.
 *
 * Blocks may touch but not overlap; every base must sit on a declared surface;
 * routes must clear block footprints; every landmark must lie on a walkable
 * surface or within its declared radius of a route.
 */
export const assertWorldPlacements = (input) => {
    for (let left = 0; left < input.blocks.length; ++left)
        for (let right = left + 1; right < input.blocks.length; ++right)
            if (overlaps(input.blocks[left], input.blocks[right]))
                throw new Error(`World blocks "${input.blocks[left].id}" and "${input.blocks[right].id}" overlap.`);
    for (const block of input.blocks) {
        if (input.surfaces.some((surface) => surfaceSupportsBlock(surface, block)) ===
            false)
            throw new Error(`World block "${block.id}" floats or lacks a supporting surface at its base.`);
    }
    for (const route of input.routes)
        for (let index = 1; index < route.waypoints.length; ++index)
            for (const block of input.blocks)
                if (segmentIntersectsBounds(route.waypoints[index - 1], route.waypoints[index], block.bounds, route.allowedFormationWidth / 2))
                    throw new Error(`World route "${route.id}" is blocked by "${block.id}".`);
    for (const landmark of input.landmarks) {
        const onWalkable = input.surfaces.some((surface) => surface.walkable && insidePolygon(landmark.position, surface.polygon));
        const byRoute = input.routes.some((route) => route.waypoints
            .slice(1)
            .some((point, index) => pointSegmentDistance(landmark.position, route.waypoints[index], point) <=
            landmark.radius + route.allowedFormationWidth / 2));
        if (onWalkable === false && byRoute === false)
            throw new Error(`World landmark "${landmark.id}" is unreachable from walkable terrain and declared routes.`);
    }
};
/**
 * Evaluate one production-world height rule at an XZ point.
 *
 * The footprint is not consulted: this answers what the rule says, and
 * {@link worldGroundSurface} answers where the rule applies. A `heightfield`
 * clamps to its edge samples outside its own lattice, so the answer stays a
 * finite number wherever it is asked.
 */
export const worldSurfaceHeight = (surface, point) => {
    const rule = surface.height;
    if (rule.kind === "constant")
        return rule.value;
    if (rule.kind === "plane")
        return rule.originHeight + rule.slopeX * point.x + rule.slopeZ * point.z;
    // Bilinear over the cell the point falls in. The lattice coordinate is
    // clamped before the cell is chosen, so a query outside the grid reads its
    // nearest edge instead of extrapolating relief nobody authored.
    const column = latticeCell((point.x - rule.originX) / rule.spacingX, rule.columns);
    const row = latticeCell((point.z - rule.originZ) / rule.spacingZ, rule.rows);
    const near = lerp(heightfieldSample(rule, column.index, row.index), heightfieldSample(rule, column.index + 1, row.index), column.fraction);
    const far = lerp(heightfieldSample(rule, column.index, row.index + 1), heightfieldSample(rule, column.index + 1, row.index + 1), column.fraction);
    return lerp(near, far, row.fraction);
};
/**
 * The world terrain under an XZ point, or `null` where the world has none.
 *
 * The first declared surface containing the point wins, which is the answer the
 * ground oracle already reported and therefore the one an author has been
 * composing against: a terraced square states its steps in the order it wants
 * them read. A point exactly on a footprint edge is on that surface, because
 * the edge of a floor is still floor and a strict reading would drop the
 * outermost rank of a unit sized to its own ground.
 *
 * The height that goes with it is {@link worldSurfaceHeight} of the same record.
 * Both answers come from here so a placement, a gate and an oracle cannot each
 * pick a different surface.
 */
export const worldGroundSurface = (surfaces, point) => surfaces.find((surface) => insideOrOnPolygon(point, surface.polygon)) ?? null;
/** Height of the world terrain under an XZ point, or `null` over nothing. */
export const worldGroundHeight = (surfaces, point) => {
    const surface = worldGroundSurface(surfaces, point);
    return surface === null ? null : worldSurfaceHeight(surface, point);
};
/**
 * Which cell of a lattice a coordinate falls in, and how far across it.
 *
 * The coordinate is clamped into the lattice first, so a point outside reads
 * the edge cell at fraction zero or one rather than an extrapolated one. A
 * lattice of a single line has no cell to cross and reads that line.
 */
const latticeCell = (coordinate, count) => {
    const last = Math.max(0, count - 2);
    const clamped = Math.min(Math.max(coordinate, 0), Math.max(0, count - 1));
    const index = Math.min(Math.floor(clamped), last);
    return { index, fraction: clamped - index };
};
/**
 * One stored sample, with its indices clamped into the declared grid.
 *
 * A record whose `samples` is shorter than `columns * rows` is refused by
 * design validation; reading it here answers zero rather than `NaN`, so a
 * placement built on a malformed field is wrong in a way a reader can see
 * instead of poisoning every arithmetic downstream of it.
 */
const heightfieldSample = (rule, column, row) => rule.samples[Math.min(Math.max(row, 0), rule.rows - 1) * rule.columns +
    Math.min(Math.max(column, 0), rule.columns - 1)] ?? 0;
const lerp = (from, to, progress) => from + (to - from) * progress;
const overlaps = (left, right) => left.bounds.min.x < right.bounds.max.x &&
    left.bounds.max.x > right.bounds.min.x &&
    left.bounds.min.y < right.bounds.max.y &&
    left.bounds.max.y > right.bounds.min.y &&
    left.bounds.min.z < right.bounds.max.z &&
    left.bounds.max.z > right.bounds.min.z;
const insidePolygon = (point, polygon) => {
    let inside = false;
    for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
        const current = polygon[index];
        const prior = polygon[previous];
        if (current.z > point.z !== prior.z > point.z &&
            point.x <
                ((prior.x - current.x) * (point.z - current.z)) /
                    (prior.z - current.z) +
                    current.x)
            inside = !inside;
    }
    return inside;
};
const surfaceSupportsBlock = (surface, block) => {
    const footprint = [
        { x: block.bounds.min.x, z: block.bounds.min.z },
        { x: block.bounds.max.x, z: block.bounds.min.z },
        { x: block.bounds.max.x, z: block.bounds.max.z },
        { x: block.bounds.min.x, z: block.bounds.max.z },
    ];
    if (footprint.some((point) => insideOrOnPolygon(point, surface.polygon) === false ||
        Math.abs(worldSurfaceHeight(surface, point) - block.bounds.min.y) >
            1e-6))
        return false;
    // Four contained corners are insufficient for a concave surface whose notch
    // cuts through the block. A simple polygon has no holes, so a notch must
    // either put one of its vertices inside the rectangle or properly cross a
    // footprint edge.
    if (surface.polygon.some((point) => point.x > block.bounds.min.x &&
        point.x < block.bounds.max.x &&
        point.z > block.bounds.min.z &&
        point.z < block.bounds.max.z))
        return false;
    for (let index = 0; index < footprint.length; ++index) {
        const blockFrom = footprint[index];
        const blockTo = footprint[(index + 1) % footprint.length];
        for (let surfaceIndex = 0; surfaceIndex < surface.polygon.length; ++surfaceIndex)
            if (segmentsProperlyIntersect(blockFrom, blockTo, surface.polygon[surfaceIndex], surface.polygon[(surfaceIndex + 1) % surface.polygon.length]))
                return false;
    }
    return true;
};
const insideOrOnPolygon = (point, polygon) => polygon.some((current, index) => pointSegmentDistance(point, current, polygon[(index + 1) % polygon.length]) <= 1e-9) || insidePolygon(point, polygon);
const segmentsProperlyIntersect = (leftFrom, leftTo, rightFrom, rightTo) => {
    const orient = (origin, first, second) => (first.x - origin.x) * (second.z - origin.z) -
        (first.z - origin.z) * (second.x - origin.x);
    const leftA = orient(leftFrom, leftTo, rightFrom);
    const leftB = orient(leftFrom, leftTo, rightTo);
    const rightA = orient(rightFrom, rightTo, leftFrom);
    const rightB = orient(rightFrom, rightTo, leftTo);
    return leftA * leftB < -Number.EPSILON && rightA * rightB < -Number.EPSILON;
};
const segmentIntersectsBounds = (from, to, bounds, padding) => {
    let minimum = 0;
    let maximum = 1;
    for (const axis of ["x", "z"]) {
        const delta = to[axis] - from[axis];
        const low = bounds.min[axis] - padding;
        const high = bounds.max[axis] + padding;
        if (Math.abs(delta) <= Number.EPSILON) {
            if (from[axis] < low || from[axis] > high)
                return false;
            continue;
        }
        const first = (low - from[axis]) / delta;
        const second = (high - from[axis]) / delta;
        minimum = Math.max(minimum, Math.min(first, second));
        maximum = Math.min(maximum, Math.max(first, second));
        if (minimum > maximum)
            return false;
    }
    return true;
};
const pointSegmentDistance = (point, from, to) => {
    const dx = to.x - from.x;
    const dz = to.z - from.z;
    const lengthSquared = dx * dx + dz * dz;
    const ratio = lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.z - from.z) * dz) / lengthSquared));
    return Math.hypot(point.x - (from.x + dx * ratio), point.z - (from.z + dz * ratio));
};
const assertText = (value, field) => {
    if (value.trim().length === 0)
        throw new Error(`${field} must contain non-whitespace text.`);
};
const assertVector = (value, field) => {
    if ([value.x, value.y, value.z].every(Number.isFinite) === false)
        throw new Error(`${field} must be finite.`);
};
//# sourceMappingURL=worldKit.js.map