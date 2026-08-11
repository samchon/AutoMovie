# Clip, Keyframe과 보간

## 재현 가능한 Motion Clip {#motion-clips-keyframes}

Clip은 duration, sample time, channel target, key value, interpolation와 loop 또는 clamp behavior를 선언하고 같은 input에서 같은 pose와 transform을 만들어야 한다.

### Key Time {#motion-key-times}

Key time은 finite하고 ordered하며 clip range 안에 있어야 하고 동일 time의 여러 key가 허용되는 경우 precedence를 명시해야 한다.

### 보간 종류 {#motion-interpolation}

Step, linear, eased, cubic, quaternion와 project-defined bounded interpolation을 channel type에 맞게 선택하고 rotation을 component-wise linear 보간하지 않아야 한다.

### Loop와 Trim {#motion-loop-trim}

Loop period, seam, source range, trim, hold와 time scale을 분리하여 startOffset과 film clock에서 일관되게 sample해야 한다.

### Clip Refusal {#motion-clip-refusal}

Zero-keyframe required channel, non-finite key, unsorted time, invalid quaternion, incompatible topology와 duration 밖 event를 거부해야 한다.
