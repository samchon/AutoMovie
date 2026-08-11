# 벽, 칸막이와 Lining

## 공간을 나누는 두께 있는 경계 {#interior-walls-partitions-linings}

Structural wall, non-structural partition, demountable wall, screen, lining, wainscot와 freeform divider를 centerline이나 face 기준, height, thickness, layer와 host connection으로 표현할 수 있어야 한다.

각 storey, room boundary와 height zone은 같은 wall type을 재사용하거나 다른 structural role, stud·infill, lining, finish assembly, tile·panel field와 acoustic condition을 가질 수 있어야 한다. Repeated floor의 shared rule과 individual wall-face override는 final thickness와 provenance를 함께 보존해야 한다.

### 양면 Ownership {#interior-wall-two-sided-ownership}

한 wall의 각 face는 서로 다른 adjacent space, finish, base, trim와 acoustic condition을 가질 수 있으며 wall identity와 total assembly를 공유해야 한다.

Front, back, return, top, bottom, reveal와 cut face를 구분하고 각 region의 finish datum, build direction, pattern coordinate와 termination을 선언할 수 있어야 한다. 양면 build-up의 합이 exterior envelope, opening frame, floor area와 clear width를 침범하지 않아야 한다.

### 부분 높이와 자유 형상 {#interior-wall-partial-freeform}

Half-height wall, curved partition, sloped top, folded surface, niche, recess, reveal와 sculpted lining을 full-height rectangular wall로 강제하지 않아야 한다.

### 교차와 접합 {#interior-wall-intersections}

Wall-to-wall, wall-to-column, wall-to-floor, wall-to-ceiling와 wall-to-envelope junction에서 layer termination, corner, trim와 finish continuity를 제어할 수 있어야 한다.

Opening, recess, niche, service penetration와 demountable joint는 제거 volume, remaining core, fill element, seal과 allowed movement를 wall assembly에 연결해야 한다. 표면 표시만 있는 가짜 opening이나 finish를 뚫고 hidden layer를 남긴 route를 거부해야 한다.

### 경계 일관성 {#interior-wall-boundary-validation}

의도하지 않은 gap, overlap, inverted face, zero thickness, room을 가로지르는 detached partition와 exterior envelope 밖의 lining을 탐지해야 한다.
