# Pass, Channel과 Product

## 하나의 Scene에서 나오는 여러 Render Product {#rendering-passes-channels-products}

Beauty, depth, normal, identity mask, outline, pose, shadow와 project-defined supported pass는 camera, view, frame schedule, dimensions, channel schema, data type, background와 color treatment를 포함한 product identity를 가져야 한다. Pass 이름이나 file suffix만으로 서로 다른 product를 구분해서는 안 된다.

### Beauty와 Structural {#rendering-beauty-structural-distinction}

Beauty appearance와 geometry 또는 identity 검증용 structural pass를 구분해야 한다. Environment, material override, lighting, tone mapping, anti-aliasing, transparency와 hidden object 처리 규칙을 pass별로 명시하고 beauty-only effect가 structural truth를 오염시켜서는 안 된다.

### Arbitrary Channel {#rendering-arbitrary-channels}

Color, alpha, depth, normal, motion-like vector, object id와 metadata-like channel은 purpose, component order, unit, coordinate space, encoding, precision, missing value와 validity region을 가져야 한다. Unknown channel을 color로 해석하거나 unit 없는 numeric output을 verified data로 제공해서는 안 된다.

### Identity와 Mask {#rendering-identity-mask-channels}

Identity channel은 source owner와 instance를 안정적으로 구분하고 같은 input closure에서 frame과 chunk에 걸쳐 같은 mapping을 사용해야 한다. Palette identity는 digest 자신을 제외한 version, protocol, background, 모든 entry field와 bounded gap을 canonical하게 결속해야 한다. Mask frame은 같은 shot에서 관찰한 palette와 runtime coverage 및 resident sidecar bytes를 하나의 receipt dependency로 보존하며, unresolved 또는 unnamed geometry를 완전한 structural evidence로 승격하지 않아야 한다. Anti-aliased boundary, transparent surface, occlusion과 background가 mask 판정에 미치는 규칙을 선언해야 한다.

### Multi-view와 Product {#rendering-multiview-products}

여러 camera, eye, turntable angle, crop, resolution과 delivery version은 독립된 product identity를 가져야 한다. View 간 공통 frame time을 유지하되 camera-specific visibility와 projection을 하나의 product로 합쳐서는 안 된다.

### Pass Dependency와 Order {#rendering-pass-dependencies}

다른 pass나 intermediate를 소비하는 product는 dependency와 evaluation order를 명시해야 한다. Independent pass는 요청 순서와 관계없이 같은 결과를 내야 하고 실패한 pass가 unrelated product를 stale 또는 incomplete로 만들 필요가 있는지 정확히 보고해야 한다.

### Partial Product Set {#rendering-partial-product-set}

일부 pass만 완료되면 expected, completed, failed와 not-run product를 구분해야 한다. Beauty 성공을 structural pass 성공으로 간주하거나 missing guide pass를 빈 channel로 채워 complete set을 만들면 안 된다.

### Pass Refusal {#rendering-pass-refusal}

Unknown pass, unsupported channel, identity collision, requested pass를 제공할 수 없는 runtime, invalid precision, incompatible transparency와 beauty-only effect leakage는 거절해야 한다. Diagnostic은 affected product와 frame range를 포함해야 한다.
