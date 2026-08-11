# Contact, Weight와 Support

## 동작을 세계에 붙이는 Contact {#motion-contact-weight-support}

Foot plant, hand grasp, seat, lean, push, carry, impact, rolling와 object support를 subject landmark, target geometry, time interval, normal, tangent, tolerance, relative transform와 release event로 표현할 수 있어야 한다.

### Contact Phase {#motion-contact-phases}

Approach, touch, hold, load, slide, roll, release와 separation을 구분하고 contact가 필요한 frame에서 target과 effector가 같은 relative-motion rule로 움직여야 한다.

### Contact Authority와 Tolerance {#motion-contact-authority-tolerance}

Contact가 root, limb, target object 또는 coupled solver 중 무엇을 얼마나 보정할 수 있는지, position과 angle tolerance, allowed slip와 correction bound를 선언하고 두 대상을 무제한 늘이거나 teleport하지 않아야 한다.

### Weight Cue {#motion-weight-cues}

Center shift, anticipation, follow-through, support limb, acceleration와 reaction을 bounded pose와 timing cue로 표현하여 무게가 단순 속도 adjective에 머물지 않아야 한다.

### Moving Support {#motion-moving-support}

Vehicle, platform, actor hand와 moving object에 붙은 contact는 같은 fixed clock의 target transform을 읽고 world anchor로 고정되지 않아야 한다.

### Support와 Load Transfer {#motion-support-load-transfer}

Required support set, center cue, carried weight class와 support 전환 시간을 표현하여 두 발, 좌석, 손잡이 또는 vehicle wheel 중 무엇이 subject를 지지하는지 검토할 수 있어야 한다.

### Contact Refusal {#motion-contact-refusal}

Target 누락, penetration, floating gap, hold 중 drift, release 전 분리, incompatible speed와 두 authority가 같은 control을 소유하는 상태를 거부해야 한다.
