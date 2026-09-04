# `@automovie/viewer`

## 필름 전환 합성

`resolveAutoMovieFilmBeautyComposition`은 컴파일러가 샘플링한 한두 개의 뷰티 레이어를 직접 렌더, 검정으로의 페이드, 디졸브로 구분한다. `renderFadeToBlackFrame`은 단일 레이어의 가중치를 전체 프레임에 적용하고 `disposeFadeToBlack`은 렌더러가 소유한 GPU 자원을 해제한다.

`mapImportedHumanoidBones` maps a loaded glTF/VRM scene onto a compiled
proxy skeleton before `createImportedModelObject` wraps it. Production hosts
therefore render and review the final registered mesh while engine validation
continues to use deterministic proxy geometry and measurement data.

`buildInstancedInstanceSet` and `regenerateInstanceSlot` render general crowd,
vegetation, prop, and debris chunks with seeded scale, palette, numeric traits,
frustum culling, and automatic LOD without scene-node expansion.

`buildSpaceObject`가 만드는 support patch는 depth, mask, normal, outline용 구조 가이드이며 beauty 색상이나 깊이를 쓰지 않는다. 최종 화면에 보일 바닥은 slab, terrain, platform 같은 물리 geometry로 별도 저작해야 한다.

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
| `bakeFormationCycle` / `formationCycleGait` / `formationCyclePosition` / `sampleFormationCycleMatrix` / `applyFormationCycleMaterial` | LOD tier의 런타임 모델이 gait를 선언하면 `formationCycleGait`가 직접 조합용 gait 계약을 정규화하고, 한 사이클을 rigid part 행렬 표로 한 번 굽는다. 각 멤버는 자기 `motionPhase`에서 그 표를 정점 단계에서 읽는다. 표는 tier당 하나라 멤버가 열 명이든 십만 명이든 인스턴스 버퍼는 그대로이고, 한 프레임이 갱신하는 것은 시간 uniform 하나뿐이다. gait가 없는 모델은 표를 갖지 않고 예전처럼 정지한 채 남는다. |
| `buildInstancedEffect` | 컴파일된 fog/smoke/dust 볼륨을 고정 스텝으로 샘플링해 인스턴스 파티클로 그리고, 파티클 상한과 LOD 거리 컬링을 강제한다. |
| `buildFluidSurfaceObject` / `buildFluidSprayObject` | 엔진이 푼 유체 상태의 자유수면과 분무를 그대로 올린다. 표면은 평범한 `Mesh`라 구조 가이드 패스가 모든 메시의 머티리얼을 바꾸는 것만으로 beauty/normal/depth/mask에 나타나고, bounding sphere도 엔진이 준 그려지는 범위를 쓴다. 분무는 `Points`라 같은 패스들이 의도적으로 숨긴다. 장식 안개가 segmentation mask를 물들이면 안 되기 때문이다. |
| `applySceneEnvironment` / `applyRendererEnvironment` | 씬이 선언한 이미지 조명·배경·노출·톤매핑·그림자 정책을 렌더러에 싣고, 구조 가이드 패스 동안 그 상태를 유예했다가 정확히 되돌린다. 환경을 선언한 씬이 자기 beauty 패스의 곡선과 노출을 소유하고, `IAutoMovieRenderSpec.toneMapping`은 환경을 선언하지 않은 씬에만 적용되는 배송 기본값이다. 그래서 환경을 말한 적 없는 기존 프로덕션의 바이트가 그대로 남는다. |
| `applyAutoMovieSemanticMask` / `IAutoMovieSemanticMaskHandle` | 엔진이 도출한 시맨틱 마스크를 씬에 입히고 되돌린다. 색은 노드 배열 순서가 아니라 안정적 semantic id에서 나오므로, 무관한 소품이 하나 늘어도 기존 색은 한 바이트도 바뀌지 않는다. 안개·이미지 조명·헬퍼는 이 패스 동안 유예된다. 장식이 정체성을 덮어쓰면 마스크가 말하려던 것이 사라지기 때문이다. |
| `observeAutoMovieSceneRender` | 실제 three scene을 순회해 현재 프레임의 관찰값을 만든다. 관찰은 설계나 예산 판정을 대체하지 않으며 render package의 audit 입력으로만 전달된다. |
| `buildSoftBodyObject` / `buildPlantingObject` | 엔진이 전진시킨 연성체 상태를 그대로 메시로 올리고, 실내 식재 군집을 인스턴스로 올린다. 상태와 시드는 엔진이 소유하므로 같은 입력은 같은 프레임을 낸다. |
| `buildAnalysisOverlayObject` / `autoMovieAnalysisRampColor` | 분석 결과를 씬 위에 얹는다. 램프 색은 정의된 구간에서만 의미가 있고 바깥은 고정되며, 빌린 머티리얼은 처분하지 않고 스스로 만든 것만 처분한다. |
| `mountViewer(canvas, scene, camera, onFrame)` | 브라우저 RAF와 `WebGLRenderer`를 붙인다. |
| `captureViewerSnapshot(renderer, scene, camera)` | headless-friendly renderer 표면으로 한 프레임을 data URL로 읽는다. |
| `applyAutoMovieSectionPlanes` | 선언된 절단을 **해석된 씬을 고치지 않고** 보기 상태로 실현한다. 절단면에 정확히 놓인 기하는 살아남는다 : 절개를 뜬 바닥은 자기 절단을 견딘다. `clipIntersection`을 기본값에 맡기지 않고 false로 쓰는데, 그래야 어느 한 평면이라도 지운 조각이 떨어지고 집합이 의도대로 교집합으로 작동한다. 합집합이 설정된 채 들어온 머티리얼은 두 번째 평면이 첫 번째가 자른 것을 되살릴 수 있기 때문이다. 빈 평면 목록은 절개를 해제하며, **한 번도 자르지 않은 씬과 자른 뒤 해제한 씬이 동일하게** 그려진다. 머티리얼 재컴파일은 평면 **개수**가 바뀔 때만 일어난다. three.js가 그 개수를 셰이더 프로그램에 굽고 값은 매 프레임 읽으므로, 절단면을 미끄러뜨리는 것은 공짜이고 뜨거나 놓는 것만 컴파일 한 번을 문다. |
| `autoMovieViewerSubjectKey` / `parseAutoMovieViewerSubjectKey` | 저작된 한 물건을 `<kind>:<id>`로 이름 붙이고 되읽는다. kind를 id 옆에 두는 것이 요점이다. 배치된 element와 그것이 배치하는 model이 같은 이름으로 저작됐을 때 두 문자열을 갈라놓는 것이 곧 prototype·placement 구분이다. 이 union에는 shot도 frame도 take도 없다. 주체는 자기가 무엇인지로 불리고, 자기를 담고 있는 배송된 그림으로 불리지 않는다. |
| `frameAutoMovieViewerSubject(bounds, viewpoint)` | 한 주체를 한 시점에서 잡는 눈을 놓는다. 거리는 그 주체 자신의 반대각선과 두 화각 중 좁은 쪽에서 나오므로 **0.05 m 문설주와 50 m 입면이 한 규칙으로 잡히고** 어느 쪽도 손으로 맞춘 카메라를 필요로 하지 않는다. 클립 평면도 같은 반지름에서 파생되어 far/near 비가 규모를 건너 일정하게 유지된다. 고정 near는 작은 부품을 잘라내거나 큰 것에 깊이 버퍼를 통째로 낭비하고, 후자는 먼 픽셀 하나를 두고 두 면이 다투는 것처럼 보여 모델링 결함으로 읽힌다. |
| `autoMovieViewerTurntableViewpoints` | 한 주체가 지는 고정 시점 집합을 낸다. 리뷰어가 고르는 것이 아니라 서비스가 정한다. |
| `autoMovieViewerPoseFromHeading` / `applyAutoMovieViewerSubjectPose` | 관찰용 포즈를 heading에서 만들고 적용한다. |
| `captureAutoMovieViewerSubjectView` | 그 시점 하나를 프레임으로 읽는다. 관찰이지 납품 증거가 아니다. |

