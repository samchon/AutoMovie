import alanRickman from "./alan-rickman.json";
import danielRadcliffe from "./daniel-radcliffe.json";
import emmaWatson from "./emma-watson.json";
import generatedBlackBoy01 from "./generated-black-boy-01.json";
import generatedBlackGirl01 from "./generated-black-girl-01.json";
import generatedKoreanBoy01 from "./generated-korean-boy-01.json";
import generatedKoreanGirl01 from "./generated-korean-girl-01.json";
import generatedWhiteBoy01 from "./generated-white-boy-01.json";
import generatedWhiteGirl01 from "./generated-white-girl-01.json";
import jangSuHye from "./jang-su-hye.json";
import kimMinJung from "./kim-min-jung.json";
import leeTaeRi from "./lee-tae-ri.json";
import maggieSmith from "./maggie-smith.json";
import michaelGambon from "./michael-gambon.json";
import miriamMargolyes from "./miriam-margolyes.json";
import ohSeungYoon from "./oh-seung-yoon.json";
import parkEunBin from "./park-eun-bin.json";
import type { humanFaceStudyReview } from "./review";
import rupertGrint from "./rupert-grint.json";
import yooSeungHo from "./yoo-seung-ho.json";

/**
 * Selected numerical face documents used by the actual playground editor.
 * The package contains no named people; this study owns their input choices
 * and keeps the documents portable. The editor admits each document when read.
 * Source images, input quality and per-view observations remain separate.
 *
 * @evidence requirements/actors/facial-authoring/contract.md#actor-face-review Binds the editor's actual nineteen saved inputs to their separate source inventories, capture observations and unaccepted likeness verdicts.
 * @evidence specifications/asset-and-representation/facial-authoring/contract.md#face-spec-review Keeps the imported document identity attached to each artifact-specific review rather than treating successful construction as visual acceptance.
 *
 * @evidence src/subjects/human-face-documents/review.md#alan-rickman Supplies the alan-rickman replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#alan-rickman #c7dceac Read the oblique source, nine-view account and distinct browser/Node GLBs. Chin and asymmetric aperture edits survive, but front/reference and clay look markedly younger: wrinkles, tissue descent and perioral volume are not recovered. The one-normal-ULP difference is separate from this unaccepted age/identity result.
 * @evidence src/subjects/human-face-documents/review.md#daniel-radcliffe Supplies the daniel-radcliffe replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#daniel-radcliffe #1629862 Read the source's visible lower incisors and the independently authored mandibular row in the nine-view result. Only a thin lower enamel sliver is visible, while the dark gap, regular crowns and angular nasal/lid support remain. No obvious protrusion in these views is not an interarch collision certificate; likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#emma-watson Supplies the emma-watson replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#emma-watson #be69b22 Read the makeup/source limitations and nine output views. The closed mouth and thinner vermilion persist, but triangular inferior-orbit planes remain in both obliques and clay, establishing a shape defect rather than merely colour. Rear anatomy remains inferred and likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#generated-black-boy-01 Supplies the generated-black-boy-01 replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#generated-black-boy-01 #bc7db7c Read the source selection, artifact identities and all nine directly inspected views. Front/reference retain the broad smile, while obliques and clay show regular lower-lid shelves, uniform crowns and angular nasal transitions. The latest live editor also displayed this saved person after subject switching. Likeness remains unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#generated-black-girl-01 Supplies the generated-black-girl-01 replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#generated-black-girl-01 #657af47 Read the nine-view record and matched its final document/model identity to the current replay. The dark optical palette and smile remain, but lower-lid/lip bands and the tooth row are too uniform; profiles/back show inferred posterior lobes. Source hair is not reproduced and likeness remains unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#generated-korean-boy-01 Supplies the generated-korean-boy-01 replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#generated-korean-boy-01 #1b28b83 Read the selected original, nine capture identities and final observations. The smile is present but incisal form, brows and inferior-lid roll are regular. The refused smaller-opening proposal was withdrawn without weakening orientation admission. Replay passes and likeness remains unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#generated-korean-girl-01 Supplies the generated-korean-girl-01 replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#generated-korean-girl-01 #9b18d53 Read the frozen first-hour boundary and the separately identified hair-free human artifact. All nine listed images, neutral and performance diagnostics were directly inspected; synthetic lid, nasal, lip and crown form remains. Current replay retains model 9d0c26d8 and GLB 112cc109. No identity fitting was resumed and likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#generated-white-boy-01 Supplies the generated-white-boy-01 replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#generated-white-boy-01 #fb65797 Read the source-pigment correction and nine-view account. The narrow-eyed smile and upper row remain, but block-like crowns, strip brows and angular nasal base do not reproduce the original. Reduced lower-lid relief does not resolve generic smiling tissue; likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#generated-white-girl-01 Supplies the generated-white-girl-01 replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#generated-white-girl-01 #a5bbc38 Read the oblique original's observed/hidden-side distinction and all nine output views. Lateral gaze and smile remain, while the inferred opposite side, uniform enamel and simple lid rolls are not independently observed. Replay passes without accepting likeness or rear anatomy.
 * @evidence src/subjects/human-face-documents/review.md#jang-su-hye Supplies the jang-su-hye replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#jang-su-hye #3e30425 Read why the adult symposium portrait was selected over small childhood group frames. Its nine views retain closed lips without visible enamel, but nasal shape and orbital bands are simplified; hidden head/neck is inferred. The settings do not purport to reproduce other ages, and likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#kim-min-jung Supplies the kim-min-jung replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#kim-min-jung #4b85daf Read the closed-smile source and nine-view output record. Explicit lip closure removed the inappropriate dental strip, while heavy vermilion, pinched inner under-eye wedges and angular nasal base remain visible in obliques/clay. Event lighting does not supply measured albedo; likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#lee-tae-ri Supplies the lee-tae-ri replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#lee-tae-ri #b7819d8 Read the selected event portrait, actual chin-frame adjustment and all nine output identities. The closed smile survives, but eye shape, lip contour and cheek support are generalized; side/back anatomy is inferred. A successful chin control and deterministic replay do not accept likeness.
 * @evidence src/subjects/human-face-documents/review.md#maggie-smith Supplies the maggie-smith replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#maggie-smith #0abedfe Read the full-body source's small face and scarf-covered neck limitations. All nine outputs were inspected; the face looks substantially younger, with insufficient wrinkles, orbital bags and aged tissue. Uniform enamel and generic neck remain defects, and low source resolution does not make likeness accepted.
 * @evidence src/subjects/human-face-documents/review.md#michael-gambon Supplies the michael-gambon replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#michael-gambon #67e0d00 Read the monochrome provenance and nine-view record with separate one-ULP browser/Node GLBs. The wider jaw and narrowed eyes survive, but smooth young tissue and simplified orbital/nasolabial form remain. Skin and iris colours are explicitly unobserved authored values; likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#miriam-margolyes Supplies the miriam-margolyes replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#miriam-margolyes #6bcbd28 Read the primary target selection, nine output identities and open-smile observations. Lower teeth appear only as slivers; the large oral gap lacks the photographed tongue and inner form, and clay exposes angular orbit and insufficient aged tissue. The background person was not the target and likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#oh-seung-yoon Supplies the oh-seung-yoon replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#oh-seung-yoon #538b9a0 Read the small source's pixel/fringe limitations and nine directly inspected output views. The wide regular upper row, dark oral gap and heavy lid/lip bodies remain. The orientation-refused opening reduction was not committed; no guard was weakened and likeness is unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#park-eun-bin Supplies the park-eun-bin replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#park-eun-bin #25a4ccf Read the nine-view record and its separate browser and Node GLB digests. Closed lips hide enamel, but lid rolls and narrow nasal form remain simplified. The cross-runtime difference is one normal ULP, not a position or topology change; inferred rear anatomy and likeness remain unaccepted.
 * @evidence src/subjects/human-face-documents/review.md#rupert-grint Supplies the rupert-grint replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#rupert-grint #05fd653 Read the premiere original and nine-view result. The thin closed lip band remains, but regular lid shelves, simplified nasal base and weak individualized soft tissue differ; freckles are unsupported. Source pose and successful replay do not accept likeness.
 * @evidence src/subjects/human-face-documents/review.md#yoo-seung-ho Supplies the yoo-seung-ho replay document whose selected source, rendered artifact and nine inspected views are recorded here.
 * @evidenceReview src/subjects/human-face-documents/review.md#yoo-seung-ho #c49b506 Read the selected small image and nine-view output account. Slightly parted lips and upper enamel remain, while heavy lid/lip bodies and angular profile jaw differ from the original. Superior orbit and rear anatomy are not measured. Current replay preserves the artifact without accepting likeness.
 * @evidence {@link humanFaceStudyReview} Retains the shared construction-source inspection for these independent numerical face documents.
 */
export const humanFaceStudyDocuments: Readonly<Record<string, unknown>> = {
  "alan-rickman": alanRickman,
  "daniel-radcliffe": danielRadcliffe,
  "emma-watson": emmaWatson,
  "generated-black-boy-01": generatedBlackBoy01,
  "generated-black-girl-01": generatedBlackGirl01,
  "generated-korean-boy-01": generatedKoreanBoy01,
  "generated-korean-girl-01": generatedKoreanGirl01,
  "generated-white-boy-01": generatedWhiteBoy01,
  "generated-white-girl-01": generatedWhiteGirl01,
  "jang-su-hye": jangSuHye,
  "kim-min-jung": kimMinJung,
  "lee-tae-ri": leeTaeRi,
  "maggie-smith": maggieSmith,
  "michael-gambon": michaelGambon,
  "miriam-margolyes": miriamMargolyes,
  "oh-seung-yoon": ohSeungYoon,
  "park-eun-bin": parkEunBin,
  "rupert-grint": rupertGrint,
  "yoo-seung-ho": yooSeungHo,
};
