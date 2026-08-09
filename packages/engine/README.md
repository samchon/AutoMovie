# `@automovie/engine`

## Deterministic film grammar

`analyzeFilmGrammar` consumes shots in edited order and reports axis crossings,
jump cuts, eyeline mismatches, screen-direction reversals, measured shot-size
mismatches, missing re-establishment, and pacing statistics. It sorts subjects
by stable id, uses opening/closing camera, subject, and resolved gaze-target
geometry plus durations, and returns each finding as fact, editorial impact,
and recovery. A neutral action-axis shot or a camera that visibly changes
half-plane inside a shot breaks an otherwise hidden crossing.

`IAutoMovieShotContract.styleIntent` records deliberate grammar exceptions.
Each marker suppresses exactly one matching diagnostic; for example,
`jump-cut` removes only `grammar-jump-cut`. Use
`grammarDiagnosticsToReviewNotes` to file results through the existing visual
review backlog. The edit-list layer supplies shot order; human or VLM aesthetic
judgment remains outside this mechanical analyzer.

## Seeded primitives and world kit

`seededValue` and `mixSeed` are the shared domain-separated PRNG primitives for
effects, formations, and general instances. The world kit constructs
terrain/ramp surfaces, visible wall/building box proxies, and grid/scatter/
route instance designs. `assertWorldPlacements` throws on overlapping or
floating blocks, blocked routes, and unreachable landmarks.

## Registered shot authoring

`defineShot(id, { scene, contract, build })` is the code-authoring boundary for
one registered shot. `compileDefinedShot` runs the authored
stage → block → perform pipeline directly in the engine, so a source module
does not need an MCP application wrapper to produce a deterministic shot
artifact.

The returned runtime contains the compiler-ready source artifact, opening/closing continuity, independently measured participant/state/event/camera outcomes, and D010 physics-advice decisions. The registered builder remains the source of the typed stage, blocking, and performance program; the host supplies current rig lookup and frame dimensions, and a builder cannot pass by echoing its own contract ids.

Physics advice is a discriminated decision record: it preserves the original proposal separately from an accepted or modified selected response, while rejection selects nothing. `realizeShotContract` is also owned here so compiler and direct-link consumers lower the same production contract through the same engine path.

## Interaction events

`performShot` emits `shot.events` for engine-visible interactions on the
shot-local clock. Launches record collision-solver `contact`, impact `hit`, and
unbalancing `fall` events while still injecting the same synthetic `react`
action for actor motion. `attachTo` records scripted `grab`/`attach` and
`detach`/`release` handoff events while keeping prop movement in `objectMotions`.

Use `sequenceEventTimeline(sequence, shots)` to map those shot-local events onto
the sequence output clock after trims and transitions.

## Light over time

`shot.lightMotions` states how a staged light changes across the shot's own
clock, and `resolveShotLighting({ lights, clips, seconds })` evaluates it: the
scene's lights carrying their values at that instant, with an untouched light
returned by identity. A light is not a scene node, so its tracks address a
pointer channel (`/lights/<light id>/<property>`) rather than a node channel,
by id and never by index.

`LIGHT_CHANNEL_PROPERTIES` is the single table both halves read.
`validateShotArtifact` admits a pointer only when the table has an entry whose
`carries` accepts the staged light's kind, and holds every keyframe to that
entry's `bounds` (the same range the scene gate enforces on the staged value)
and to its `valueFault`, the rule a whole keyframe value carries when the
components are not the whole story; the applier writes through the same entry.
Adding a property to `AutoMovieLightProperty` without giving it that pair does
not compile, so the admitted set and the applied set cannot drift.

A light's PLACEMENT is in that table too: `position` (`vec3`) and `rotation`
(`quaternion`) key a light's direction and location like any other value. glTF
gets a moving light by hanging it on a node and animating the node, but
automovie stages lights outside `nodes`, so without these a light's direction
would be fixed for the whole film. The kind split follows the physics: a
directional light is infinitely distant and carries no `position`, a point light
radiates every way and carries no `rotation`, a spot carries both. `scale` is
deliberately not an axis — a punctual light has no extent for it to mean
anything about. `rotation` is a `quaternion` rather than a `vec4` so the sampler
slerps it, and its keyframes are held to unit length, the same rule the scene
gate holds a staged transform to.

## Light over a production

`shot.lightMotions` runs on a shot's clock, which is seconds long. A production
whose length is part of its subject states its sources once, on the STORY clock,
through `IAutoMovieProductionLighting`, and every shot inherits their state at
its own story moment:

```ts
inheritProductionLighting({ lighting, lights: scene.lights, pin, seconds });
```

