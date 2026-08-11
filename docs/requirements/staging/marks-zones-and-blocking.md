# Mark, Zone과 Blocking

## 공간에 고정되는 의미 Anchor {#staging-marks-zones-blocking}

Entry, exit, speaking mark, interaction point, formation origin, camera lane, safe zone, reveal line와 project-defined mark를 location-local identity와 transform으로 표현할 수 있어야 한다.

### Reference Frame와 Revision {#staging-mark-reference-frame}

각 mark와 zone은 host location 또는 subject, coordinate frame, unit, geometry revision와 valid film interval을 가져야 하며 host가 이동·변형·교체되면 같은 fixed-clock sample에서 다시 resolve되어야 한다.

### Mark와 Surface {#staging-mark-surface}

Mark는 floor, terrain, stair, platform, vehicle, actor 또는 moving object 중 자신의 host를 명시하고 같은 fixed clock에서 world transform을 resolve해야 한다.

### Zone {#staging-zones}

Action, audience, danger, restricted, off-screen, cue와 camera zone을 bounded volume 또는 surface region으로 표현하고 물리 wall과 논리 zone을 구분해야 한다.

### Zone Membership {#staging-zone-membership}

Zone의 inside, outside와 boundary 판정, tolerance, capacity, priority와 overlapping policy를 선언하고 moving subject가 들어오고 머물고 나가는 time interval을 관찰 가능한 event와 연결할 수 있어야 한다.

### Blocking 관계 {#staging-blocking-relations}

Distance, facing, eyeline, rank, proximity, concealment와 reveal 관계를 명시하고 absolute coordinate만으로 dramatic relation을 숨기지 않아야 한다.

### 의도적 공간 예외 {#staging-intentional-spatial-exceptions}

Restricted zone 진입, 안전 거리 축소, 비정상 camera lane와 deliberate overlap은 reason, affected relation, interval, 대안과 별도 acceptance를 가져야 하며 tolerance 확대나 검사 비활성화로 의도를 대신하지 않아야 한다.

### Mark Refusal {#staging-mark-refusal}

Host 밖 mark, inaccessible point, overlapping exclusive zone, moving host가 없는 dynamic mark와 wrong-level placement를 거부해야 한다.
