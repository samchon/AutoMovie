# 미지원 입력과 명시적 Degradation

## 지원 한계의 정직한 표현 {#external-unsupported-degradation}

외부 입력의 format, version, feature, dependency와 intended use마다 supported, supported with declared degradation, unsupported, invalid, unavailable, quarantined와 not-run을 구분해야 한다. File을 일부 읽었거나 frame에 무언가 나타났다는 사실을 전체 입력의 성공으로 확대하지 않아야 한다.

### Format과 Feature 지원의 분리 {#external-unsupported-format-feature}

Container나 document format을 읽을 수 있어도 그 안의 모든 extension, codec, material, rig, animation, channel, schema와 semantic relationship을 지원한다고 주장하지 않아야 한다. 지원 범위는 실제 선택된 element와 consumer 목적까지 좁혀 판단해야 한다.

### Hard Failure 조건 {#external-unsupported-hard-failure}

Required dependency 누락, digest mismatch, identity ambiguity, invalid coordinate 또는 time basis, credential 노출, 권리 상태 충돌, budget 초과와 안전하지 않은 active content는 선택한 결과를 신뢰할 수 없게 만들면 채택을 중단해야 한다. 실패를 origin object, generic mesh, black frame, silence 또는 빈 metadata로 몰래 완성하지 않아야 한다.

### 사용자가 선택하는 Degradation {#external-user-chosen-degradation}

원본의 비필수 feature만 지원하지 않을 때 사용자는 feature 제거, bounded approximation, proxy 또는 placeholder, native reinterpretation과 source 교체 중 허용할 대응을 선택할 수 있어야 한다. 각 degradation은 적용 전에 consequence를 드러내고 receipt와 current status에 남으며 다른 source나 provider를 자동 선택하지 않아야 한다.

### 부분 채택의 경계 {#external-partial-adoption-boundary}

일부 scene, stream, track, layer 또는 field만 안전하고 완전하게 닫힐 때 그 subset을 독립 identity로 채택할 수 있어야 한다. 선택된 subset이 제외한 dependency를 실제로 읽지 않는지 검증하고, 제외된 요소와 behavior를 보존했다고 주장하지 않아야 한다.

### Placeholder와 최종 결과의 구분 {#external-placeholder-final-boundary}

Offline proxy, diagnostic material, static pose, muted source, missing-media marker와 다른 placeholder는 저작과 검토를 계속하기 위한 명시적 상태로 사용할 수 있지만 accepted final input 또는 검증된 fidelity로 표시하지 않아야 한다. Placeholder가 timing, bounds, identity와 downstream decision에 미치는 차이를 확인할 수 있어야 한다.

### 외형과 의미의 경계 {#external-fidelity-semantic-boundary}

High-detail model, realistic image나 정교한 motion을 가져올 수 있다는 사실은 AutoMovie가 그 detail을 저작·수정하거나 rig constraint, collision, physical behavior, likeness와 권리 상태를 이해한다는 뜻이 아니다. Direct placement가 보존한 외형, native reinterpretation이 실제로 만든 의미와 unsupported semantic layer를 구분해야 한다.

### 지원 축소와 호환성 {#external-support-regression-compatibility}

이전에 채택된 revision의 feature가 이후 환경에서 지원되지 않으면 기존 pinned result를 조용히 다르게 해석하지 않아야 한다. 가능한 이전 해석 조건, migration 후보, explicit degradation 또는 unsupported 상태를 제시하고 사용자 승인 뒤에만 current result를 바꿔야 한다.
