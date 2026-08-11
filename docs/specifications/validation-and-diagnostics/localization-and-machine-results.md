# Localization과 기계 판독 결과

## 정규 의미와 Display Message {#validation-message-semantics}

<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-message-semantic-separation 번역 가능한 설명과 자동 판정의 정규 의미를 분리한다. -->

Diagnostic의 정규 identity, classification, severity, location, scope, cause parameter, correction action과 outcome은 locale-neutral data다. Display message는 이 data와 message template identity에서 파생되며 자동화가 message text, 어순이나 punctuation을 parsing하여 판정하지 않는다.

Template 변경은 diagnostic 의미를 바꾸지 않지만 cause나 correction 의미의 변경은 diagnostic 또는 compatibility version을 바꾼다. 결과는 사용한 template 및 locale identity를 남겨 같은 정규 레코드의 서로 다른 표시를 구분한다.

### 기계 판독 Result Envelope {#validation-machine-result-envelope}

<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-machine-readable-result identity, 분류, 위치, 원인, 교정과 완전성을 자유 문구 없이 소비하게 한다. -->

Machine result는 schema와 semantic version, session과 input identity, effective policy, requested 및 checked scope, collection mode, budget accounting, completeness, overall outcome, ordered diagnostic records와 artifact state를 canonical field로 제공한다. Cause와 correction의 핵심 값은 typed parameter, unit, relation과 action identity로 표현하고 message만 가진 필수 의미를 두지 않는다.

Serialization은 같은 정규 result에서 stable field presence, list order, number와 string encoding을 제공한다. Consumer가 모르는 required classification, severity 또는 compatibility major version을 받으면 fail-closed로 incompatible을 보고하고, 모르는 optional field는 보존하거나 무시하되 success 의미를 확대하지 않는다.

### Locale 선택과 Fallback {#validation-locale-fallback}

<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-locale-fallback 요청 locale과 실제 표시 locale 및 fallback을 결과에 남긴다. -->

Display input은 requested locale, 허용 fallback chain과 message catalogue version을 가진다. Result는 requested locale, resolved locale와 fallback 여부를 기록하고 번역이 없을 때 정규 data를 유지한 채 선언된 fallback만 사용한다.

일부 parameter의 internal identity는 번역하지 않고 localized label과 함께 제공할 수 있다. Mixed-language fallback은 어느 token이 stable identity이고 어느 문구가 설명인지 구분하며, 번역 누락을 message omission이나 diagnostic omission으로 바꾸지 않는다.

### 값, 단위와 시간 Formatting {#validation-canonical-value-format}

<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-value-unit-time-format locale별 표시가 수치, 단위, 좌표와 시간의 정규 의미를 바꾸지 않게 한다. -->

Canonical value는 finite 여부, numeric magnitude, unit, coordinate 또는 clock identity, precision과 interval boundary를 locale-neutral form으로 보존한다. Display formatter만 decimal separator, digit grouping, localized unit label과 time-zone 표현을 바꿀 수 있고 원래 값과 converted display value를 구분한다.

Frame, rational rate, sample index와 film time은 exact relation을 유지하고 wall-clock timestamp와 섞지 않는다. Rounding이 허용될 때는 display precision을 명시하며 acceptance comparison은 display string이 아닌 canonical value로 수행한다.

### 접근 가능한 Diagnostic Presentation {#validation-accessible-diagnostic-presentation}

<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-accessible-presentation 색상이나 아이콘 없이도 순서, 상태, 원인과 교정을 같은 의미로 전달한다. -->

Presentation은 severity와 status의 text label, heading hierarchy, occurrence order, target과 location description, cause와 correction relation을 보조 기술이 읽을 수 있는 순서로 제공한다. Color, icon, animation 또는 sound는 보조 cue일 뿐 유일한 상태 표현이 아니다.

Aggregated occurrence와 nested cause는 펼치지 않아도 count와 highest severity를 알 수 있고 펼치면 각 occurrence를 독립적으로 탐색할 수 있어야 한다. Truncated와 redacted 상태도 접근 가능한 text와 machine field에 동일하게 나타난다.

### 안전한 Localized Export {#validation-safe-localized-export}

<!-- @evidence requirements/diagnostics/localization-and-machine-results.md#diagnostics-safe-localized-export locale과 export format 변화가 redaction을 우회하지 않게 한다. -->

Export는 정규 result에 redaction policy를 먼저 적용한 뒤 허용된 field만 machine format과 localized presentation으로 변환한다. Translation catalogue, fallback template, accessibility label과 debug representation 어느 것도 protected raw value를 다시 읽거나 삽입하지 않는다.

Export format은 schema version, encoding, locale와 redaction profile을 선언하고 같은 result identity와 diagnostic order를 유지한다. Lossy format은 생략한 field와 machine round-trip 불가를 명시하며 complete machine result로 표시하지 않는다.
