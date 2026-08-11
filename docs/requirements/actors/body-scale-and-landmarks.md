# Body Scale과 Landmark

## 실제 단위의 Actor Body {#actor-body-scale-landmarks}

Actor는 overall height, root basis, body extent와 head, shoulder, hand, pelvis, knee, foot 같은 motion과 framing에 필요한 named landmark를 실제 단위로 가져야 한다.

### Proportion과 Neutral State {#actor-proportion-neutral}

Body segment proportion, neutral pose와 local axis를 명시하고 model마다 다른 hidden normalization으로 motion과 camera framing을 맞추지 않아야 한다.

### 좌우와 Asymmetry {#actor-left-right-asymmetry}

Paired landmark와 limb는 left와 right identity, default relation와 authored asymmetry를 가질 수 있어야 한다.

### Bounds와 Shot Scale {#actor-bounds-shot-scale}

Static mesh bounds, rigged pose bounds, motion range와 costume·prop를 포함한 performance bounds를 구분하여 camera와 collision이 같은 목적의 bounds를 사용해야 한다.

### Scale 검증 {#actor-scale-validation}

Non-finite landmark, inverted limb, zero body extent, declared height와 model bounds의 모순, unit mismatch와 shot별 silent scale override를 거부해야 한다.
