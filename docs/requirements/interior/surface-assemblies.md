# Surface Assembly

## 보이는 면과 시공체의 분리 {#interior-surface-assemblies}

보이는 finish surface, 그 아래 substrate, membrane, adhesive, cavity, support와 structural host를 구분하면서 ordered assembly와 total thickness로 연결할 수 있어야 한다.

### 면, 물질과 제품 {#interior-surface-substance-product}

같은 appearance를 가진 surface가 서로 다른 substance와 build-up을 가질 수 있고, 같은 substance도 coating, polish, cut와 orientation에 따라 다른 surface를 가질 수 있어야 한다.

### Region과 Layer {#interior-surface-regions-layers}

Floor, wall, ceiling, built-in과 curved host의 부분 region마다 layer 순서, thickness, finish side와 edge condition을 독립적으로 선언할 수 있어야 한다.

Assembly는 datum, build direction, start offset, each layer의 material, role, thickness와 air gap을 가져야 하며 zero-thickness membrane·coating과 volumetric layer를 구분해야 한다. Stud-and-infill, frame-and-panel처럼 한 section 안의 constituent와 path-following profile도 ordered flat layer를 거짓으로 늘어놓지 않고 표현할 수 있어야 한다.

같은 type을 여러 storey나 room에 재사용할 수 있으나 floor, ceiling, tile 또는 panel field와 wall의 양면은 독립된 region, orientation, pattern와 override를 가질 수 있어야 한다. 해석된 total thickness는 exterior가 정한 slab, envelope, opening와 clear-height budget 안에 있어야 한다.

### 숨은 Layer와 Cut Face {#interior-hidden-layers-cut-faces}

Section, opening reveal, damage와 unfinished state에서 드러나는 substrate, core와 membrane은 원래 assembly에서 파생되어야 하며 보이는 finish texture를 절단면에 반복하지 않아야 한다.

### Region 합성과 단부 {#interior-surface-region-composition}

Region은 closed contour, hole, height band, host relationship 또는 project-defined field로 정의하고 overlap 시 compose, subtract, clip 또는 priority rule을 명시해야 한다. Opening, edge, service penetration, inspection hatch와 corner에서 각 layer가 wrap, terminate, overlap 또는 다른 assembly와 join하는 방식을 수량과 section에 보존해야 한다.

### Assembly 충돌 {#interior-assembly-conflicts}

음수 thickness, 겹친 layer, 끊긴 waterproof layer, host 밖 build-up와 서로 양립하지 않는 finish side를 탐지해야 한다.
