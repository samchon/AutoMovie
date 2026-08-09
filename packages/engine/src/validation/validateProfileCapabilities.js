import { ViolationCollector } from "./violation";
/**
 * Validate the typed semantic capability data carried by model profiles.
 *
 * Locomotion remains proven by the profile's existing `gaits` field. This
 * validator owns the additional mountable and destructible traits so direct
 * engine consumers and production design lint enforce one contract.
 */
export const validateProfileCapabilities = (props) => {
    const collector = new ViolationCollector();
    const profileIds = new Set();
    for (const [profileIndex, profile] of props.profiles.entries()) {
        const path = `$input.profiles[${profileIndex}]`;
        nonBlank(profile.id, `${path}.id`, "profile id", collector);
        nonBlank(profile.name, `${path}.name`, "profile name", collector);
        unique(profileIds, profile.id, `${path}.id`, "profile id", collector);
        const traitKinds = new Set();
        for (const [traitIndex, trait] of (profile.traits ?? []).entries()) {
            const traitPath = `${path}.traits[${traitIndex}]`;
            unique(traitKinds, trait.kind, `${traitPath}.kind`, "profile trait kind", collector);
            if (trait.kind === "mountable") {
                integer(trait.seats, 1, 1_024, `${traitPath}.seats`, "mountable seats", collector);
                positive(trait.payloadMass, `${traitPath}.payloadMass`, "mountable payload mass", collector);
                continue;
            }
            positive(trait.durability, `${traitPath}.durability`, "destructible durability", collector);
            positive(trait.impactBody.mass, `${traitPath}.impactBody.mass`, "impact body mass", collector);
            bounded(trait.impactBody.restitution, 0, 1, `${traitPath}.impactBody.restitution`, "impact body restitution", collector);
            positive(trait.impactBody.hardness, `${traitPath}.impactBody.hardness`, "impact body hardness", collector);
            positive(trait.impactBody.penetrability, `${traitPath}.impactBody.penetrability`, "impact body penetrability", collector);
        }
    }
    return collector.toValidation();
};
const nonBlank = (value, path, label, collector) => {
    if (value.trim().length === 0)
        collector.push("type", path, `${label} must be non-blank`, value);
};
const unique = (seen, value, path, label, collector) => {
    if (seen.has(value))
        collector.push("type", path, `${label} must be unique`, value);
    seen.add(value);
};
const positive = (value, path, label, collector) => {
    if (Number.isFinite(value) === false || value <= 0)
        collector.push("range", path, `${label} must be finite and positive`, value);
};
const bounded = (value, min, max, path, label, collector) => collector.range(path, value, min, max, label);
const integer = (value, min, max, path, label, collector) => {
    if (Number.isInteger(value) === false || value < min || value > max)
        collector.push("range", path, `${label} must be an integer within [${min}, ${max}]`, value);
};
//# sourceMappingURL=validateProfileCapabilities.js.map