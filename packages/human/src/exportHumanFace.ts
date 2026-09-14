import type { IAutoMovieModel } from "@automovie/interface";
import { type JSONDocument, WebIO } from "@gltf-transform/core";

import {
  portraitDocument,
  portraitGltfExtensions,
} from "./geometry/portraitDocument";

/**
 * Serialize an admitted static face to GLB and glTF with resident resources.
 * The package owns both document creation and its writer: glTF-Transform uses
 * class identity internally, so passing a Document between independently loaded
 * CommonJS and ES-module copies can silently discard its geometry. Returned
 * bytes and JSON have no such module-instance identity requirement.
 *
 * This applies the same static geometry, Float32 and optical-material admission
 * as portraitDocument. It does not mutate the model, fetch resources or create
 * an animation. Consumers register the supported extensions when reading.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-export Returns the face's actual static geometry and optical materials as independently readable assets.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-export Keeps document and writer in one module instance before exposing portable GLB bytes and glTF resources.
 */
export async function exportHumanFace(model: IAutoMovieModel): Promise<{
  glb: Uint8Array<ArrayBuffer>;
  gltf: JSONDocument;
}> {
  const document = portraitDocument(model);
  const writer = new WebIO().registerExtensions(portraitGltfExtensions);
  const glb = await writer.writeBinary(document);
  const gltf = await writer.writeJSON(document);
  return { glb, gltf };
}
