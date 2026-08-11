# Kinematics, contact와 interaction

## Root trajectory와 이동 authority {#performance-kinematics-root-trajectory-authority}

<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-root-trajectories world path와 subject-local motion을 결합하는 root 계약을 정의한다. -->
<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-root-authority-mode clip, path, staging 중 root authority를 선택하게 한다. -->
<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-path-timing path distance와 shot-local timing을 함께 해석한다. -->
<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-path-fit-warp motion warp의 보존 대상과 한계를 명시한다. -->
<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-facing-travel facing과 travel direction을 독립 상태로 둔다. -->
<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-root-ground-clearance ground height, clearance와 root state를 검증한다. -->
<!-- @evidence requirements/motion/root-motion-and-trajectories.md#motion-trajectory-refusal 모순되거나 공간 밖인 trajectory를 거부한다. -->

Root motion 입력은 subject identity, 시작 world transform, local root curve 또는 semantic path, timing·speed law, facing policy, ground·clearance policy와 authority mode다. `clip-authoritative`는 source displacement를 보존하고 staging이 시작 transform만 제공하며, `path-authoritative`는 route와 timing에 맞춰 clip을 retime·warp하고, `in-place`는 clip root displacement를 제거해 외부 placement가 전부를 소유한다. 한 shot에서 같은 root 자유도를 여러 authority가 동시에 쓰지 않는다.

Resolved trajectory는 production frame마다 world root, velocity, facing, path progress, ground residual과 적용 warp를 반환한다. Facing은 travel과 같게 할 수도, gaze·formation·object target에 독립적으로 고정할 수도 있다. Motion warp는 semantic event order, contact phase, gait character와 authored extrema를 보존하는 bounded 변환이어야 하며, 필요한 scale·time·turn 보정이 선언된 한계를 넘으면 경로를 억지로 맞추지 않는다.

Path가 traversable space 밖으로 나가거나 ground가 다가값이라 해석 불가하거나 clearance가 부족하거나 속도·가속이 non-finite이거나 root authority가 충돌하면 실패한다. 결과에는 실패 time, segment, 실제와 허용 residual, 영향받는 event·contact와 route·timing·motion 변경 선택지를 포함한다.

### Procedural gait와 compact rule {#performance-kinematics-procedural-gait-rule}

<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-gaits compact rule에서 재현 가능한 motion을 생성한다. -->
<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-rule-selection procedural rule의 선택과 소유권을 기록한다. -->
<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-gait-table body kind별 gait table을 열린 profile 데이터로 둔다. -->
<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-general-procedural-control gait 밖의 일반 procedural control도 같은 계약으로 확장한다. -->
<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-variation variation을 explicit seed와 bounded law로 생성한다. -->
<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-terrain-adaptation terrain 높이와 기울기에 동작을 적응시킨다. -->
<!-- @evidence requirements/motion/procedural-motion-and-gaits.md#motion-procedural-bound 무제한 simulation이나 per-member curve를 거부한다. -->

Procedural rule은 stable rule identity와 version, semantic capability, target profile, parameter schema와 bounds, deterministic evaluator, output channels, required state, fixed seed domain, cost bound를 가진다. Gait table은 이름, period, limb phase·duty·amplitude, root bob과 style parameter를 body profile이 소유하며 engine이 human 목록으로 고정하지 않는다. Door cycle, wheel roll, wing beat, breathing, idle variation 같은 일반 rule도 같은 등록 경계로 추가한다.

사용자는 available rule, authored clip, external motion, static state 중 실행 방식을 선택한다. Variation은 actor·formation·slot identity와 explicit seed에서 파생하고 allowed parameter만 바꾸며, time마다 새 randomness를 뽑지 않는다. Terrain adaptation은 ground query, foot·wheel contact, slope·step capability를 읽어 root와 limb target을 보정하지만 원래 action meaning과 route를 바꾸지 않는다.

평가 횟수, solver iteration, state size, generated keys와 spatial reach는 선언된 bound 안에 있어야 한다. Rule이 target profile을 지원하지 않거나 terrain이 capability를 넘거나 output channel이 없거나 seed·initial state가 없거나 bound를 초과하면 실패한다. 사용자가 선택하지 않은 procedural life를 정적 object나 background에 자동 부여하지 않는다.

