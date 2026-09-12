/**
 * Slots per independently regenerated general-instance runtime chunk.
 *
 * A separate constant from the formation chunk size even though both are 1,024:
 * a compiled instance set's chunk list is part of its own digest, so the two
 * populations can change their range size without renumbering each other.
 *
 * @evidence requirements/asset-authoring/identity-and-instances.md#asset-compression-individuality Stores and renders a large instance set in bounded ranges while every member stays addressable by its slot.
 * @evidence specifications/asset-and-representation/alternatives-instances-and-groups.md#asset-spec-group-individuality Fixes the range size the compressed population is summarized and drawn by without dropping member identity.
 */
export const AUTOMOVIE_INSTANCE_CHUNK_SIZE = 1_024;
