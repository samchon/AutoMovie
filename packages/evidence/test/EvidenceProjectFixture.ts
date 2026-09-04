import fs from "node:fs";
import os from "node:os";
import path from "node:path";

interface IContractFixture {
  path: string;
  title: string;
  units: readonly {
    anchor: string;
    title: string;
  }[];
}

const CONTRACTS: readonly IContractFixture[] = [
  {
    path: "discovery/core/common.md",
    title: "Production-Specific Contract Discovery",
    units: [
      {
        title: "Shared and local boundary",
        anchor: "shared-local-boundary",
      },
      {
        title: "Canonical realization",
        anchor: "canonical-realization",
      },
    ],
  },
  {
    path: "discovery/core/settings.md",
    title: "Settings Discovery",
    units: [
      {
        title: "Directive, promise, and subject requirements",
        anchor: "directive-promise-subject-requirements",
      },
      {
        title: "Planned delivery backcast",
        anchor: "planned-delivery-backcast",
      },
    ],
  },
  {
    path: "discovery/delivery/briefs.md",
    title: "Brief Discovery",
    units: [
      {
        title: "Work-specific brief requirements",
        anchor: "work-specific-brief-requirements",
      },
    ],
  },
  {
    path: "discovery/design/designs.md",
    title: "Design Discovery",
    units: [
      {
        title: "Work-specific design requirements",
        anchor: "work-specific-design-requirements",
      },
    ],
  },
  {
    path: "discovery/design/instances.md",
    title: "Instance Discovery",
    units: [
      {
        title: "Work-specific instance requirements",
        anchor: "work-specific-instance-requirements",
      },
    ],
  },
  {
    path: "discovery/design/maps.md",
    title: "Map Discovery",
    units: [
      {
        title: "Work-specific map requirements",
        anchor: "work-specific-map-requirements",
      },
    ],
  },
  {
    path: "discovery/design/materials.md",
    title: "Material Discovery",
    units: [
      {
        title: "Work-specific material requirements",
        anchor: "work-specific-material-requirements",
      },
    ],
  },
  {
    path: "discovery/design/models.md",
    title: "Model Discovery",
    units: [
      {
        title: "Work-specific model requirements",
        anchor: "work-specific-model-requirements",
      },
    ],
  },
  {
    path: "discovery/design/motions.md",
    title: "Motion Discovery",
    units: [
      {
        title: "Work-specific motion requirements",
        anchor: "work-specific-motion-requirements",
      },
    ],
  },
  {
    path: "discovery/design/spaces.md",
    title: "Space Discovery",
    units: [
      {
        title: "Work-specific space requirements",
        anchor: "work-specific-space-requirements",
      },
    ],
  },
  {
    path: "discovery/design/systems.md",
    title: "System Discovery",
    units: [
      {
        title: "Work-specific system requirements",
        anchor: "work-specific-system-requirements",
      },
    ],
  },
  {
    path: "discovery/story/films.md",
    title: "Film Discovery",
    units: [
      {
        title: "Work-specific film requirements",
        anchor: "work-specific-film-requirements",
      },
    ],
  },
  {
    path: "discovery/story/screenplays.md",
    title: "Screenplay Discovery",
    units: [
      {
        title: "Work-specific screenplay requirements",
        anchor: "work-specific-screenplay-requirements",
      },
    ],
  },
  {
    path: "discovery/story/scripts.md",
    title: "Script Discovery",
    units: [
      {
        title: "Work-specific script requirements",
        anchor: "work-specific-script-requirements",
      },
    ],
  },
  {
    path: "discovery/story/treatments.md",
    title: "Treatment Discovery",
    units: [
      {
        title: "Work-specific treatment requirements",
        anchor: "work-specific-treatment-requirements",
      },
    ],
  },
  {
    path: "obligations/core/common.md",
    title: "Common obligations",
    units: [
      {
        title: "Purpose fit",
        anchor: "purpose-fit",
      },
      {
        title: "Layer boundary",
        anchor: "layer-boundary",
      },
      {
        title: "Production language",
        anchor: "production-language",
      },
      {
        title: "Proportionate development",
        anchor: "proportionate-development",
      },
    ],
  },
  {
    path: "obligations/core/defaults.md",
    title: "Post-draft anti-default obligations",
    units: [
      {
        title: "Recurrent frame distribution",
        anchor: "recurrent-frame-distribution",
      },
      {
        title: "Surface cadence distribution",
        anchor: "surface-cadence-distribution",
      },
    ],
  },
  {
    path: "obligations/core/settings.md",
    title: "Settings obligations",
    units: [
      {
        title: "Addressable canon",
        anchor: "addressable-canon",
      },
      {
        title: "Delivery scope",
        anchor: "delivery-scope",
      },
      {
        title: "Governing aim",
        anchor: "governing-aim",
      },
      {
        title: "Production visual grammar",
        anchor: "production-visual-grammar",
      },
      {
        title: "Production fidelity tier",
        anchor: "production-fidelity-tier",
      },
      {
        title: "Subject breakdown and production scope",
        anchor: "subject-breakdown-production-scope",
      },
      {
        title: "Audience or operator access",
        anchor: "audience-operator-access",
      },
      {
        title: "Accessibility deliverable states",
        anchor: "accessibility-deliverable-states",
      },
      {
        title: "Coordinate and unit convention",
        anchor: "coordinate-unit-convention",
      },
      {
        title: "Delivery review condition",
        anchor: "delivery-review-condition",
      },
      {
        title: "Settings coverage map",
        anchor: "settings-coverage-map",
      },
      {
        title: "Operative subject inventory",
        anchor: "operative-subject-inventory",
      },
      {
        title: "Agency and limits",
        anchor: "agency-and-limits",
      },
      {
        title: "Design-dependent subject conditions",
        anchor: "design-dependent-subject-conditions",
      },
      {
        title: "Minimal departure",
        anchor: "minimal-departure",
      },
      {
        title: "Internal coherence",
        anchor: "internal-coherence",
      },
    ],
  },
  {
    path: "obligations/delivery/briefs.md",
    title: "Direct brief obligations",
    units: [
      {
        title: "Single-scope eligibility",
        anchor: "single-scope-eligibility",
      },
      {
        title: "Brief unit addressability",
        anchor: "brief-unit-addressability",
      },
      {
        title: "Observable progression",
        anchor: "observable-progression",
      },
    ],
  },
  {
    path: "obligations/delivery/film-sources.md",
    title: "Film source obligations",
    units: [
      {
        title: "Editorial-only assembly",
        anchor: "editorial-only-assembly",
      },
      {
        title: "Authored auxiliary tracks",
        anchor: "authored-auxiliary-tracks",
      },
      {
        title: "Deterministic timeline",
        anchor: "deterministic-timeline",
      },
    ],
  },
  {
    path: "obligations/delivery/production-sources.md",
    title: "Production source obligations",
    units: [
      {
        title: "Settings-only serialization",
        anchor: "settings-only-serialization",
      },
      {
        title: "Delivery identity",
        anchor: "delivery-identity",
      },
      {
        title: "Shared visual grammar",
        anchor: "shared-visual-grammar",
      },
    ],
  },
  {
    path: "obligations/delivery/shots.md",
    title: "Shot source obligations",
    units: [
      {
        title: "Contract-only composition",
        anchor: "contract-only-composition",
      },
      {
        title: "Explicit inputs and time",
        anchor: "explicit-inputs-and-time",
      },
      {
        title: "Acceptance travels with delivery",
        anchor: "acceptance-travels-with-delivery",
      },
    ],
  },
  {
    path: "obligations/design/instances.md",
    title: "Instance obligations",
    units: [
      {
        title: "Addressable instance decisions",
        anchor: "addressable-instance-decisions",
      },
      {
        title: "Prototype and membership",
        anchor: "instance-prototype-membership",
      },
      {
        title: "Stable identity and transform",
        anchor: "instance-identity-transform",
      },
      {
        title: "Variation and representation tiers",
        anchor: "instance-variation-tiers",
      },
      {
        title: "Placement validity and review",
        anchor: "instance-placement-review",
      },
    ],
  },
  {
    path: "obligations/design/instance-sources.md",
    title: "Instance source obligations",
    units: [
      {
        title: "Design-owned population",
        anchor: "instance-source-design-ownership",
      },
      {
        title: "Stable generated membership",
        anchor: "instance-source-stable-membership",
      },
      {
        title: "Invalid placement is refused",
        anchor: "instance-source-invalid-placement",
      },
    ],
  },
  {
    path: "obligations/design/maps.md",
    title: "Map obligations",
    units: [
      {
        title: "Addressable map decisions",
        anchor: "addressable-map-decisions",
      },
      {
        title: "World extent and site interface",
        anchor: "map-world-site-interface",
      },
      {
        title: "Selected world content and relations",
        anchor: "map-world-content-relations",
      },
      {
        title: "World temporal state and alternatives",
        anchor: "map-world-temporal-state",
      },
      {
        title: "World scale, partition, and population",
        anchor: "map-world-scale-partition",
      },
      {
        title: "World source resolution and staleness",
        anchor: "map-world-source-resolution",
      },
      {
        title: "Map review set",
        anchor: "map-review-set",
      },
    ],
  },
  {
    path: "obligations/design/map-sources.md",
    title: "Map source obligations",
    units: [
      {
        title: "Design-owned world construction",
        anchor: "map-source-design-ownership",
      },
      {
        title: "Deterministic resolved world",
        anchor: "map-source-deterministic-world",
      },
      {
        title: "Preserved source lineage",
        anchor: "map-source-preserved-lineage",
      },
      {
        title: "Invalid or incomplete worlds are refused",
        anchor: "map-source-invalid-world",
      },
    ],
  },
  {
    path: "obligations/design/materials.md",
    title: "Material obligations",
    units: [
      {
        title: "Addressable material decisions",
        anchor: "addressable-material-decisions",
      },
      {
        title: "Material identity and assembly",
        anchor: "material-identity-assembly",
      },
      {
        title: "Surface assignment",
        anchor: "material-surface-assignment",
      },
      {
        title: "Optical and physical response",
        anchor: "material-response",
      },
      {
        title: "Material review set",
        anchor: "material-review-set",
      },
    ],
  },
  {
    path: "obligations/design/material-sources.md",
    title: "Material source obligations",
    units: [
      {
        title: "Design-owned material construction",
        anchor: "material-source-design-ownership",
      },
      {
        title: "Explicit renderer mapping",
        anchor: "material-source-renderer-mapping",
      },
      {
        title: "Invalid material state is refused",
        anchor: "material-source-invalid-state",
      },
    ],
  },
  {
    path: "obligations/design/models.md",
    title: "Model obligations",
    units: [
      {
        title: "Addressable model decisions",
        anchor: "addressable-model-decisions",
      },
      {
        title: "Representation ceiling",
        anchor: "representation-ceiling",
      },
      {
        title: "Reference scale",
        anchor: "reference-scale",
      },
      {
        title: "Articulation ownership",
        anchor: "articulation-ownership",
      },
      {
        title: "Model review set",
        anchor: "model-review-set",
      },
    ],
  },
  {
    path: "obligations/design/model-sources.md",
    title: "Model source obligations",
    units: [
      {
        title: "Design-owned construction",
        anchor: "design-owned-construction",
      },
      {
        title: "Deterministic build",
        anchor: "deterministic-build",
      },
      {
        title: "Unsupported fidelity is explicit",
        anchor: "unsupported-fidelity-is-explicit",
      },
    ],
  },
  {
    path: "obligations/design/motions.md",
    title: "Motion obligations",
    units: [
      {
        title: "Addressable motion decisions",
        anchor: "addressable-motion-decisions",
      },
      {
        title: "Time base",
        anchor: "time-base",
      },
      {
        title: "Contact policy",
        anchor: "contact-policy",
      },
      {
        title: "Composition and interruption",
        anchor: "composition-interruption",
      },
      {
        title: "Motion review set",
        anchor: "motion-review-set",
      },
    ],
  },
  {
    path: "obligations/design/motion-sources.md",
    title: "Motion source obligations",
    units: [
      {
        title: "Design-owned transition",
        anchor: "design-owned-transition",
      },
      {
        title: "Pure time mapping",
        anchor: "pure-time-mapping",
      },
      {
        title: "Invalid input is visible",
        anchor: "invalid-input-is-visible",
      },
    ],
  },
  {
    path: "obligations/design/spaces.md",
    title: "Space obligations",
    units: [
      {
        title: "Addressable spatial decisions",
        anchor: "addressable-spatial-decisions",
      },
      {
        title: "Spatial reference and topology",
        anchor: "space-reference-topology",
      },
      {
        title: "Exterior and interior interface",
        anchor: "space-envelope-interface",
      },
      {
        title: "Access, circulation, and clearance",
        anchor: "space-access-circulation",
      },
      {
        title: "Space review set",
        anchor: "space-review-set",
      },
    ],
  },
  {
    path: "obligations/design/space-sources.md",
    title: "Space source obligations",
    units: [
      {
        title: "Design-owned topology",
        anchor: "space-source-design-ownership",
      },
      {
        title: "Stable spatial identities",
        anchor: "space-source-stable-identities",
      },
      {
        title: "Invalid topology is refused",
        anchor: "space-source-invalid-topology",
      },
    ],
  },
  {
    path: "obligations/design/systems.md",
    title: "System obligations",
    units: [
      {
        title: "Addressable system decisions",
        anchor: "addressable-system-decisions",
      },
      {
        title: "Ownership and interfaces",
        anchor: "system-ownership-interfaces",
      },
      {
        title: "State, clock, and determinism",
        anchor: "system-state-clock",
      },
      {
        title: "Budget and degradation",
        anchor: "system-budget-degradation",
      },
      {
        title: "System review set",
        anchor: "system-review-set",
      },
    ],
  },
  {
    path: "obligations/design/system-sources.md",
    title: "System source obligations",
    units: [
      {
        title: "Design-owned process",
        anchor: "system-source-design-ownership",
      },
      {
        title: "Pure explicit evaluation",
        anchor: "system-source-explicit-evaluation",
      },
      {
        title: "Failure and budget are observable",
        anchor: "system-source-failure-budget",
      },
    ],
  },
  {
    path: "obligations/story/narratives.md",
    title: "Narrative obligations",
    units: [
      {
        title: "Unit addressability",
        anchor: "unit-addressability",
      },
      {
        title: "Unit contribution distribution",
        anchor: "unit-contribution-distribution",
      },
      { title: "Sequence connection", anchor: "sequence-connection" },
      {
        title: "State continuity distribution",
        anchor: "state-continuity-distribution",
      },
      {
        title: "Character continuity distribution",
        anchor: "character-continuity-distribution",
      },
      {
        title: "Temporal gear distribution",
        anchor: "temporal-gear-distribution",
      },
      { title: "Speech distribution", anchor: "speech-distribution" },
      {
        title: "Voice-frame distribution",
        anchor: "voice-frame-distribution",
      },
      { title: "Pacing arrangement", anchor: "pacing-arrangement" },
    ],
  },
  {
    path: "obligations/story/screenplays.md",
    title: "Screenplay obligations",
    units: [
      {
        title: "Realization-ready contract",
        anchor: "realization-ready-contract",
      },
      {
        title: "Format and scene completeness",
        anchor: "screenplay-format-scene-completeness",
      },
      {
        title: "Revision and realization handoff",
        anchor: "screenplay-revision-realization-handoff",
      },
    ],
  },
  {
    path: "obligations/story/scripts.md",
    title: "Script obligations",
    units: [
      {
        title: "Release partition",
        anchor: "release-partition",
      },
      {
        title: "Script boundary",
        anchor: "script-boundary",
      },
    ],
  },
  {
    path: "obligations/story/subjects.md",
    title: "Subject obligations",
    units: [
      {
        title: "Situated conditions",
        anchor: "situated-conditions",
      },
      {
        title: "Drives and pressures",
        anchor: "drives-and-pressures",
      },
      {
        title: "Knowledge and perception",
        anchor: "knowledge-and-perception",
      },
      {
        title: "Expression and behavior",
        anchor: "expression-and-behavior",
      },
      {
        title: "Bidirectional relationships",
        anchor: "bidirectional-relationships",
      },
      {
        title: "Change boundaries",
        anchor: "change-boundaries",
      },
    ],
  },
  {
    path: "obligations/story/treatments.md",
    title: "Treatment obligations",
    units: [
      {
        title: "Opening condition",
        anchor: "opening-condition",
      },
      {
        title: "Terminal condition",
        anchor: "terminal-condition",
      },
      {
        title: "Audience route",
        anchor: "audience-route",
      },
      {
        title: "Resolution and aftermath",
        anchor: "resolution-aftermath",
      },
      {
        title: "Thematic development",
        anchor: "thematic-development",
      },
      {
        title: "Treatment boundary",
        anchor: "treatment-boundary",
      },
      {
        title: "Sustained middle",
        anchor: "sustained-middle",
      },
    ],
  },
  {
    path: "principles/core/common.md",
    title: "Common principles",
    units: [
      {
        title: "Declared scope preservation",
        anchor: "scope-preservation",
      },
      {
        title: "Layer-substantive completion",
        anchor: "substantive-completion",
      },
      {
        title: "Evidence-content conformance",
        anchor: "evidence-content-conformance",
      },
      {
        title: "Declared basis",
        anchor: "declared-basis",
      },
    ],
  },
  {
    path: "principles/core/defaults.md",
    title: "Composition-safe anti-default principles",
    units: [
      { title: "Purposeful enumeration", anchor: "purposeful-enumeration" },
      { title: "Earned significance", anchor: "earned-significance" },
      {
        title: "Responsive qualification",
        anchor: "responsive-qualification",
      },
      { title: "Functional formatting", anchor: "functional-formatting" },
      { title: "Material contrast", anchor: "contrastive-definition" },
    ],
  },
  {
    path: "principles/core/inherited-units.md",
    title: "Inherited-unit principles",
    units: [
      {
        title: "Derived parent differentiation",
        anchor: "derived-parent-differentiation",
      },
    ],
  },
  {
    path: "principles/core/research.md",
    title: "Research principles",
    units: [
      {
        title: "Source identity",
        anchor: "source-identity",
      },
      {
        title: "Production consequence",
        anchor: "production-consequence",
      },
      {
        title: "Uncertainty boundary",
        anchor: "uncertainty-boundary",
      },
    ],
  },
  {
    path: "principles/core/settings.md",
    title: "Settings principles",
    units: [
      {
        title: "Information structure",
        anchor: "information-structure",
      },
      {
        title: "Fact status",
        anchor: "fact-status",
      },
      {
        title: "Source support",
        anchor: "source-support",
      },
      {
        title: "Capability boundary",
        anchor: "capability-boundary",
      },
      {
        title: "Constraint sufficiency",
        anchor: "constraint-sufficiency",
      },
      {
        title: "Observable identity",
        anchor: "observable-identity",
      },
    ],
  },
  {
    path: "principles/core/source-units.md",
    title: "TypeScript source-unit principles",
    units: [
      {
        title: "Source-owner scope preservation",
        anchor: "source-scope-preservation",
      },
      {
        title: "Source-owner substantive completion",
        anchor: "source-substantive-completion",
      },
      {
        title: "Source-owner evidence-content conformance",
        anchor: "source-evidence-content-conformance",
      },
    ],
  },
  {
    path: "principles/delivery/briefs.md",
    title: "Direct brief principles",
    units: [
      {
        title: "Brief information structure",
        anchor: "brief-information-structure",
      },
      {
        title: "No narrative smuggling",
        anchor: "no-narrative-smuggling",
      },
    ],
  },
  {
    path: "principles/design/instances.md",
    title: "Instance design principles",
    units: [
      {
        title: "Instance information structure",
        anchor: "instance-information-structure",
      },
      {
        title: "Prototype boundary",
        anchor: "instance-prototype-boundary",
      },
      {
        title: "Single derivation authority",
        anchor: "instance-derivation-authority",
      },
      {
        title: "Verification-addressable population claims",
        anchor: "instance-verification-address",
      },
    ],
  },
  {
    path: "principles/design/maps.md",
    title: "Map design principles",
    units: [
      {
        title: "Addressable world identity",
        anchor: "map-addressable-world-identity",
      },
      {
        title: "Map information structure",
        anchor: "map-information-structure",
      },
      {
        title: "Coordinate, extent, and scale convention",
        anchor: "map-coordinate-extent-scale",
      },
      {
        title: "Verification-addressable world claims",
        anchor: "map-verification-address",
      },
    ],
  },
  {
    path: "principles/design/materials.md",
    title: "Material design principles",
    units: [
      {
        title: "Material information structure",
        anchor: "material-information-structure",
      },
      {
        title: "Construction and appearance separation",
        anchor: "material-construction-appearance",
      },
      {
        title: "Binding interface contract",
        anchor: "material-binding-interface",
      },
      {
        title: "Verification-addressable material claims",
        anchor: "material-verification-address",
      },
    ],
  },
  {
    path: "principles/design/models.md",
    title: "Model design principles",
    units: [
      {
        title: "Model information structure",
        anchor: "model-information-structure",
      },
      {
        title: "Representation contract",
        anchor: "representation-contract",
      },
      {
        title: "Spatial convention",
        anchor: "spatial-convention",
      },
      {
        title: "Reviewable structure",
        anchor: "reviewable-structure",
      },
    ],
  },
  {
    path: "principles/design/motions.md",
    title: "Motion design principles",
    units: [
      {
        title: "Motion information structure",
        anchor: "motion-information-structure",
      },
      {
        title: "State endpoints",
        anchor: "state-endpoints",
      },
      {
        title: "Temporal phases",
        anchor: "temporal-phases",
      },
      {
        title: "Spatial relation",
        anchor: "spatial-relation",
      },
      {
        title: "Parameter domain",
        anchor: "parameter-domain",
      },
    ],
  },
  {
    path: "principles/design/spaces.md",
    title: "Space design principles",
    units: [
      {
        title: "Spatial information structure",
        anchor: "space-information-structure",
      },
      {
        title: "Topology before geometry",
        anchor: "space-topology",
      },
      {
        title: "Canonical boundary authority",
        anchor: "space-boundary-authority",
      },
      {
        title: "Verification-addressable spatial claims",
        anchor: "space-verification-address",
      },
    ],
  },
  {
    path: "principles/design/systems.md",
    title: "System design principles",
    units: [
      {
        title: "System information structure",
        anchor: "system-information-structure",
      },
      {
        title: "Authority confinement",
        anchor: "system-authority-confinement",
      },
      {
        title: "Explicit dependency basis",
        anchor: "system-dependency-basis",
      },
      {
        title: "Verification-addressable system claims",
        anchor: "system-verification-address",
      },
    ],
  },
  {
    path: "principles/story/narratives.md",
    title: "Narrative principles",
    units: [
      {
        title: "Unit function",
        anchor: "unit-function",
      },
      {
        title: "Unit connection",
        anchor: "unit-connection",
      },
      {
        title: "State continuity",
        anchor: "horizontal-state-continuity",
      },
      {
        title: "Narrated time",
        anchor: "narrated-time",
      },
      {
        title: "Audience investment",
        anchor: "audience-investment",
      },
      {
        title: "Character continuity",
        anchor: "character-continuity",
      },
      {
        title: "Information entry",
        anchor: "information-entry",
      },
      {
        title: "Specificity",
        anchor: "specificity",
      },
      {
        title: "Closing-line contribution",
        anchor: "closing-line-contribution",
      },
      {
        title: "Parent differentiation",
        anchor: "parent-differentiation",
      },
      {
        title: "Drive to turn",
        anchor: "drive-to-turn",
      },
      {
        title: "Unit identity",
        anchor: "unit-identity",
      },
      {
        title: "Boundary-state inheritance",
        anchor: "state-continuity",
      },
      {
        title: "Observable inheritance",
        anchor: "observable-inheritance",
      },
    ],
  },
  {
    path: "principles/story/screenplays.md",
    title: "Screenplay principles",
    units: [
      {
        title: "Screenplay blocks",
        anchor: "screenplay-blocks",
      },
      {
        title: "Filmable expression",
        anchor: "filmable-expression",
      },
      {
        title: "Audiovisual voice",
        anchor: "audiovisual-voice",
      },
      {
        title: "Block continuity",
        anchor: "block-continuity",
      },
      {
        title: "Audience access",
        anchor: "audience-access",
      },
      {
        title: "Pacing and rhythm",
        anchor: "pacing-rhythm",
      },
      {
        title: "Audience orientation",
        anchor: "audience-orientation",
      },
      {
        title: "Dialogue and sound voice",
        anchor: "dialogue-sound-voice",
      },
      {
        title: "Emotional grounding",
        anchor: "emotional-grounding",
      },
      {
        title: "Audiovisual selection",
        anchor: "audiovisual-selection",
      },
      {
        title: "Timing allocation",
        anchor: "timing-allocation",
      },
      {
        title: "Master-scene and shooting boundary",
        anchor: "master-scene-shooting-boundary",
      },
      {
        title: "Scene semantic completion",
        anchor: "screenplay-scene-completion",
      },
      {
        title: "Locked revision identity",
        anchor: "screenplay-locked-revision",
      },
      {
        title: "Heading identity axes",
        anchor: "screenplay-heading-identity",
      },
    ],
  },
  {
    path: "principles/story/scripts.md",
    title: "Script principles",
    units: [
      {
        title: "Staging blocks",
        anchor: "staging-blocks",
      },
      {
        title: "Scene entry state",
        anchor: "scene-entry-state",
      },
      {
        title: "Scene exit state",
        anchor: "scene-exit-state",
      },
      {
        title: "Executable progression",
        anchor: "executable-progression",
      },
      {
        title: "Dialogue action",
        anchor: "dialogue-action",
      },
      {
        title: "Knowledge state",
        anchor: "knowledge-state",
      },
    ],
  },
  {
    path: "principles/story/treatments.md",
    title: "Treatment principles",
    units: [
      {
        title: "Treatment paragraphs",
        anchor: "treatment-paragraphs",
      },
      {
        title: "Narrative development",
        anchor: "causal-turn",
      },
      {
        title: "Audience change",
        anchor: "audience-change",
      },
      {
        title: "Information design",
        anchor: "information-design",
      },
    ],
  },
  {
    path: "upstream/delivery/briefs.md",
    title: "Brief upstream revision",
    units: [
      {
        title: "Parent revision from brief work",
        anchor: "parent-revision-from-brief-work",
      },
    ],
  },
  {
    path: "upstream/delivery/film-sources.md",
    title: "Film-source upstream revision",
    units: [
      {
        title: "Parent revision from film-source work",
        anchor: "parent-revision-from-film-source-work",
      },
    ],
  },
  {
    path: "upstream/delivery/production-sources.md",
    title: "Production-source upstream revision",
    units: [
      {
        title: "Settings revision from production-source work",
        anchor: "settings-revision-from-production-source-work",
      },
    ],
  },
  {
    path: "upstream/delivery/shots.md",
    title: "Shot-source upstream revision",
    units: [
      {
        title: "Parent revision from shot work",
        anchor: "parent-revision-from-shot-work",
      },
    ],
  },
  {
    path: "upstream/design/instances.md",
    title: "Instance upstream revision",
    units: [
      {
        title: "Parent revision from instance work",
        anchor: "parent-revision-from-instance-work",
      },
    ],
  },
  {
    path: "upstream/design/instance-sources.md",
    title: "Instance-source upstream revision",
    units: [
      {
        title: "Design revision from instance-source work",
        anchor: "design-revision-from-instance-source-work",
      },
    ],
  },
  {
    path: "upstream/design/maps.md",
    title: "Map upstream revision",
    units: [
      {
        title: "Settings revision from map work",
        anchor: "settings-revision-from-map-work",
      },
    ],
  },
  {
    path: "upstream/design/map-sources.md",
    title: "Map-source upstream revision",
    units: [
      {
        title: "Design revision from map-source work",
        anchor: "design-revision-from-map-source-work",
      },
    ],
  },
  {
    path: "upstream/design/materials.md",
    title: "Material upstream revision",
    units: [
      {
        title: "Parent revision from material work",
        anchor: "parent-revision-from-material-work",
      },
    ],
  },
  {
    path: "upstream/design/material-sources.md",
    title: "Material-source upstream revision",
    units: [
      {
        title: "Design revision from material-source work",
        anchor: "design-revision-from-material-source-work",
      },
    ],
  },
  {
    path: "upstream/design/models.md",
    title: "Model upstream revision",
    units: [
      {
        title: "Settings and space revision from model work",
        anchor: "settings-and-space-revision-from-model-work",
      },
    ],
  },
  {
    path: "upstream/design/model-sources.md",
    title: "Model-source upstream revision",
    units: [
      {
        title: "Design revision from model-source work",
        anchor: "design-revision-from-model-source-work",
      },
    ],
  },
  {
    path: "upstream/design/motions.md",
    title: "Motion upstream revision",
    units: [
      {
        title: "Parent revision from motion work",
        anchor: "parent-revision-from-motion-work",
      },
    ],
  },
  {
    path: "upstream/design/motion-sources.md",
    title: "Motion-source upstream revision",
    units: [
      {
        title: "Design revision from motion-source work",
        anchor: "design-revision-from-motion-source-work",
      },
    ],
  },
  {
    path: "upstream/design/spaces.md",
    title: "Space upstream revision",
    units: [
      {
        title: "Settings and map revision from space work",
        anchor: "settings-and-map-revision-from-space-work",
      },
    ],
  },
  {
    path: "upstream/design/space-sources.md",
    title: "Space-source upstream revision",
    units: [
      {
        title: "Design revision from space-source work",
        anchor: "design-revision-from-space-source-work",
      },
    ],
  },
  {
    path: "upstream/design/systems.md",
    title: "System upstream revision",
    units: [
      {
        title: "Parent revision from system work",
        anchor: "parent-revision-from-system-work",
      },
    ],
  },
  {
    path: "upstream/design/system-sources.md",
    title: "System-source upstream revision",
    units: [
      {
        title: "Design revision from system-source work",
        anchor: "design-revision-from-system-source-work",
      },
    ],
  },
  {
    path: "upstream/story/screenplays.md",
    title: "Screenplay upstream revision",
    units: [
      {
        title: "Script and canon revision from screenplay work",
        anchor: "script-and-canon-revision-from-screenplay-work",
      },
    ],
  },
  {
    path: "upstream/story/scripts.md",
    title: "Script upstream revision",
    units: [
      {
        title: "Treatment and settings revision from script work",
        anchor: "treatment-and-settings-revision-from-script-work",
      },
    ],
  },
  {
    path: "upstream/story/treatments.md",
    title: "Treatment upstream revision",
    units: [
      {
        title: "Settings revision from treatment work",
        anchor: "settings-revision-from-treatment-work",
      },
    ],
  },
] as const;

