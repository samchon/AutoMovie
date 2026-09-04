# Evidence, Freshness와 완결성

## Verdict Evidence 집합 {#acceptance-system-evidence-set}

### 수치 Evidence {#acceptance-system-numeric-evidence}

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-evidence-sufficiency Requires evidence kind and scope to match each criterion obligation. -->

각 criterion verdict는 required evidence specification과 actual evidence set을 가지며 evidence identity, subject, scope, context, observation, producer와 freshness를 보존한다. Evidence가 존재한다는 사실과 criterion을 판정하기에 충분하다는 사실을 분리한다.

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-numeric-evidence Requires measured values, units, samples, aggregation, tolerance and comparison result. -->

수치 evidence는 actual measured values, 단위와 basis, 표본 위치, 집계값, tolerance, uncertainty와 comparison result를 가진다. 평균값은 별도 최대 위반이나 tail risk를 숨기지 않고 planned parameter를 measurement로 표시하지 않는다.

### 구조 Evidence {#acceptance-system-structural-evidence}

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-structural-evidence Requires identities, relations, order, coverage, state and omissions rather than counts alone. -->

구조 evidence는 target identity, relation, order, coverage, state와 missing item을 재구성할 수 있어야 한다. Summary count는 연결 대상과 relation correctness를 잃으면 required structural evidence가 아니다.

### 지각 Evidence {#acceptance-system-perceptual-evidence}

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-perceptual-evidence Binds actual pixels or decoded audio to target, time, view, pass and presentation. -->

지각 evidence는 actual current pixels 또는 decoded audio, artifact identity, time, view, pass, presentation context와 observed feature를 결속한다. Still frame은 motion과 sync를, structural pass는 beauty appearance를 대신 증명하지 않는다.

### 의미 Evidence {#acceptance-system-semantic-evidence}

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-semantic-evidence Requires an authority's actual observation rather than a repeated criterion statement. -->

의미 evidence는 authority가 실제로 관찰한 scope, 드러난 정보와 criterion을 충족하거나 반증한 이유를 가진다. Criterion 문장을 복사한 기록이나 source에 의도가 적혀 있다는 사실은 결과의 semantic observation이 아니다.

## Evidence Freshness {#acceptance-system-evidence-freshness}

### Current와 Historical Evidence {#acceptance-system-current-historical-evidence}


<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-evidence-freshness Binds evidence to target, version, profile, time range and actual artifact identity. -->

Evidence freshness는 target, source와 dependency identity, criterion version, profile, sample scope, context와 actual artifact relation에서 계산한다. Filename, 설명, 생성 시각 또는 비슷한 frame만 같다는 이유로 current 상태를 부여하지 않는다.

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-current-historical-evidence Separates evidence usable for current verdicts from evidence usable only for comparison and provenance. -->

Current evidence만 current verdict를 discharge할 수 있고 historical evidence는 comparison, regression과 provenance에 사용할 수 있다. Historical result가 더 좋아 보이거나 과거 approval에 쓰였어도 현재 pass를 만들지 않는다.

Capture runtime identity는 Vite, viewer, engine, Three.js, Playwright와 Playwright core의 installed package closure를 package tree별 content digest, file count와 byte count로 정규화한다. Package-owned Chromium 또는 configured executable은 executable과 support-file tree의 content identity를 같은 closure에 포함하고, system channel은 `system-channel-unsealed`로 기록한다. Capture는 runtime import 전 snapshot을 만들고 browser launch, page load와 최종 pixel commit 전후에 같은 physical generation과 exact inventory를 다시 확인하며, 하나라도 달라지면 이전 manifest를 current evidence로 재사용하지 않는다.

### Evidence 계보와 무결성 {#acceptance-system-evidence-lineage-integrity}

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-evidence-lineage-integrity Preserves derivation, transformation, byte identity and post-verdict integrity. -->

Evidence record는 observation에서 파생된 경로, transform과 compression loss, bytes와 metadata identity, custody와 verdict 이후 변경 여부를 가진다. 계보 또는 무결성이 필수인데 확인되지 않으면 verified와 current 상태를 거절한다.

### Evidence 충돌 {#acceptance-system-evidence-conflict}

<!-- @evidence requirements/acceptance/evidence-and-freshness.md#acceptance-evidence-conflict Exposes conflicts between numeric, structural and perceptual evidence. -->

서로 다른 evidence가 같은 criterion에서 상충하는 결론을 지지하면 각 observation과 conflict relation을 보존한다. 우선 rule이나 해결 authority가 없으면 verdict는 indeterminate이며 유리한 evidence만 선택하지 않는다.
