import { AutoMovieMcpFrameCapture } from "./dto";

/**
 * Runtime context shared by the {@link AutoMovieApplication} facade and its
 * services — the deterministic infrastructure the tools run on, never LLM
 * orchestration.
 *
 * Today it carries only the host-injected frame-capture adapter (#608). It is
 * deliberately a thin shell: the AutoMovie project-folder memory (#614 — the
 * project directory itself, JSON AST plus 3D assets, is the resident state,
 * unlike AutoBe's hidden `.autobe` JSON mirror) and the prerequisite graph
 * (#615) will live here when they land, which is why services receive a context
 * object rather than loose fields.
 */
export class AutoMovieContext {
  public constructor(
    /**
     * Frame-capture adapter owned by the host (a Playwright page, a render
     * worker), or `undefined` when the host has none — `seeFrame` then reports
     * `no-capture-adapter` honestly instead of pretending.
     */
    public readonly capture?: AutoMovieMcpFrameCapture,
  ) {}
}
