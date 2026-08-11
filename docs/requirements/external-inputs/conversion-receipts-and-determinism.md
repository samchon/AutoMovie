# Conversion Receipt와 결정론

## 반복 가능한 외부 입력 해석 {#external-conversion-determinism}

같은 pinned source closure, 같은 selection과 adoption mode, 같은 declared interpretation과 같은 변환 조건은 지원되는 결정론 범위에서 같은 adopted bytes와 identity를 만들어야 한다. 결과가 platform이나 외부 service state에 따라 달라질 수 있으면 결정론 범위와 고정해야 할 결과 bytes를 명시해야 한다.

### Receipt의 입력 범위 {#external-conversion-receipt-inputs}

Receipt는 raw source와 dependency digest, 선택한 scene·node·stream·range·field, coordinate와 unit 해석, adoption mode, placement, override, tool 또는 model version, 설정과 resource budget을 결과와 결속해야 한다. Input order가 의미 없을 때는 정규화하고 의미가 있을 때는 순서를 identity에서 보존해야 한다.

### Element 대응과 변환 사실 {#external-conversion-receipt-mapping}

Source element와 result identity의 대응, split과 merge, transform baking, coordinate·unit·time·color 변환, resample, retarget, material substitution, metadata normalization과 group membership을 기록해야 한다. 아무 변화가 없는 direct placement도 확인한 해석과 적용한 placement를 기록하여 숨은 변환과 구분해야 한다.

### Loss, 근사와 누락 {#external-conversion-receipt-loss}

Unsupported extension, dropped channel, approximated material, reduced precision, changed topology, missing event와 다른 의미 손실은 element별 consequence와 함께 기록해야 한다. 결과가 열리거나 보인다는 이유로 원본 fidelity와 behavior가 보존되었다고 표시하지 않아야 한다.

### 결과 Digest와 Canonical Receipt {#external-conversion-receipt-canonical-result}

Receipt의 의미가 같은 경우 field order, path 표기와 실행 순서의 우연한 차이로 identity가 달라지지 않도록 canonical form과 output digest를 가져야 한다. 의미 있는 source, setting, version 또는 result 차이는 다른 receipt identity가 되어야 한다.

### 외부 생성의 재현성 경계 {#external-generation-reproducibility-boundary}

외부 생성 API와 도구가 같은 request에서 같은 bytes를 보장하지 않으면 AutoMovie의 재현 기준은 request 재실행이 아니라 채택된 output bytes와 receipt의 고정이어야 한다. Prompt, seed와 model label은 provenance이지 bit-identical regeneration의 충분조건이 아니어야 한다.

### Receipt Freshness와 비교 {#external-conversion-receipt-freshness}

Source closure, interpretation, conversion condition 또는 result bytes가 바뀌면 이전 receipt를 current로 재사용하지 않아야 한다. 사용자는 두 revision의 source, 변환, loss와 result 차이를 구분하여 새 결과를 채택하거나 이전 결과를 유지할 수 있어야 한다.
