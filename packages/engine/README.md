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
`jump-cut` removes only `grammar-jump-cut`, and `axis-cross` only
`grammar-axis-crossed`. Use `grammarDiagnosticsToReviewNotes` to file results
through the existing visual review backlog. The edit-list layer supplies shot
order; human or VLM aesthetic judgment remains outside this mechanical
analyzer.

`readFilmGrammar` is the same pass with its suppression decision visible:
besides the surviving findings it returns the declarations that excepted
nothing, so a marker for a break the edit never makes can be reported rather
than read as a registered intent. `analyzeFilmGrammar` is its findings half.
The production compiler calls it over the assembled film timeline, so the edit
is actually read rather than merely readable.

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
produces a deterministic shot artifact without anything wrapped around it.

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
deliberately not an axis : a punctual light has no extent for it to mean
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

[`@automovie/production`](../production)은 이 엔진의 두 번째 저작 API가 아니다. generated project가 자기 스크립트로 돌리는 결정론적 실행 계층 : 컴파일러, 추적되는 프로젝트 저장소, 캡쳐, 검사, 렌더 잡 : 일 뿐이다. 러너블 스타터는 `npx create-automovie <dir>`로 만들고, generated project의 compile/lint/render/verify 명령이 같은 엔진을 호출한다.

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
| `fluid/` | 건축과 독립된 결정적 shallow-water 도메인: 고정 격자·고정 스텝 solver, 절대 스텝 seek, 질량 보존과 CFL 검증, 자유수면 지오메트리, 상한 있는 분무, 건물 수경 바인딩 |
| `space/`      | 공간: 지면·standable surface, affordance 접촉                                                                                                       |
| `text/`       | 결정적 문자열 비교(`compareCodeUnits`)                                                                                                              |
| `validation/` | 티어별 검증 오케스트레이터 → `IAutoMovieValidation`                                                                                                 |
| `sound/` | 완성 필름 타임라인의 결정론적 사운드 계획·렌더링, 음소-비짐 변환, 파형·스펙트로그램 증거 |
| `scene/` | 씬을 감싸는 대기: 안개 법칙과 그 밀도 해석 |
| `service/` | 건물이 공급받는 배분 그래프의 검증과 lowering: port 매체·방향·단위 정합, 노드와 그 port를 자기 논리 공간 안에 붙듦, 계통 부하를 root 반대쪽 끝에서 읽어 용량과 대조(급수는 유입 port, 배수는 유출 port), 구간 간섭(run 전체가 아니라 직선 leg마다), 관통 슬리브를 뚫린 벽면의 두께와 외곽 안에 붙듦, 젖은 구역과 방수 범위, 배수의 유체 source/drain 결합, 유지보수 부피 |
| `soft/` | 연성체와 실내 식재의 결정적 상태: 고정 스텝 전진, 시드 기반 배치, 충돌 |
| `drawing/` | 설계 하나에서 도면·주석·일람·물량을 파생한다. 파생 방향은 단방향이며 도면이 설계를 대체하지 않는다 |
| `analysis/` | 읽기 전용 대지 문맥 위의 환경 분석: 채광(직달·천공), 인공조명, 열관류와 표면온도, 이슬점과 결로 여유, 환기량과 정상상태 CO₂, Sabine 잔향과 수음점 음압, 합성 차음. 푼 것과 못 푼 것을 한 union으로 가르고 못 푼 값은 `null`로 남긴다 |
| `architecture/` | 코드 저작 건축의 검증과 lowering: 모든 요소·공간이 정확히 한 건물 단위에 속하는 총 소유권, 공간 질의(포함·인접·연결자·지지면·노드·소속 건물), 설계와 관찰을 분리해 유지하는 도면 근거, phase별 lifecycle snapshot과 대안 비교·변경 영향·content digest를 stable id 위에서 계산하는 설계 계보, 적층을 호스트 측정선 위에 놓아 전체 치수·개구부 reveal·접합 연속성을 내고 층 충돌과 마감 누락·중복을 가려내는 재료 구성, 저자가 모듈 법칙을 쓰고 엔진이 클리핑·개구부 회피·절단 분류·이웃 측정·시드 변주·수량과 손실을 맡는 결정적 표면 패턴 |
| `render/` | 렌더 예산 측정과 의미 증거: 장면 인벤토리, 초과 소유자와 되돌아가는 길을 함께 내는 예산 판정, 순서에 의존하지 않는 시맨틱 마스크, 방 가시성 힌트, 대상 지문 |

## 직접 조합하는 공개 callable

다음 callable은 테스트 편의를 위한 노출이 아니라, 라이브러리 소비자가 엔진의
결정론적 중간 단계와 검증기를 직접 조합할 수 있도록 유지하는 공개 표면이다.

