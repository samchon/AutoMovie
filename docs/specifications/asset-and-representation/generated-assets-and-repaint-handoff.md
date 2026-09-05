# 생성 자산 채택과 재도색 인계

## 외부 생성 경계 {#asset-spec-generation-boundary}

### 사용자와 제공자 선택 입력 {#asset-spec-generation-provider-choice}

<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption 생성된 geometry, model, motion, image, texture와 audio를 작품 자산으로 명시적으로 채택할 수 있어야 한다. -->

시스템은 외부 생성 실행을 자산 저작의 선택 가능한 source activity로 취급하고, 결과가 생성되었다는 이유만으로 작품 자산이나 current revision으로 승격하지 않는다. 생성 후보는 다른 외부 입력과 같은 격리, 검증, 권리 확인, 채택 방식 선택과 고정된 bytes의 해석을 통과해야 한다.

<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generation-provider-independence 제공자, model, API와 호출 방식에 종속되지 않은 생성 요청을 지원해야 한다. -->
<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-provider-neutrality 시스템이 특정 제공자를 우선하거나 자동 선택하지 않아야 한다. -->

생성 입력은 사용자가 선택한 source channel, 제공자와 model identity·version, 선언된 capability, 실행 위치, 요청 내용, 제약, 입력 자원, 권리 조건과 승인 범위를 포함한다. 시스템은 특정 제공자, model, endpoint, 계정 또는 호출 방식을 기본값으로 정하지 않고, 필요한 capability와 현재 조건을 충족하는지 비교 가능한 사실만 제시한다.

### credential과 외부 전송 경계 {#asset-spec-generation-credential-boundary}

<!-- @evidence requirements/external-inputs/credentials-rights-and-provenance.md#external-credential-separation credential을 작품 문서, receipt와 자산 bytes에서 분리해야 한다. -->
<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-transfer-authority 외부 전송 대상과 범위를 사용자가 승인해야 한다. -->
<!-- @evidence requirements/asset-authoring/external-assets.md#asset-external-secret-boundary 외부 자산 취득과 생성에 쓰는 비밀정보를 자산 및 provenance와 분리해야 한다. -->

credential은 비밀 저장 경계에서 실행 시점에만 참조하며 문서, prompt 기록, provenance, 로그, receipt와 자산에 값을 복사하지 않는다. 외부 전송 전 시스템은 대상 제공자, 전송할 source·reference·metadata, 민감 정보, 보존·학습 조건과 실행 위치를 제시하고 사용자 승인 범위를 벗어난 전송을 거부한다.

### request, attempt와 결과 identity {#asset-spec-generation-attempt-identity}

<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generation-attempt-lineage 요청, 각 시도, 원본 결과와 최종 채택 결과를 별도 identity로 추적해야 한다. -->

request는 변하지 않는 의도와 입력의 identity이고, attempt는 한 번의 실행 identity이며, raw output과 해석·편집·변환된 candidate는 각각 별도 revision이다. 기록은 request·attempt identity, 제공자·model·version, 실행 환경, seed와 제어값, 입력·출력 digest, 시간, 상태, 오류, 변환 계보와 최종 채택 여부를 연결한다.

### 결정론과 seed 의미 {#asset-spec-generation-reproducibility}

<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generation-reproducibility-boundary prompt, seed와 설정만으로 외부 생성 bytes의 재현을 보장하지 않아야 한다. -->
<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-procedural-generation-distinction 로컬 절차 생성과 외부 비결정적 생성을 같은 재현성으로 주장하지 않아야 한다. -->
<!-- @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-seed-semantics seed를 동일 결과 보장으로 과장하지 않아야 한다. -->

결정론적 절차 자산은 규칙 revision, 입력과 seed가 같을 때 동일 결과를 요구하지만, 외부 생성의 seed는 제공자가 선언한 제어 의미만 기록하고 bytes 동일성을 보장하지 않는다. 외부 결과의 재사용 가능성은 고정된 output bytes와 digest에서 오며, 같은 prompt·seed 재실행을 원본 복원 수단으로 취급하지 않는다.

### 생성 결과 채택 출력 {#asset-spec-generation-adoption-output}

<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generation-fixed-output 채택된 생성 결과는 고정 bytes, digest와 해석 revision을 가져야 한다. -->
<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generated-adoption-modes 생성 결과에도 direct, native와 group 채택 방식을 사용할 수 있어야 한다. -->

