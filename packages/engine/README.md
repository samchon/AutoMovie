# `@automovie/engine`

## Interaction events

`performShot` emits `shot.events` for engine-visible interactions on the
shot-local clock. Launches record collision-solver `contact`, impact `hit`, and
unbalancing `fall` events while still injecting the same synthetic `react`
action for actor motion. `attachTo` records scripted `grab`/`attach` and
`detach`/`release` handoff events while keeping prop movement in `objectMotions`.

Use `sequenceEventTimeline(sequence, shots)` to map those shot-local events onto
the sequence output clock after trims and transitions.

## 현재 Tier 3 표면

- `validateGroundContact`: 설정한 발 본이 `y` 지면 평면 위에 있어야 하는 클립에서만 호출하는 물리 검증기. 모션을 샘플링하고 FK를 푼 뒤, `$input.samples[i].<bone>.worldPosition.y` 경로에 `physics` 위반을 만든다.
- `validateFootSkate`: 심어진 발 구간을 명시받아 수평 월드 속도를 검사하는 물리 검증기. 허용 속도를 넘으면 `$input.contacts[i].samples[j].<bone>.horizontalSpeed` 경로에 `physics` 위반을 만든다.
- `validateSelfIntersection`: 명시한 capsule proxy pair의 중심선 거리를 검사하는 물리 검증기. 반지름 합보다 가까우면 `$input.pairs[i].samples[j].distance` 경로에 `physics` 위반을 만든다.
- `validateBalanceSupport`: 명시한 support window에서 COM proxy 본의 XZ 투영이 support hull margin 안에 있는지 검사하는 물리 검증기. 벗어나면 `$input.supports[i].samples[j].centerOfMass.supportDistance` 경로에 `physics` 위반을 만든다.

현재 Tier 3 검증기는 자동 보정기가 아니라 hard rejection 신호다. 작은 수치 오차는 `tolerance`나 `margin`으로 모델링하고, root 이동·stance 변경·액션 변경은 호출자나 상위 하니스가 다시 작성한다.

## Imported humanoid retargeting

`retargetHumanoidMotion`은 stickman 등 정규화된 humanoid skeleton에 작성된 clip을 imported VRM/glTF humanoid skeleton으로 묶는다. joint angle은 clinical 값 그대로 보존하고, 결과 `characterization.target.jointAxes/restFrames`를 FK 또는 viewer playback에 넘겨 target rig-space로 변환한다.

Root motion은 기본적으로 `target rest height / source rest height`로 translation을 스케일한다. Facing은 v1에서 authored root rotation을 보존한다. Target ROM은 skeleton bone constraint가 있으면 그것을 우선하고, 없으면 `DEFAULT_HUMANOID_ROM`을 쓴다.

각도를 그대로 복사하는 것은 비례가 같은 리그에서만 정확하다. 비례가 다르면 **접촉 보존 패스**(`contacts`, 기본 켬)가 소스에서 지면 접촉을 검출해 같은 `rootScale`로 사상하고, 작성된 키프레임 시각 그대로 대상 사지를 다시 푼다. 손은 지면 기준이 없어 `contacts.hands`로 시간창을 선언한 경우에만 핀한다. IK 결과는 target ROM으로 clamp되며, clamp된 체인이 접촉에 못 닿으면 실패가 아니라 `physics` warning으로 남는다. `contacts.enabled === false`가 v1 동작이고, `characterization.contactPolicy`가 어느 쪽이 돌았는지 기록한다. 자세한 내용은 `.wiki/07-decisions/311-retarget-contact-preservation.md`.

이 API는 VRM/glTF animation export/import 자체가 아니라 그 전 단계의 retarget decision record다. Exporter나 viewer runtime은 반환된 motion, boneMap, jointAxes, restFrames를 사용해 concrete node animation으로 내리면 된다.

automovie의 **결정론적 엔진**. `@automovie/interface`의 AST를 받아 계산·검증한다. AI도 `three.js`도 없다. 순수 TypeScript.

