# 재료와 Texture

## Project-owned 표면 표현 {#asset-material-texture-authoring}

저자 에이전트는 작품에 필요한 색, 반사, 거칠기, 금속성, 투명도, 굴절, 발광, 표면 요철과 실제 변위를 project-owned material과 texture로 구성할 수 있어야 한다.

### 재료와 image의 독립성 {#asset-material-image-independence}

재료의 물리적·시각적 속성과 이를 보조하는 image map은 구분되어야 하며, image가 없더라도 의미 있는 material을 선언할 수 있어야 한다.

### Texture 좌표와 축척 {#asset-texture-coordinates-scale}

Texture는 적용 surface, 좌표계, 실제 축척, 방향, 반복, clamp, seam과 channel 의미를 선언하여 같은 input에서 같은 배치를 만들어야 한다.

### 사용자 제작 texture {#asset-user-authored-texture}

사용자는 자신이 만든 image, 절차적 field 또는 승인한 외부 bytes로 작품별 texture를 제공할 수 있어야 하며 저장소 catalogue에 같은 무늬가 미리 존재할 필요가 없어야 한다.

### 다중 상태 재료 {#asset-material-state}

젖음, 먼지, 마모, 녹, 혈흔, 그을음, 손상과 시간 변화 같은 상태는 원본 material identity를 잃지 않고 선언된 단계나 film time에 따라 달라질 수 있어야 한다.

### Texture provenance {#asset-texture-provenance}

외부 또는 생성 texture는 원본, license, digest, color space, 해상도와 consumer를 추적할 수 있어야 하며 바뀐 bytes를 같은 asset으로 조용히 사용하지 않는다.