/**
 * Materializes one isolated project from typed contract inputs.
 *
 * The fixture deliberately owns its contract bytes. Tests exercise evidence
 * decisions without reading the repository scaffold or treating its current
 * file population as an oracle.
 */
export const createEvidenceProjectFixture = (roots: string[]): string => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "automovie-graph-"));
  roots.push(directory);
  for (const contract of CONTRACTS) {
    const file = path.join(directory, "docs", contract.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      [
        `# ${contract.title}`,
        "",
        `Synthetic scope for ${contract.path}.`,
        "",
        ...contract.units.flatMap((unit) => [
          `## ${unit.title} {#${unit.anchor}}`,
          "",
          ...structuredRuleLines(contract.path, unit.anchor),
          `Synthetic contract input for ${unit.anchor}.`,
          "",
          `Review question: does the host answer ${unit.anchor}?`,
          "",
          `Sources: synthetic package test input for ${unit.anchor}.`,
          "",
        ]),
      ].join("\n"),
      "utf8",
    );
  }
  for (const contract of [
    {
      path: "language/discovery/signals.md",
      title: "English discovery signals",
      units: [
        {
          title: "Work-specific English conditions",
          anchor: "english-work-specific-conditions",
        },
      ],
    },
    {
      path: "language/principles/common.md",
      title: "English principles",
      units: [
        { title: "Idiomatic relation", anchor: "english-idiomatic-relation" },
        { title: "Register ownership", anchor: "english-register-ownership" },
      ],
    },
    {
      path: "language/obligations/common.md",
      title: "English obligations",
      units: [
        {
          title: "Population register and frame account",
          anchor: "english-population-register-frame-account",
        },
        {
          title: "Audience language access",
          anchor: "english-audience-language-access",
        },
      ],
    },
  ] as const) {
    const file = path.join(directory, "docs", contract.path);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(
      file,
      [
        `# ${contract.title}`,
        "",
        ...contract.units.flatMap((unit) => [
          `## ${unit.title} {#${unit.anchor}}`,
          "",
          ...structuredRuleLines(contract.path, unit.anchor),
          `Synthetic language contract input for ${unit.anchor}.`,
          "",
        ]),
      ].join("\n"),
      "utf8",
    );
  }
  const localContracts = path.join(directory, "docs", "contracts");
  fs.mkdirSync(localContracts, { recursive: true });
  fs.writeFileSync(
    path.join(localContracts, "index.md"),
    "<!-- @evidenceExclude discovery/core/common.md#shared-local-boundary This synthetic project retains no production-specific rule. -->\n\n# Work-specific contract audit\n",
    "utf8",
  );
  return directory;
};

/** Emit metadata only for the scaffold routes whose application time is binding. */
const structuredRuleLines = (relative: string, anchor: string): string[] => {
  const sharedDefault =
    relative === "principles/core/defaults.md" ||
    (relative === "principles/story/narratives.md" &&
      anchor === "closing-line-contribution");
  const populationDefault = relative === "obligations/core/defaults.md";
  const languageRule = relative.startsWith("language/");
  if (!sharedDefault && !populationDefault && !languageRule) return [];
  const safeApplication = sharedDefault
    ? "composition-safe"
    : populationDefault
      ? anchor === "recurrent-frame-distribution"
        ? "post-draft-frequency"
        : "population-distribution"
      : relative.startsWith("language/discovery/")
        ? "observation-only"
        : relative.startsWith("language/obligations/")
          ? "population-distribution"
          : "composition-safe";
  const id = languageRule
    ? anchor
    : anchor === "contrastive-definition"
      ? "sh-material-contrast"
      : `sh-${anchor}`;
  return [
    "```contract-rule",
    JSON.stringify(
      {
        id,
        status: "active",
        safeApplication,
        timing: "synthetic contract routing boundary",
        sourceIdentity: "fixture@1",
      },
      null,
      2,
    ),
    "```",
    "",
  ];
};
