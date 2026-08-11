# Pose, Expression과 Gaze

## 의미를 읽을 수 있는 Actor State {#actor-pose-expression-gaze}

Actor는 body pose, hand 또는 coarse gesture, gaze target, facial 또는 proxy expression와 named performance state를 같은 sample time에 표현할 수 있어야 한다.

### Pose와 Motion 구분 {#actor-pose-motion-distinction}

Pose는 한 시점의 state이고 motion은 pose 사이의 시간 변화이므로 static pose, clip, procedural motion와 performance override의 precedence를 명시해야 한다.

### Gaze와 Attention {#actor-gaze-attention}

Look target, head·eye contribution, attention change와 intentional avoidance를 표현하고 target이 사라지거나 actor 뒤에 있을 때의 bounded behavior를 정의해야 한다.

### Expression Channel {#actor-expression-channels}

Neutral에서의 named expression, intensity, left·right asymmetry와 blend compatibility를 저작할 수 있으나 상세 얼굴 복원이나 음성만으로 표정을 추측하지 않아야 한다.

### Pose 검증 {#actor-pose-validation}

Joint range 위반, body self-intersection, ground penetration, broken contact, impossible gaze, missing morph와 non-finite transform을 named finding으로 남겨야 한다.
