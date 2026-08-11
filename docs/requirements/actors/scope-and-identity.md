# Actor 범위와 Identity

## Story와 Render 사이의 Actor {#actor-scope-identity}

Actor는 story character 또는 non-character performer를 model, skeleton, pose, motion, voice, costume, prop와 scene placement에 연결하는 stable production identity를 가져야 한다.

### Character와 Actor 구분 {#actor-character-distinction}

하나의 story character를 여러 age, costume, proxy, stunt double와 rendition actor가 표현할 수 있고 한 generic actor prototype이 여러 unnamed role에 instance될 수 있어야 한다.

### Human과 열린 Performer {#actor-open-performer-kind}

Humanoid proxy, articulated object, creature proxy와 project-defined performer를 지원하되 직접 저작하는 정교한 anatomy, skin, hair와 arbitrary likeness는 제품 약속으로 삼지 않아야 한다.

### Authored Fact {#actor-authored-facts}

Role, scale, rig, appearance, capabilities, voice와 state는 project source가 소유하고 이름이나 model filename에서 성격과 행동을 추정하지 않아야 한다.

### Missing Binding {#actor-missing-binding}

Scene이 요구하는 character에 actor, model, required control 또는 performance가 없으면 origin pose와 default voice로 조용히 대체하지 않아야 한다.