채택 출력은 고정된 raw bytes, content digest, 해석된 모델·자원 revision, 검증 결과, 권리·provenance와 사용자가 고른 `direct`, `native` 또는 `group` 방식을 포함한다. 생성 source는 native 변환이나 의미 보강의 권위가 아니며, 변환·선택·누락과 사용자 override를 별도 receipt로 남긴다.

### 생성 채택 실패 {#asset-spec-generation-adoption-failures}

<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generation-input-rights 생성 입력과 결과의 이용 권한 및 제한을 채택 전에 확인해야 한다. -->
<!-- @evidence requirements/asset-authoring/generated-assets.md#asset-generation-refusal 권리, provenance, bytes, 검증 또는 채택 방식이 불완전한 생성 결과를 거부해야 한다. -->
<!-- @evidence requirements/asset-authoring/validation.md#asset-external-generated-validation 외부·생성 자산의 closure, provenance, license, digest와 변환 결과를 검증해야 한다. -->

입력 또는 결과의 이용 권한, source provenance, 고정된 output bytes와 digest, 자원 closure, 선택한 채택 방식이나 목적별 검증이 불완전하면 후보는 `rejected`, `unsupported` 또는 `quarantined`에 머문다. 시스템은 preview, 임시 URL, 다시 실행할 수 있다는 주장이나 제공자 성공 상태를 채택 가능한 자산의 증거로 대신하지 않는다.

## 재도색 인계 경계 {#asset-spec-repaint-handoff-boundary}

### 인계 자격과 source 잠금 {#asset-spec-repaint-eligibility-source-lock}

<!-- @evidence requirements/repaint/scope-and-user-choice.md#repaint-scope-user-choice 재도색은 사용자가 선택하는 별도의 선택적 rendition이어야 한다. -->
<!-- @evidence requirements/production-design/visual-delivery-and-fidelity-tiers.md#production-design-repaint-boundary 재도색은 결정론적 구조 pass를 대체하지 않는 appearance handoff여야 한다. -->

재도색은 승인된 결정론적 장면의 구조를 source로 삼아 appearance만 새로 해석하는 독립 rendition이다. 시스템은 재도색을 렌더 경로의 자동 단계나 source 구조 오류의 우회로로 사용하지 않으며, 원본 장면과 재도색 결과를 각각 보존하고 사용자가 delivery별 포함 여부를 선택하게 한다.

### 명시적 재도색 경로 선택 {#asset-spec-repaint-manual-routing}

<!-- @evidence requirements/repaint/scope-and-user-choice.md#repaint-no-automatic-routing 재도색을 명시적으로 선택한 delivery에서만 외부 handoff를 준비하게 한다. -->

Runtime은 결정론적 render나 review 완료를 재도색 실행 요청으로 해석하지 않는다. 선택한 production delivery가 재도색을 요구할 때만 관련 guide와 adapter 경로를 노출하며, 그 선택이 없으면 결정론적 artifact를 그대로 유지한다.

### 실행 자격과 입력 결속 {#asset-spec-repaint-execution-eligibility}

<!-- @evidence requirements/repaint/scope-and-user-choice.md#repaint-provider-independence Host가 선택한 provider adapter만 실행하게 한다. -->
<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-source-review-freshness Source와 rendition review의 freshness를 각각 추적하게 한다. -->
<!-- @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-source-failure-first Source compile 또는 structural review 실패를 외부 실행보다 먼저 반환하게 한다. -->
<!-- @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-current-evidence Current source frame, review와 fingerprint 증거를 실행 전제에 포함하게 한다. -->
<!-- @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-eligibility-refusal 불완전한 자격을 구체적 refusal로 반환하게 한다. -->
<!-- @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-project-relative-references Reference를 manifest-owned project asset으로 해석하게 한다. -->
<!-- @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-control-alignment Source와 structural control frame의 manifest alignment를 검증하게 한다. -->
<!-- @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-refusal 누락되거나 stale, misaligned 또는 digest-mismatched reference를 거절하게 한다. -->

Repaint executor는 caller가 제공한 adapter identity와 current deterministic source closure만 사용한다. Source compile, structural review, frame·control alignment와 project-relative reference digest를 모두 검증하고, 실패한 exact prerequisite를 외부 요청 전에 반환한다.

