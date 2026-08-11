# 축선, Eyeline과 Screen Direction

## 공간 관계를 보존하는 Camera Grammar {#camera-axis-eyeline-screen-direction}

Interaction axis, line of action, eyeline, travel direction와 subject screen side를 scene-local 관계로 선언하고 shot마다 world axis를 새로 해석하지 않아야 한다.

### Axis Source Trace {#camera-axis-source-trace}

Active line과 screen relation은 staging participant, mark, path, gaze target와 interaction phase를 참조하고 subject가 이동하거나 관계가 바뀌면 어느 event에서 새 axis가 성립하는지 추적해야 한다.

### 180-degree Line {#camera-180-line}

Dialogue, confrontation, movement와 group action의 active line과 camera side를 추적하여 cut 사이 screen relation이 유지되거나 위반이 명시되어야 한다.

### Eyeline Match {#camera-eyeline-match}

Actor gaze target, head pose, camera position와 target의 screen location을 연결하여 서로를 보는 인물이 엉뚱한 방향을 보지 않아야 한다.

### Entrance와 Exit Direction {#camera-entry-exit-direction}

Subject가 frame을 나가고 들어오는 side, travel direction와 location topology를 edit boundary에서 추적할 수 있어야 한다.

### Grammar Sampling {#camera-grammar-time-sampling}

Axis side, eyeline, subject screen position와 travel vector는 cut 양쪽의 정확한 source sample과 transition overlap에서 평가하고 shot의 시작 transform이나 평균 heading만으로 동적 관계를 판정하지 않아야 한다.

### Grammar Finding {#camera-grammar-findings}

Unmotivated line cross, reversed eyeline, travel flip와 orientation ambiguity를 탐지하되 의도적 위반을 자동 오류로 만들지 않아야 한다.

### Grammar Alternative {#camera-grammar-alternatives}

같은 event를 다른 axis side, eyeline strategy 또는 entrance 방향으로 찍는 take는 독립 grammar state와 continuity consequence를 가져야 하며 edit가 선택하지 않은 take의 관계를 현재 sequence에 적용하지 않아야 한다.
