# Completeness, Freshness와 Refusal

## Evidence obligation matrix {#evp-evidence-obligation-matrix}

### Dependency-based freshness {#evp-dependency-based-freshness}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-completeness-and-freshness claim, approval와 publication에 필요한 evidence와 실제 상태를 비교하는 matrix를 정의한다. -->

Completeness 입력은 decision kind와 revision, required evidence roles와 scope, actual record inventory, dependency graph와 policy revision이다. 출력 matrix는 requirement별 satisfied, missing, stale, conflicting, unsupported, not-run 또는 invalid 상태, contributing record ids와 uncovered scope를 포함해야 한다.

Complete는 모든 required row가 current positive evidence로 충족되고 blocking conflict가 없을 때만 출력할 수 있다. Optional row와 intentionally absent row는 정책 근거를 포함하고 required omission을 대신하지 않아야 한다.

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-dependency-based-current-status subject, source, dependency, activity, 조건, rubric과 judgment 변화로 current 상태를 계산한다. -->

Freshness key는 subject revision, source와 dependency closure identities, activity와 execution identity, observation conditions, criterion 또는 rubric revision과 reviewer decision identity를 포함해야 한다. Evaluator는 stored key와 current key를 field별로 비교해 current, stale 또는 indeterminate와 changed roles를 출력해야 한다.

Output path 존재, 생성 시각과 이전 success는 current 판정의 충분조건이 아니다. 새 optional field를 모르는 reader는 identity 차이를 무시하지 않고 indeterminate와 compatibility-unknown reason을 반환해야 한다.

### Outcome classification lattice {#evp-outcome-classification-lattice}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-unsupported-and-not-run unsupported, not-run, error, fail과 pass를 서로 대체할 수 없는 결과로 정의한다. -->

모든 검사 record의 canonical outcome은 pass, fail, error, unsupported, not-run과 cancelled를 구분하고 severity, execution completeness와 artifact availability를 별도 축으로 가져야 한다. Observation의 success는 pass, failed는 error로 정규화하고 partial은 관찰된 child scope의 pass와 누락 scope의 not-run을 보존한 채 전체 completeness를 partial로 둔다. Automated finding의 warning은 outcome이 아니라 severity이며 criterion 충족 여부에 따라 pass 또는 fail과 결합한다. Aggregation은 complete pass만 satisfied evidence로 계산하고 나머지 outcome의 원인과 scope를 보존해야 한다.

Unsupported를 not-run으로, error를 fail로, 빈 output을 pass로 바꾸어서는 안 된다. 새로운 outcome을 모르는 consumer는 pass로 default하지 않고 unresolved로 처리해야 한다.

### Partial aggregation {#evp-partial-aggregation}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-partial-results-and-aggregation frame, channel, sample, proxy, platform와 variant의 제한된 coverage를 집계에 보존한다. -->

Partial result는 exact included와 omitted scope, selection method, requested scope, completion ratio를 계산할 수 있는 경우의 exact counts와 omitted reason을 포함해야 한다. Aggregator는 union과 intersection을 명시하고 duplicate record와 overlapping scope를 double-count하지 않아야 한다.

Proxy, sample 또는 한 platform의 pass는 해당 scope만 만족시키고 final, full-range 또는 cross-platform complete로 승격할 수 없다. 결과가 truncated되어 전체 발생 수를 모르면 lower bound와 unknown remainder를 출력해야 한다.

### Reproduction verification boundary {#evp-reproduction-verification-boundary}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reproduction-boundary 결정적 activity의 재검증과 외부 service 또는 사람 판단의 보존 경계를 분리한다. -->

Reverification 입력은 original activity와 input identities, protocol, runtime constraints와 expected output identity다. Deterministic activity는 rerun output identity를 expected output identity와 exact로 비교하고 match, mismatch 또는 unverifiable을 출력해야 한다. 수치 tolerance가 결과 의미의 일부인 criterion은 identity 일치를 대신하지 않는 별도 observation으로 판정해야 한다.

Nondeterministic activity는 raw output와 당시 conditions의 integrity를 검증하되 rerun equality를 요구하지 않아야 한다. 사람 judgment는 같은 evidence와 rubric을 다시 열 수 있는지 검증할 수 있지만 같은 decision을 재현 가능하다고 주장해서는 안 된다.

### Fail-closed decision gate {#evp-fail-closed-decision-gate}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-honest-refusal 필수 parent, source, digest, rights, custody, credential 분리와 authority가 없거나 모순될 때 positive 판정을 거부한다. -->

Decision gate는 obligation matrix, lineage completeness, integrity, rights, custody, privacy, execution conditions와 authority status를 입력받아 current, verified, approved 또는 publishable 중 요청된 verdict와 diagnostic set을 출력해야 한다. Positive verdict는 모든 mandatory precondition이 명시적으로 satisfied일 때만 허용한다.

Missing, stale, conflicting, credential leak, invalid digest와 ambiguous authority는 verdict를 거부하고 exact unmet identity, affected scope, last verified boundary와 가능한 remediation을 반환해야 한다. 이전 positive verdict나 fallback artifact를 자동 재사용해서는 안 된다.

### Reapproval after change {#evp-reapproval-after-change}

<!-- @evidence requirements/evidence-and-provenance/completeness-freshness-and-refusal.md#evidence-reapproval-after-change source, tool, policy, rights, transformation, output와 judgment 교체 뒤 영향받은 판정을 새 evidence로 다시 승인한다. -->

Change event는 old와 new revision, changed roles와 reverse impact result를 입력으로 받아 stale decisions, preserved decisions와 required rerun 또는 human review를 출력해야 한다. Preserved decision은 exact unaffected scope와 proof relation을 가진 새 impact judgment를 요구한다.

새 evidence 없이 affected approval을 상속하거나 unrelated sibling까지 모두 invalidation해서는 안 된다. Compatibility상 dependency relation을 해석할 수 없으면 preserved가 아니라 indeterminate로 반환해야 한다.
