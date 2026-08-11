# Pass, Channel과 Product

## 하나의 Scene에서 나오는 여러 Render Product {#rendering-passes-channels-products}

Beauty, depth, normal, mask, outline, pose, shadow와 project-defined supported pass를 camera, resolution, channel, data type, background와 output identity로 표현할 수 있어야 한다.

### Beauty와 Structural {#rendering-beauty-structural-distinction}

Beauty appearance와 geometry·identity 검증용 structural pass를 구분하고 environment, material override, tone mapping와 transparency 적용 규칙을 pass마다 명시해야 한다.

### Arbitrary Channel {#rendering-arbitrary-channels}

Color, alpha, depth, vector, id와 metadata-like channel을 목적과 unit, encoding, precision과 validity region과 함께 제공할 수 있어야 한다.

### Multi-view와 Product {#rendering-multiview-products}

여러 camera, eye, turntable angle, resolution, crop와 delivery version을 독립 product identity로 만들고 파일 suffix만으로 구분하지 않아야 한다.

### Pass Refusal {#rendering-pass-refusal}

Unknown pass, unsupported channel, identity collision, missing runtime hook와 beauty-only effect leakage를 거부해야 한다.
