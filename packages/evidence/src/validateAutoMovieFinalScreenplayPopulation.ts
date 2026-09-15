import type { AutoMovieEvidenceStage } from "./createAutoMovieEvidenceConfig";
import { parseAutoMovieEvidenceSyntax } from "./parseAutoMovieEvidenceSyntax";

/**
 * Parsed construction identity and the body of one screenplay file.
 *
 * @author Samchon
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Represents the exact construction identity protected by final revision.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Supplies parsed file and unit facts independently of physical file access.
 */
export interface IAutoMovieScreenplayDocumentIdentity {
  /**
   * The sole parsed H1 title, without its Markdown heading marker.
   *
   * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Preserves the construction file identity.
   * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Supplies the title compared across passes.
   */
  title: string;
  /**
   * Authored bytes inspected for premature evidence annotations.
   *
   * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Keeps draft bodies free of evidence annotations.
   * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Supplies the body to the shared evidence syntax parser.
   */
  source: string;
  /**
   * Ordered, explicitly anchored units already validated by the Markdown parser.
   *
   * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Preserves unit identity and containment across final revision.
   * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Supplies the depth, anchor, lineage, and title compared at each ordered position.
   */
  units: readonly {
    anchor: string;
    depth: 2 | 3 | 4;
    lineage: string;
    title: string;
  }[];
}

/**
 * Protect the construction population while final audience language changes.
 *
 * Physical enumeration and Markdown parsing belong to the graph factory.
 * These comparisons decide population identity and draft annotation admission;
 * literal content and mechanical-clause fidelity still require author review.
 *
 * @evidence requirements/production-evidence/graph.md#agent-production-evidence-physical-integrity Refuses final residue, incomplete populations, and changed construction identities.
 * @evidence specifications/production-evidence/graph.md#spec-authoring-production-evidence-physical-integrity Checks final file, heading, nesting, order, group identity, and evidence-stage boundaries through supplied observations.
 */
export const validateAutoMovieFinalScreenplayPopulation = (props: {
  stage: AutoMovieEvidenceStage;
  residents: readonly string[];
  files: readonly string[];
  construction: ReadonlyMap<string, IAutoMovieScreenplayDocumentIdentity>;
  readFinal: (relative: string) => IAutoMovieScreenplayDocumentIdentity;
  readGroupTitles: (group: string) => {
    construction: string;
    final: string;
  };
}): void => {
  if (props.stage === "disabled") {
    if (props.residents.length !== 0)
      throw new Error(
        `screenplayNaturalness is disabled but governed hosts remain: ${props.residents.join(", ")}.`,
      );
    return;
  }
  if (props.files.length === 0)
    throw new Error(
      `screenplayNaturalness cannot enter ${props.stage} without a final screenplay host.`,
    );
  const expectedFiles = [...props.construction.keys()];
  if (
    props.files.length !== expectedFiles.length ||
    props.files.some((file, index) => file !== expectedFiles[index])
  )
    throw new Error(
      `final screenplay filenames must exactly preserve construction screenplays; received [${props.files.join(", ")}], expected [${expectedFiles.join(", ")}].`,
    );
  for (const relative of props.files) {
    const final = props.readFinal(relative);
    const construction = props.construction.get(relative)!;
    if (
      props.stage === "draft" &&
      parseAutoMovieEvidenceSyntax({
        path: `docs/final/screenplays/${relative}`,
        source: final.source,
      }).length !== 0
    )
      throw new Error(
        `docs/final/screenplays/${relative} is draft and must be completed before evidence tags are authored.`,
      );
    if (final.title !== construction.title)
      throw new Error(
        `final/screenplays/${relative} must exactly preserve the construction screenplay H1 title.`,
      );
    if (
      final.units.length !== construction.units.length ||
      final.units.some((unit, index) => {
        const expected = construction.units[index]!;
        return (
          unit.depth !== expected.depth ||
          unit.anchor !== expected.anchor ||
          unit.lineage !== expected.lineage ||
          unit.title !== expected.title
        );
      })
    )
      throw new Error(
        `final/screenplays/${relative} must exactly preserve construction screenplay headings, identity, nesting, and order.`,
      );
  }
  for (const group of new Set(props.files.map((file) => file.split("/")[0]!))) {
    const titles = props.readGroupTitles(group);
    if (titles.final !== titles.construction)
      throw new Error(
        `final/screenplays/${group}/index.md must exactly preserve the construction screenplay delivery-group H1 title.`,
      );
  }
};
