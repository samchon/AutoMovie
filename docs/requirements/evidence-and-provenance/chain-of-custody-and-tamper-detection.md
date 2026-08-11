# 인계 연쇄와 위변조 탐지

## 보관과 인계의 추적 {#custody-chain-traceability}

검증, 승인 또는 게시 판단에 사용한 source, artifact와 evidence가 생성, 복사, 반입, 반출, 게시 또는 보관 위치를 이동할 때 사용자는 인계 전후 identity, 송신자와 수신자 또는 실행 주체, 시점, 방법, 목적과 무결성 확인 결과를 추적할 수 있어야 한다.

### 경계별 무결성 확인 {#custody-boundary-integrity-check}

외부 반입, process 간 전달, cache 복원, archive 회수와 publication 경계에서는 기대 digest와 실제 bytes를 비교하고, 불일치, 누락, 중복 또는 예상하지 않은 dependency를 어느 경계에서 발견했는지 기록해야 한다.

### 변경을 드러내는 기록 {#custody-tamper-evident-history}

확정된 custody와 provenance 기록의 수정, 삭제, 삽입 또는 순서 변경은 탐지 가능해야 하며, 정정은 원기록을 조용히 바꾸는 대신 작성자, 이유와 시점을 가진 새 기록으로 이전 기록을 supersede해야 한다.

### Signature와 attestation의 경계 {#custody-signature-attestation-boundary}

Signature 또는 attestation을 제시할 때는 결속된 bytes나 record, signer identity와 신뢰 근거, algorithm, 검증 시점과 결과를 보여야 하며, 유효한 signature가 기록 내용의 사실성, 저작권 보유 또는 작품 품질까지 증명한다고 주장해서는 안 된다.

### Custody 공백과 격리 {#custody-gap-and-quarantine}

필수 인계 기록, parent, digest 또는 권한을 확인할 수 없는 artifact는 공백의 범위와 마지막 정상 지점을 표시하고 verified chain에서 격리해야 하며, 나중에 기록을 보충하면 누가 어떤 근거로 해소했는지 남겨야 한다.

### 배포 사본의 검증 {#custody-distributed-copy-verification}

사용자는 전달 묶음, offline media와 remote copy를 원본 publication identity와 대조할 수 있어야 하며, filename, 저장 위치 또는 전송 성공 메시지만으로 동일한 사본이라고 판정해서는 안 된다.
