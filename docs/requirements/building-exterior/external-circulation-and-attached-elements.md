# 외부 Circulation과 부착 시설

## 건물과 결합된 외부 요소 {#building-external-circulation-attachments}

Exterior stair, fire escape, ramp, ladder, bridge, gangway, canopy, awning, louver, shutter, maintenance platform, sign와 building-mounted equipment를 명시적 identity, support, route와 connection으로 표현할 수 있어야 한다.

### Circulation 연결 {#building-external-circulation}

Stair, ramp, bridge와 walkway는 시작·끝 building 또는 map node, level, landing, width, rise·run 또는 slope, headroom, guard와 door·opening 또는 map path connection을 가져야 한다. Interior가 연결되면 threshold와 accessible route가 양쪽에서 같은 connector state를 사용해야 한다.

### 부착과 지지 {#building-external-attachment-support}

Attachment는 host wall, roof, structure 또는 foundation의 anchor, orientation, load path 또는 declared visual support, installation extent와 clearance를 가져야 한다. Facade finish만을 구조 support로 추정하지 않아야 한다.

### 가동 요소 {#building-external-operable-element}

Awning, shutter, gate, folding stair, bridge joint와 maintenance equipment의 state와 movement volume이 facade, opening, interior threshold, map route, actor와 camera를 간섭하는지 확인할 수 있어야 한다.

### 무지지 요소의 거부 {#building-external-attachment-refusal}

Anchor 없는 attachment, 끊긴 path, level mismatch, inverted flight, insufficient headroom, blocked landing와 impossible clearance를 stable identity를 가진 finding으로 남겨야 한다.

### 여러 건물 동의 연결 {#building-external-multi-building-connection}

Skybridge와 exterior connector가 여러 건물 동을 잇는 경우 각 end의 building, storey, boundary, transform와 independent movement allowance를 보존하고 connector를 별도 건물 동이나 map road로 오인하지 않아야 한다.
