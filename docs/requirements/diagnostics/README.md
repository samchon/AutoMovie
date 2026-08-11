# 진단 요구사항

진단은 저작, 검증, 변환, 렌더, 전달과 외부 입력 처리에서 사용자가 실패와 불확실성을 이해하고 다음 조치를 선택할 수 있게 하는 공통 제품 결과다. 진단은 실패를 문자열로 알리는 데 그치지 않고 대상, 영향 범위, 결과 상태와 조치 가능성을 추적 가능한 형태로 보존해야 한다.

## 사용자 약속 {#diagnostics-user-promise}

사용자는 진단만으로 무엇이 잘못되었거나 확인되지 않았는지, 어느 입력과 파생 결과가 영향을 받았는지, 작업이 어디까지 수행되었는지, 안전하게 다시 시도하려면 무엇을 바꾸어야 하는지 판단할 수 있어야 한다.

## 적용 경계 {#diagnostics-scope}

이 주제는 제품 전반의 오류, 경고, 정보성 finding과 실행 상태를 다룬다. 각 저작 영역은 자기 분야의 유효성 규칙을 소유하고, 진단은 그 규칙의 위반과 확인 불가 상태를 일관된 identity와 context로 전달한다.

진단은 주관적 품질 판단을 자동으로 확정하지 않는다. 시각 또는 청각 검토가 필요한 항목은 검토가 실행되지 않았거나 판단이 남아 있음을 명시하고, 수치 검사만으로 작품의 적합성을 주장하지 않아야 한다.

## 문서 지도 {#diagnostics-document-map}

- [정체성, 경로와 맥락](./identity-path-and-context.md)
- [입력과 결과의 분류](./input-and-result-classification.md)
- [수집, 중단과 결정성](./collection-fail-fast-and-determinism.md)
- [예산과 진단 제한](./budgets-and-limits.md)
- [외부 입력과 보안 실패](./external-input-and-security.md)
- [현지화와 기계 판독 결과](./localization-and-machine-results.md)
- [부분 산출물과 복구](./partial-artifacts-and-recovery.md)
