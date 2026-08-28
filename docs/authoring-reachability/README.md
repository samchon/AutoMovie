# 저작 도달 가능성

AutoMovie의 제품 요구와 생성 프로젝트의 저작 계약은 서로 다른 그래프다. 제품 요구는 저장소가 제공해야 할 능력을 정하고, 저작 계약은 한 production의 저자가 무엇을 결정하고 증명해야 하는지 정한다. 둘을 1,982개의 개별 인용으로 억지로 연결하지 않는다. 이 문서는 요구 family마다 저작자가 도달하는 owner가 있는지 판정하고, 기계 판정의 원본은 [families.json](./families.json)에 둔다.

## 현재 모집단

2026-08-28 현재 `docs/requirements/`에는 27개 family와 명시 anchor가 있는 H3 unit 1,982개가 있다. `packages/template/docs/`에는 discovery 17개, principle 83개, obligation 108개로 H2 208개가 있다. 저작 계약에서 `requirements/`를 직접 인용한 경우와 요구 문서에서 discovery, principle, obligation을 직접 인용한 경우는 모두 0건이다.

Correspondence는 해당 family의 결정을 저자가 어느 계약 owner와 절차에서 만나게 되는지 말한다. 이것은 그 family의 모든 H3가 이미 구현되었다거나 하나의 계약 항목이 모든 세부 요구를 대신한다는 주장이 아니다. 부재는 다음 세 종류로만 기록한다.

| 분류 | 의미 |
| --- | --- |
| `unpaid-authoring-edge` | 저자가 몰아야 하지만 family를 책임지는 저작 owner가 없다. 부분적으로 닿는 계약이 있어도 family 결정을 모을 owner가 없으면 이 상태다. |
| `not-author-driven` | 저자는 입력을 선언하거나 결과에 대응할 뿐, 동작의 계약은 deterministic host나 생성 harness가 소유한다. |
| `intentional-exclusion` | 제품이 의도적으로 제공하지 않으며, 다시 여는 관찰 가능한 조건이 있다. |

## Family 교차표

| 요구 family | H3 | 판정 | 저작 계약 또는 부재 근거 |
| --- | ---: | --- | --- |
| `acceptance` | 76 | authoring contract | common evidence conformance, brief observations, shot acceptance, production review |
| `actors` | 62 | authoring contract | settings subject inventory, operative agency, design-dependent conditions, film dramatic-subject obligations, model and motion branches |
| `agent-authoring` | 38 | not author-driven | generated-project `AGENTS.md`, production router, evidence staging이 harness 동작을 소유한다 |
| `asset-authoring` | 65 | authoring contract | model, material, instance principles and source obligations, design routing and rigging |
| `building-exterior` | 126 | authoring contract | settings subject/equipment conditions, spaces, materials, instances, systems, spatial-design craft, and current building/texture measurements |
| `camera` | 77 | authoring contract | screenplay orientation, shot composition and inputs, cinematography |
| `delivery-and-accessibility` | 94 | authoring contract | settings가 접근성 산출물을 required, optional, intentionally absent, unsupported로 분류하고 film source가 필요한 timeline·language-version track을 매핑한다. 저자가 선택한 delivery 제약을 실현·검증하는 container·codec·timebase·media-fact probe·encode·package·published-byte validation·publication·retention·recovery mechanics는 deterministic host가 소유한다 |
| `diagnostics` | 36 | authoring contract | evidence conformance, evidence staging, diagnostics-first debugging |
| `editorial` | 85 | authoring contract | screenplay timing, film-source editorial assembly, editing |
| `effects-and-simulation` | 69 | authoring contract | systems behavior, state clock, budget, degradation, explicit source evaluation |
| `evidence-and-provenance` | 51 | authoring contract | source identity, fact status, declared basis, evidence conformance and staging |
| `external-inputs` | 60 | authoring contract | research identity and consequence, settings source support, source ownership |
| `formations` | 54 | authoring contract | settings member/carried-object conditions, instance membership and placement, motion spatial relations |
| `interior` | 153 | authoring contract | settings의 user·equipment 조건, spaces·materials·instances·systems, spatial-design craft와 current measurement review set |
| `lighting` | 86 | authoring contract | systems state and source evaluation, shot inputs, cinematography |
| `map` | 152 | authoring contract | map discovery, world identity and information structure, terrain·water·ecology·land use·settlement·transport·infrastructure·weather·time state, site interfaces, deterministic map source and review |
| `motion` | 81 | authoring contract | motion endpoints, phases, domain, time, contact, composition and pure source mapping |
| `operations-and-recovery` | 81 | not author-driven | compiler, render and command hosts가 lock, retry, checkpoint, publication and recovery를 소유한다 |
| `product` | 30 | authoring contract | scope preservation, purpose fit, layer boundary, production-kind router |
| `production-design` | 99 | authoring contract | settings가 visual grammar, reference reconciliation, fidelity와 build-or-adopt scope를 소유하고 전문 design branch와 production source가 이를 실현한다 |
| `production-evidence` | 7 | authoring contract | common evidence integrity, contract-target inventory and evidence staging |
| `rendering` | 90 | authoring contract | settings delivery scope, production-source delivery identity, shot time, film timeline and deterministic capture |
| `repaint` | 43 | authoring contract | settings의 visual·fidelity 결정, 외부 generator adoption configuration, deterministic structural truth, receipt lineage와 publication evidence |
| `review` | 16 | authoring contract | subject verification addresses, population review sets, production review and author Self-Review |
| `sound` | 80 | authoring contract | screenplay audible intent, systems, auxiliary-track mapping and sound craft |
| `staging` | 70 | authoring contract | script physical progression and boundary, shot realization |
| `story` | 101 | authoring contract | narrated-time principles, sustained-middle treatment coverage, executable scripts, and final screenplay contracts |

