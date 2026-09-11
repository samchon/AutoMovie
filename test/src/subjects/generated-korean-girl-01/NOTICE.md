# Measurement provenance

The triangle connectivity in `controlNet.ts` is derived from Google's [MediaPipe canonical face model](https://github.com/google-ai-edge/mediapipe/blob/master/mediapipe/modules/face_geometry/data/canonical_face_model.obj), distributed under the [Apache License 2.0](LICENSE.mediapipe). No canonical vertex positions were copied into this subject.

Vertex positions were obtained by running [MediaPipe Face Landmarker](https://developers.google.com/edge/mediapipe/solutions/vision/face_landmarker/web_js) locally on the user-supplied photograph. The measurement used `@mediapipe/tasks-vision` 0.10.22-rc.20250304 and the downloaded face-landmarker model identified by the SHA-256 in `controlNet.ts`. The model and measurement runtime are not redistributed here and are not dependencies of the constructed AutoMovie model.

The positions were unrotated by the estimated camera rotation, normalized to a 134 mm cheek width, and placed in the face coordinate frame. This normalization supplies a working scale; it is not a measurement of the depicted person's real head size. Image-plane positions are observations, while depth and pose are monocular estimates. The source image, model and topology digests identify the basis for those derived values.
