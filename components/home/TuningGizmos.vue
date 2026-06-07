<script setup lang="ts">
// Dev-only: a small bright marker at every tunable vec3 point flagged `gizmo`,
// so hard-to-eyeball anchors (the forehead, the emitter, …) are visible in the
// scene while you drag their sliders. Rendered in the ASCII pass (it's a dev aid,
// rough placement is fine — the live effect gives the precision). Positions are
// reactive, so the markers track the sliders in real time.
const tuning = useTuningStore();
</script>

<template>
  <TresGroup
    v-for="g in tuning.gizmoFields"
    :key="g.group + ':' + g.field.key"
    :position="[g.value.x, g.value.y, g.value.z]"
  >
    <TresMesh>
      <TresSphereGeometry :args="[0.06, 10, 10]" />
      <TresMeshBasicMaterial color="#ff2db6" :depth-test="false" />
    </TresMesh>
  </TresGroup>
</template>
