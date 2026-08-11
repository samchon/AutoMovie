# Custody와 Tamper Detection

## Custody ledger boundary {#evp-custody-ledger-boundary}

### Boundary integrity receipt {#evp-custody-boundary-receipt}

<!-- @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-chain-traceability 검증, 승인 또는 게시에 쓰인 artifact의 생성과 인계를 append-only custody ledger로 구체화한다. -->

Custody event 입력은 artifact identity와 revision, event kind, sender와 receiver 또는 operator role, source와 destination boundary, event time, purpose와 pre-transfer verification이다. 출력 event는 post-transfer identity와 verification result를 포함하고 previous event를 참조하며, copy와 ownership transfer를 같은 의미로 기록하지 않아야 한다.

Ledger는 artifact별 ordered event chain과 각 chain head의 immutable identity를 제공해야 한다. Verifier는 이전에 받아들인 terminal head 또는 독립적으로 보관된 최신 checkpoint를 expected identity로 받아야 하며, expected identity가 없는 chain은 제시된 범위의 내부 연속성만 증명하고 마지막 event 뒤의 삭제 여부를 verified로 판정하지 않아야 한다. Actor, boundary, time 또는 digest가 없는 event는 incomplete이며 verified custody 계산에 참여할 수 없다.

<!-- @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-boundary-integrity-check 반입, 전달, 복원과 publication 경계마다 expected identity와 actual bytes를 비교한다. -->

각 boundary receipt는 expected artifact와 dependency closure, captured source snapshot, destination snapshot, bytes readback, expected와 actual digest, member count와 unexpected member를 입력과 출력으로 결속해야 한다. Verification은 전송 전과 후의 identity가 같아야 하는 copy인지 declared transformation으로 달라져야 하는지 구분해야 한다.

Mismatch, missing, duplicate, undeclared dependency와 readback failure는 event를 failed 또는 partial로 만들며 successor가 생겼더라도 verified chain으로 연결하지 않아야 한다. 독립 artifact의 valid receipt는 보존할 수 있다.

### Tamper-evident correction chain {#evp-tamper-evident-correction-chain}

<!-- @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-tamper-evident-history 확정 record의 수정, 삭제, 삽입과 순서 변경을 탐지하고 정정을 새 record로 남긴다. -->

각 ledger record는 canonical payload digest와 predecessor identity를 결속하고 chain index 또는 equivalent ordering proof를 가져야 한다. 검증기는 expected head 또는 checkpoint와 actual chain을 대조하여 record mutation, missing predecessor, duplicate successor, insertion, reorder와 truncation을 탐지하고 first divergent event와 affected tail을 출력해야 한다.

정정은 original id, corrected id, correction reason, author와 time을 가진 supersede event로만 허용한다. Tamper-evident는 변경 탐지 능력이며 storage compromise 예방이나 payload claim의 진실을 자동 증명한다고 표시해서는 안 된다.

### Signature verification boundary {#evp-signature-verification-boundary}

<!-- @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-signature-attestation-boundary signature와 attestation이 결속하는 bytes, signer, algorithm과 trust result를 명시한다. -->

Signature verification 입력은 signed bytes 또는 manifest identity, signature bytes, algorithm과 parameters, signer claim, trust material과 verification time이다. 출력은 valid, invalid, unsupported, revoked, expired 또는 indeterminate result와 실제 검증한 identity를 포함해야 한다.

Signer claim과 trusted signer, signature 존재와 verification success를 구분해야 한다. Valid result는 bytes binding만 증명하며 사실성, 저작권, 작품 품질과 actor authority는 별도 claim과 judgment 없이는 승인하지 않아야 한다.

### Custody quarantine state {#evp-custody-quarantine-state}

<!-- @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-gap-and-quarantine 필수 custody gap을 마지막 정상 지점과 함께 격리하고 근거 있는 해소를 기록한다. -->

Gap detector는 missing event, parent, digest, actor authority 또는 boundary receipt를 찾아 artifact revision을 quarantined 상태로 전환하고 last verified event, gap kind와 affected use를 출력해야 한다. Quarantined bytes는 inspection과 recovery에만 쓸 수 있고 approval 또는 publication input이 될 수 없다.

Gap resolution은 recovered evidence, resolver authority, verification과 time을 가진 새 activity다. Resolution이 실패하거나 candidate가 여러 개면 quarantine을 유지하고 최근 candidate를 자동 선택하지 않아야 한다.

### Distributed copy verification {#evp-distributed-copy-verification}

<!-- @evidence requirements/evidence-and-provenance/chain-of-custody-and-tamper-detection.md#custody-distributed-copy-verification 전달 묶음, offline media와 remote copy를 publication identity에 대조한다. -->

Copy verifier는 publication manifest identity, expected closure와 destination에서 다시 읽은 bytes를 입력받아 per-member identity, missing, extra, corrupt와 inaccessible 결과를 출력해야 한다. Filename, URL, object version label과 transfer success는 bytes verification을 대신할 수 없다.

Remote readback을 허용하지 않는 destination은 unverified-remote-copy 상태와 확인 불가 범위를 반환해야 한다. 이후 readback은 새 verification event이며 이전 unavailable 결과를 덮어쓰지 않아야 한다.