`pin` is the shot's existing `IAutoMovieShotStoryTime`, so no second clock is
introduced: `autoMovieStoryTime` maps the shot-local second onto the story
second, and `resolveProductionLighting` answers with the same
`resolveShotLighting` pass the per-shot axis uses. Two shots pinned an hour apart
in the story inherit an hour apart however the edit cuts them, and a shot with a
`rate` carries the source at its own pace.

It is purely additive. No production lighting, or a shot with no story pin,
returns the staged lights element by element unchanged. Otherwise the merge is by
id: a staged light the production names is replaced in place, one it does not
name comes back by identity, and a source no scene staged is appended after them.
Hand the result to the applier that plays `shot.lightMotions` and the shot's own
statement lands on top of the inherited one.

The transform clips are unchanged: `cameraMotion`, `objectMotions`, and a
coverage take still refuse every pointer channel, because `applyObjectMotion`
and `resolveFrame` still write node channels only.

## 현재 Tier 3 표면

- `validateGroundContact`: 설정한 발 본이 `y` 지면 평면 위에 있어야 하는 클립에서만 호출하는 물리 검증기. 모션을 샘플링하고 FK를 푼 뒤, `$input.samples[i].<bone>.worldPosition.y` 경로에 `physics` 위반을 만든다.
- `validateFootSkate`: 심어진 발 구간을 명시받아 수평 월드 속도를 검사하는 물리 검증기. 허용 속도를 넘으면 `$input.contacts[i].samples[j].<bone>.horizontalSpeed` 경로에 `physics` 위반을 만든다.
- `validateSelfIntersection`: 명시한 capsule proxy pair의 중심선 거리를 검사하는 물리 검증기. 반지름 합보다 가까우면 `$input.pairs[i].samples[j].distance` 경로에 `physics` 위반을 만든다.
- `validateBalanceSupport`: 명시한 support window에서 COM proxy 본의 XZ 투영이 support hull margin 안에 있는지 검사하는 물리 검증기. 벗어나면 `$input.supports[i].samples[j].centerOfMass.supportDistance` 경로에 `physics` 위반을 만든다.

Tier 3의 물리 결과는 자동 보정이나 차단이 아니라 **plausibility warning**이다. warning만 있는 검증은 성공하며, 호출자는 제안을 적용하거나 restage하거나 의도적인 비현실성을 `physicsIntent`로 명시한다. 잘못된 sample rate나 존재하지 않는 bone처럼 검증기 입력 자체가 깨진 경우만 error다.

## Imported humanoid retargeting

`retargetHumanoidMotion`은 stickman 등 정규화된 humanoid skeleton에 작성된 clip을 imported VRM/glTF humanoid skeleton으로 묶는다. joint angle은 clinical 값 그대로 보존하고, 결과 `characterization.target.jointAxes/restFrames`를 FK 또는 viewer playback에 넘겨 target rig-space로 변환한다.

Root motion은 기본적으로 `target rest height / source rest height`로 translation을 스케일한다. Facing은 v1에서 authored root rotation을 보존한다. Target ROM은 skeleton bone constraint가 있으면 그것을 우선하고, 없으면 `DEFAULT_HUMANOID_ROM`을 쓴다.

각도를 그대로 복사하는 것은 비례가 같은 리그에서만 정확하다. 비례가 다르면 **접촉 보존 패스**(`contacts`, 기본 켬)가 소스에서 지면 접촉을 검출해 같은 `rootScale`로 사상하고, 작성된 키프레임 시각 그대로 대상 사지를 다시 푼다. 손은 지면 기준이 없어 `contacts.hands`로 시간창을 선언한 경우에만 핀한다. IK 결과는 target ROM으로 clamp되며, clamp된 체인이 접촉에 못 닿으면 실패가 아니라 `physics` warning으로 남는다. `contacts.enabled === false`가 v1 동작이고, `characterization.contactPolicy`가 어느 쪽이 돌았는지 기록한다.

이 API는 VRM/glTF animation export/import 자체가 아니라 그 전 단계의 retarget decision record다. Exporter나 viewer runtime은 반환된 motion, boneMap, jointAxes, restFrames를 사용해 concrete node animation으로 내리면 된다.

automovie의 **결정론적 엔진**. `@automovie/interface`의 AST를 받아 계산·검증한다. AI도 `three.js`도 없다. 순수 TypeScript.

이 패키지가 automovie의 "검증 가능하면 수렴한다" 사상을 실제로 구현하는 곳이다. 특히 **관절 가동범위(ROM) 검증**이 여기 산다: 물리적으로 불가능한 포즈를 결정론적으로 거부하고 `IAutoMovieConstraintViolation[]`을 만들어 하니스의 `// ❌` 피드백 재료를 제공한다.

## 코드 저작과 제품 경계

모션 제작은 극한에서 **코딩 작업**이다. 파라메트릭 곡선, 위상 합성, 샘플링 솔버를 코딩 에이전트가 tracked TypeScript로 작성하고, `@automovie/interface`의 타입과 이 패키지의 순수 함수를 직접 사용한다.

