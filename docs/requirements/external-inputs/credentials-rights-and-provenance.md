# Credential, 권리와 Provenance

## 책임 있는 외부 입력 기록 {#external-provenance-rights-contract}

외부 입력은 어디에서 어떤 권한과 조건으로 얻었고 어떤 활동을 거쳐 current revision이 되었는지 추적할 수 있어야 한다. 기록이 존재한다는 사실을 source claim이나 법적 권리의 진실을 자동 보증하는 것으로 확대하지 않아야 한다.

### Credential 분리 {#external-credential-separation}

API key, access token, cookie, private key, session과 account secret은 source data, project source, prompt, request 또는 conversion receipt, log, cache metadata, generated artifact와 evidence에 포함되지 않아야 한다. Credential identity나 사용된 account role이 필요하면 비밀값을 재구성할 수 없는 참조만 남기고 최소 권한과 사용자 소유 경계를 유지해야 한다.

### Source Provenance {#external-provenance-source-record}

Source URI 또는 repository, provider나 tool identity, creator 또는 publisher claim, acquisition time, original filename 또는 member, format과 version, raw digest와 upstream revision을 알 수 있는 범위에서 기록해야 한다. 알 수 없는 항목은 unknown으로 남기고 그럴듯한 author, license, date나 version을 만들어 넣지 않아야 한다.

### 생성과 취득 Activity {#external-provenance-acquisition-activity}

Generated 또는 transformed input은 사용한 service, model 또는 tool version, user-visible request, prompt와 control, seed, reference input digest, response identity, output digest와 알려진 재현성 한계를 기록할 수 있어야 한다. Credential과 외부 service가 보유한 숨은 state는 provenance에서 분리하고 seed만으로 같은 결과를 보장한다고 주장하지 않아야 한다.

### License와 이용 조건 {#external-rights-license-conditions}

License identifier 또는 원문 위치, attribution, allowed use, modification과 redistribution 조건, 지역·기간·계정 또는 project 제한과 확인 시점을 기록할 수 있어야 한다. 필요한 권리 정보가 없거나 현재 사용과 모순되면 publication 가능한 자산으로 자동 승인하지 않으며, 제품이 법률 판단을 대신했다고 표시하지 않아야 한다.

### 개인정보와 민감 Metadata {#external-provenance-sensitive-data}

개인 식별 정보, 정확한 위치, 비공개 repository path, account identity와 source metadata의 민감도를 사용자가 판단하고 보존, redaction 또는 공개 범위를 선택할 수 있어야 한다. Redaction은 공개 receipt에서 비밀을 제거하되 어떤 필드가 의도적으로 비공개인지와 current bytes의 digest 결속을 구분할 수 있어야 한다.

### Derivation과 Consumer 추적 {#external-provenance-derivation-consumers}

Raw source, normalized input, native reinterpretation, composed asset와 downstream shot 또는 deliverable 사이의 derivation을 추적하고 각 consumer가 읽는 revision을 식별할 수 있어야 한다. Source가 교체되거나 권리 상태가 바뀌면 영향을 받는 consumer와 stale review 또는 publication을 찾을 수 있어야 한다.
