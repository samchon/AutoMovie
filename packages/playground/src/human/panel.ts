import {
  type IAutoMovieHumanFaceDocument,
  type IPortraitHairLayer,
  createHumanFaceEditor,
  createPortraitMaterials,
  humanFaceControlDefinitions,
  humanFaceDetailChannels,
  humanFaceExpressionDefinitions,
  humanFaceRegionValue,
  humanFaceRegions,
  parseHumanFaceDocument,
  replaceHumanFaceRegion,
  resolveHumanFaceDocument,
  resolveHumanFaceExpression,
  serializeHumanFaceDocument,
  setHumanFaceDetail,
  setHumanFaceHairLayerDetail,
} from "@automovie/human";
import type { JSONDocument } from "@gltf-transform/core";

type PreviewAsset = {
  glb: Uint8Array<ArrayBuffer>;
  gltf: JSONDocument;
  parts: number;
};

/**
 * Mount the face editor controls around a caller-owned numerical preview.
 * The viewport owns GPU allocation; this panel owns document selection, input,
 * transactions, last-valid downloads and the visible error state. A failed or
 * stale load cannot replace the current model. Callers may await ready before
 * interacting and read snapshots without taking ownership of the preview.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor Binds subject, region, scalar, side, expression, camera, clay and file controls to the displayed face.
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-editor-state Routes edits and history through validated transactions while guarding stale subject loads.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor-view Keeps display-only controls outside the saved identity and exports the committed document/model pair.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-editor Isolates asynchronous file reads and subject builds before committing their document and model together.
 * @evidenceExclude requirements/actors/facial-authoring/README.md#face-requirements The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement detailed facial authoring across document, editor and study review.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-document The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement the standalone human-face recipe, basis and version interpreter.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-anatomical-components The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement named craniofacial components, cavities and attached tissues.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-skin-condition The panel exposes shared numerical controls but delegates persistent and expression-driven tissue fields to the human builder; it does not model skin morphology.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-skin-colour The browser adapter submits numerical documents to the human builder; it does not evaluate pigmentation fields or assemble corresponding skin cages.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-controls-replacement The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement anatomical detail overrides and side-specific part replacement.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-expression The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement observed-relative eyelid, oral, dental and gaze performance.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-export The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement validated anatomical face GLTF/GLB serialization.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-provenance The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement non-executable selected-portrait facts in the face document.
 * @evidenceExclude requirements/actors/facial-authoring/contract.md#actor-face-review The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement per-person source inventories, direct render inspection and likeness decisions.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/README.md#face-specifications The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement the complete face construction, application and review boundary.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-document The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement human-face version admission and photo-independent basis interpretation.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-components The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement cranial, cervical, ocular, nasal, oral and auricular surface assembly.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-skin-condition The panel delegates skin field synthesis and conforming local tessellation to the human builder; it does not implement either numerical operation.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-skin-colour The browser adapter submits numerical documents to the human builder; it does not evaluate pigmentation fields or assemble corresponding skin cages.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-controls The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement ordered face defaults, trait offsets, array replacement and asymmetric detail.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-attachments The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement face-part cut ownership and final-surface attachment correspondence.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-expression The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement the neutral/observed/current face solve and fixed optical identity.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-export The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement face-specific Float32, optical-material and GLTF serialization admission.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-provenance The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement nullable portrait provenance that does not execute during face replay.
 * @evidenceExclude specifications/asset-and-representation/facial-authoring/contract.md#face-spec-review The panel delegates model construction and serialization to its preview adapter and records no study verdict; it does not implement input/output review receipts, required portrait views and subjective acceptance.
 */
