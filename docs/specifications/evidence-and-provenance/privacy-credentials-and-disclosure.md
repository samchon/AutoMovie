# Privacy, Credential과 Disclosure

## Data classification과 disclosure profile {#evp-data-classification-disclosure}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-data-minimization evidence와 provenance가 목적에 필요한 최소 정보만 수집하도록 classification과 disclosure 경계를 정의한다. -->

Record field와 attached artifact는 public, restricted, confidential 또는 secret classification, collection purpose, retention class와 permitted actor roles를 가져야 한다. Disclosure 요청은 destination profile과 requester authority를 입력받아 허용 field, redacted field와 refused field를 출력하고 목적에 필요하지 않은 값은 처음부터 수집하지 않아야 한다.

알 수 없는 field와 새 schema field는 가장 제한적인 적용 가능한 class로 처리해야 한다. Classification이나 purpose가 없으면 public export를 거부하고 누락을 diagnostic으로 반환해야 한다.

### Credential exclusion gate {#evp-credential-exclusion-gate}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-credential-omission credential과 secret이 source, prompt, log, receipt, metadata와 exported evidence에 들어가지 못하게 한다. -->

Ingestion과 export boundary는 API key, access token, password, cookie, private key, session secret, authorization header와 credential-bearing URI를 금지 field와 known secret reference로 검사해야 한다. 실행에 credential이 필요하면 secret store의 opaque handle과 permitted execution boundary만 입력으로 받고 secret value를 evidence payload에 복사하지 않아야 한다.

Secret이 발견되면 record publication을 거부하고 affected artifact와 copy 범위, detection time와 rotation 또는 disposal requirement를 secret 원문 없이 출력해야 한다. Redaction 뒤에도 원문 digest, preview, exception text와 backup이 credential을 복구할 수 있으면 성공으로 판정하지 않아야 한다.

### Human identity pseudonymization {#evp-human-identity-pseudonymization}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-human-identity-and-pseudonym 책임과 권한을 보존하면서 사람의 불필요한 identity 공개를 제한한다. -->

Human actor 입력은 public pseudonym, role, authority scope와 restricted identity mapping을 분리해야 한다. Public record는 판단의 책임과 authority를 확인하는 데 필요한 pseudonym과 role만 출력하고 법적 이름, 연락처, account와 location은 명시적 purpose와 permission이 있을 때만 restricted view에 포함해야 한다.

Pseudonym collision, expired mapping과 authority 불명은 judgment attribution을 ambiguous로 만든다. Mapping을 볼 수 없는 reader도 동일 actor의 authorized pseudonym continuity는 검증할 수 있어야 하지만 실제 identity를 추정할 수 있어서는 안 된다.

### Sensitive metadata filtering {#evp-sensitive-metadata-filtering}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-sensitive-metadata local path, host, 위치, 시간, prompt와 embedded metadata의 공개 위험을 통제한다. -->

Metadata classifier는 absolute path, username, host, device, precise location과 capture time, prompt, document property, EXIF-like field와 private locator를 field 단위로 분류해야 한다. Public output은 destination policy에 따라 remove, generalize 또는 tokenize하고 어떤 category를 처리했는지 disclosure summary로 출력해야 한다.

Display locale이나 export format 변경이 filtered field를 원문으로 되돌려서는 안 된다. 분류할 수 없는 embedded metadata가 있으면 공개를 보류하거나 opaque attachment 전체를 restricted로 처리해야 한다.

### External transfer authorization {#evp-external-transfer-authorization}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-external-service-disclosure 외부 provider 전송 전에 대상, data, 목적, retention과 재사용 조건에 대한 선택을 기록한다. -->

Transfer plan 입력은 provider와 execution boundary, account 또는 organization scope, exact data inventory, purpose, expected output, network route, known retention과 reuse terms revision이다. Authorization output은 approved, rejected, expired 또는 needs-decision 상태, approving authority, approved data scope와 expiry를 포함해야 한다.

Plan과 실제 payload가 다르거나 terms가 바뀌면 전송을 거부하고 새 authorization을 요구해야 한다. 한 provider의 실패는 다른 provider로의 자동 transfer authority가 되지 않는다.

### Redaction derivative {#evp-redaction-derivative}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-redaction-and-source-relation redacted evidence를 원본과 결속된 별도 revision으로 만들고 민감 값 복원을 막는다. -->

Redaction 입력은 source record revision, disclosure profile, selected field categories, technique, authority와 reason이다. 출력은 별도 redacted revision, source relation, redaction manifest와 verification result를 가지며 removed value 자체나 reversible token을 public payload에 포함하지 않아야 한다.

Verifier는 필수 public identity와 lineage relation이 남고 금지 field가 payload, attachment, preview와 metadata에 없음을 확인해야 한다. Source가 바뀌면 redacted revision은 stale이며 기존 redaction manifest를 재사용하지 않아야 한다.

### Erasure tombstone {#evp-erasure-tombstone}

<!-- @evidence requirements/evidence-and-provenance/privacy-credentials-and-disclosure.md#privacy-erasure-and-lineage 삭제 의무를 수행하면서 복구 가능한 민감 값을 남기지 않는 tombstone과 disposal relation을 정의한다. -->

Erasure 입력은 exact subject와 copy scope, legal 또는 policy basis, authority와 required completion time이다. 출력 tombstone은 non-content-bearing identity, erased categories, disposal activity ids, time, remaining inaccessible 또는 failed copies와 lineage gap reason만 포함해야 한다.

Secret이나 personal data를 dictionary attack으로 확인할 수 있는 digest, preview, reversible encryption과 backup을 tombstone에 남겨서는 안 된다. 과거 public view와 derivative가 제거되지 않았으면 erasure를 complete로 표시하지 않고 partial 또는 failed 범위를 출력해야 한다.
