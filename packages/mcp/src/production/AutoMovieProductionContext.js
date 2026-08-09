import { AutoMovieProductionProject } from "./AutoMovieProductionProject";
import { findAutoMovieProjectRoot, openAutoMovieProduction, } from "./openAutoMovieProduction";
/** Session context: guide reads, fixed root and current production services. */
export class AutoMovieProductionContext {
    capture;
    defaultProductionId;
    archetypes;
    guides = new Set();
    root;
    services = new Map();
    constructor(capture, projectRoot, defaultProductionId, 
    /** Archetype catalogue every production opened here is judged against. */
    archetypes) {
        this.capture = capture;
        this.defaultProductionId = defaultProductionId;
        this.archetypes = archetypes;
        validateProductionId(defaultProductionId);
        this.root = findAutoMovieProjectRoot(projectRoot);
    }
    /** Record delivery of one exact guide. */
    recordGuide(name) {
        this.guides.add(name);
    }
    /** Whether one exact guide received session credit. */
    hasGuide(name) {
        return this.guides.has(name);
    }
    /** Resolve one production under the immutable host root. */
    forProduction(productionId) {
        validateProductionId(productionId);
        const registered = AutoMovieProductionProject.registeredProductionIds(this.root);
        let selected = productionId ?? this.defaultProductionId;
        if (selected === undefined) {
            if (registered.length !== 1)
                throw new Error(registered.length === 0
                    ? "The project has no registered production. Create and compile one through the non-MCP project API before requesting evidence."
                    : `The project has ${registered.length} registered productions. Configure one productionId from: ${registered.join(", ")}.`);
            selected = registered[0];
        }
        if (registered.includes(selected) === false)
            throw new Error(`Production "${selected}" is not registered. Choose one current productionId from: ${registered.join(", ")}.`);
        const retained = this.services.get(selected);
        if (retained !== undefined)
            return retained;
        const opened = openAutoMovieProduction({
            projectRoot: this.root,
            productionId: selected,
            capture: this.capture,
            archetypes: this.archetypes,
        });
        this.services.set(opened.project.productionId, opened);
        return opened;
    }
}
const validateProductionId = (productionId) => {
    if (productionId !== undefined &&
        (productionId.trim().length === 0 || productionId.trim() !== productionId))
        throw new Error("Host productionId must be a trimmed non-empty production namespace.");
};
//# sourceMappingURL=AutoMovieProductionContext.js.map