# Acceptance Evidence와 Freshness

## Evidence 충분성 {#acceptance-evidence-sufficiency}

각 verdict는 criterion이 요구한 수치, 구조, 시각, 청각 또는 의미 evidence를 실제 판정 범위만큼 가져야 한다. Evidence의 존재와 충분성을 구분하고, 한 종류의 evidence로 다른 종류의 관찰 의무를 대체하지 않아야 한다.

### 수치 evidence {#acceptance-numeric-evidence}

수치 evidence는 실제 측정값, 단위, 기준계, 표본 위치, 집계값, 허용오차와 비교 결과를 보여야 한다. 평균만으로 최대 위반을 숨기거나 계획된 parameter를 측정값으로 제시하지 않아야 한다.

### 구조 evidence {#acceptance-structural-evidence}

구조 evidence는 대상 identity, 관계, coverage, 순서, 상태와 누락을 판정할 수 있어야 한다. 요약 count만으로 잘못 연결된 구성원을 통과시키지 않아야 한다.

### 시각·청각 evidence {#acceptance-perceptual-evidence}

시각·청각 evidence는 실제 current pixel 또는 decoded audio, 대상 identity, 시간, view, pass, presentation 조건과 관찰된 특징을 연결해야 한다. 구조 pass는 구조를 증명할 수 있지만 beauty appearance를, still frame은 motion이나 sync를 대신 증명하지 않아야 한다.

### 의미 evidence {#acceptance-semantic-evidence}

의미 evidence는 판단 authority가 실제로 본 범위와 그 범위에서 criterion을 충족하거나 반증한 관찰을 포함해야 한다. Criterion 문장을 그대로 반복한 기록은 관찰 evidence로 인정하지 않아야 한다.

## Evidence freshness {#acceptance-evidence-freshness}

Evidence는 판정 대상, version, profile, 시간 범위와 실제 산출물 identity에 결속되어야 한다. 그 결속에 영향을 주는 변경이 있으면 이전 evidence와 verdict는 stale로 표시되어야 한다.

파일명, 화면 설명 또는 비슷한 frame만 같다는 이유로 이전 evidence를 current로 간주하지 않아야 한다.

### Current와 historical evidence {#acceptance-current-historical-evidence}

Current evidence는 현재 판정에 사용할 수 있고 historical evidence는 비교와 provenance에 사용할 수 있어야 한다. Historical evidence가 더 좋아 보이더라도 현재 결과의 pass를 대신하지 않아야 한다.

Capture evidence는 실제 사용한 Vite, viewer, engine, Three.js와 Playwright package bytes 및 package-owned 또는 configured browser support tree의 identity를 가져야 한다. 같은 package 이름과 version만으로 다른 설치를 current로 간주하지 않으며 system channel은 content-sealed인 것처럼 표시하지 않아야 한다.

### Evidence 계보와 무결성 {#acceptance-evidence-lineage-integrity}

사용자는 evidence가 어떤 대상과 관찰에서 파생되었는지, 변환 또는 압축으로 무엇이 달라졌는지, bytes와 metadata가 판정 이후 바뀌지 않았는지 확인할 수 있어야 한다.

## Evidence 충돌 {#acceptance-evidence-conflict-group}

### Evidence 충돌 {#acceptance-evidence-conflict}

수치, 구조와 지각 evidence가 서로 다른 결론을 가리키면 충돌을 숨기지 않고 criterion별로 드러내야 한다.

충돌을 해결할 authority나 우선 규칙이 없으면 verdict는 indeterminate이어야 하며, 유리한 evidence 하나만 선택하여 pass로 만들지 않아야 한다.
