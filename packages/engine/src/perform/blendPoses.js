const AXES = ["flexion", "abduction", "twist"];
/**
 * Blend several pose layers by **weighted additive composition**: per bone, per
 * axis (flexion / abduction / twist), the result is the weight-normalized sum
 * of the layers that set that axis. A `null` axis contributes nothing and does
 * not dilute the others, so a single layer at weight 1 reproduces its own value
 * exactly, which makes this a drop-in for the last-wins {@link mergePoses} on
 * the disjoint-region layering path (no bone is set twice there), while adding
 * real blending when layers genuinely overlap on an axis (e.g. a carry pose
 * plus a reaction flinch on the same arm).
 *
 * The blend never clamps: a weighted result outside a joint's ROM stays out of
 * range so `validateMotion` reports it. The model must reweigh or reposition,
 * the engine does not hide it. Root: the last `ownsRoot` layer, else the last
 * non-null root; skeleton: the first layer's. The input must be non-empty.
 *
 * Weights are supplied by the caller; deriving them from action priority or an
 * IK solver is a later pass.
 *
 * @author Samchon
 */
export const blendPoses = (layers) => {
    if (layers.length === 0)
        throw new Error("blend poses must not be empty");
    const acc = new Map();
    const order = [];
    for (const layer of layers)
        for (const joint of layer.pose.joints) {
            let entry = acc.get(joint.bone);
            if (entry === undefined) {
                entry = { weight: [0, 0, 0], weighted: [0, 0, 0] };
                acc.set(joint.bone, entry);
                order.push(joint.bone);
            }
            AXES.forEach((axis, i) => {
                const value = joint[axis];
                if (value !== null) {
                    entry.weight[i] += layer.weight;
                    entry.weighted[i] += layer.weight * value;
                }
            });
        }
    const joints = order.map((bone) => {
        const entry = acc.get(bone);
        const axisValue = (i) => entry.weight[i] > 0 ? entry.weighted[i] / entry.weight[i] : null;
        return {
            bone,
            flexion: axisValue(0),
            abduction: axisValue(1),
            twist: axisValue(2),
        };
    });
    let root = layers[0].pose.root;
    const owning = layers.filter((layer) => layer.ownsRoot === true);
    if (owning.length > 0)
        root = owning[owning.length - 1].pose.root;
    else
        for (const layer of layers)
            if (layer.pose.root !== null)
                root = layer.pose.root;
    return { skeleton: layers[0].pose.skeleton, root, joints };
};
//# sourceMappingURL=blendPoses.js.map