## IK, constraint와 reachability {#performance-kinematics-ik-constraint-reachability}

<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraints-ik target을 따르는 bounded solve를 정의한다. -->
<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-range-of-motion target solve 뒤에도 rig ROM을 적용한다. -->
<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-target-space target의 local, parent, world space를 명시한다. -->
<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-solve-order FK, driver, IK, limit와 contact 보정 순서를 고정한다. -->
<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-coupled-range-drivers coupled range와 driver를 개별 clamp보다 우선 이해한다. -->
<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-reachability chain 길이와 limit로 reachability를 판정한다. -->
<!-- @evidence requirements/motion/constraints-and-inverse-kinematics.md#motion-constraint-solve-failure iteration과 residual 한계를 가진 실패를 반환한다. -->

Constraint solve 입력은 target identity와 frame, owner chain, goal transform 또는 position, pole·twist, influence, solver family, iteration·tolerance bound, ROM·coupled driver, prior state다. 평가 순서는 authored channels, forward state, dependency drivers, bounded IK, joint·channel limits, contact correction과 final validation처럼 contract version에 고정하며, consumer별로 순서를 바꾸지 않는다. Goal이 움직이면 sample time의 authoritative target state를 읽는다.

Reachability는 chain의 rest geometry와 current scale, enabled DOF, ROM, obstacle 또는 declared keep-out, required orientation을 함께 본다. Position만 닿는 것과 방향까지 맞는 것을 구분하고, analytical solve는 모든 valid branch 중 continuity와 pole policy로 결정하며 iterative solve는 fixed iteration과 deterministic tie-break을 사용한다. Coupled limit이나 corrective driver를 축별 clamp로 대체하지 않는다.

Unreachable, singular, pole ambiguity, iteration exhaustion, ROM clamp 후 residual 초과, target frame 불명, dependency cycle은 구분된 failure다. Output은 requested target, resolved end effector, positional·angular residual, chosen branch, iterations, applied limits와 contact impact를 포함하며, 손을 target 근처에 두고 `contact`로 기록하지 않는다.

### Contact phase, weight와 support {#performance-contact-phase-weight-support}

<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-contact-weight-support motion을 world support와 접촉 상태에 결합한다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-contact-phases approach, touch, planted, release 같은 contact phase를 명시한다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-contact-authority-tolerance contact target, frame와 tolerance authority를 정의한다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-weight-cues 속도, support와 settle에서 weight cue를 검증한다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-moving-support 움직이는 support의 time-varying frame을 따른다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-support-load-transfer support set과 load transfer 순서를 계산한다. -->
<!-- @evidence requirements/motion/contact-weight-and-support.md#motion-contact-refusal 떠 있음, 미끄럼과 모순된 support를 거부한다. -->

Contact contract는 stable contact identity, participants와 contact features, target frame, phase intervals, position·orientation·slip tolerance, supporting 또는 grasping 역할, load share, author 또는 solver authority를 가진다. `approach`, `touch`, `planted`, `load`, `release` 같은 phase는 shot-local event와 연결되고, planted 구간에서는 relative transform 또는 허용 slip을 유지한다. Moving platform, carried object, rotating wheel처럼 support가 움직이면 world point를 고정하지 않고 그 support의 time-varying frame에서 접촉을 보존한다.

Weight는 mass가 있다고 자동으로 읽히는 값이 아니라 root acceleration, support polygon, center-of-mass proxy, impact timing, settle, contact force 또는 대체 가능한 deterministic cue의 조합이다. Load transfer는 이전 support와 새 support의 overlap, center-of-mass 이동과 event 순서를 출력하고, falling·jumping·external force처럼 support 밖 상태는 authored cause를 요구한다.

Contact 검증은 phase 내부 sample에서 separation, penetration, relative speed, orientation, support margin과 target availability를 측정한다. Tolerance를 올려 실제 실패를 통과시키지 않으며, 서로 모순된 두 planted contact, 사라진 support, geometry가 없는 feature, excessive foot skate, unexplained float는 실패다. Physics plausibility warning을 사용자가 의도적으로 승인할 수는 있지만 malformed contact나 event realization을 성공으로 바꾸지는 못한다.