## 에셋 경로

`buildModel`은 세 가지 모델 경로를 같은 규칙으로 처리한다.

- primitive part는 엔진 tessellation을 거쳐 일반 `THREE.Mesh`가 된다.
- mesh part에 `skin`이 있고 `attachedBone`이 `null`이면 `THREE.SkinnedMesh`가 되며 skeleton bones에 bind된다.
- `attachedBone`이 있으면 rigid attachment가 우선한다. skin payload가 있더라도 그 part는 해당 bone 아래에 통째로 붙는 prop으로 취급한다.

glTF loader는 viewer가 소유하지 않는다. host가 `GLTFLoader`와 앱별 asset resolver로 파일을 로드한 뒤, `createImportedModelObject`에 root object, normalized bone map, expression target을 넘긴다.

## 재생 규칙

`AutoMoviePlayer.update(seconds)`는 한 번의 호출에서 다음을 순서대로 수행한다.

1. `sampleMotion`으로 pose와 expression을 같은 시간에서 샘플링한다.
2. 선택된 ROM clamp와 spring follow-through를 pose에 반영한다.
3. `applyPose`로 bones/root를 갱신한다.
4. `applyExpression`으로 morph target 또는 VRM expression manager를 갱신한다.
5. `afterAutoMovieFrame` 훅이 있으면 `deltaSeconds`와 함께 호출한다.

이 순서를 유지해야 imported VRM runtime의 `vrm.update(dt)`와 AutoMovie pose/expression이 같은 frame clock에 묶인다.

## Playground 경계

`stickman.html`과 film/impact 계열 route는 motion-first viewer path다. 테스트와 캡처는 이 경로를 우선한다.

`body.html`, `face.html`은 신체·얼굴 실험 표면이다. viewer runtime의 계약을 검증하는 곳이 아니라, 다음 모델 제작 실험을 위한 playground로 둔다.