| Callable | 직접 소비 목적 |
|---|---|
| `autoMovieDewPoint` | 환경 분석기가 쓰는 온도·습도 기반 이슬점 계산 |
| `builtBoundaryWallCut` | 건축 lowering 결과에서 경계벽 절단면 조회 |
| `builtConnectorGeometry` | 계단·램프·승강기 연결부의 생성 기하 조회 |
| `builtConnectorCarriagePlacements` | 연결부 안 운반체 배치의 결정론적 조회 |
| `builtConnectorSectionAt` | 연결부 진행률에 따른 단면 실측 |
| `builtEnvironmentSupportSweep` | 지지면과 건축 요소 사이의 간섭 sweep |
| `builtEnvironmentPlacementOverlapSweep` | 배치된 환경 요소 사이의 중첩 sweep |
| `designLineageDecisionComparisons` | 설계 lineage 두 상태의 결정 비교 |
| `designLineageDigest` | 설계 lineage의 안정적 content digest |
| `flattenHead` | 보존된 face 계약을 평탄화하는 호환 경계 |
| `morphFace` | 보존된 face morph 계약의 엔진 실행 경계 |
| `autoMovieSectionPlanesKeepPoint` | viewer와 같은 절단면 포함 판정의 headless 사용 |
| `forgeCast` | 등록 archetype으로 stand-in cast를 직접 생성 |
| `playbackFrameSamples` | 고정 FPS 재생 구간의 프레임 표본 생성 |
| `readSlateContext` | slate 메타데이터의 정규화된 문맥 조회 |
| `reviewShot` | shot review 입력을 결정론적으로 정규화 |
| `reviewVisualRead` | visual-read review 입력을 결정론적으로 정규화 |
| `scriptAncestors` | script graph에서 안정적인 조상 순회 |
| `locateOnBeat` | beat 내부 위치를 시간·공간 좌표로 해석 |
| `autoMovieStoryInterval` | story 범위를 정규화된 시간 구간으로 변환 |
| `fluidStateDigest` | 유체 상태의 재현 가능한 digest |
| `tessellateToMesh` | parametric geometry를 검증 가능한 mesh로 tessellate |
| `resolveAffordanceSeat` | 착석 affordance의 지지 자세 해석 |
| `pointSegmentDistance` | 공간 검증기가 공유하는 점-선분 거리 계산 |
| `motionToClip` | motion 계약을 재생 가능한 clip으로 변환 |
| `followPathMotion` | 경로 추종 motion을 결정론적으로 생성 |
| `resolveActorWorldFrame` | actor의 world-space frame 해석 |
| `resolveBoneTarget` | rig target을 bone-local 목표로 해석 |
| `mergePoses` | 복수 pose channel의 결정론적 합성 |
| `autoMovieRenderTargetAssets` | render target이 실제로 요구하는 asset 집합 조회 |
| `autoMovieRenderTargetSummary` | render target의 정규화된 요약 생성 |
| `autoMovieRoomVisibility` | room 단위 가시성 집합 계산 |
| `resolveAutoMovieSemanticMask` | semantic id를 안정적인 mask 값으로 해석 |
| `createSpringState` | spring simulation의 명시적 초기 상태 생성 |
| `restRelativeConstraint` | rest pose 상대 constraint 계산 |
| `serviceSegmentBounds` | 건물 service segment의 실측 bounds 계산 |
| `serviceEnvelopeObstructions` | service envelope의 장애물 검출 |
| `serviceNetworkSchematic` | service network의 안정적인 schematic 생성 |
| `serviceAnalysisSupport` | service 분석 결과의 지지 근거 계산 |
| `plantingStateDigest` | 식재 simulation 상태의 안정적 digest |
| `sampleSoftBody` | 연성체 상태를 지정 시간에서 표본화 |
| `softBodyStateDigest` | 연성체 상태의 안정적 digest |
| `affordanceSupportContacts` | affordance가 요구하는 지지 접점 계산 |
| `surfaceContains` | standable surface의 점 포함 판정 |
| `isWalkable` | surface의 보행 가능성 판정 |
| `supportContactsFor` | 배치물의 지지 접점 해석 |
| `validateExpressionResult` | expression 결과 계약 검증 |
| `detectFreeFall` | 지지 없는 동역학 상태 검출 |
| `validateMeshTopology` | mesh manifold·winding·boundary 검증 |
| `validatePoseResult` | pose 결과 계약 검증 |
| `detectSupportToppling` | 지지 다각형 밖 무게중심의 전도 검출 |

## 검증 티어 (현재 구현)

- **Tier 1 (range):** 값 범위. blendshape·머티리얼 계수 ∈ [0,1], 프리미티브 치수 > 0 등. (인터페이스가 러프 타입이라 엔진이 범위를 강제)
- **Tier 2 (rom):** 관절 가동범위. flexion/abduction/twist를 본별 해부학 한계와 대조. **automovie 차별점.**
- **Tier 3 (physics):** 자기교차·접지·균형·충돌 등 물리 plausibility를 warning으로 보고한다. malformed validator input은 error다.
- **Tier 4 (temporal):** 시간 일관성. 키프레임 시간 단조성·duration 이내·각속도 상한.
- **Tier 5 (topology):** non-manifold edge와 뒤집힌 winding 같은 mesh 구조 오류를 거부한다. 닫힌 solid가 필요한 호출자는 open boundary도 검사한다.

검증기는 `IAutoMovieConstraintViolation[]`을 만들고 `IAutoMovieValidation`으로 묶는다. 직접-link 호출자와 production compiler가 이 결과를 소비하며, lint와 compile 진단이 외부 에이전트의 일반적인 작성→실행→수정 루프로 되돌린다. error가 하나라도 있으면 실패하고 warning만 있으면 성공한다.

## 좌표·각도 규약

`@automovie/interface` README의 규약을 따른다(y-up, 미터, 의미 각도). 본 로컬 회전 합성 규약은 `kinematics/jointToQuaternion.ts` JSDoc 참조.
