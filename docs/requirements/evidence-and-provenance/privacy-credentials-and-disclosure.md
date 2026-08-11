# 개인정보, credential과 공개 경계

## 필요한 정보만 남기는 증거 {#privacy-data-minimization}

Evidence와 provenance는 검토, 재현, 권리 확인과 책임 추적에 필요한 최소 정보만 수집하고, 각 정보의 목적, 공개 범위, 보존 조건과 접근 주체를 사용자가 확인할 수 있게 해야 한다.

### Credential 제외 {#privacy-credential-omission}

API key, access token, password, cookie, private key, session secret와 credential이 포함된 URI 또는 header는 source, prompt, error, log, receipt, manifest, artifact metadata와 exported evidence에 기록해서는 안 되며, 발견 시 노출 범위와 폐기 또는 교체 필요성을 알려야 한다.

### 사람 identity와 가명 {#privacy-human-identity-and-pseudonym}

사람의 판단과 행위는 필요한 책임과 권한을 추적할 수 있어야 하지만 법적 이름, 연락처, 계정 identifier와 위치를 불필요하게 공개해서는 안 되며, 승인된 pseudonym이나 role로 기록할 때 접근 권한이 있는 범위에서만 실제 주체와 연결할 수 있어야 한다.

### 민감한 metadata {#privacy-sensitive-metadata}

Local path, username, host, 위치와 촬영 시각, prompt, embedded document property와 reference metadata가 개인이나 비공개 제작 정보를 드러낼 수 있음을 표시하고, public view에서는 정책에 따라 제거, 일반화 또는 대체해야 한다.

### 외부 service 전송 {#privacy-external-service-disclosure}

자료가 외부 provider로 전송되기 전에 사용자는 전송 대상, data 범위, 목적, provider retention과 재사용 조건, 적용되는 계정 또는 조직 경계를 확인하고 허용 여부를 결정할 수 있어야 한다.

### Redaction과 원본 관계 {#privacy-redaction-and-source-relation}

Redacted evidence는 새 revision으로 식별하고 제거하거나 대체한 field 종류와 이유를 표시하되 민감한 값을 되살릴 정보를 공개해서는 안 되며, 권한 있는 검토자는 정책이 허용하는 범위에서 원본 record와의 관계와 redaction의 완전성을 판정할 수 있어야 한다.

### 삭제 요청과 계보 보존 {#privacy-erasure-and-lineage}

개인정보 또는 비밀정보를 삭제해야 할 때는 복구 가능한 값을 보존하지 않는 tombstone이나 disposal record로 계보의 공백과 삭제 사유를 설명하고, privacy 의무를 이유로 삭제된 content를 digest, preview 또는 backup에 계속 노출해서는 안 된다.