<!-- @evidence requirements/repaint/eligibility-and-prerequisites.md#repaint-eligibility-prerequisites current deterministic source와 구조 review 이후에만 재도색할 수 있어야 한다. -->
<!-- @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-source-reference-lock production, shot, 시간, frame, camera와 pass identity를 고정해야 한다. -->

인계 입력은 current production·shot revision, 정확한 시간 또는 frame 범위, source digest, camera·projection·viewport, 구조 pass와 review identity, delivery 선언을 포함한다. source가 stale이거나 구조·contact·timing 실패가 남았거나 source와 review의 revision이 다르면 재도색 실행을 허용하지 않고 먼저 결정론적 source를 교정하게 한다.

### appearance 요청과 reference 역할 {#asset-spec-repaint-controls-references}

<!-- @evidence requirements/repaint/prompts-controls-and-constraints.md#repaint-prompts-controls-constraints appearance 요청, 제약과 제어값을 안정된 입력으로 기록해야 한다. -->
<!-- @evidence requirements/repaint/source-frames-and-reference-locking.md#repaint-reference-roles source, 구조 control, identity, style과 negative reference 역할을 구분해야 한다. -->

재도색 request는 보존할 subject identity·count·pose·silhouette·camera·contact·event, 바꿀 appearance 범위, prompt·negative prompt, 구조 control, identity·style·negative reference와 각 정렬 정보를 포함한다. reference는 project-relative identity와 digest로 고정하고 역할을 서로 대신하지 않으며, 구조 변경 요청과 appearance 요청이 섞이면 실행 전에 범위를 분리한다.

### attempt, retry와 채택 계보 {#asset-spec-repaint-attempt-selection}


<!-- @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-retries-seeds-variation 매 실행을 독립 result로 기록해야 한다. -->
<!-- @evidence requirements/repaint/retries-seeds-and-variation.md#repaint-one-accepted-lineage 여러 후보 중 하나의 명시적 accepted lineage만 publication으로 이어져야 한다. -->

각 재도색 attempt는 독립 identity, request revision, seed·variation 제어, 실행 상태, output digest, 오류와 review 결과를 가진다. retry는 사전 선언한 budget과 중단 조건 안에서 새 attempt를 만들고 이전 출력을 덮어쓰지 않으며, 후보 비교 기록과 사용자 선택을 거쳐 하나의 accepted lineage만 delivery 후보가 된다.

Runtime은 maximum attempt, per-attempt timeout, request elapsed·cost ceiling, retryable failure set과 attempt 순서별 deterministic backoff를 실행 전에 검증한다. Reroll은 새 request identity, retry는 같은 request identity와 새 attempt identity, select는 검증된 candidate를 active로 만드는 transaction, reversal은 이전 candidate를 새 selection record로 다시 선택하는 transaction이다. Started call은 succeeded·failed·cancelled·invalid·stale 중 하나의 terminal record로 닫히고 timeout, rate limit, provider refusal, partial bytes와 budget exhaustion도 사라지지 않는다.

성공한 provider output은 candidate receipt와 bytes만 atomic publish한다. Selection은 current source·request fingerprint·generator adoption·candidate bytes·기존 pointer snapshot을 재검증하고 selection record와 active pointer를 한 transaction에 publish하므로, candidate 생성이나 failed pointer write만으로 current lineage가 바뀌지 않는다.

### 구조 비교와 연속성 {#asset-spec-repaint-structure-continuity}


<!-- @evidence requirements/repaint/structural-comparison-and-review.md#repaint-structural-comparison-review 재도색 전후 subject, pose, silhouette, camera, contact와 event를 비교해야 한다. -->
<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-sequence-continuity-publication 여러 재도색 shot에서 같은 film의 시각 identity를 추적해야 한다. -->
<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-reference-continuity 공유 reference, model version, control policy와 핵심 palette를 고정하거나 의도된 변경으로 기록해야 한다. -->
<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-continuity-baseline-changes 여러 shot의 visual identity 기준과 의도된 변화를 고정해야 한다. -->
<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-continuity-drift-propagation 앞선 rendition을 다음 reference로 쓸 때 계보와 승인 범위를 기록하고 검토되지 않은 drift 전파를 막아야 한다. -->
<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-temporal-artifacts sequence playback에서 flicker, identity drift, geometry warp, texture crawl과 transition mismatch를 검토해야 한다. -->