### Gaze, expression과 attention solve {#performance-kinematics-gaze-expression-attention}

<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-gaze-attention gaze를 moving target과 attention event에 결합한다. -->
<!-- @evidence requirements/actors/pose-expression-and-gaze.md#actor-expression-channels coarse preset과 available fine channel을 사용한다. -->
<!-- @evidence requirements/motion/layers-blends-and-transitions.md#motion-layer-channel-ownership gaze, face와 body channel의 동시 ownership을 판정한다. -->

Gaze solve는 actor와 target identity, attention interval, eye·head·torso contribution policy, aim axes, world up, target loss policy와 available rig limits를 입력으로 받는다. Expression solve는 intent preset, intensity, optional fine channels, transition·hold·settle timing과 voice alignment receipt를 입력으로 받는다. 둘은 body performance와 별도 layer일 수 있지만 같은 head·face channel을 쓰면 ownership과 priority를 명시한다.

출력은 각 sample의 resolved target relation, eye·head·torso contribution, constraint residual, expression weight와 event relation이다. 눈 channel이 없으면 head로만 해결할지 unsupported로 남길지 capability plan이 결정하며, facial channel이 없는 crude proxy에 정교한 감정 전달을 주장하지 않는다. Target이 뒤에 있거나 사라졌을 때 joint를 뒤집거나 갑자기 neutral로 튀지 않고 authored fallback 또는 failure를 사용한다.

### Attachment, handoff와 object interaction {#performance-interaction-attachment-object-handoff}

<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-object-interaction actor와 object가 공유하는 timed interaction을 정의한다. -->
<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-object-authored-vocabulary object마다 사용자 저작 control과 affordance vocabulary를 허용한다. -->
<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-object-state-transition object articulation과 상태 전이를 event로 기록한다. -->
<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-object-handoff object ownership과 attachment handoff를 명시한다. -->
<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-coupled-objects 여러 object의 coupled motion과 constraint를 평가한다. -->
<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-multi-subject-interaction 여러 actor·object가 참여하는 동기 choreography를 보존한다. -->
<!-- @evidence requirements/motion/object-motion-and-interaction.md#motion-interaction-refusal missing affordance, timing과 contact 실패를 거부한다. -->
<!-- @evidence requirements/staging/interactions-and-choreography.md#staging-interaction-contact-contract choreography의 contact 역할과 motion event를 연결한다. -->
<!-- @evidence requirements/asset-authoring/rig-and-state.md#asset-general-joint-relations skeleton 없는 object도 joint profile로 움직일 수 있게 한다. -->

Object interaction은 stable interaction identity, participants와 역할, object state before·after, affordance·socket·bone·surface target, approach·contact·attach·release event, ownership interval, coupled constraint와 failure policy를 가진다. Skeleton이 없는 object는 transform·joint·morph·domain channel clip으로 움직이고, articulated object는 자신의 profile과 limits를 사용한다. Object vocabulary는 문, 차량, 도구, 생물 아닌 기계 등 새로운 control을 추가할 수 있지만, mesh 모양에서 의미를 추정하지 않고 authored affordance와 capability를 요구한다.

Handoff는 이전 owner의 release와 새 owner의 contact·attach 사이에 object root state를 연속적으로 넘기며, 어느 interval에도 두 배타적 owner가 동시에 authoritative하지 않아야 한다. Rigid attachment는 parent frame을 따르고 release 시 world transform과 velocity를 보존한다. Coupled object는 shared driver 또는 constraint graph와 solve order를 가지며, multi-subject action의 reaction은 computed contact event 또는 authored semantic event에서 scheduling된다.

Missing target, unsupported control, violated hinge travel, dangling attachment, ownership overlap·gap, unreachable grip, event 순서 역전, contact residual 초과는 실패다. Interaction event output은 kind, producer, exact local time, initiator·target·object, computed point, source action과 scheduled reaction을 포함하며, scripted cue와 collision-solved contact의 provenance를 구분한다.

### Secondary motion과 moving boundary {#performance-secondary-motion-boundary-choice}