25개 family는 저작 계약으로 도달하고 2개는 host 또는 harness가 소유한다. 저작 owner가 없는 family edge와 whole-family 의도적 제외는 현재 모두 0개다. 이후 부재 분류를 사용하려면 `families.json`에 이유와 재개 조건을 함께 적어야 한다.

## 미지급 수와 gate

`node internals/authoring-reachability-gate.mjs`는 미지급 family 수 0을 정확히 고정한다. family가 늘거나 분류가 빠지거나 대응 path와 anchor가 사라지거나 debt가 다시 생기면 ledger를 다시 판단하기 전까지 실패한다. 지급된 edge도 조용히 예전 baseline 아래에 숨을 수 없다.

Specification fragment debt도 같은 방식으로 센다. 현재 `@evidenceObligation` target-anchor와 id 쌍은 23개이고 source의 고유 `@evidencePart` 쌍은 22개다. 미지급 1개는 다음과 같다.

- `camera-light-and-visibility/visibility-and-image-space-observation.md#clv-clipping-clearance-evaluation::depth-precision-constraint`

## 저장소 evidence review 정책

Repository requirement-specification-source graph에서는 `evidence/review`를 켜지 않는다. 현재 package source에 실제로 적힌 관계는 `@evidence` 13,732개와 `@evidenceExclude` 7,586개, 합계 21,318개다. specification의 positive 관계 2,625개를 합치면 repository graph에는 positive 16,357개와 exclusion 7,586개, 합계 23,943개가 있다. 실제 companion review tag는 0개다. source 제외 사유 7,586개는 1,176종이고 상위 20종이 4,019개(52.98%)를 차지하며, 최다 사유 하나가 1,747회 쓰인다. 23,943개의 companion 문장을 일괄 요구하면 target별 의미 검토보다 package boundary의 기계적 재진술을 늘린다.

이 결정은 review를 생략한다는 뜻이 아니다. `evidence/graph`가 resolved target과 population을 검사하고 `evidence/documented`가 public carrier를 유지하며 `evidence/todo`가 선언된 미구현 계약을 거부한다. `internals/contract-ownership.mjs`는 contract owner와 fragment declaration을 추적하고, `internals/authoring-reachability-gate.mjs`는 family owner와 정확한 unpaid fragment target 집합을 추적한다. 변경자는 evidence-graph skill과 review skill에 따라 실제 host, target, 이유와 consequence를 읽고, source를 바꾸면 development skill의 테스트와 100% per-file coverage 의무를 진다. 이 조합도 산문의 의미를 자동 증명하지는 않으므로 Self-Review가 최종 owner다.

생성 production의 review stage는 별도 그래프다. 작품의 선택된 저작 모집단에서 관계를 실질적으로 검사하는 절차이므로 repository-wide source edge 수와 같은 이유로 자동 해제하지 않는다. 다만 changed relationship만 고르고, 구체적인 검사 기록을 보존하며, 복제 acknowledgement를 거부하는 review mechanism이 생기면 repository 정책도 다시 판단한다. Gate는 lint config가 이 기록과 다르게 `evidence/review`를 켜는 것을 거부한다.

## 기존 건물 실험 적용

[modern-suburban-house baseline](../../.agents/skills/experiment/baselines/modern-suburban-house.md)과 #1952에 교차표를 적용했다. 제외된 벤치마크 #2110을 다시 실행하지 않고 이미 기록된 brief, compiled counts, report와 driver 관찰만 사용했다.

| 관찰 | 교차표 판정 |
| --- | --- |
| 한 채의 2층집, 20개 space, 28개 opening, 23개 authored model을 같은 graph로 만들었다 | `building-exterior`, `interior`, `asset-authoring`은 spaces, models, materials, instances, systems 계약으로 도달한다 |
| `building:report`가 opening의 void와 filling element 차이, 끊어진 구조와 선언 gap을 보고했다 | diagnostics와 review 절차가 authoring contract에 연결되어 실제 구조 finding을 만들었다 |
| 고정 brief는 중앙 `dog-leg` 계단을 요구했지만 세 reference image는 중간참이나 180도 회귀가 없는 직선 계단을 보였다 | 당시 `production-design` reference reconciliation owner가 없어 intake에서 해결되지 않은 모순이며, 이제 settings의 production visual grammar와 subject breakdown owner가 이를 adoption 전에 해결한다 |
| 실험은 한 대지의 단독 주택을 요청했고 그 밖의 지형, 수계, 교통, 생태, 정착지나 map delivery를 요청하지 않았다 | `map` owner 부재는 실제지만 이 실행의 declared scope에서는 활성 finding이 아니다 |
| 접근성 delivery와 repaint rendition을 요청하지 않았다 | 새 계약은 접근성 product를 intentionally absent 또는 unsupported까지 분류하고 deterministic/repainted fidelity와 generator adoption을 명시하게 하므로, 요청 부재가 미결정 상태로 남지 않는다 |

이 적용은 crosswalk가 모든 미지급 family를 모든 production의 결함으로 바꾸지 않음을 보여 준다. 먼저 선언한 delivery scope가 family를 활성화하는지 판정하고, 활성화된 family만 그 owner에게 요구한다. Owner 자체가 없는 경우에만 family edge가 제품 debt다.
