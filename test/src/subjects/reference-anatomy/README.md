# Anatomical surface reference

This is a labelled, unfitted reference study for evaluating a continuous facial surface. It is not the completed reference portrait and does not use `@automovie/face` or `@automovie/human`. AutoMovie model types and the general engine-backed geometry helpers construct its resident meshes.

`mesh.json` contains the head and upper-neck portion of MakeHuman's `hm08` base mesh, lip-region membership, eye-joint anchors and four sparse target sets. The asset source is [MPFB2 at commit 437dd513888a92399d1d3200d2e80859fae55abc](https://github.com/makehumancommunity/mpfb2/tree/437dd513888a92399d1d3200d2e80859fae55abc). Its base-mesh header explicitly releases the asset under CC0, and the repository's asset license separately covers targets and mesh-information data. [LICENSE.CC0.md](LICENSE.CC0.md) retains that asset license. MPFB program logic has not been incorporated.

The retained OBJ body faces have all original vertices at source Y >= 6.2. Helpers and surfaces below that crop are excluded. Original face ordering owns the published lip UV-region membership. Provenance in the JSON records the pinned commit and SHA-256 of each consumed input. The child/young shape blend is an authored reference prior, not a calibrated age estimate or a measurement of the photographed subject.

`buildAnatomicalStudy` applies the same weighted targets to skin and eye-joint anchors, then normalizes their separation and midpoint in one head frame. Lip and skin regions retain one common normal field. Simple optical parts make the eye openings readable; detailed hair, brows, teeth and target-image fitting are not supplied by this study.

Regenerate the resident asset from the repository root with `./test/node_modules/.bin/tsx.cmd test/scripts/face-review/build-anatomical-basis.ts`. The generator requires the pinned `.references/mpfb2` checkout with `data/3dobjs`, `data/mesh_metadata`, `data/uv_layers` and the selected macro/expression targets present. Generated geometry retains the asset's provenance; it must never be presented as entirely original sculpting.
