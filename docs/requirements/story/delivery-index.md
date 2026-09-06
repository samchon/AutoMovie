# Script와 Screenplay Delivery Index

## 권위 없는 순서 projection {#story-delivery-index-boundary}

### Canonical ordered link block {#story-delivery-index}

각 script와 screenplay delivery group의 `index.md`는 group H1과 numbered unit filename 순서의 canonical link block만 가져야 한다. Link label은 unit의 visible H1이고 target은 normalized project-relative Markdown path이며 index는 action, dialogue, participant 또는 story fact를 다시 요약하는 두 번째 권위가 될 수 없다.

Check와 write는 같은 pure renderer 결과를 사용해야 한다. Missing index 또는 unit, malformed·중복·unmatched marker, extra·missing·duplicate·wrong-order·wrong-target link, invalid H1과 apply 전후 source 변경을 named diagnostic으로 거부하고 반복 실행은 byte-identical해야 한다.
