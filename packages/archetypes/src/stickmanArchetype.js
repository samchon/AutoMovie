import { Quaternion } from "@automovie/engine";
import { numberOf, numberParameter } from "./parameterValues";
/**
 * The catalogue's articulated figure: one height-driven primitive rig.
 *
 * Every proportion is derived from `height`, so one number moves the whole
 * runtime and the compiled result stays reproducible. It is one catalogue's
 * idea of an upright figure, registered like any other archetype rather than
 * known to the compiler.
 */
export const STICKMAN_ARCHETYPE = {
    id: "stickman",
    capabilities: ["signal"],
    bones: [
        "hips",
        "spine",
        "head",
        "leftUpperArm",
        "leftLowerArm",
        "leftHand",
        "rightUpperArm",
        "rightLowerArm",
        "rightHand",
        "leftUpperLeg",
        "leftLowerLeg",
        "rightUpperLeg",
        "rightLowerLeg",
    ],
    parameters: {
        height: { kind: "number", minimum: 0.5, maximum: 3 },
        headRadius: { kind: "number", minimum: 0.05, maximum: 0.5 },
        limbRadius: { kind: "number", minimum: 0.01, maximum: 0.25 },
    },
    plan: () => ({
        required: ["height", "headRadius", "limbRadius"],
        accepted: null,
        refusals: [],
    }),
    projectionRadius: (parameters) => numberOf(parameters, "height") / 2,
    build: (input) => build(input),
};
const build = (input) => {
    const height = numberParameter(input.parameters, "height");
    const headRadius = numberParameter(input.parameters, "headRadius");
    const limbRadius = numberParameter(input.parameters, "limbRadius");
    const part = (id, bone, shape, local) => ({
        id,
        name: id,
        geometry: { type: "primitive", shape },
        material: input.material,
        attachedBone: bone,
        transform: local,
    });
    const torsoHeight = Math.max(headRadius * 2, height * 0.3);
    const upperLimb = Math.max(limbRadius * 2, height * 0.15);
    const lowerLimb = Math.max(limbRadius * 2, height * 0.14);
    return {
        skeleton: skeletonOf(input.skeleton, height),
        parts: [
            part("pelvis", "hips", {
                type: "box",
                width: height * 0.19,
                height: height * 0.12,
                depth: height * 0.11,
            }, transform(0, 0, 0)),
            part("torso", "spine", {
                type: "box",
                width: height * 0.25,
                height: torsoHeight,
                depth: height * 0.12,
            }, transform(0, torsoHeight * 0.22, 0)),
            part("head", "head", { type: "sphere", radius: headRadius }, null),
            ...["left", "right"].flatMap((side) => {
                const sign = side === "left" ? 1 : -1;
                return [
                    part(`${side}-upper-arm`, `${side}UpperArm`, {
                        type: "capsule",
                        radius: limbRadius,
                        height: upperLimb,
                    }, horizontal(sign * upperLimb * 0.55)),
                    part(`${side}-lower-arm`, `${side}LowerArm`, {
                        type: "capsule",
                        radius: limbRadius * 0.85,
                        height: lowerLimb,
                    }, horizontal(sign * lowerLimb * 0.55)),
                    part(`${side}-hand`, `${side}Hand`, { type: "sphere", radius: limbRadius * 1.05 }, null),
                    part(`${side}-thigh`, `${side}UpperLeg`, {
                        type: "capsule",
                        radius: limbRadius * 1.15,
                        height: height * 0.19,
                    }, transform(0, -height * 0.105, 0)),
                    part(`${side}-shin`, `${side}LowerLeg`, {
                        type: "capsule",
                        radius: limbRadius,
                        height: height * 0.19,
                    }, transform(0, -height * 0.105, 0)),
                ];
            }),
        ],
    };
};
const skeletonOf = (id, height) => {
    const bone = (name, parent, x, y, z) => ({
        bone: name,
        parent,
        rest: transform(x, y, z),
        constraint: null,
    });
    return {
        id,
        bones: [
            bone("hips", null, 0, height * 0.5, 0),
            bone("spine", "hips", 0, height * 0.18, 0),
            bone("head", "spine", 0, height * 0.24, 0),
            bone("leftUpperArm", "spine", height * 0.125, height * 0.15, 0),
            bone("leftLowerArm", "leftUpperArm", height * 0.17, 0, 0),
            bone("leftHand", "leftLowerArm", height * 0.16, 0, 0),
            bone("rightUpperArm", "spine", -height * 0.125, height * 0.15, 0),
            bone("rightLowerArm", "rightUpperArm", -height * 0.17, 0, 0),
            bone("rightHand", "rightLowerArm", -height * 0.16, 0, 0),
            bone("leftUpperLeg", "hips", height * 0.07, -height * 0.04, 0),
            bone("leftLowerLeg", "leftUpperLeg", 0, -height * 0.22, 0),
            bone("rightUpperLeg", "hips", -height * 0.07, -height * 0.04, 0),
            bone("rightLowerLeg", "rightUpperLeg", 0, -height * 0.22, 0),
        ],
    };
};
const transform = (x, y, z, rotation = { x: 0, y: 0, z: 0, w: 1 }) => ({
    translation: { x, y, z },
    rotation,
    scale: { x: 1, y: 1, z: 1 },
});
const horizontal = (x) => rotateZ(x < 0 ? 90 : -90, x, 0, 0);
const rotateZ = (degrees, x, y, z) => transform(x, y, z, Quaternion.fromAxisAngle({ x: 0, y: 0, z: 1 }, degrees));
//# sourceMappingURL=stickmanArchetype.js.map