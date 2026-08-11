# 축선, Eyeline과 Screen Direction

## 공간 관계를 보존하는 Camera Grammar {#camera-axis-eyeline-screen-direction}

Interaction axis, line of action, eyeline, travel direction와 subject screen side를 scene-local 관계로 선언하고 shot마다 world axis를 새로 해석하지 않아야 한다.

### 180-degree Line {#camera-180-line}

Dialogue, confrontation, movement와 group action의 active line과 camera side를 추적하여 cut 사이 screen relation이 유지되거나 위반이 명시되어야 한다.

### Eyeline Match {#camera-eyeline-match}

Actor gaze target, head pose, camera position와 target의 screen location을 연결하여 서로를 보는 인물이 엉뚱한 방향을 보지 않아야 한다.

### Entrance와 Exit Direction {#camera-entry-exit-direction}

Subject가 frame을 나가고 들어오는 side, travel direction와 location topology를 edit boundary에서 추적할 수 있어야 한다.

### Grammar Finding {#camera-grammar-findings}

Unmotivated line cross, reversed eyeline, travel flip와 orientation ambiguity를 탐지하되 의도적 위반을 자동 오류로 만들지 않아야 한다.
