# Source Frame과 Reference Lock

## 구조를 고정하는 Current Reference {#repaint-source-reference-lock}

Repaint input은 exact production, shot, film time, source frame digest, camera, beauty와 필요한 depth, mask, pose 또는 other control pass identity를 가져야 한다.

### Reference Role {#repaint-reference-roles}

Structure, character identity, costume, style, material, color와 environment reference를 role별로 구분하고 동일 image를 모든 역할의 정본으로 사용하지 않아야 한다.

### Project-relative Asset {#repaint-project-relative-references}

Reference는 registered project asset 또는 immutable fetched result로 고정되고 undeclared absolute path와 mutable remote URL에 의존하지 않아야 한다.

### Spatial Alignment {#repaint-control-alignment}

Source beauty와 control pass는 같은 dimensions, crop, camera, time와 subject state를 가져야 한다.

### Reference Refusal {#repaint-reference-refusal}

Digest mismatch, wrong time, stale pass, dimension mismatch, missing role와 license restriction을 거부해야 한다.
