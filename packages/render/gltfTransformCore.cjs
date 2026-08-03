"use strict";

// Keep this native import outside TypeScript compilation. Consumers execute
// render source and build output under different module settings, but both
// must select glTF Transform's ESM export only when GLB export is requested.
exports.importGltfTransformCore = () => import("@gltf-transform/core");
