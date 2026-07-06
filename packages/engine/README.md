# `@automovie/engine`

## 현재 Tier 3 표면

- `validateGroundContact`: 설정한 발 본이 `y` 지면 평면 위에 있어야 하는 클립에서만 호출하는 물리 검증기. 모션을 샘플링하고 FK를 푼 뒤, `$input.samples[i].<bone>.worldPosition.y` 경로에 `physics` 위반을 만든다.
- `validateFootSkate`: 심어진 발 구간을 명시받아 수평 월드 속도를 검사하는 물리 검증기. 허용 속도를 넘으면 `$input.contacts[i].samples[j].<bone>.horizontalSpeed` 경로에 `physics` 위반을 만든다.

automovie의 **결정론적 엔진**. `@automovie/interface`의 AST를 받아 계산·검증한다. AI도 `three.js`도 없다 — 순수 TypeScript.

이 패키지가 automovie의 "검증 가능하면 수렴한다" 사상을 실제로 구현하는 곳이다. 특히 **관절 가동범위(ROM) 검증**이 여기 산다 — 물리적으로 불가능한 포즈를 결정론적으로 거부하고 `IAutoMovieConstraintViolation[]`을 만들어 하니스의 `// ❌` 피드백 재료를 제공한다.

## 모듈

| 모듈 | 책임 |
|---|---|
| `math/` | 벡터·쿼터니언 수학 (순수 함수, three.js 비의존) |
| `kinematics/` | 의미 각도(flexion/abduction/twist) → 본 로컬 쿼터니언(FK), 포즈 해석 |
| `rom/` | 휴머노이드 ROM 기본 테이블 + 관절별 ROM 검증 |
| `motion/` | 이징 함수, 키프레임 보간(시각 t의 포즈 샘플링) |
| `face/` | **Dormant boundary** — 결정 001 이후 보존만 하는 face/head flatten·morph 헬퍼. 검증과 테스트는 유지하지만 현재 본진은 모션/하니스다. |
| `geometry/` | 프리미티브 형상 → 삼각형 메쉬 테셀레이션 |
| `validation/` | 티어별 검증 오케스트레이터 → `IAutoMovieValidation` |

## 검증 티어 (현재 구현)

- **Tier 1 (range):** 값 범위 — blendshape·머티리얼 계수 ∈ [0,1], 프리미티브 치수 > 0 등. (인터페이스가 러프 타입이라 엔진이 범위를 강제)
- **Tier 2 (rom):** 관절 가동범위 — flexion/abduction/twist를 본별 해부학 한계와 대조. **automovie 차별점.**
- **Tier 4 (temporal):** 시간 일관성 — 키프레임 시간 단조성·duration 이내·각속도 상한.
- Tier 3 (physics: 자기교차·접지·균형)와 Tier 5 (mesh 위상)는 후속.

검증기는 `IAutoMovieConstraintViolation[]`을 만들고, `IAutoMovieValidation`(success | violations)으로 묶는다. `@automovie/agent`가 이를 MicroAgentica 피드백 루프에 흘려 `// ❌`로 렌더한다.

## 좌표·각도 규약

`@automovie/interface` README의 규약을 따른다(y-up, 미터, 의미 각도). 본 로컬 회전 합성 규약은 `kinematics/jointToQuaternion.ts` JSDoc 참조.
