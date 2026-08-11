# Representation, LOD와 Fidelity {#building-envelope-representation-lod-fidelity-specification}

## 관찰 범위에 결속된 Representation {#building-envelope-representation-view-contract}

### Representation 입력과 선택 출력 {#building-envelope-representation-input-output}

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-representations-lod-fidelity 건물 외피의 proxy·standard·hero 표현과 원거리·근거리 성공 기준을 관찰 조건에 결속한다. -->

각 building, mass, facade, roof, opening, attachment와 pattern은 authoring identity와 하나 이상의 representation identity를 가진다. Representation은 목적, tier, valid distance 또는 projected-size 범위, camera angle, interaction·measurement 권한, geometry·material ceiling, source revision과 cost bound를 선언한다.

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-fidelity-success fidelity 성공을 관찰 거리, raster, angle, light, motion과 required fact의 조합으로 판정한다. -->

입력은 camera 또는 view set, target raster·scale, distance, projected extent, light·weather state, interaction, requested pass와 tier policy를 제공한다. 출력은 선택한 representation, selection reason, preserved facts, deliberate loss, unsupported purpose, budget contribution와 transition receipt다.

### 공통 LOD 불변식 {#building-envelope-lod-common-invariants}

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-lod-invariants tier 전환에서도 identity, transform, extent, 높이, silhouette, opening, contact와 state를 보존한다. -->

모든 tier는 building identity, world transform, footprint, total-height target, major mass, landmark, negative space, ground contact, story-relevant opening·attachment와 current phase·state를 선언된 tolerance 안에서 보존한다. 낮은 tier는 interaction, hero, contact, drawing 또는 quantity target을 몰래 대신하지 않는다.

### 원거리 Silhouette Fidelity {#building-envelope-distant-silhouette-fidelity}

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-distant-fidelity 원거리에서 building silhouette, skyline, major opening rhythm과 landmark를 보존한다. -->

Far representation은 예상 delivery raster와 contrast에서 footprint-to-height proportion, roofline, tower·wing 분절, 주요 void와 facade rhythm이 식별되어야 한다. 미세 texture noise나 normal detail은 mass와 outline을 대신할 수 없고 neighbouring context와 겹친 실제 shot angle에서 판정한다.

### 근거리 Assembly Fidelity {#building-envelope-close-assembly-fidelity}

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-close-fidelity 근거리에서 facade depth, opening reveal, joint, edge, support, drainage와 material scale을 검토한다. -->

Near representation은 declared view와 interaction 범위에서 facade·roof assembly depth, opening component와 reveal, corner·joint, attachment support, guard, drainage path, actual module, material scale와 visible backing을 해결해야 한다. 요구 범위 밖 detail은 생략할 수 있으나 생략된 사실을 측정 가능한 것으로 표시하지 않는다.

### 전환, 수량과 시각 검토 실패 {#building-envelope-lod-transition-review-failures}

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-lod-transition LOD transition의 위치, hysteresis, loss와 drift를 결정론적으로 기록한다. -->

선택은 같은 입력에서 재현되고 경계의 hysteresis 또는 명시적 전환 규칙을 따른다. Silhouette pop, extent·height·contact drift, opening·state 소실, unstable instance seed, 잘못된 quantity 대체, view 범위 밖 acceptance와 current source가 아닌 capture는 실패이며 `unsupported` representation을 빈 성공으로 대체하지 않는다.

## Exterior-only Set Fidelity {#building-envelope-exterior-only-fidelity-range}

### Set Fidelity 호환성 {#building-envelope-exterior-only-fidelity-compatibility}


Exterior-only set은 허용 camera position, distance, elevation, angle, reflection·shadow 범위와 투명·개방 opening을 통해 보이는 최대 depth를 선언한다. 이 범위에서는 누락된 backside, roof top, return와 opening backing이 없어서는 안 되며 범위 밖 관찰은 `unsupported` 또는 더 높은 representation 요구로 보고한다.

<!-- @evidence requirements/building-exterior/representations-lod-and-fidelity.md#building-exterior-set-fidelity-range exterior-only set에 interior를 연결하거나 camera 범위를 넓힐 때 기존 성공 판정을 자동 승계하지 않는다. -->

Interior 연결, reflective surface 추가, camera range 확대와 opening state 변경은 이전 exterior-only acceptance를 stale로 만든다. 기존 set은 원래 범위의 proxy로 계속 사용할 수 있지만 새 linked-interior 또는 hero 결과의 complete representation으로 승격하려면 경계와 관찰 검토를 다시 실행해야 한다.
