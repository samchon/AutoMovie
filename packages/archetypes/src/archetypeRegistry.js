/**
 * Register one closed catalogue of archetypes for a host to build from.
 *
 * Registration is where a duplicate or blank id has to fail, because after it
 * the map answers one definition per id and nobody can tell which of two
 * builders a recipe reached.
 */
export const createAutoMovieArchetypeRegistry = (archetypes) => {
    const registry = new Map();
    for (const archetype of archetypes) {
        if (archetype.id.trim().length === 0)
            throw new Error("A model archetype id must contain non-whitespace text. Give every registered archetype the exact id its recipes name.");
        if (registry.has(archetype.id))
            throw new Error(`Model archetype "${archetype.id}" is registered twice. Register one definition per id so a recipe cannot reach two builders.`);
        registry.set(archetype.id, archetype);
    }
    return registry;
};
//# sourceMappingURL=archetypeRegistry.js.map