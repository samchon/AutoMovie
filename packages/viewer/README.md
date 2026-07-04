# `@automovie/viewer`

automovie의 **재생·검수 표면**. `@automovie/interface`의 모델·포즈·모션·씬을 `three.js`로 렌더하고, `@automovie/engine`의 FK·보간으로 모션을 재생한다.

**viewer지 editor가 아니다.** AI가 structured output으로 만든 산출물을 보여주고·재생하고·스냅샷할 뿐, Blender식 수작업 저작 UI는 만들지 않는다. 모노리포에서 `three.js`를 직접 import하는 패키지는 이 viewer 하나뿐이다.

## 공개 표면

| 함수/클래스 | 역할 |
|---|---|
| `buildModel(model)` | `IAutoMovieModel` → `THREE.Group` + 본 맵 (프리미티브 테셀레이션·메쉬·스켈레톤·머티리얼) |
| `buildGeometry` / `buildMaterial` | 개별 형상·머티리얼 → three 객체 |
| `applyPose(modelObject, pose, skeleton)` | 엔진 FK로 본 쿼터니언 적용 |
| `buildScene(scene, getModelObject)` | `IAutoMovieScene` → `THREE.Scene` + 카메라·조명 |
| `AutoMoviePlayer` | 모션 클립을 시각 t에 샘플링(엔진)해 포즈 적용 — `update(seconds)` |
| `mountViewer(canvas, scene, camera, onFrame)` | `WebGLRenderer` + RAF 루프 (브라우저) |

## 사용 흐름

```ts
const modelObject = buildModel(character);       // THREE.Group + bones
const player = new AutoMoviePlayer(modelObject, character.skeleton!, waveClip);
const scene = new THREE.Scene();
scene.add(modelObject.object);
mountViewer(canvas, scene, camera, (t) => player.update(t));
```

## 현재 한계

- 스킨드 메쉬 변형(스킨 가중치 기반)은 후속 — 현재는 본에 파트를 부착(rigid)하거나 모델 루트에 둔다.
- 표정(blendshape) 적용은 모프 타깃이 있는 모델(VRM import)에서만 의미가 있어 현재 미적용 — 샘플된 표정은 노출만 한다.
- VRM/glTF 파일 import 렌더(`@pixiv/three-vrm`)는 ingest 단계와 함께 후속.
- headless 스냅샷은 후속.