직접 소비자의 진입 seam:

- `performShot`: 주입식 `IAutoMovieActionSynthesizer`가 콘텐츠 seam이다. 어떤 동사든 **코드로 계산한 클립**을 반환하면 엔진이 영역 마스킹·레이어링·ROM 게이트를 그대로 적용한다("engine enforces, model creates").
- `validateMotion`/`validatePose`/`clampPose` + ROM: 결정론적 오라클. 무엇을 만들든 물리 진실은 엔진이 심판한다.
- `sampleMotion`/`sampleClip`: 재생 계약. 저작한 클립을 프레임으로 샘플링한다.

[`@automovie/mcp`](../mcp)는 이 엔진의 두 번째 저작 API가 아니다. 정확히 다섯 개의 가이드·호스트 증거·리뷰 도구만 제공하며 design setter, compiler, renderer, geometry query를 노출하지 않는다. 러너블 스타터는 `npx create-automovie <dir>`로 만들고, generated project의 compile/lint/render/verify 명령이 같은 엔진을 호출한다.

## 모듈

| 모듈          | 책임                                                                                                                                                |
| ------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `math/`       | 벡터·쿼터니언 수학 (순수 함수, three.js 비의존)                                                                                                     |
| `kinematics/` | 의미 각도(flexion/abduction/twist) → 본 로컬 쿼터니언(FK), 포즈 해석                                                                                |
| `rom/`        | 휴머노이드 ROM 기본 테이블 + 관절별 ROM 검증                                                                                                        |
| `motion/`     | 이징 함수, 키프레임 보간(시각 t의 포즈 샘플링)                                                                                                      |
| `face/`       | **Dormant boundary**: 결정 001 이후 보존만 하는 face/head flatten·morph 헬퍼. 검증과 테스트는 유지하지만 현재 본진은 모션/하니스다.                 |
| `geometry/`   | 프리미티브 형상 → 삼각형 메쉬 테셀레이션                                                                                                            |
| `perform/`    | 액션 콜 → 배우별 퍼포먼스 클립: 리전 마스크(`bodyRegionBones`, `actionRegion`), 레이어링·블렌딩, 기본 신서사이저, 위치 타겟 해석                    |
| `film/`       | 필름 파이프라인 stage/block/perform/cut: 씬 스테이징, 비트 블로킹, 샷 수행, 카메라 무브·프로젝션, 부착·발사 컴파일, 비트 엔드 상태, 시퀀스 컷, 리뷰 |
| `resolve/`    | 시각 t의 해석: 클립 샘플링, 드라이버·드리븐 커브, IK, 스프링, 채널 한계, 씬 합성, 조명 해석, 스켈레톤 노드화                                        |
| `physics/`    | 탄도·투사체, 충돌과 반응, 임팩트·반동, 질량 특성                                                                                                    |
| `space/`      | 공간: 지면·standable surface, affordance 접촉                                                                                                       |
| `text/`       | 결정적 문자열 비교(`compareCodeUnits`)                                                                                                              |
| `validation/` | 티어별 검증 오케스트레이터 → `IAutoMovieValidation`                                                                                                 |
| `sound/` | 완성 필름 타임라인의 결정론적 사운드 계획·렌더링, 음소-비짐 변환, 파형·스펙트로그램 증거 |

## 검증 티어 (현재 구현)

- **Tier 1 (range):** 값 범위. blendshape·머티리얼 계수 ∈ [0,1], 프리미티브 치수 > 0 등. (인터페이스가 러프 타입이라 엔진이 범위를 강제)
- **Tier 2 (rom):** 관절 가동범위. flexion/abduction/twist를 본별 해부학 한계와 대조. **automovie 차별점.**
- **Tier 3 (physics):** 자기교차·접지·균형·충돌 등 물리 plausibility를 warning으로 보고한다. malformed validator input은 error다.
- **Tier 4 (temporal):** 시간 일관성. 키프레임 시간 단조성·duration 이내·각속도 상한.
- **Tier 5 (topology):** non-manifold edge와 뒤집힌 winding 같은 mesh 구조 오류를 거부한다. 닫힌 solid가 필요한 호출자는 open boundary도 검사한다.

검증기는 `IAutoMovieConstraintViolation[]`을 만들고 `IAutoMovieValidation`으로 묶는다. 직접-link 호출자와 production compiler가 이 결과를 소비하며, lint와 compile 진단이 외부 에이전트의 일반적인 작성→실행→수정 루프로 되돌린다. error가 하나라도 있으면 실패하고 warning만 있으면 성공한다.

## 좌표·각도 규약

`@automovie/interface` README의 규약을 따른다(y-up, 미터, 의미 각도). 본 로컬 회전 합성 규약은 `kinematics/jointToQuaternion.ts` JSDoc 참조.
