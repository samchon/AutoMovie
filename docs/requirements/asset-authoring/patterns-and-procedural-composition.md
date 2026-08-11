# Pattern과 절차적 구성

## 저작 가능한 반복 규칙 {#asset-pattern-procedural-authoring}

벽돌, 타일, 판재, 지붕재, 포장, 식생, 군중, 기둥, 창호와 장식처럼 반복되는 요소를 저자가 원형, 좌표, 배열, 경계, seed와 예외로 구성할 수 있어야 한다.

### 실제 module {#asset-physical-module}

실제 형상과 수량이 필요한 pattern은 image 반복으로 축약하지 않고 module의 크기, 형태, 간격, joint, orientation과 depth를 유지해야 한다.

### 절차적 규칙 {#asset-procedural-rule}

Grid, stagger, radial, path-following, surface distribution, cluster, gradient와 사용자 정의 조합을 고정 목록에 갇히지 않고 표현할 수 있어야 한다.

### 결정론적 변주 {#asset-deterministic-variation}

위치, 회전, 크기, 재료, 손상과 형상의 변주는 bounded range, distribution, spatial correlation과 seed로 통제되어 같은 입력에서 재현되어야 한다.

### 경계와 예외 {#asset-pattern-boundary-exception}

Pattern은 host boundary, opening, exclusion, border, transition과 최소 piece 규칙을 따르며 corner, edge와 작품별 고유 instance를 명시적 예외로 보존해야 한다.

### 국소 안정성 {#asset-pattern-local-stability}

관련 없는 scene 요소가 바뀌어도 변하지 않은 pattern 영역의 instance identity와 변주가 임의로 다시 섞여서는 안 된다.