export function mountHumanFacePanel<Model extends PreviewAsset>(
  app: HTMLElement,
  props: {
    /** Available independent documents and their lazy text readers. */
    subjects: readonly { id: string; read: () => Promise<string> }[];
    /** A resident subject to load after wiring the controls. */
    initialSubjectId: string;
    /** The host owns canvas rendering, resource disposal and off-thread construction. */
    viewport: (canvas: HTMLCanvasElement) => {
      build: (document: IAutoMovieHumanFaceDocument) => Promise<Model>;
      cancel: () => void;
      publish: (model: Model) => void;
      dispose: (model: Model) => void;
      fitView: () => void;
      cameraView: (degrees: number) => void;
      setClay: (enabled: boolean) => void;
    };
    /** The browser host owns actual file publication; the panel selects committed bytes. */
    download: (filename: string, bytes: BlobPart, mime: string) => void;
  },
) {
  const document = app.ownerDocument;
  const { subjects, download } = props;
  const initial = subjects.find(
    (subject) => subject.id === props.initialSubjectId,
  );
  if (initial === undefined)
    throw new Error("The initial face must name an available subject.");
  type Region = (typeof humanFaceRegions)[number];
  type Side = "right" | "left";
  app.innerHTML = `
<style>
*{box-sizing:border-box}body{margin:0;background:#161c23;color:#e4eaf0;font:13px/1.4 system-ui,sans-serif}
#human-editor{display:grid;grid-template-columns:minmax(320px,1fr) 420px;height:100vh}#viewport{position:relative;min-width:0}#face-canvas{width:100%;height:100%;display:block}
#face-panel{overflow:auto;padding:18px;background:#10161d;border-left:1px solid #303a46}h1{font-size:19px;margin:0 0 6px}h2{font-size:14px;margin:22px 0 8px}p{color:#a9b7c8;margin:6px 0}
button,input,select,textarea{font:inherit;color:inherit;background:#202b37;border:1px solid #405063;border-radius:4px}button{cursor:pointer;padding:5px 8px}button:disabled{opacity:.4;cursor:default}
select{padding:6px;width:100%}.toolbar{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.number-row{margin:12px 0}.number-row label{display:block}.number-row .entry{display:flex;gap:10px;align-items:center}.number-row input[type=range]{flex:1;min-width:0}.number-row input[type=number]{width:84px;padding:3px}.number-row small{color:#93a5ba}
textarea{width:100%;height:250px;padding:8px;font:11px/1.4 ui-monospace,monospace;resize:vertical}#face-status{white-space:pre-wrap;padding:10px;background:#1c2834;border-radius:5px;color:#cce3ed}#face-status[data-state=error]{background:#422127;color:#ffd2d2}
#view-tools{position:absolute;top:12px;left:12px;right:12px;display:flex;flex-wrap:wrap;gap:5px}#view-note{position:absolute;bottom:15px;left:15px;padding:6px 10px;background:#10161dba;border-radius:5px;pointer-events:none}.inline{display:flex;gap:8px;align-items:center}.inline select{flex:1}.hint{font-size:11px;color:#97a8bb;white-space:pre-wrap}
@media(max-width:780px){#human-editor{grid-template-columns:1fr;height:auto}#viewport{height:60vh}#face-panel{height:auto;overflow:visible}}
</style>
<main id="human-editor"><section id="viewport"><canvas id="face-canvas"></canvas><div id="view-tools">
<button data-view="0">Front</button><button data-view="45">Left ¾</button><button data-view="-45">Right ¾</button><button data-view="90">Left</button><button data-view="-90">Right</button><button data-view="180">Back</button><button id="fit-view">Fit</button><label><input id="clay" type="checkbox"> Clay</label>
</div><div id="view-note">Drag to orbit · wheel to zoom · static expression pose</div></section>
<aside id="face-panel"><h1>Human · face editor</h1><p>Procedural anatomy · numerical replay · no runtime photograph</p><div id="face-status" role="status">Choose a face document.</div>
<h2>Subject</h2><select id="face-subject" aria-label="Subject"></select><p class="hint" id="source-note"></p>
<div class="toolbar"><button id="face-undo">Undo</button><button id="face-redo">Redo</button><button id="face-reset">Reset subject</button></div>
<div class="toolbar"><button id="face-save">Save document</button><button id="face-load">Load document</button><button id="face-glb">Export GLB</button><button id="face-gltf">Export glTF + buffers</button><input id="face-file" type="file" accept=".json,application/json" hidden></div>
<h2>Region</h2><div class="inline"><select id="face-region" aria-label="Region"></select><select id="face-side" aria-label="Side"><option value="">Common</option><option value="right">Right</option><option value="left">Left</option></select></div>
<select id="face-hair-layer" aria-label="Hair layer" hidden></select>
<h2>Intermediate controls</h2><p class="hint">Offsets from the basis. Exact detailed overrides take precedence.</p><div id="intermediate-controls"></div>
<h2>Detailed anatomy</h2><p class="hint">Values below are the applied profile. ↶ removes only that detailed override.</p><div id="detail-controls"></div>
<details><summary>Complete region profile / replacement</summary><p class="hint">Arrays replace their entire population. This edits the selected region only; unknown fields and invalid combinations refuse.</p><textarea id="region-json" aria-label="Complete region profile"></textarea><div class="toolbar"><button id="region-apply">Replace region</button><button id="region-inherit">Inherit region</button></div></details>
<h2>Expression</h2><div class="toolbar"><button data-expression="neutral">Neutral</button><button data-expression="observed">Observed</button><button data-expression="smile">Smile</button><button data-expression="wink">Wink</button><button data-expression="open">Open jaw</button></div><div id="expression-controls"></div>
<h2>Appearance</h2><div id="appearance-controls"></div><p class="hint">Linear RGB, surface roughness and clearcoat strength. Hair appearance follows the finish named by the applied groom. These change shading, not geometry. Geometry, document validity and visual likeness are separate judgments. Select the hair region for surface-card geometry; the eye region owns brows and lids.</p>
</aside></main>`;

  const element = <T extends HTMLElement>(id: string): T =>
    app.querySelector<T>("#" + id)!;
  const viewport = props.viewport(element<HTMLCanvasElement>("face-canvas"));
  const { build, publish, dispose, fitView, cameraView } = viewport;
  let editor: ReturnType<typeof createHumanFaceEditor<Model>> | undefined;
  let draft: IAutoMovieHumanFaceDocument | undefined;
  let subjectRevision = 0;
  let selectedRegion: Region = "eye";
  let selectedSide: Side | undefined;
  let selectedHairLayer: string | undefined;
  const setStatus = (message: string, state = "ready"): void => {
    const target = element("face-status");
    target.textContent = message;
    target.dataset.state = state;
    if (state === "ready" || state === "error")
      element<HTMLSelectElement>("face-subject").value =
        editor?.snapshot().document.id ?? "";
  };
  const withdraw = (): number => {
    const revision = ++subjectRevision;
    editor?.cancel();
    draft = editor?.snapshot().document;
    viewport.cancel();
    return revision;
  };
  const refuse = (error: unknown): void => {
    withdraw();
    setStatus(error instanceof Error ? error.message : String(error), "error");
  };
  for (const button of app.querySelectorAll<HTMLButtonElement>("[data-view]"))
    button.onclick = () => cameraView(Number(button.dataset.view));
  element("fit-view").onclick = fitView;
  element<HTMLInputElement>("clay").onchange = () =>
    viewport.setClay(element<HTMLInputElement>("clay").checked);
  const numberRow = (
    container: HTMLElement,
    props: {
      id: string;
      label: string;
      value: number;
      minimum: number;
      maximum: number;
      step: number;
      hint: string;
      change: (value: number) => Promise<void>;
      inherit?: () => Promise<void>;
    },
  ): void => {
    const row = document.createElement("div");
    row.className = "number-row";
    const label = document.createElement("label");
    label.htmlFor = props.id;
    label.textContent = props.label;
    label.title = props.hint;
    const entry = document.createElement("div");
    entry.className = "entry";
    const slider = document.createElement("input");
    slider.type = "range";
    slider.min = String(props.minimum);
    slider.max = String(props.maximum);
    slider.step = String(props.step);
    slider.value = String(props.value);
    slider.id = props.id + "-slider";
    slider.setAttribute("aria-label", props.label + " slider");
    const number = document.createElement("input");
    number.type = "number";
    number.min = slider.min;
    number.max = slider.max;
    number.step = "any";
    number.value = String(Number(props.value.toFixed(6)));
    number.id = props.id;
    slider.oninput = () => {
      number.value = slider.value;
    };
    slider.onchange = () => props.change(Number(slider.value));
    number.onchange = () => {
      if (number.value.trim() === "") {
        refuse("A numeric value is required.");
        return;
      }
      return props.change(Number(number.value));
    };
    entry.append(slider, number);
    if (props.inherit) {
      const reset = document.createElement("button");
      reset.textContent = "↶";
      reset.title = "Remove this override";
      reset.onclick = props.inherit;
      entry.append(reset);
    }
    const hint = document.createElement("small");
    hint.textContent = props.hint;
    row.append(label, entry, hint);
    container.append(row);
  };
  const change = async (next: IAutoMovieHumanFaceDocument): Promise<void> => {
    const revision = ++subjectRevision;
    // Only controls rendered from a committed document can supply a candidate.
    const owner = editor!;
    draft = structuredClone(next);
    const pending = owner.edit(next);
    setStatus(
      "Building and validating the latest numerical document…",
      "building",
    );
    await pending;
    if (editor !== owner || revision !== subjectRevision) return;
    const state = owner.snapshot();
    draft = state.document;
    if (state.status === "ready") publish(state.model);
    refresh();
  };
  const attempt = async (
    action: () => IAutoMovieHumanFaceDocument,
  ): Promise<void> => {
    try {
      await change(action());
    } catch (error) {
      refuse(error);
    }
  };
  const refresh = (): void => {
    if (editor === undefined) return;
    const state = editor.snapshot(),
      face = state.document;
    setStatus(
      state.error ??
        `${face.name}\n${state.model.parts} anatomical parts · valid document / model / glTF\nLikeness: not accepted by construction.`,
      state.status,
    );
    element<HTMLButtonElement>("face-undo").disabled = !state.canUndo;
    element<HTMLButtonElement>("face-redo").disabled = !state.canRedo;
    element("source-note").textContent =
      face.reference?.decision ??
      "No source provenance supplied. This does not prevent numerical replay.";
    const side = element<HTMLSelectElement>("face-side");
    side.disabled = !["eye", "ear", "cheek"].includes(selectedRegion);
    if (side.disabled) {
      selectedSide = undefined;
      side.value = "";
    }
    const intermediate = element("intermediate-controls"),
      details = element("detail-controls"),
      expressions = element("expression-controls"),
      appearance = element("appearance-controls");
    intermediate.replaceChildren();
    details.replaceChildren();
    expressions.replaceChildren();
    appearance.replaceChildren();
    const regions: Record<string, string> = {
      frame: "frame",
      eye: "eyes",
      ear: "ears",
      cheek: "cheeks",
      nose: "nose",
      mouth: "mouth",
      cranium: "cranium",
      neck: "neck",
    };
    // Resolve once for this view. Each row reads the published metadata path on
    // that same final profile, rather than reinterpreting the whole basis per row.
    const regionProfile = humanFaceRegionValue(
      face,
      selectedRegion,
      selectedSide,
    );
    const layerSelect = element<HTMLSelectElement>("face-hair-layer");
    layerSelect.hidden = selectedRegion !== "hairLayers";
    layerSelect.replaceChildren();
    const hairLayers =
      selectedRegion === "hairLayers"
        ? ((regionProfile as readonly IPortraitHairLayer[] | undefined) ?? [])
        : [];
    for (const layer of hairLayers) {
      const option = document.createElement("option");
      option.value = layer.id;
      option.textContent = layer.id;
      layerSelect.append(option);
    }
    const activeLayer =
      hairLayers.find((layer) => layer.id === selectedHairLayer) ??
      hairLayers[0];
    selectedHairLayer = activeLayer?.id;
    layerSelect.value = selectedHairLayer ?? "";
    layerSelect.disabled = hairLayers.length === 0;
    const detailProfile =
      selectedRegion === "hairLayers" ? activeLayer?.profile : regionProfile;
    for (const definition of humanFaceControlDefinitions.filter(
      (item) => item.region === regions[selectedRegion],
    ))
      numberRow(intermediate, {
        ...definition,
        id: `trait-${definition.id}`,
        value: face.controls?.[definition.id] ?? 0,
        label: definition.label,
        hint: `${definition.unit}; neutral 0. ${definition.effect}`,
        change: (value) =>
          attempt(() => ({
            ...draft!,
            controls: { ...draft!.controls, [definition.id]: value },
          })),
      });
    for (const definition of humanFaceDetailChannels.filter(
      (item) =>
        item.region ===
        (selectedRegion === "hairLayers" ? "hair" : selectedRegion),
    )) {
      let field: unknown = detailProfile;
      for (const key of definition.path)
        field = (field as Record<string, unknown> | undefined)?.[key];
      if (field === undefined) continue;
      const value = field as number;
      numberRow(details, {
        ...definition,
        id: `detail-${definition.id.replaceAll(".", "-")}`,
        label: activeLayer
          ? `${activeLayer.id}: ${definition.meaning}`
          : definition.meaning,
        value,
        hint: `${definition.unit}. ${definition.effect}`,
        change: (value) =>
          attempt(() =>
            activeLayer
              ? setHumanFaceHairLayerDetail(
                  draft!,
                  activeLayer.id,
                  definition.id,
                  value,
                )
              : setHumanFaceDetail(draft!, definition.id, value, selectedSide),
          ),
        inherit: activeLayer
          ? undefined
          : () =>
              attempt(() =>
                setHumanFaceDetail(
                  draft!,
                  definition.id,
                  undefined,
                  selectedSide,
                ),
              ),
      });
    }
    element<HTMLTextAreaElement>("region-json").value = JSON.stringify(
      regionProfile ?? null,
      null,
      2,
    );
    const expression = resolveHumanFaceExpression(face.expression);
    for (const definition of humanFaceExpressionDefinitions) {
      const sides = definition.paired
        ? (["right", "left"] as const)
        : [undefined];
      for (const owner of sides) {
        const value = expression[definition.id];
        numberRow(expressions, {
          ...definition,
          id: `expression-${definition.id}-${owner ?? "common"}`,
          label: `${definition.label}${owner ? ` · ${owner}` : ""}`,
          value: typeof value === "number" ? value : value[owner as Side],
          hint: `${definition.unit}; neutral 0.`,
          change: (value) =>
            attempt(() => {
              const current = resolveHumanFaceExpression(draft!.expression);
              return {
                ...draft!,
                expression: {
                  ...current,
                  [definition.id]:
                    owner === undefined
                      ? value
                      : {
                          ...(current[definition.id] as Record<Side, number>),
                          [owner]: value,
                        },
                },
              };
            }),
        });
      }
    }
    const hairRecipe = resolveHumanFaceDocument(face).recipe;
    const hairMaterials = new Set([
      hairRecipe.hair?.material,
      ...(hairRecipe.hairLayers ?? []).map((layer) => layer.profile.material),
    ]);
    for (const material of face.appearance ?? createPortraitMaterials()) {
      if (
        !["skin", "lips", "brows", "teeth"].includes(material.id) &&
        !hairMaterials.has(material.id)
      )
        continue;
      for (const component of ["r", "g", "b"] as const)
        numberRow(appearance, {
          id: `material-${material.id}-${component}`,
          label: `${material.id} · ${component.toUpperCase()}`,
          value: material.baseColor[component],
          minimum: 0,
          maximum: 1,
          step: 0.005,
          hint: "Linear RGB reflectance",
          change: (value) =>
            attempt(() => ({
              ...draft!,
              appearance: (draft!.appearance ?? createPortraitMaterials()).map(
                (item) =>
                  item.id === material.id
                    ? {
                        ...item,
                        baseColor: {
                          ...item.baseColor,
                          [component]: value,
                          hex: null,
                        },
                      }
                    : item,
              ),
            })),
        });
      for (const [property, label] of [
        ["roughness", "Surface roughness"],
        ["clearcoat", "Clearcoat strength"],
      ] as const)
        numberRow(appearance, {
          id: `material-${material.id}-${property}`,
          label: `${material.id}: ${label}`,
          value: material[property] ?? 0,
          minimum: 0,
          maximum: 1,
          step: 0.01,
          hint: "Unit interval; changes surface response without changing shape.",
          change: (value) =>
            attempt(() => ({
              ...draft!,
              appearance: (draft!.appearance ?? createPortraitMaterials()).map(
                (item) =>
                  item.id === material.id
                    ? { ...item, [property]: value }
                    : item,
              ),
            })),
        });
    }
  };
  const choose = async (
    document: IAutoMovieHumanFaceDocument,
    revision: number,
  ): Promise<void> => {
    setStatus(`Building ${document.name}…`, "building");
    try {
      const model = await build(document);
      if (revision !== subjectRevision) {
        dispose(model);
        return;
      }
      editor = createHumanFaceEditor({ document, model, build });
      draft = structuredClone(document);
      publish(model);
      refresh();
      fitView();
    } catch (error) {
      if (revision === subjectRevision)
        setStatus(
          error instanceof Error ? error.message : String(error),
          "error",
        );
    }
  };
  const loadDocument = async (read: () => Promise<string>): Promise<void> => {
    const revision = withdraw();
    setStatus("Reading the selected face document…", "building");
    try {
      const text = await read();
      if (revision === subjectRevision)
        await choose(parseHumanFaceDocument(text), revision);
    } catch (error) {
      if (revision === subjectRevision)
        setStatus(
          error instanceof Error ? error.message : String(error),
          "error",
        );
    }
  };
  const subjectSelect = element<HTMLSelectElement>("face-subject");
  for (const subject of subjects) {
    const option = document.createElement("option");
    option.value = subject.id;
    option.textContent = subject.id.replaceAll("-", " ");
    subjectSelect.append(option);
  }
  subjectSelect.value = props.initialSubjectId;
  subjectSelect.onchange = () => {
    const subject = subjects.find((item) => item.id === subjectSelect.value);
    if (subject) return loadDocument(subject.read);
  };
  const regionSelect = element<HTMLSelectElement>("face-region");
  for (const region of humanFaceRegions) {
    const option = document.createElement("option");
    option.value = region;
    option.textContent = region;
    regionSelect.append(option);
  }
  regionSelect.value = selectedRegion;
  regionSelect.onchange = () => {
    selectedRegion = regionSelect.value as Region;
    refresh();
  };
  element<HTMLSelectElement>("face-side").onchange = (event) => {
    selectedSide =
      ((event.currentTarget as HTMLSelectElement).value as Side) || undefined;
    refresh();
  };
  element<HTMLSelectElement>("face-hair-layer").onchange = (event) => {
    selectedHairLayer = (event.currentTarget as HTMLSelectElement).value;
    refresh();
  };
  for (const action of ["undo", "redo", "reset"] as const)
    element(`face-${action}`).onclick = async () => {
      if (!editor) return;
      const revision = ++subjectRevision;
      const owner = editor;
      const pending = owner[action]();
      setStatus(`Rebuilding ${action}…`, "building");
      await pending;
      if (owner !== editor || revision !== subjectRevision) return;
      const state = owner.snapshot();
      draft = state.document;
      publish(state.model);
      refresh();
    };
  element("region-inherit").onclick = () =>
    attempt(() =>
      replaceHumanFaceRegion({
        document: draft!,
        basisId: draft!.basis.id,
        region: selectedRegion,
        side: selectedSide,
        value: undefined,
      }),
    );
  element("region-apply").onclick = () =>
    attempt(() => {
      const value = JSON.parse(
        element<HTMLTextAreaElement>("region-json").value,
      );
      const candidate = structuredClone(draft!);
      if (selectedSide !== undefined) {
        const sides = (candidate.asymmetry ??= {});
        Object.assign((sides[selectedSide] ??= {}), {
          [selectedRegion]: value,
        });
      } else
        Object.assign((candidate.detail ??= {}), { [selectedRegion]: value });
      const parsed = parseHumanFaceDocument(JSON.stringify(candidate));
      return replaceHumanFaceRegion({
        document: draft!,
        basisId: draft!.basis.id,
        region: selectedRegion,
        side: selectedSide,
        value:
          selectedSide === undefined
            ? parsed.detail?.[selectedRegion]
            : parsed.asymmetry?.[selectedSide]?.[
                selectedRegion as "eye" | "ear" | "cheek"
              ],
      });
    });
  for (const button of app.querySelectorAll<HTMLButtonElement>(
    "[data-expression]",
  ))
    button.onclick = () =>
      attempt(() => {
        const presets = {
          neutral: {},
          observed: draft!.basis.expression,
          smile: { smile: { right: 4, left: 4 }, lipPart: 7 },
          wink: { blink: { right: 1, left: 0 }, smile: { right: 2, left: 1 } },
          open: { jawOpen: 8, lipPart: 2 },
        };
        return {
          ...draft!,
          expression:
            presets[button.dataset.expression as keyof typeof presets],
        };
      });
  element("face-save").onclick = () => {
    if (editor) {
      const state = editor.snapshot();
      download(
        `${state.document.id}.face.json`,
        serializeHumanFaceDocument(state.document),
        "application/json",
      );
    }
  };
  element("face-glb").onclick = () => {
    if (editor) {
      const state = editor.snapshot();
      download(
        `${state.document.id}.glb`,
        state.model.glb,
        "model/gltf-binary",
      );
    }
  };
  element("face-gltf").onclick = () => {
    if (editor) {
      const state = editor.snapshot();
      for (const [uri, bytes] of Object.entries(state.model.gltf.resources))
        download(uri, bytes, "application/octet-stream");
      download(
        `${state.document.id}.gltf`,
        JSON.stringify(state.model.gltf.json, null, 2),
        "model/gltf+json",
      );
    }
  };
  element("face-load").onclick = () =>
    element<HTMLInputElement>("face-file").click();
  element<HTMLInputElement>("face-file").onchange = async (event) => {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    await loadDocument(() => file.text());
    input.value = "";
  };

  return {
    ready: loadDocument(initial.read),
    snapshot: () => editor?.snapshot(),
  };
}
