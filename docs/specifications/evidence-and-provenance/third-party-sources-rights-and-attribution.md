# Third-party Source, Rights와 Attribution

## Third-party source ledger {#evp-third-party-source-ledger}

<!-- @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-source-record 채택한 외부 자료의 제공자, creator claim, 취득 시점, fixed bytes와 consumer를 source ledger로 정밀화한다. -->

Source record 입력은 source kind, authoritative 또는 claimed locator, provider, creator와 publisher claim, acquisition time, original member identities, fixed snapshot 또는 bytes digest, media facts와 adopting consumer identity다. 출력은 source revision과 acquisition activity를 연결하고 original, mirror, generated와 transformed source를 구분해야 한다.

Locator, creator 또는 publisher를 알 수 없으면 unknown으로 보존하고 fabricated value를 넣지 않아야 한다. 같은 content를 다른 권리 또는 acquisition으로 얻으면 content digest를 공유하더라도 source revision을 별도로 유지해야 한다.

### Rights evaluation {#evp-third-party-rights-evaluation}

<!-- @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-rights-and-terms license, permission, attribution과 이용 제한을 source revision과 사용 목적에 대해 평가한다. -->

Rights input은 license identifier 또는 text locator, permission evidence, terms version과 checked time, intended use, modification, distribution, territory, duration, account와 project scope다. 출력은 permitted, restricted, expired, conflicting, unknown 또는 requires-human-legal-review 상태와 unmet obligations를 포함해야 한다.

System은 규칙 일치와 기록 완전성을 판정할 수 있지만 법률 자문이나 실제 권리 소유를 보증한다고 표시해서는 안 된다. Required terms가 없거나 intended use와 충돌하면 publication approval을 만들지 않아야 한다.

### Attribution propagation closure {#evp-attribution-propagation-closure}

<!-- @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-attribution-propagation attribution, notice와 license copy를 derivation과 delivery closure에 전파한다. -->

Attribution obligation은 source identity, required text 또는 document, placement or delivery condition과 affected derivative roles를 포함해야 한다. Propagator는 derivation graph와 delivery manifest를 입력받아 destination별 required attribution set, satisfied item, missing item과 source relation을 출력해야 한다.

여러 source의 obligation을 합치더라도 각 notice의 origin을 보존해야 한다. Transformation이나 composition이 source relation을 끊거나 unsupported obligation을 drop하면 delivery rights state를 incomplete 또는 conflicting으로 만들어야 한다.

### Generated provider provenance {#evp-generated-provider-provenance}

<!-- @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-generated-source 외부 생성 service의 model, request, reference, terms와 raw 및 adopted output을 provenance로 결속한다. -->

Generated source는 provider, exact model 또는 unknown-version state, execution boundary, request identity, prompt 또는 instruction digest, ordered references, controls, terms revision, raw output와 adopted output identities를 포함해야 한다. Fetch된 original과 generated acquisition은 서로 배타적인 source mode이며 transformation 뒤에는 별도 derived entity를 만들어야 한다.

Provider claim에 없는 copyright, exclusivity, training-source cleanliness와 reproducibility를 inferred fact로 출력해서는 안 된다. Credential은 source provenance에 포함하지 않고 secret execution boundary에서만 사용해야 한다.

### Source와 terms change impact {#evp-source-terms-change-impact}

<!-- @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-source-change-and-withdrawal source, license, permission과 provider terms 변경 또는 철회의 영향을 찾는다. -->

Refresh 입력은 prior source와 rights revisions, newly observed source 또는 terms, checked time와 change reason이다. Impact output은 changed facts, affected assets, derivatives, publications, approvals와 replacement 또는 withdrawal action을 relation별로 제공해야 한다.

Mutable terms의 latest page를 과거 acquisition에 소급 적용하거나 이전 approval을 자동 유지해서는 안 된다. Change relevance를 확정할 수 없으면 affected consumer를 current-safe로 분류하지 않고 human review required로 반환해야 한다.

### Restricted source verification {#evp-restricted-source-verification}

<!-- @evidence requirements/evidence-and-provenance/third-party-sources-rights-and-attribution.md#third-party-source-access-restriction 원본을 배포할 수 없는 source의 제한 사유, custody와 허용된 verification 경로를 표현한다. -->

Restricted source record는 restriction basis, custodian, access role, verification method, fixed identity와 allowed disclosure summary를 포함해야 한다. Authorized verifier는 원본 bytes를 공개하지 않고 identity와 rights evidence의 존재, scope와 freshness를 판정한 attestation을 출력할 수 있어야 한다.

원본에 접근하지 못한 reader는 source absent와 restricted를 구분하고 independent verification을 완료했다고 표시해서는 안 된다. Restriction schema나 verification method를 지원하지 않으면 public consumer는 unverifiable로 처리해야 한다.
