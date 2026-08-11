# Scene Lowering과 Runtime State

## Declared Source를 Renderable State로 변환 {#rendering-scene-lowering-runtime}

Scene lowering은 model, instance, actor, formation, camera, light, environment, effect와 material의 compiled identity를 runtime object와 deterministic state에 연결해야 한다.

### Ownership 보존 {#rendering-lowering-ownership}

Runtime object는 source subject, group, material, semantic owner와 state를 유지하여 mask, selection, diagnostic와 review가 같은 identity를 읽어야 한다.

### Time Update {#rendering-runtime-time-update}

각 frame에서 transform, pose, morph, material state, light, effect와 visibility를 fixed film clock으로 update하고 previous frame state가 seek 결과를 바꾸지 않아야 한다.

### Build와 Dispose {#rendering-runtime-lifecycle}

Runtime object, texture, buffer, audio, effect와 listener를 build, update, replace와 dispose할 수 있고 retry와 shot change에서 stale resource가 남지 않아야 한다.

### Lowering Refusal {#rendering-lowering-refusal}

Unknown model, missing material, unsupported feature, duplicate runtime owner와 invalid state를 generic mesh 또는 origin object로 대체하지 않아야 한다.
