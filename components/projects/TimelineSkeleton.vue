<script setup lang="ts">
/**
 * What the timeline looks like while its payload is still in flight.
 *
 * Only reachable on a client-side navigation into /projects: a direct load
 * gets the data inlined in the prerendered payload and never sees this. It
 * exists so that second-or-so does not show an empty page under a full hero.
 *
 * Shaped like the thing it is standing in for — a stem down the middle with
 * cards alternating off it — so the real timeline lands in the same place
 * rather than replacing something of a different size.
 */
defineProps<{ rows?: number }>();
</script>

<template>
  <div class="skel" aria-hidden="true">
    <div class="stem" />
    <div
      v-for="i in rows ?? 5"
      :key="i"
      class="row"
      :class="i % 2 ? 'right' : 'left'"
      :style="{ '--i': i }"
    >
      <div class="card">
        <div class="hd">
          <span class="ln w4" />
          <span class="ln w7 tall" />
          <span class="ln w5" />
        </div>
        <div class="bd">
          <span class="ln w10" />
          <span class="ln w9" />
          <span class="ln w6" />
        </div>
      </div>
    </div>
    <p class="sr">Loading projects…</p>
  </div>
</template>

<style scoped>
.skel {
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 196px minmax(0, 1fr);
  row-gap: 118px;
  padding-bottom: 4rem;
}
.stem {
  position: absolute;
  top: 0;
  bottom: 4rem;
  left: 50%;
  width: 2px;
  transform: translateX(-1px);
  background: linear-gradient(to bottom, #00ff9c, #1b2430 55%, transparent);
  opacity: 0.25;
}
.row { display: flex; min-width: 0; }
.row.left { grid-column: 1; justify-content: flex-end; }
.row.right { grid-column: 3; justify-content: flex-start; }

.card {
  width: min(396px, 100%);
  border: 1px solid var(--vp-line);
  border-radius: 3px;
  background: var(--vp-panel);
  overflow: hidden;
  /* Each card breathes a beat after the one above it, so the wait reads as
     the page filling in rather than as four identical boxes pulsing. */
  animation: skel-breathe 1.9s ease-in-out infinite;
  animation-delay: calc(var(--i) * 0.12s);
}
.hd { padding: 0.85rem 1.15rem 0.8rem; border-bottom: 1px solid var(--vp-line); display: grid; gap: 0.45rem; }
.bd { padding: 1rem 1.15rem 1.4rem; display: grid; gap: 0.5rem; }

.ln { display: block; height: 0.55rem; border-radius: 2px; background: var(--vp-line-hi); }
.ln.tall { height: 1rem; }
.w4 { width: 22%; }
.w5 { width: 40%; }
.w6 { width: 55%; }
.w7 { width: 64%; }
.w9 { width: 88%; }
.w10 { width: 100%; }

@keyframes skel-breathe {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 0.8; }
}

.sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (max-width: 1000px) {
  .skel { grid-template-columns: 56px minmax(0, 1fr); row-gap: 88px; }
  .row.left, .row.right { grid-column: 2; justify-content: flex-start; }
  .stem { left: 26px; }
}
@media (prefers-reduced-motion: reduce) {
  .card { animation: none; opacity: 0.6; }
}
</style>
