import {
  AutoMovieDrawingRole,
  IAutoMovieDrawing,
  IAutoMovieDrawingPoint,
  IAutoMovieDrawingView,
} from "@automovie/interface";

/**
 * Page margin around a drawing's extent, in page millimetres.
 *
 * Fixed rather than authored: it is the border of the sheet, not a property of
 * the design, and making it a parameter would let two derivations of one
 * revision differ in a way nobody could see and every digest would notice.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Gives every derived SVG a fixed ten-millimetre page border independent of author input or model extent.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Expands the scaled drawing bounds by `10` page millimetres on each side when computing the canonical SVG viewport.
 */
export const AUTOMOVIE_DRAWING_SVG_MARGIN = 10;

/**
 * Serialize one derived drawing as a self-describing SVG sheet.
 *
 * The vector output is not a picture with the meaning thrown away. Every line
 * carries the element it came from, the layer it belongs to and its relation to
 * the cut plane; every region carries its logical space and cell; every note
 * carries whether it resolved; every gap the derivation declared is carried
 * through as a marker, so a sheet cannot look complete while its report says it
 * is not. The drawing a human reads and the sidecar a machine reads are the
 * same file, and a consumer never has to match geometry to learn what it is
 * looking at.
 *
 * The scale is honoured as drafting scale: one model metre becomes `1000 /
 * scale` millimetres on the page, so a 1:50 plan prints at 1:50 and a stroke
 * weight given in page millimetres means what it says at every scale.
 *
 * Output is byte-deterministic. Coordinates are rounded and then formatted to
 * fixed decimals, which is also what keeps a value a whisker either side of an
 * axis from printing a sign; every element is emitted in the order the drawing
 * already canonicalized, so one design yields one file.
 *
 * @evidence requirements/interior/deliverables-and-quantities.md#interior-drawing-views Serializes the derived sheet at its authored drafting scale while retaining source identities, line roles, annotations, regions, and unresolved gaps in the SVG itself.
 * @evidence specifications/interior-space/deliverables-and-validation.md#interior-space-drawing-schedule-quantity Validates pen values, converts model metres to page millimetres, emits canonical semantic SVG groups, and formats coordinates for byte-deterministic output.
 * @author Samchon
 */
