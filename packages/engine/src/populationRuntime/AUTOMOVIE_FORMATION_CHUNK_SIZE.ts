/**
 * Slots per independently regenerated and culled formation runtime chunk.
 *
 * A compiled formation stores one bounds, centroid and anonymous count per
 * chunk rather than one scene node per member, so this is the range a viewer
 * regenerates, culls and selects a tier for. Changing it changes the chunk list
 * and therefore the digest of every compiled formation.
 *
 * @evidence requirements/formations/scope-and-identity.md#formation-authoring-mode-selection Keeps a compact formation reviewable as bounded ranges of regenerated members rather than forcing an explicit roster.
 * @evidence specifications/performance-motion-and-staging/formation-identity-layout-and-terrain.md#performance-formation-compact-representation-compatibility Fixes the size of the bounded chunks the compact runtime keeps in place of anonymous member nodes.
 */
export const AUTOMOVIE_FORMATION_CHUNK_SIZE = 1_024;
