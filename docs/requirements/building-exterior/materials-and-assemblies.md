# 외장 재료와 적층

## 외피 적층과 외장 표현 {#building-exterior-materials-assemblies}

외벽, roof, soffit와 exterior slab는 structure, substrate, insulation, waterproof·vapor layer, cavity, fixing substructure, cladding, coating와 joint가 순서, side, region, termination와 thickness를 가진 assembly로 표현될 수 있어야 한다.

### 열린 재료 범위 {#building-exterior-open-material-range}

Stone, brick, wood, earth, plaster, concrete, metal, glass, ceramic, composite panel, membrane, fabric skin와 vegetation-integrated facade를 포함하되 material 목록을 닫거나 특정 시대 catalogue에 제한하지 않는다.

### 실제 Surface 속성 {#building-exterior-surface-properties}

Color, gloss, roughness, reflection, transmission, refraction, emission, relief, displacement, weathering, thickness와 cut section을 material identity, surface region, orientation와 actual scale에 연결할 수 있어야 한다. 시각 속성만으로 구조·열·방수 성능을 추정하지 않아야 한다.

### 접합과 배수 Detail {#building-exterior-joints-drainage}

Joint, sealant, flashing, drip, coping, fastener, movement gap, opening·roof·balcony junction와 drainage path를 이름, profile, width, depth, host와 state를 가진 detail로 표현할 수 있어야 한다.

### Interior와 다른 마감 {#building-exterior-two-sided-finish}

같은 wall, slab나 roof의 exterior finish와 interior finish는 독립적으로 저작되며 shared construction identity, core position와 total thickness를 공유해야 한다. 양쪽 layer 합이 available thickness를 넘거나 서로 같은 side를 소유하면 실패해야 한다.

### Assembly 수량과 Representation {#building-exterior-assembly-quantity-representation}

Layer volume, finish area, joint length, fixing count와 waste는 opening, edge, wrap, cut, phase와 resolved pattern을 반영한 actual assembly에서 산출해야 한다. 원거리 texture나 proxy surface는 별도의 exact build-up 근거가 없는 한 근거리 detail 또는 시공 수량의 근거가 될 수 없다.
