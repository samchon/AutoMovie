# Refresh, Version Pinning과 Offline

## 작품이 읽는 Revision의 고정 {#external-version-pinning}

채택된 외부 입력은 mutable URL, latest model, moving branch, current API response 또는 local path의 현재 내용이 아니라 정확한 bytes, dependency closure와 해석 revision으로 고정되어야 한다. 작품을 다시 열거나 render하는 행위만으로 더 새로운 외부 결과가 current revision을 바꾸지 않아야 한다.

### Provider와 Tool Version Pinning {#external-provider-tool-version-pinning}

외부 service, model, dataset, schema와 tool의 version을 식별할 수 있으면 source revision과 함께 고정해야 한다. Provider가 version을 공개하지 않거나 내부 동작이 변할 수 있으면 그 제한을 unknown 또는 non-reproducible acquisition으로 기록하고 숨은 고정성을 주장하지 않아야 한다.

### 명시적 Refresh {#external-explicit-refresh}

Refresh는 사용자가 선택한 source를 다시 조회하거나 새 file을 제시하는 명시적 작업이어야 하며, 새 raw digest와 closure를 이전 revision과 비교한 뒤 별도 후보로 만들어야 한다. Timestamp나 filename만 바뀐 경우와 실제 content가 바뀐 경우를 구분하고 새 후보를 자동 채택하지 않아야 한다.

### 변경 영향과 Stale 상태 {#external-refresh-impact-staleness}

Source element, coordinate, unit, duration, skeleton, license, dependency와 adopted result가 바뀌면 영향받는 reinterpretation, composition, shot, render, review와 publication을 식별해야 한다. 이전 receipt와 evidence는 삭제하지 않고 어느 revision에 대해서만 유효한지 stale 상태를 표시해야 한다.

### Offline-ready 입력 {#external-offline-ready-inputs}

사용자는 채택된 bytes와 허용된 dependency closure를 network 없이 다시 검증하고 사용할 수 있는 offline-ready 상태로 고정할 수 있어야 한다. 권리나 크기 때문에 closure를 보존하지 못한 입력은 offline-ready로 표시하지 않고 필요한 external dependency와 복원 조건을 드러내야 한다.

### Cache의 Identity와 신뢰 {#external-cache-identity-trust}

Cache entry는 source revision, closure, interpretation과 result digest로 식별하고 path나 최근 사용 순서만으로 current input과 일치한다고 판단하지 않아야 한다. Digest mismatch, incomplete entry, 다른 credential scope와 stale conversion을 cache hit로 사용하지 않아야 한다.

### Cache Miss와 Source 부재 {#external-cache-miss-unavailable-source}

Offline 상태의 cache miss, 폐쇄된 account, 삭제된 source와 unavailable provider는 current revision을 다른 자료로 채우지 않고 unavailable로 보고해야 한다. 사용자 승인과 검증 없이 network에서 비슷한 이름의 자료를 다시 받거나 더 최신 revision으로 승격하지 않아야 한다.
