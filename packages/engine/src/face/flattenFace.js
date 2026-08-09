/** Traits with one morph target: symmetric features. */
const SINGLE = [
    { parameter: "faceWidth", path: "width", read: (f) => f.width },
    { parameter: "faceLength", path: "length", read: (f) => f.length },
    { parameter: "jawWidth", path: "jaw.width", read: (f) => f.jaw?.width },
    {
        parameter: "chinLength",
        path: "jaw.chin.length",
        read: (f) => f.jaw?.chin?.length,
    },
    {
        parameter: "chinProtrusion",
        path: "jaw.chin.protrusion",
        read: (f) => f.jaw?.chin?.protrusion,
    },
    { parameter: "noseLength", path: "nose.length", read: (f) => f.nose?.length },
    { parameter: "noseWidth", path: "nose.width", read: (f) => f.nose?.width },
    {
        parameter: "noseProjection",
        path: "nose.projection",
        read: (f) => f.nose?.projection,
    },
    { parameter: "mouthWidth", path: "mouth.width", read: (f) => f.mouth?.width },
    {
        parameter: "mouthHeight",
        path: "mouth.height",
        read: (f) => f.mouth?.height,
    },
    {
        parameter: "lipFullness",
        path: "mouth.lips.fullness",
        read: (f) => f.mouth?.lips?.fullness,
    },
];
const PAIRED = [
    {
        base: "eyeSize",
        group: "eyes",
        leaf: "size",
        read: (f) => f.eyes,
    },
    {
        base: "eyeWidth",
        group: "eyes",
        leaf: "width",
        read: (f) => f.eyes,
    },
    {
        base: "eyeSpacing",
        group: "eyes",
        leaf: "offset",
        read: (f) => f.eyes,
    },
    {
        base: "eyeHeight",
        group: "eyes",
        leaf: "height",
        read: (f) => f.eyes,
    },
    {
        base: "eyeTilt",
        group: "eyes",
        leaf: "tilt",
        read: (f) => f.eyes,
    },
    {
        base: "browHeight",
        group: "brows",
        leaf: "height",
        read: (f) => f.brows,
    },
    {
        base: "cheekFullness",
        group: "cheeks",
        leaf: "fullness",
        read: (f) => f.cheeks,
    },
];
/**
 * Project an {@link IAutoMovieFace} onto its morph targets: the nested,
 * anatomy-shaped document flattened to `(parameter, weight)` pairs in
 * declaration order, omitted leaves and groups skipped.
 *
 * Paired features follow the side rule: a lone `left`/`right` sources BOTH side
 * targets (the symmetric shorthand), two defined sides each source their own.
 * The eye pair's `spacing` scalar adds onto each side's `offset` for the
 * spacing targets. The reported `path` names the field the document actually
 * spells (the mirrored source when only one side exists), so a violation is
 * always actionable.
 *
 * Both engine consumers go through this single mapping, so validation paths and
 * morph application can never disagree about what a field means: `validateFace`
 * range-checks each trait at its document `path`, `morphFace` applies each
 * trait's `parameter` target.
 *
 * @author Samchon
 */
export const flattenFace = (face) => {
    const out = [];
    for (const { parameter, path, read } of SINGLE) {
        const weight = read(face);
        if (weight !== undefined)
            out.push({ parameter, path, weight });
    }
    for (const { base, group, leaf, read } of PAIRED) {
        const set = read(face);
        if (set === undefined)
            continue;
        const pairScalar = base === "eyeSpacing" ? set.spacing : undefined;
        for (const [suffix, side, other] of [
            ["R", "right", "left"],
            ["L", "left", "right"],
        ]) {
            // the side rule: a lone side sources both targets
            const srcSide = set[side] !== undefined ? side : other;
            const value = set[srcSide]?.[leaf];
            if (value === undefined && pairScalar === undefined)
                continue;
            out.push({
                parameter: `${base}${suffix}`,
                path: value !== undefined
                    ? `${group}.${srcSide}.${leaf}`
                    : `${group}.spacing`,
                weight: (value ?? 0) + (pairScalar ?? 0),
            });
        }
    }
    return out;
};
//# sourceMappingURL=flattenFace.js.map