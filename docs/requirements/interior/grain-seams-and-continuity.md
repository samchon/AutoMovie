# 결, 이음과 연속성

## 재료 방향과 조각 관계 {#interior-grain-seam-continuity}

Wood grain, stone veining, fabric nap, brushed metal, sheet direction와 anisotropy를 각 piece의 local orientation과 assembly 전체의 design intent에 연결할 수 있어야 한다.

### Bookmatch와 연속 결 {#interior-grain-bookmatch}

Bookmatch, slip match, continuous slab, running grain와 intentional random orientation을 adjacent piece 관계로 선언하고 source image의 어느 영역을 사용하는지 추적할 수 있어야 한다.

원판, 원목, roll, slab scan 또는 generated texture를 raw-stock identity로 선택하고 실제 scale, capture direction, color space와 usable region을 기록할 수 있어야 한다. Piece의 cut polygon, orientation, flip, sequence와 source region이 중복되거나 usable extent를 벗어나면 연속 무늬가 비슷해 보이더라도 거부해야 한다.

### Seam과 Sheet Layout {#interior-seam-sheet-layout}

Sheet, roll, carpet, veneer, board와 membrane의 최대 크기, seam 위치, overlap, weld, repeat match와 direction을 실제 host extent에 맞춰 배치할 수 있어야 한다.

### Corner와 다면 연속성 {#interior-grain-corner-continuity}

Wall return, column wrap, countertop edge, stair, ceiling fold와 curved surface에서 결이 이어지는지 끊기는지 명시하고 surface마다 독립 UV로 우연히 바뀌지 않아야 한다.

### 연속성 Evidence {#interior-grain-continuity-evidence}

연속성 주장은 piece identity, source region, orientation와 junction을 통해 재현 가능해야 하며 beauty render의 비슷한 색만으로 증명하지 않는다.

Deterministic variation을 사용할 때 grain direction, repeat phase, stock selection과 local offset은 group seed와 stable piece identity에서 파생되고 algorithm version과 stream key를 기록해야 한다. 앞선 piece의 추가나 삭제가 변경되지 않은 나머지 field를 다시 섞지 않아야 한다.
