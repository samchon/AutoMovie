# Performance와 Story Binding

## Story Goal을 수행하는 Actor {#actor-performance-story-binding}

Performance는 actor, story scene, character goal, semantic event, motion, pose, gaze, expression, utterance와 prop interaction을 하나의 film-time 범위에 연결해야 한다.

### Performance Precedence {#actor-performance-precedence}

Static pose, default motion, scene performance와 shot-specific override가 겹칠 때 명시적이고 결정적인 precedence를 가져야 한다.

### Start Offset와 Local Clock {#actor-performance-local-clock}

Actor performance의 film start, source motion start, trim, loop와 hold를 구분하여 같은 film time에서 모든 consumer가 같은 local sample을 읽어야 한다.

### Event와 Contact {#actor-performance-events-contacts}

Foot plant, grasp, release, strike, look, speech와 reaction event를 motion sample과 story semantic event에 연결하고 화면·소리·prop state가 같은 시간을 사용해야 한다.

### Performance Gap {#actor-performance-gap}

Story event를 수행하는 motion이 없거나 motion에 필요한 target과 prop이 없으면 generic idle로 완료를 가장하지 않아야 한다.
