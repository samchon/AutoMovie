# Acceptance 요구사항

이 주제는 사용자가 영화, 자산, 장면, 구간, 산출물 또는 그 일부에 대해 무엇을 성공으로 인정할지 요청하고, 현재 결과를 같은 기준으로 관찰하며, 승인 또는 거절을 재현 가능하게 판정할 수 있어야 한다는 제품 계약을 정의한다.

## 주제 범위 {#acceptance-topic-scope}

Acceptance는 다른 주제의 의도를 대신 정하지 않는다. 다른 주제가 약속한 대상과 결과를 반증 가능한 criterion, 명시적 허용오차, 충분한 evidence, 판정 profile과 승인 authority에 연결한다.

Acceptance는 품질을 “좋음”이라는 단일 평가어로 축약하지 않는다. 대상, 관찰 범위, 기대 상태, 비교 규칙, 실패 조건과 판정 권한이 없으면 승인 가능한 criterion으로 취급하지 않아야 한다.

### 관찰 가능한 계약 {#acceptance-observable-contract}

사용자는 승인 요청이 무엇을 검사하는지, 어떤 evidence가 사용되었는지, 허용오차 안과 밖이 어떻게 구분되는지, 누가 어떤 범위를 승인했는지 확인할 수 있어야 한다.

### 정직한 결과 상태 {#acceptance-honest-outcome}

Acceptance는 criterion의 pass, fail, indeterminate, not-run, unsupported와 stale, 집계의 partial, 승인의 accepted, rejected와 accepted-with-deviation을 구분해야 하며, 불확실하거나 일부만 성공한 결과를 완전한 승인으로 올려 보고하지 않아야 한다.

## 핵심 계약 {#acceptance-core-contract}

- 같은 대상 identity, criterion version, profile, 입력 상태, 관찰값과 evidence가 주어지면 수치·구조 criterion의 판정은 반복할 때마다 같아야 한다.
- 시각·서사·미학 criterion은 주관적 판단이 필요한 지점을 명시하고, 그 판단을 내릴 authority와 실제 관찰을 기록해야 한다.
- 각 필수 criterion은 positive, negative와 boundary case로 성공 조건과 반증 조건을 함께 드러내야 한다.
- 승인 범위보다 낮은 fidelity, 해상도, 시간 coverage 또는 evidence tier의 결과를 더 높은 profile의 통과로 일반화하지 않아야 한다.
- 한 criterion의 통과를 다른 대상, 시간 구간, camera, 언어, 전달 profile 또는 작품 전체의 통과로 확장하지 않아야 한다.

## 문서 지도 {#acceptance-document-map}

- [범위, 대상과 권한](./scope-targets-and-authority.md)
- [Criterion 계약](./criteria-and-observables.md)
- [허용오차와 경계](./tolerances-and-boundaries.md)
- [Positive, negative와 boundary case](./case-matrix-and-counterexamples.md)
- [Evidence 충분성과 freshness](./evidence-and-freshness.md)
- [Profile과 집계 판정](./profiles-and-aggregation.md)
- [검토 표면과 표본 범위](./review-surfaces-and-sampling.md)
- [불확실성과 부분 성공](./uncertainty-and-partial-success.md)
- [승인, 예외와 게시](./approval-exceptions-and-publication.md)
- [변경, 회귀와 재판정](./change-regression-and-revalidation.md)