export const autoMovieDrawingToSvg = (props: {
  /** Drawing to serialize. */
  drawing: IAutoMovieDrawing;
  /** View the drawing was derived from; supplies the pen. */
  view: IAutoMovieDrawingView;
}): string => {
  const { drawing, view } = props;
  if (view.id !== drawing.view)
    throw new Error(
      `drawing "${drawing.view}" cannot be drawn with the pen of view "${view.id}"`,
    );
  for (const role of ROLES) {
    const weight = view.style.weights[role];
    if (!Number.isFinite(weight) || weight <= 0)
      throw new Error(
        `drawing view "${view.id}" ${role} stroke weight must be a finite number > 0, but was ${weight}`,
      );
    for (const dash of view.style.dashes[role])
      if (!Number.isFinite(dash) || dash <= 0)
        throw new Error(
          `drawing view "${view.id}" ${role} dash pattern must hold only finite numbers > 0, but held ${dash}`,
        );
  }
  if (!Number.isFinite(view.style.textHeight) || view.style.textHeight <= 0)
    throw new Error(
      `drawing view "${view.id}" text height must be a finite number > 0, but was ${view.style.textHeight}`,
    );

  const perMetre = 1000 / drawing.scale;
  const extent = drawing.extent ?? { min: { x: 0, y: 0 }, max: { x: 0, y: 0 } };
  const width =
    (extent.max.x - extent.min.x) * perMetre + AUTOMOVIE_DRAWING_SVG_MARGIN * 2;
  const height =
    (extent.max.y - extent.min.y) * perMetre + AUTOMOVIE_DRAWING_SVG_MARGIN * 2;
  const at = (point: IAutoMovieDrawingPoint): { x: string; y: string } => ({
    x: number(
      (point.x - extent.min.x) * perMetre + AUTOMOVIE_DRAWING_SVG_MARGIN,
    ),
    // SVG y grows downward while the page up axis grows upward, so the sheet is
    // flipped once here rather than in every consumer that reads it back.
    y: number(
      (extent.max.y - point.y) * perMetre + AUTOMOVIE_DRAWING_SVG_MARGIN,
    ),
  });

  const body: string[] = [];
  for (const region of drawing.regions)
    body.push(
      tag("polygon", [
        ["class", "automovie-region"],
        ["data-space", region.space],
        ["data-cell", region.cell],
        ["data-kind", region.kind],
        ["data-finish", region.finish ?? ""],
        ["data-area", number(region.area)],
        [
          "points",
          region.polygon
            .map((point) => {
              const placed = at(point);
              return `${placed.x},${placed.y}`;
            })
            .join(" "),
        ],
        ["fill", "currentColor"],
        ["fill-opacity", "0.06"],
        ["stroke", "none"],
      ]),
    );
  for (const line of drawing.lines) {
    const from = at(line.from);
    const to = at(line.to);
    body.push(
      tag("line", [
        ["class", "automovie-line"],
        ["data-owner", line.owner],
        ["data-space", line.space ?? ""],
        ["data-layer", line.layer],
        ["data-role", line.role],
        ["x1", from.x],
        ["y1", from.y],
        ["x2", to.x],
        ["y2", to.y],
        ["stroke", "currentColor"],
        ["stroke-width", number(view.style.weights[line.role])],
        ...dashAttribute(view.style.dashes[line.role]),
      ]),
    );
  }
  for (const mark of drawing.openings) {
    const identity: Array<[string, string]> = [
      ["class", "automovie-opening"],
      ["data-opening", mark.opening],
      ["data-boundary", mark.boundary],
      ["data-kind", mark.kind],
      ["data-fill", mark.fill ?? ""],
      ["data-basis", mark.basis],
      ["data-width", mark.width === null ? "" : number(mark.width)],
      ["data-height", mark.height === null ? "" : number(mark.height)],
    ];
    // An opening with no void outline is still carried, as an empty marker: the
    // schedule counts it, so a sheet that dropped it would disagree with the
    // schedule about how many openings the building has.
    body.push(
      mark.polygon.length < 3
        ? tag("g", identity)
        : tag("polygon", [
            ...identity,
            [
              "points",
              mark.polygon
                .map((point) => {
                  const placed = at(point);
                  return `${placed.x},${placed.y}`;
                })
                .join(" "),
            ],
            ["fill", "none"],
            ["stroke", "currentColor"],
            ["stroke-width", number(view.style.weights.cut)],
          ]),
    );
  }
  for (const dimension of drawing.dimensions) {
    if (dimension.status === "stale") {
      body.push(
        tag("g", [
          ["class", "automovie-dimension"],
          ["data-id", dimension.id],
          ["data-status", "stale"],
          ["data-reason", dimension.reason ?? ""],
        ]),
      );
      continue;
    }
    const from = at(dimension.from!);
    const to = at(dimension.to!);
    body.push(
      tag("line", [
        ["class", "automovie-dimension"],
        ["data-id", dimension.id],
        ["data-status", "resolved"],
        ["data-measure", dimension.measure],
        ["data-value", number(dimension.value!)],
        ["x1", from.x],
        ["y1", from.y],
        ["x2", to.x],
        ["y2", to.y],
        ["stroke", "currentColor"],
        ["stroke-width", number(view.style.weights.projected)],
      ]),
    );
  }
  for (const annotation of drawing.annotations) {
    if (annotation.status === "stale") {
      body.push(
        tag("g", [
          ["class", "automovie-annotation"],
          ["data-id", annotation.id],
          ["data-status", "stale"],
          ["data-reason", annotation.reason ?? ""],
        ]),
      );
      continue;
    }
    const placed = at(annotation.at!);
    body.push(
      `  ${tag(
        "text",
        [
          ["class", "automovie-annotation"],
          ["data-id", annotation.id],
          ["data-status", "resolved"],
          ["x", placed.x],
          ["y", placed.y],
          ["font-size", number(view.style.textHeight)],
          ["fill", "currentColor"],
        ],
        false,
      )}${xml(annotation.text)}</text>`,
    );
  }
  for (const gap of drawing.gaps)
    body.push(
      tag("g", [
        ["class", "automovie-gap"],
        ["data-subject", gap.subject],
        ["data-status", gap.status],
        ["data-reason", gap.reason],
        ["data-remedy", gap.remedy],
      ]),
    );

  return [
    tag(
      "svg",
      [
        ["xmlns", "http://www.w3.org/2000/svg"],
        ["width", `${number(width)}mm`],
        ["height", `${number(height)}mm`],
        ["viewBox", `0 0 ${number(width)} ${number(height)}`],
        ["data-automovie-protocol", drawing.protocol],
        ["data-automovie-view", drawing.view],
        ["data-automovie-environment", drawing.environment],
        ["data-automovie-projection", drawing.projection],
        ["data-automovie-discipline", drawing.discipline],
        ["data-automovie-scale", number(drawing.scale)],
        ["data-automovie-digest", drawing.digest],
      ],
      false,
    ),
    ...body,
    "</svg>",
  ].join("\n");
};

const ROLES: AutoMovieDrawingRole[] = [
  "cut",
  "projected",
  "overhead",
  "hidden",
];

const tag = (
  name: string,
  attributes: ReadonlyArray<[string, string]>,
  selfClosing = true,
): string => {
  const written = attributes
    .map(([key, value]) => `${key}="${xml(value)}"`)
    .join(" ");
  return selfClosing ? `  <${name} ${written} />` : `<${name} ${written}>`;
};

const dashAttribute = (dashes: readonly number[]): Array<[string, string]> =>
  dashes.length === 0
    ? []
    : [["stroke-dasharray", dashes.map(number).join(",")]];

/**
 * Format one page millimetre value.
 *
 * Fixed decimals so two runs cannot differ in a trailing digit. Rounding first
 * is also what keeps a coordinate that lands on an axis from printing its sign:
 * a value a whisker below zero rounds to negative zero, which `toFixed` writes
 * as `0.000` rather than `-0.000`, so which side the geometry approached from
 * cannot change the bytes.
 */
const number = (value: number): string =>
  (Math.round(value * 1000) / 1000).toFixed(3);

const xml = (text: string): string =>
  text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
