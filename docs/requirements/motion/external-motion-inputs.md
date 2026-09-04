# 외부 Motion 입력과 채택

## 사용자가 선택한 Motion Source {#motion-external-inputs-adoption}

사용자와 저작 에이전트는 외부 model에 포함된 animation, 독립 clip, motion capture, keyframe export, generated motion와 baked simulation result 중 작품에 사용할 source와 take를 명시적으로 선택할 수 있어야 한다.

### Adoption Mode {#motion-external-adoption-mode}

외부 motion은 원본 channel과 timing을 유지하는 direct use, project-native clip으로의 conversion, target rig에 대한 retargeting 또는 기존 motion과의 layer composition 중 선택한 방식으로 채택되어야 하며 시스템이 편의상 방식을 바꾸지 않아야 한다.

### Source Basis {#motion-external-source-basis}

Source clip identity, take, duration, timebase 또는 sample rate, unit, coordinate convention, source skeleton과 rest basis, root policy, channel list, event와 loop intent를 읽고 선택 전에 보여 줄 수 있어야 한다.

이 byte inspector는 생성 project의 명명된 command 또는 public import에서 접근 가능해야 하며, exact source-order hierarchy와 rest basis를 반환하고 semantic mapping이나 adoption 결정을 대신하지 않아야 한다.

### Compatibility와 User Override {#motion-external-compatibility-override}

Target control coverage, joint와 range compatibility, scale, root, contact, morph, event, interpolation와 unsupported channel을 비교하고 자동 mapping, trim, scale와 correction은 사용자가 검토, override 또는 거부할 수 있어야 한다.

### Non-destructive Receipt {#motion-external-adoption-receipt}

원본 bytes와 digest를 보존하고 선택된 take, adoption mode, mapping, time conversion, trim, correction, loss와 result digest를 기록하여 source 변경이나 재채택 뒤 영향받은 performance와 evidence를 stale로 식별해야 한다.

### External Motion Refusal {#motion-external-input-refusal}

해석할 수 없는 timebase, missing target, ambiguous mapping, unsupported compression, corrupt sample, required source 또는 rights conflict와 declared loss budget 초과를 generic motion으로 대체하지 않아야 한다.