<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-motion primary action에 종속된 bounded 변화를 정의한다. -->
<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-author-solver secondary state의 author와 solver 책임을 분리한다. -->
<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-adoption-choice live, baked, static 또는 off 선택을 사용자에게 제공한다. -->
<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-moving-boundary 움직이는 attachment boundary와 collision proxy를 사용한다. -->
<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-static-compatibility secondary를 쓰지 않는 기존 static path를 보존한다. -->
<!-- @evidence requirements/motion/secondary-motion.md#motion-secondary-claim-boundary cloth, hair와 soft-body realism claim을 제한한다. -->

Secondary domain은 primary driver identity, rest state, attachment·collision boundary, bounded physical parameters, seed, fixed-step, cache policy와 active interval을 가진다. 사용자는 `live deterministic`, `baked`, `static`, `disabled`를 선택하고, author는 원하는 범위와 boundary를 소유하며 solver는 그 안의 파생 state만 계산한다. Actor나 object가 움직이면 boundary도 같은 sampled transform을 사용하고, stale static collision volume을 계속 사용하지 않는다.

Output은 resolved state 또는 baked cache digest, input fingerprint, max displacement·energy 같은 bound, collision·stability finding과 visual review state다. Secondary motion을 생략한 기존 기록은 이전처럼 static하게 재생되어야 한다. Solver가 없거나 unstable하거나 budget을 넘으면 static 또는 bake로 자동 전환하지 않고 선택지를 반환하며, crude proxy spring이나 cloth가 production-quality hair·fabric simulation을 증명한다고 주장하지 않는다.

### Scale retarget와 contact 재해결 {#performance-kinematics-retarget-scale-contact}

<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retargeting-scale 다른 rig와 scale에서 motion을 재사용하는 변환을 정의한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-mapping-selection mapping 선택과 사용자 override를 기록한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-source-provenance source clip, rig와 characterization provenance를 보존한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-proportion limb와 root proportion 차이를 보정한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-non-humanoid non-humanoid profile 사이에도 semantic correspondence를 요구한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-contact-preservation target rig에서 contact를 다시 해결한다. -->
<!-- @evidence requirements/motion/retargeting-and-scale.md#motion-retarget-refusal mapping, ROM 또는 contact를 보존하지 못하면 거부한다. -->

Retarget 입력은 source motion·rig와 target rig identity, selected semantic mapping, rest characterization, source·target proportion, root scale·facing policy, contact windows, target ROM과 override decision이다. Joint angle 의미를 우선 보존하고 root translation과 reach는 선언된 proportion measure로 변환하며, contact window는 target rest geometry에서 IK 또는 다른 bounded solver로 다시 해결한다. Non-humanoid는 compatible semantic chain과 gait·control correspondence가 있을 때만 같은 pipeline을 사용한다.

결과는 transformed motion, characterization receipt, root·limb scale, per-contact residual, ROM correction, lost·unsupported channel과 current target review를 포함한다. 사용자 override는 선택 근거로 남지만 impossible reach나 invalid mapping을 성공으로 만들지 않는다. Contact, silhouette 또는 action meaning을 보존하지 못하면 alternate mapping, target-specific clip, staging adjustment 또는 refusal을 반환한다.

### Interaction 결정론과 compatibility {#performance-interaction-determinism-compatibility}

<!-- @evidence requirements/motion/validation-and-determinism.md#motion-scrambled-seek contact와 interaction event도 seek 순서와 무관하게 재현되게 한다. -->
<!-- @evidence requirements/product/extensibility-and-compatibility.md#product-omission-compatibility 새 interaction 기능을 생략한 기존 입력의 동작을 보존한다. -->

Root, IK, contact, attachment, object와 secondary solve의 evaluation identity는 동일한 input digest, frame clock, seed, solver version과 fixed bounds를 포함한다. 같은 time을 어떤 순서로 seek해도 resolved state와 event identity가 같아야 하며, computed event를 후속 reaction과 sound가 재사용해 별도 충돌 계산으로 timing을 갈라놓지 않는다.

새 affordance, constraint, interaction event kind 또는 procedural rule은 optional additive data로 도입하고, 이를 쓰지 않는 기존 motion의 state와 event 출력은 유지한다. 평가 순서, retention, target-space 또는 contact 의미의 변경은 migration이 필요하다. Unsupported capability는 빈 event 목록과 구분된 status로 나타내고, 생략을 성공한 no-contact로 해석하지 않는다.
