import typia from "typia";
import { digestAutoMovieBytes } from "./contentIdentity";
/** Read and authenticate the current compiler-owned evidence target registry. */
export const readAutoMovieProductionRegistry = (project) => {
    const generated = project.generatedManifest();
    if (generated === null)
        throw new Error("Evidence requires a current compiler registry. Run the scaffold compile command first.");
    const entry = generated.files.find((file) => file.path === "manifests/compile.json");
    if (entry === undefined)
        throw new Error("Current generated ownership has no evidence target registry. Recompile with the installed AutoMovie package.");
    const bytes = project.readGeneratedFile("manifests/compile.json");
    if (digestAutoMovieBytes(bytes) !== entry.digest)
        throw new Error("Compiler target registry bytes differ from generated ownership. Recompile before producing evidence.");
    const validation = typia.validateEquals(JSON.parse(Buffer.from(bytes).toString("utf8")));
    if (validation.success === false ||
        validation.data.productionId !== project.productionId ||
        validation.data.inputFingerprint !== generated.inputFingerprint)
        throw new Error("Compiler target registry is malformed or stale for the active production. Recompile before producing evidence.");
    return validation.data;
};
//# sourceMappingURL=productionRegistry.js.map