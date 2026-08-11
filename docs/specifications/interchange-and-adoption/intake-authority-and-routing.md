# Intake Authority와 Provider-neutral Routing

## 사용자 승인 Intake Intent {#interchange-intake-authority}

<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-user-choice 사용자가 고른 API, tool, file과 repository를 하나의 명시적 intake intent로 보존한다. -->

Acquisition은 source locator, channel kind, 예상 media family, 요청한 revision 또는 version, 허용된 network authority, 전달할 project input과 사용자 승인 identity를 가진 intake intent에서 시작한다. System은 intent가 정하지 않은 provider, file, repository revision이나 이미 생성된 result를 후보로 추가하지 않는다.

### Channel-independent Source Revision {#interchange-channel-independent-revision}

<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-channel-parity 서로 다른 acquisition channel에서 온 자료에 같은 identity와 검증 의무를 적용한다. -->

API response, tool output, user file와 repository object는 acquisition metadata를 channel-specific envelope에 보존한 뒤 raw bytes 또는 canonical structured payload와 content digest를 가진 공통 source revision으로 봉인된다. Channel이 신뢰 등급을 부여하지 않으며 모든 revision은 같은 closure, validation, provenance와 pinning gate를 통과한다.

### Provider-neutral Dispatch {#interchange-provider-neutral-dispatch}

<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-provider-neutrality Provider 이름과 상업 관계가 dispatch와 fallback을 결정하지 못하게 한다. -->
<!-- @evidence requirements/repaint/providers-models-and-credentials.md#repaint-providers-models-credentials 외부 실행 option을 사용자가 선택한다는 동일한 routing 원칙을 intake 전반에 적용한다. -->

Dispatch는 사용자가 선택한 channel capability와 declared media contract만 비교하며 provider, account tier, catalogue position 또는 상업적 관계를 preference score로 사용하지 않는다. 선택한 option이 unavailable이면 다른 option을 호출하지 않고 실패 상태와 이미 pinned revision의 사용 가능성을 반환한다.

### Outbound Transfer Authorization {#interchange-outbound-transfer-authorization}

<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-transfer-authority 외부 전송의 목적지, payload와 retention을 호출 전에 사용자가 판단하게 한다. -->

Remote acquisition은 final destination authority, redirect policy, 전송되는 input digest와 media role, credential reference, 알려진 retention·region 조건을 authorization record에 결속한 뒤에만 시작한다. Retry와 redirect가 destination, payload 또는 retention boundary를 바꾸면 기존 authorization은 유효하지 않고 새 승인 없이 bytes를 보내지 않는다.

### Untrusted Source Content {#interchange-source-authority-separation}

<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-authority-boundary Source metadata와 embedded instruction이 project authority로 승격되지 않게 한다. -->

Source가 제공한 name, prompt, instruction, link, tag와 metadata는 opaque data 또는 declared schema field로만 전달된다. 이 내용은 intake policy, agent instruction, filesystem path, credential reference, executable action과 후속 network request를 생성할 권한이 없으며 명시적 user-authored decision만 그 경계를 바꿀 수 있다.

### Acquisition Failure Envelope {#interchange-acquisition-failure-envelope}

<!-- @evidence requirements/external-inputs/source-selection-and-provider-neutrality.md#external-source-acquisition-failure Acquisition 실패와 pinned revision의 계속 사용 가능성을 구분한다. -->

Acquisition result는 source intent와 attempt identity, failure class, provider-visible status, partial bytes의 격리 위치, retry 가능 여부와 이전 adopted revision의 availability를 함께 반환한다. Timeout, quota, authentication, refusal, missing source와 invalid response는 empty success나 alternate-source success로 정규화되지 않는다.
