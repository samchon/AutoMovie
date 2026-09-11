# 외부 자산 식별과 Credential

## 외부 입력 기록 {#external-provenance-rights-contract}

외부 입력은 project가 채택한 bytes, current revision과 이를 사용하는 consumer를 식별할 수 있어야 한다.

### Credential 분리 {#external-credential-separation}

API key, access token, cookie, private key, session과 account secret은 source data, project source, prompt, request 또는 conversion receipt, log, cache metadata, generated artifact와 evidence에 포함되지 않아야 한다. Credential identity나 사용된 account role이 필요하면 비밀값을 재구성할 수 없는 참조만 남기고 최소 권한과 사용자 소유 경계를 유지해야 한다.

### 채택한 자산의 식별 {#external-provenance-source-record}

채택한 자산은 project-relative path와 current digest로 식별하고 형식별 decoder 또는 runtime이 요구하는 technical facts를 제공해야 한다.

### 생성과 취득 Activity {#external-provenance-acquisition-activity}

Generated 또는 transformed input은 사용한 service, model 또는 tool version, user-visible request, prompt와 control, seed, reference input digest, response identity, output digest와 알려진 재현성 한계를 기록할 수 있어야 한다. Credential과 외부 service가 보유한 숨은 state는 provenance에서 분리하고 seed만으로 같은 결과를 보장한다고 주장하지 않아야 한다.

### 개인정보와 민감 Metadata {#external-provenance-sensitive-data}

개인 식별 정보, 정확한 위치, 비공개 repository path, account identity와 source metadata의 민감도를 사용자가 판단하고 보존, redaction 또는 공개 범위를 선택할 수 있어야 한다. Redaction은 공개 receipt에서 비밀을 제거하되 어떤 필드가 의도적으로 비공개인지와 current bytes의 digest 결속을 구분할 수 있어야 한다.

### Derivation과 Consumer 추적 {#external-provenance-derivation-consumers}

채택한 자산과 이를 읽는 production consumer를 연결하고 각 consumer가 읽는 revision을 식별할 수 있어야 한다. 자산 bytes가 교체되면 영향을 받는 consumer와 stale derived artifact를 찾을 수 있어야 한다.
