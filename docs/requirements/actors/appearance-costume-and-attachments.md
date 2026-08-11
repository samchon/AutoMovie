# Appearance, Costume와 Attachment

## Actor에 속한 시각 상태 {#actor-appearance-costume-attachments}

Body material, proxy color, hair 또는 head silhouette, costume, footwear, carried equipment와 attached prop를 actor identity, body region, anchor와 story state에 연결할 수 있어야 한다.

### Costume Layer와 Variant {#actor-costume-layers-variants}

Base body, inner, outer, armor, accessory와 removable layer를 outfit, scene, damage와 phase에 따라 순서와 body coverage를 가진 조합으로 구성하고 서로 다른 costume version을 덮어쓰지 않아야 한다.

### Attachment와 Contact {#actor-attachment-contact}

Weapon, bag, tool, helmet와 wearable soft object는 named bone 또는 body anchor, local offset, orientation, collider와 handoff state를 가져야 한다.

### Rigid와 Soft Binding {#actor-rigid-soft-binding}

Rigid attachment, skinned costume, bounded soft wearable과 hand-held object를 구분하고 각 binding의 anchor, deformation basis, collision envelope, simulation 또는 authored motion 책임과 unsupported fallback을 명시해야 한다.

### 외부 Appearance Asset {#actor-external-appearance-assets}

사용자가 제공한 model, texture, costume와 accessory를 direct use, native conversion 또는 group composition할 수 있고 source, license, digest, scale, rig compatibility와 actor consumer를 추적해야 한다. 여러 후보 중 무엇을 어느 outfit과 shot에 쓰는지는 사용자가 선택해야 한다.

### 관통과 분리 {#actor-costume-intersection-refusal}

Detached attachment, unsupported garment, body·costume penetration, wrong-side item, missing anchor와 actor scale에 맞지 않는 equipment를 검토할 수 있어야 한다.