이 패키지가 automovie의 "검증 가능하면 수렴한다" 사상을 실제로 구현하는 곳이다. 특히 **관절 가동범위(ROM) 검증**이 여기 산다: 물리적으로 불가능한 포즈를 결정론적으로 거부하고 `IAutoMovieConstraintViolation[]`을 만들어 하니스의 `// ❌` 피드백 재료를 제공한다.

## 소비 방식: 두 갈래

automovie를 구동하는 길은 둘이며, 둘 다 일급이다.

- **MCP 도구** ([`@automovie/mcp`](../mcp)): 에이전트가 stdio로 파이프라인을 구동한다. 슬레이트 상태·트랜잭션·교정 루프·크로스세션 영속성이 필요할 때. 얇은 동사를 기본 신시사이저가 살찌우고, `enact`로 **코드가 계산한 dense 클립**까지 주입할 수 있다.
- **직접 링크**: `@automovie/interface`(타입)와 이 패키지를 임포트해 타입에 직접 프로그래밍한다. 코드 네이티브 모션 저작, 커스텀 신시사이저, 호스트 통합에 쓴다.

모션 제작은 극한에서 **코딩 작업**이다(파라메트릭 곡선, 위상 합성, 샘플링 솔버). 그래서 코딩 에이전트에겐 타입 시스템 자체가 자연스러운 인터페이스일 수 있고, 이 패키지는 그 직접 경로를 정식으로 연다. 직접 소비자의 진입 seam:

- `performShot`: 주입식 `IAutoMovieActionSynthesizer`가 콘텐츠 seam이다. 어떤 동사든 **코드로 계산한 클립**을 반환하면 엔진이 영역 마스킹·레이어링·ROM 게이트를 그대로 적용한다("engine enforces, model creates").
- `validateMotion`/`validatePose`/`clampPose` + ROM: 결정론적 오라클. 무엇을 만들든 물리 진실은 엔진이 심판한다.
- `sampleMotion`/`sampleClip`: 재생 계약. 저작한 클립을 프레임으로 샘플링한다.

두 경로는 합쳐진다: 코드로 클립을 계산하고, 어느 문으로 들어왔든 **같은 엔진**이 강제한다. `enact`가 그 다리다. 러너블 스타터는 `npx autobe start <dir>`([`autobe`](../cli)) 참고.

## 모듈

| 모듈 | 책임 |
|---|---|
| `math/` | 벡터·쿼터니언 수학 (순수 함수, three.js 비의존) |
| `kinematics/` | 의미 각도(flexion/abduction/twist) → 본 로컬 쿼터니언(FK), 포즈 해석 |
| `rom/` | 휴머노이드 ROM 기본 테이블 + 관절별 ROM 검증 |
| `motion/` | 이징 함수, 키프레임 보간(시각 t의 포즈 샘플링) |
| `face/` | **Dormant boundary**: 결정 001 이후 보존만 하는 face/head flatten·morph 헬퍼. 검증과 테스트는 유지하지만 현재 본진은 모션/하니스다. |
| `geometry/` | 프리미티브 형상 → 삼각형 메쉬 테셀레이션 |
| `validation/` | 티어별 검증 오케스트레이터 → `IAutoMovieValidation` |

## 검증 티어 (현재 구현)

- **Tier 1 (range):** 값 범위. blendshape·머티리얼 계수 ∈ [0,1], 프리미티브 치수 > 0 등. (인터페이스가 러프 타입이라 엔진이 범위를 강제)
- **Tier 2 (rom):** 관절 가동범위. flexion/abduction/twist를 본별 해부학 한계와 대조. **automovie 차별점.**
- **Tier 4 (temporal):** 시간 일관성. 키프레임 시간 단조성·duration 이내·각속도 상한.
- Tier 3 (physics: 자기교차·접지·균형)와 Tier 5 (mesh 위상)는 후속.

검증기는 `IAutoMovieConstraintViolation[]`을 만들고, `IAutoMovieValidation`(success | violations)으로 묶는다. `@automovie/agent`가 이를 MicroAgentica 피드백 루프에 흘려 `// ❌`로 렌더한다.

## 좌표·각도 규약

`@automovie/interface` README의 규약을 따른다(y-up, 미터, 의미 각도). 본 로컬 회전 합성 규약은 `kinematics/jointToQuaternion.ts` JSDoc 참조.
