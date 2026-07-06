# `@automovie/viewer`

`@automovie/viewer`는 AutoMovie 산출물을 `three.js` 위에서 재생하는 런타임이다.

AI가 만든 `@automovie/interface` 모델, 포즈, 모션, 표정을 화면에 올리고, `@automovie/engine`이 계산한 FK와 보간 결과를 그대로 투영한다. 이 패키지는 editor가 아니다. 수작업 저작 UI는 playground가 담당하고, viewer는 재생과 스냅샷의 얇은 표면으로 남는다.

## 공개 표면

| 함수/클래스 | 역할 |
|---|---|
| `buildGeometry` / `buildMaterial` | AutoMovie geometry/material을 three 객체로 변환한다. |
| `buildModel(model)` | generated/imported `IAutoMovieModel`을 `THREE.Group`, bone map, mesh로 만든다. |
| `createImportedModelObject(options)` | 이미 로드된 VRM/glTF/three 객체를 viewer runtime 객체로 감싼다. |
| `applyPose(modelObject, pose, skeleton)` | 엔진 FK 결과를 bone quaternion과 root transform에 쓴다. |
| `applyExpression(modelObject, expression)` | VRM preset, ARKit channel, morph target influence를 갱신한다. |
| `AutoMoviePlayer` | 모션을 샘플링하고 pose, expression, imported-runtime flush를 같은 frame clock에서 수행한다. |
| `buildScene(scene, getModelObject)` | scene graph, camera, light를 three scene으로 만든다. |
| `mountViewer(canvas, scene, camera, onFrame)` | 브라우저 RAF와 `WebGLRenderer`를 붙인다. |
| `captureViewerSnapshot(renderer, scene, camera)` | headless-friendly renderer 표면으로 한 프레임을 data URL로 읽는다. |

## 에셋 경로

`buildModel`은 세 가지 모델 경로를 같은 규칙으로 처리한다.

- primitive part는 엔진 tessellation을 거쳐 일반 `THREE.Mesh`가 된다.
- mesh part에 `skin`이 있고 `attachedBone`이 `null`이면 `THREE.SkinnedMesh`가 되며 skeleton bones에 bind된다.
- `attachedBone`이 있으면 rigid attachment가 우선한다. skin payload가 있더라도 그 part는 해당 bone 아래에 통째로 붙는 prop으로 취급한다.

VRM/glTF loader는 viewer가 소유하지 않는다. host가 `GLTFLoader`, `@pixiv/three-vrm`, 앱별 asset resolver로 파일을 로드한 뒤, `createImportedModelObject`에 root object, normalized bone map, expression target을 넘긴다. playground의 `vrmAdapter.ts`가 그 예시다.

## 재생 규칙

`AutoMoviePlayer.update(seconds)`는 한 번의 호출에서 다음을 순서대로 수행한다.

1. `sampleMotion`으로 pose와 expression을 같은 시간에서 샘플링한다.
2. 선택된 ROM clamp와 spring follow-through를 pose에 반영한다.
3. `applyPose`로 bones/root를 갱신한다.
4. `applyExpression`으로 morph target 또는 VRM expression manager를 갱신한다.
5. `afterAutoMovieFrame` 훅이 있으면 `deltaSeconds`와 함께 호출한다.

이 순서를 유지해야 imported VRM runtime의 `vrm.update(dt)`와 AutoMovie pose/expression이 같은 frame clock에 묶인다.

## Playground 경계

`stickman.html`, `perform.html`, film/impact 계열 route는 motion-first viewer path다. 테스트와 캡처는 이 경로를 우선한다.

`human.html`, `body.html`, `face.html`은 에셋·신체·얼굴 실험 표면이다. viewer runtime의 계약을 검증하는 곳이 아니라, 다음 모델 제작 실험을 위한 playground로 둔다.
