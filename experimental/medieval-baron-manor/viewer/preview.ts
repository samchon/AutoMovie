import type { IAutoMovieSourcePreview } from "./src/sourcePreview";
import { createTexturedManorScene } from "../src/instances/manor-textured.js";

/** Production destinations consumed by the common source-preview navigator. */
export const createPreview = async (): Promise<IAutoMovieSourcePreview> => {
  const preview = await createTexturedManorScene();
  const roomNames = new Map(
    preview.manifest.rooms.map((room: { id: string; label: string }) => [
      room.id,
      room.label,
    ]),
  );
  const destinations = preview.views.map(
    (view: { id: string; room?: string; object?: string }, index: number) => ({
      index,
      id: view.id,
      label: view.id,
      group: roomNames.get(view.room ?? "") ?? view.object ?? "Views",
      keywords: [view.room ?? "", view.object ?? ""],
    }),
  );
  const indices = new Map(destinations.map((item) => [item.id, item.index]));
  return {
    ...preview,
    navigation: {
      items: destinations,
      apply: (id) => {
        const index = indices.get(id);
        if (index === undefined) throw new Error(`Unknown preview view: ${id}`);
        preview.applyView(index);
        preview.target.copy(preview.inspection.target.position);
      },
    },
  };
};
