# `@automovie/viewer`

`mapImportedHumanoidBones` maps a loaded glTF/VRM scene onto a compiled
proxy skeleton before `createImportedModelObject` wraps it. Production hosts
therefore render and review the final registered mesh while engine validation
continues to use deterministic proxy geometry and measurement data.

`buildInstancedInstanceSet` and `regenerateInstanceSlot` render general crowd,
vegetation, prop, and debris chunks with seeded scale, palette, numeric traits,
frustum culling, and automatic LOD without scene-node expansion.

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
| `buildScene(scene, getModelObject)` | scene graph, camera, light, 그리고 `scene.space`가 있으면 그 지면까지 three scene으로 만든다. |
| `buildSpaceObject(space)` | space의 standable surface마다 실제 `Mesh` 하나를 만들어 `__automovie_space` 그룹에 담는다. footprint의 convex hull을 팬 삼각분할하고 각 꼭짓점을 `surfaceHeightAt`으로 들어올리므로 ramp는 자기 평면이 그대로 나온다. 구조 가이드 패스는 지오메트리를 `traverse ∩ isMesh`로 모으니, 이 메시가 곧 depth/mask/normal/outline에 들어가는 지면이다(#1173). |
| `applyObjectMotion` / `applyObjectMotions` | 사물 노드의 transform 모션을 샘플링해 three 객체에 쓴다. |
| `applyLightState` / `applyLightMotion` | 조명의 시간 변화(색·세기·방향 등)를 three light에 반영한다. |
| `renderCrossDissolve` / `disposeCrossDissolve` | 두 샷을 겹쳐 그리는 크로스 디졸브 패스를 만들고 자원을 되돌린다. |
| `applyCaptureCanvasSize` | 캡처용 캔버스 크기를 렌더러·카메라와 함께 맞춘다. |
| `applyRenderMode` / `maskColor` / `IAutoMovieRenderModeHandle` | depth/mask/normal/outline 구조 가이드 패스로 씬을 전환하고 되돌린다. 교체되는 머티리얼에는 그 메시가 지닌 formation 사이클이 그대로 실리므로, 행군하는 군중은 리뷰 프레임에서도 beauty와 같은 자세로 움직인다. |
| `buildInstancedFormation` / `regenerateFormationSlot` | 컴파일된 formation 청크를 LOD tier별 `InstancedMesh`로 올리고, 카메라 갱신마다 청크 컬링·LOD 히스테리시스를 적용한다. hero 슬롯은 인스턴스 버퍼에서 빠지고 host가 넘긴 pre-formation 소스 스냅샷 위에 formation 모션을 합성한다. `slotMotions`로 지목된 소수의 멤버만 매 프레임 자기 상태로 다시 써서, 한 명이 이탈·정지하거나 아예 그려지지 않게 한다. 비용은 예외 수에 비례하며 군중 크기와 무관하고, 사라진 멤버는 `stats.removed`로 따로 센다(`near + far + culled + removed = anonymousCount`). |
| `bakeFormationCycle` / `formationCyclePosition` / `sampleFormationCycleMatrix` / `applyFormationCycleMaterial` | LOD tier의 런타임 모델이 gait를 선언하면 한 사이클을 rigid part 행렬 표로 한 번 굽고, 각 멤버가 자기 `motionPhase`에서 그 표를 정점 단계에서 읽게 한다. 표는 tier당 하나라 멤버가 열 명이든 십만 명이든 인스턴스 버퍼는 그대로이고, 한 프레임이 갱신하는 것은 시간 uniform 하나뿐이다. gait가 없는 모델은 표를 갖지 않고 예전처럼 정지한 채 남는다. |
| `buildInstancedEffect` | 컴파일된 fog/smoke/dust 볼륨을 고정 스텝으로 샘플링해 인스턴스 파티클로 그리고, 파티클 상한과 LOD 거리 컬링을 강제한다. |
| `buildFluidSurfaceObject` / `buildFluidSprayObject` | 엔진이 푼 유체 상태의 자유수면과 분무를 그대로 올린다. 표면은 평범한 `Mesh`라 구조 가이드 패스가 모든 메시의 머티리얼을 바꾸는 것만으로 beauty/normal/depth/mask에 나타나고, bounding sphere도 엔진이 준 그려지는 범위를 쓴다. 분무는 `Points`라 같은 패스들이 의도적으로 숨긴다. 장식 안개가 segmentation mask를 물들이면 안 되기 때문이다. |
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
