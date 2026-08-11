# 매스, 면적과 전체 높이

## 실제 치수의 건물 형상 {#building-massing-area-height}

건물은 실제 단위의 footprint, 길이, 폭, 전체 높이, mass volume, orientation과 measurement state를 가져야 하며 화면 구도에 맞춘 숨은 scale로 interior, map, 다른 representation이나 산출물과 분리되지 않아야 한다.

### 제한 없는 Mass {#building-unrestricted-massing}

단층, 복층, tower, podium, wing, courtyard, atrium, cantilever, bridge-connected volume, setback, curve, slope와 freeform mass를 조합하고 각 positive volume, void, cut와 overlap의 identity와 역할을 추적할 수 있어야 한다.

### 면적 기준 {#building-area-basis}

건축면적, floor area, gross area, net area, rentable·usable area와 exterior surface area를 계산할 때 boundary, opening·void·balcony·shaft·wall 포함 여부, phase, representation, unit와 rounding을 명시하여 서로 다른 면적을 같은 값처럼 사용하지 않아야 한다. Exterior-only set가 내부 floor나 usable boundary를 저작하지 않았다면 해당 면적은 unknown 또는 out-of-scope로 남겨야 한다.

### 전체 높이 {#building-total-height}

Ground datum, lowest exposed point, parapet, roof ridge, rooftop equipment와 highest attachment 중 어느 기준으로 높이를 측정했는지 구분하고 sloped terrain과 여러 building unit에서도 측정 origin과 target identity를 유지해야 한다.

### 매스 변경 영향 {#building-massing-change-impact}

Footprint, area 또는 height 변경이 storey, structure, envelope, roof, facade, opening, site contact, linked interior, shadow, view, quantity와 render에 미치는 영향을 추적하고 affected result를 current로 남겨 두지 않아야 한다.

### Interior와의 면적 정합 {#building-massing-interior-area-coordination}

Interior가 연결되면 exterior footprint와 gross boundary, interior floor·space boundary와 wall·shaft deduction이 같은 shared construction과 datum에서 계산되어야 한다. Interior 요구로 boundary가 이동하거나 exterior mass가 바뀌면 양쪽 area를 다시 산출하고, 허용 범위를 벗어난 containment·area·volume 차이는 어느 한쪽 수치를 덮어쓰지 말고 failure로 보고해야 한다.
