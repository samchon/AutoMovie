# 생성, 변환과 Derivation

## Derivation activity boundary {#evp-derivation-activity-boundary}

### Generated output receipt {#evp-generated-output-receipt}

<!-- @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-generation-transformation-history 생성, 변환, 선택, 결합과 게시 단계를 독립 activity와 output identity로 정밀화한다. -->

각 생성, 변환, 선택, composition과 publication은 하나의 attempt identity, ordered input set, effective settings, actor roles와 output set을 가져야 한다. 한 activity의 output은 그 activity completion에만 연결되고 여러 단계를 한 receipt로 압축하여 중간 parent와 loss를 숨겨서는 안 된다.

Activity graph는 downstream entity에서 모든 contributing input까지 역방향으로 탐색 가능해야 한다. Unknown activity type이나 missing parent를 만나면 graph를 보존하되 complete derivation 판정을 중단해야 한다.

<!-- @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-generated-output-record 규칙 기반 또는 생성형 output의 provider, model, 입력, control, terms와 digest를 결속한다. -->

생성 activity 입력은 generator 또는 provider identity, model과 exact version, execution boundary, ordered references, prompt 또는 declaration, controls, optional seed와 terms revision이다. 출력 receipt는 request identity, raw output identities, adopted output identities, 각 digest, outcome과 provider가 제공한 invocation reference를 포함해야 한다.

Credential, 숨은 service state와 확인하지 못한 default는 receipt payload에 넣지 않고 unknown boundary로 표시해야 한다. Model version, source digest 또는 output digest 같은 필수 identity가 없으면 adopted current output을 만들지 않아야 한다.

### Nondeterministic attempt model {#evp-nondeterministic-attempt-model}

<!-- @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-nondeterministic-generation 같은 request의 retry와 variant를 독립 output으로 보존하고 재현성 한계를 명시한다. -->

Retry, reroll과 variant는 request relation을 공유할 수 있지만 각각 새 attempt, raw output와 outcome identity를 가져야 한다. Reproducibility field는 bit-identical, conditionally reproducible 또는 non-reproducible 중 하나와 그 판정에 필요한 pinned conditions를 포함해야 한다.

같은 seed와 prompt만으로 bit-identical을 선언할 수 없고, discarded candidate는 bytes를 retention 정책에 따라 폐기하더라도 existence, attempt status와 disposal relation을 남겨야 한다. Transport retry가 같은 provider execution을 재조회한 경우와 새 생성 실행을 구분하지 못하면 별도 attempt로 취급해야 한다.

### Transformation mapping과 loss {#evp-transformation-mapping-and-loss}

<!-- @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-transformation-record 형식·좌표·단위·시간·material 변환의 element mapping, 근사와 손실을 기록한다. -->

Transformation 입력은 source revisions, transformer identity와 version, normalized settings, selection과 resource budget이다. 출력은 result revisions, source-to-result element mapping, split, merge, order, coordinate·unit·time·color conversion, resample, retarget, compression과 metadata change를 포함해야 한다.

Unsupported, omitted, approximated와 lossy element는 consequence와 함께 result별로 출력해야 한다. Mapping 충돌, 설정 모호성, budget 초과와 declared result digest 불일치는 transformation을 invalid 또는 partial로 만들고 fidelity-preserving 성공으로 표시해서는 안 된다.

### Selection과 composition record {#evp-selection-composition-record}

<!-- @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-selection-and-composition 후보 선택, 제외와 조합의 사람 또는 agent 결정을 별도 derivation activity로 만든다. -->

Selection 입력은 candidate identities, common basis, selection criterion, decision actor와 selected 또는 excluded ranges다. Composition 입력은 ordered members, roles, local relation, override와 precedence이며 출력 entity는 모든 contributing member와 decision record를 참조해야 한다.

선택하지 않은 candidate의 상태를 selected output에 섞거나 composition이 원본을 물리적으로 병합한 것으로 가장해서는 안 된다. 같은 member set이라도 의미 있는 order, role 또는 override가 다르면 별도 output identity여야 한다.

### Reverse impact index {#evp-derivation-reverse-impact-index}

<!-- @evidence requirements/evidence-and-provenance/generation-transformation-and-derivation.md#provenance-derivation-impact input, rule 또는 output 변경이 영향을 주는 consumer와 evidence를 정확히 찾는다. -->

시스템은 entity와 activity relation에서 reverse dependency index를 계산하여 변경된 revision의 direct 및 transitive consumer, review와 publication을 출력해야 한다. 영향 판정은 identity와 실제 edge에 근거하고 이름, path 유사성 또는 같은 batch에 있었다는 사실만 사용해서는 안 된다.

영향받은 current record는 stale 후보가 되고 영향 없는 sibling은 기존 identity를 유지해야 한다. 새 relation kind를 모르는 이전 indexer는 영향 없음으로 단정하지 않고 incomplete impact result를 반환해야 한다.
