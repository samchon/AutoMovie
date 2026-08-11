# Acceptance 변경, 회귀와 재판정

## 변경 영향 {#acceptance-change-impact}

대상, 의존 상태, criterion, profile, authority, runtime 조건 또는 evidence가 바뀌면 영향을 받는 acceptance 범위를 식별할 수 있어야 한다.

영향을 받지 않은 범위의 current verdict는 보존할 수 있지만, 영향 관계를 확인하지 않은 채 이전 전체 승인을 유지하지 않아야 한다.

### Criterion 변경 {#acceptance-criterion-change}

기대값, 비교 규칙, 허용오차 또는 exact 선언, 필수 evidence, severity 또는 집계 규칙의 변경은 새 criterion version으로 식별되어야 한다. 이전 기준의 pass와 새 기준의 pass를 같은 사실로 합치지 않아야 한다.

### 대상 변경 {#acceptance-target-change}

Source, asset, state, timing, camera, edit, sound, render, caption, repaint 또는 delivery 변경이 criterion의 관찰값에 영향을 줄 수 있으면 관련 evidence와 verdict는 stale이 되어야 한다.

### 환경과 Profile 변경 {#acceptance-environment-profile-change}

Display, decoder, platform, language, accessibility mode 또는 delivery profile이 판정 조건에 포함되면 그 조건의 변경은 해당 범위의 재판정을 요구해야 한다.

## 회귀 비교 {#acceptance-regression-comparison}

회귀 판정은 current와 baseline의 대상 identity, profile, 관찰 조건과 criterion version을 맞추고 실제 차이를 보여야 한다.

### 개선과 정확성의 구분 {#acceptance-improvement-correctness}

Baseline보다 나아졌다는 사실과 criterion을 통과했다는 사실을 구분해야 한다. 개선 후에도 threshold 밖이면 fail이고, 외관이 달라졌어도 criterion을 계속 만족하면 자동 fail이 아니어야 한다.

### 의도한 변화 {#acceptance-intentional-change}

의도한 차이는 변경 근거와 새 기대 상태에 연결되어야 한다. 승인되지 않은 차이를 의도라고 소급 설명하여 회귀를 숨기지 않아야 한다.

## 재판정 범위 {#acceptance-revalidation-scope}

재판정은 변경과 직접 연결된 criterion뿐 아니라 같은 상태, 시간, 자산, 산출물 또는 approval dependency를 공유하는 consequence surface를 포함해야 한다.

### 좁은 재판정의 한계 {#acceptance-narrow-revalidation-limit}

한 frame 또는 한 criterion만 다시 통과한 결과는 stale이 해소된 해당 범위에만 적용되어야 한다. Sequence, film 또는 delivery 승인이 요구하는 전체 표면을 자동 복구하지 않아야 한다.

### 재판정 완료 {#acceptance-revalidation-completion}

영향 범위의 모든 required criterion이 current evidence로 다시 판정되고, 모든 blocking criterion이 pass이며, 필요한 authority가 결과를 채택했을 때만 이전 승인과 동등한 current 승인을 회복할 수 있어야 한다.
