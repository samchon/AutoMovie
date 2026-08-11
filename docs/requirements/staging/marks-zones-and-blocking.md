# Mark, Zone과 Blocking

## 공간에 고정되는 의미 Anchor {#staging-marks-zones-blocking}

Entry, exit, speaking mark, interaction point, formation origin, camera lane, safe zone, reveal line와 project-defined mark를 location-local identity와 transform으로 표현할 수 있어야 한다.

### Mark와 Surface {#staging-mark-surface}

Mark는 floor, terrain, stair, platform, vehicle, actor 또는 moving object 중 자신의 host를 명시하고 같은 fixed clock에서 world transform을 resolve해야 한다.

### Zone {#staging-zones}

Action, audience, danger, restricted, off-screen, cue와 camera zone을 bounded volume 또는 surface region으로 표현하고 물리 wall과 논리 zone을 구분해야 한다.

### Blocking 관계 {#staging-blocking-relations}

Distance, facing, eyeline, rank, proximity, concealment와 reveal 관계를 명시하고 absolute coordinate만으로 dramatic relation을 숨기지 않아야 한다.

### Mark Refusal {#staging-mark-refusal}

Host 밖 mark, inaccessible point, overlapping exclusive zone, moving host가 없는 dynamic mark와 wrong-level placement를 거부해야 한다.