review는 source와 rendition의 subject identity·count, pose, silhouette, framing, camera relation, contact, 공간 배치와 사건 가독성을 직접 비교하고 pixel 차이와 구조 차이를 구분한다.

sequence 기록은 character, costume, prop, location, material, palette, light, weather, damage와 texture identity를 deterministic·repainted shot 전체에서 추적한다. 공유 identity·style reference, model version, control policy와 핵심 palette는 versioned continuity baseline과 적용 shot 범위로 고정하고, 의도된 상태 변화만 시작·종료 경계를 가진 shot별 delta로 기록한다.

각 request receipt는 prompt, continuity, settings, design, screenplay 또는 brief와 shot owner의 stable evidence address를 보존한다. Film request의 continuity address는 selected candidate set과 같은 baseline을 가리켜야 하고, playback observation은 flicker, identity drift, geometry warp, texture crawl와 transition mismatch를 각각 falsify할 수 있어야 한다. Continuity가 적용되지 않는 brief·library·single-image request는 null boundary를 유지하여 film review를 가장하지 않는다.

앞선 rendition을 다음 shot의 reference로 채택할 때는 derivation edge와 승인 범위를 남기며, 승인되지 않은 변화가 연쇄 reference를 통해 누적되지 않게 한다. sequence playback 검토는 frame·shot 경계의 flicker, identity drift, geometry warp, texture crawl과 transition mismatch를 지목하고 해결되지 않은 구간을 publication 실패로 전달한다.

### rendition 출력과 provenance {#asset-spec-repaint-output-provenance}


<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-identity-provenance 각 output에 source, 제공자, model, request, control, reference, 조건과 digest를 연결해야 한다. -->
<!-- @evidence requirements/repaint/scope-and-user-choice.md#repaint-independent-artifact 재도색 결과를 원본과 독립된 artifact로 보존해야 한다. -->

rendition 출력은 새 identity와 digest, source와 review revision, 제공자·model·version과 실행 환경, request·attempt identity, prompt·control·reference digest, seed 의미, 권리·조건, 구조 비교와 continuity 상태를 가진다. 출력은 원본 frame이나 자산을 덮어쓰지 않고 derivation edge로 연결되며, source가 바뀌면 새 rendition으로 재평가한다.

Receipt는 provider call의 immutable start·completion UTC instant와 metered cost를 보존한다. Terms review date의 canonicalization은 wall clock과 독립적이고, execution preflight와 candidate·selection·publication validation은 명시적으로 전달된 instant의 UTC date와 비교하여 미래 review를 거절한다.

### Derivation 검증과 refusal {#asset-spec-repaint-derivation-validation}

<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-derivation-chain Deterministic source부터 request, candidate와 adopted rendition까지의 derivation을 닫게 한다. -->
<!-- @evidence requirements/repaint/identity-and-provenance.md#repaint-provenance-refusal Provider, model, request, reference 또는 output identity가 불완전한 결과를 채택하지 않게 한다. -->

Rendition identity helper는 source, runtime, request, reference, control과 output digest를 canonical derivation으로 결합한다. 필수 identity가 비어 있거나 protocol과 맞지 않으면 output 또는 receipt path를 만들지 않고 거절한다.

### 실패와 publication 호환성 {#asset-spec-repaint-failure-publication}

<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-publication-gate current source, provenance, 구조 review와 continuity review를 모두 통과해야 publication할 수 있다. -->
<!-- @evidence requirements/repaint/sequence-continuity-and-publication.md#repaint-mixed-delivery 결정론적 shot과 재도색 shot의 혼합 정책, 전환과 review requirement를 명시해야 한다. -->
<!-- @evidence requirements/repaint/providers-models-and-credentials.md#repaint-provider-refusal capability, 조건, credential 또는 실행 경계가 충족되지 않으면 외부 실행을 거부해야 한다. -->

누락 source·reference, digest 불일치, 미지원 capability, 승인되지 않은 외부 전송, credential 부재, budget 초과, 구조 drift, temporal artifact, continuity 실패 또는 stale provenance는 구체적 attempt 상태로 남는다. publication은 current source와 accepted rendition, 완전한 provenance, 구조·continuity review와 delivery 선언이 모두 일치할 때만 가능하다. 결정론적 shot과 재도색 shot을 섞는 delivery는 포함 구간, 전환 정책과 추가 review requirement를 명시적으로 승인받으며, 선언과 다른 lane의 비의도 혼합은 거부한다.
