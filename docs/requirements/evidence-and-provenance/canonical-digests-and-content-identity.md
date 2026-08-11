# 결정적 digest와 콘텐츠 정체성

## 같은 내용에 대한 결정적 identity {#integrity-canonical-content-identity}

Digest로 식별하는 내용은 동일한 허용 입력과 동일한 identity 규칙에서 반복 계산할 때 같은 결과를 내야 하며, 사용자는 digest algorithm, 적용 범위, canonicalization 규칙과 dependency closure를 확인할 수 있어야 한다.

### 구조화된 기록의 canonicalization {#integrity-structured-canonicalization}

구조화된 기록은 property 순서, 문자 encoding, number와 string 표현, 경로와 identifier 표현, null 또는 omitted 값의 의미를 고정해야 하며, duplicate key, 비정상 수치, 모호한 encoding과 정규화할 수 없는 입력을 임의로 해석하지 않아야 한다.

### Binary와 dependency closure {#integrity-binary-dependency-closure}

Binary artifact의 identity는 실제 bytes와 algorithm을 식별하고, 외부 buffer, image, font, audio, model, 설정과 다른 필수 dependency가 결과에 영향을 주면 각 dependency의 digest와 closure membership을 포함해야 한다.

### Byte identity와 의미 identity {#integrity-byte-and-semantic-identity}

동일한 의미를 다른 serialization으로 표현할 수 있는 대상은 byte digest와 canonical semantic identity를 구분하고 둘 사이의 관계를 기록해야 하며, 둘 중 하나가 같다는 이유로 다른 하나도 같다고 주장해서는 안 된다.

### Mutable reference와 snapshot {#integrity-mutable-reference-snapshot}

내용이 바뀔 수 있는 URL, branch, latest tag, service response와 외부 collection은 그 이름만으로 current input identity가 될 수 없으며, 고정된 snapshot 또는 검증된 bytes를 연결하거나 reproducible과 verified 판정을 거부해야 한다.

### Algorithm 변경과 충돌 {#integrity-algorithm-change-and-collision}

Digest algorithm이나 canonicalization version을 바꾸면 기존 identity를 덮어쓰지 않고 새 identity와 migration 관계를 기록해야 하며, 충돌, 지원 중단 또는 계산 실패가 발견되면 관련 artifact의 verified 상태를 보류하고 사용자에게 범위를 알려야 한다.
