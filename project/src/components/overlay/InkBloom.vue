<script setup lang="ts">
/**
 * 水墨晕染：下钻 / 返图用的全屏墨湃。
 * 不规则墨渍从落点洇开 → 宣纸帷幕 → 径向揭开省图。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { canAnimate } from '../../lib/motion'

const props = withDefaults(defineProps<{
  active: boolean
  x?: number
  y?: number
  duration?: number
}>(), {
  x: 0.5,
  y: 0.45,
  duration: 1280,
})

const emit = defineEmits<{ (e: 'done'): void }>()

const uid = `ib-${Math.random().toString(36).slice(2, 8)}`
const playing = ref(false)
const reduced = ref(false)
let doneTimer = 0

const ox = computed(() => Math.round((props.x ?? 0.5) * 1000) / 10)
const oy = computed(() => Math.round((props.y ?? 0.45) * 1000) / 10)

const blots = computed(() => {
  const cx = ox.value
  const cy = oy.value
  return [
    { cx, cy, rx: 18, ry: 15, rot: -14, delay: 0, kind: 'ink' as const, op: 0.78 },
    { cx: cx + 9, cy: cy - 6, rx: 26, ry: 20, rot: 22, delay: 50, kind: 'cinnabar' as const, op: 0.58 },
    { cx: cx - 11, cy: cy + 8, rx: 22, ry: 25, rot: -26, delay: 80, kind: 'cyan' as const, op: 0.5 },
    { cx: cx + 5, cy: cy + 12, rx: 15, ry: 18, rot: 10, delay: 120, kind: 'ink' as const, op: 0.44 },
    { cx: cx - 14, cy: cy - 9, rx: 17, ry: 13, rot: 34, delay: 100, kind: 'cinnabar' as const, op: 0.4 },
    { cx: cx + 16, cy: cy + 3, rx: 12, ry: 15, rot: -8, delay: 140, kind: 'cyan' as const, op: 0.36 },
    { cx: cx - 4, cy: cy - 14, rx: 20, ry: 11, rot: -40, delay: 60, kind: 'ink' as const, op: 0.32 },
  ]
})

const flecks = computed(() => {
  const cx = ox.value
  const cy = oy.value
  return [
    { x: cx - 12, y: cy - 9, r: 1.1 },
    { x: cx + 14, y: cy - 5, r: 0.8 },
    { x: cx - 3, y: cy + 13, r: 1.0 },
    { x: cx + 18, y: cy + 7, r: 0.7 },
    { x: cx - 17, y: cy + 4, r: 0.6 },
    { x: cx + 6, y: cy - 16, r: 0.9 },
    { x: cx - 8, y: cy + 1, rx: 1.6, ry: 0.7, rot: -32 },
    { x: cx + 10, y: cy + 2, rx: 1.2, ry: 0.55, rot: 18 },
  ]
})

function fillOf(kind: 'ink' | 'cinnabar' | 'cyan') {
  return `url(#${uid}-${kind})`
}

watch(() => props.active, (on) => {
  window.clearTimeout(doneTimer)
  if (!on) {
    playing.value = false
    return
  }
  if (reduced.value || !canAnimate()) {
    playing.value = false
    emit('done')
    return
  }
  playing.value = true
  doneTimer = window.setTimeout(() => {
    playing.value = false
    emit('done')
  }, props.duration)
}, { immediate: true })

onMounted(() => {
  reduced.value = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
})
onBeforeUnmount(() => window.clearTimeout(doneTimer))
</script>

<template>
  <div
    v-if="playing"
    class="ink-bloom-root pointer-events-none absolute inset-0 z-[60] overflow-hidden"
    aria-hidden="true"
    :style="{
      '--ox': `${ox}%`,
      '--oy': `${oy}%`,
      '--dur': `${duration}ms`,
    }"
  >
    <!-- 底层宣纸帷幕 -->
    <div class="ink-paper-veil" />

    <svg class="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
      <defs>
        <filter :id="`${uid}-edge`" x="-50%" y="-50%" width="200%" height="200%">
          <feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="3" seed="7" result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="5.5" xChannelSelector="R" yChannelSelector="G" />
          <feGaussianBlur stdDeviation="0.85" />
        </filter>
        <filter :id="`${uid}-soft`" x="-60%" y="-60%" width="220%" height="220%">
          <feTurbulence type="fractalNoise" baseFrequency="0.032" numOctaves="2" seed="3" result="n2" />
          <feDisplacementMap in="SourceGraphic" in2="n2" scale="9" xChannelSelector="G" yChannelSelector="B" />
          <feGaussianBlur stdDeviation="1.8" />
        </filter>
        <filter :id="`${uid}-grain`">
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer><feFuncA type="linear" slope="0.28" /></feComponentTransfer>
        </filter>
        <radialGradient :id="`${uid}-ink`" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#2C2A26" stop-opacity="0.78" />
          <stop offset="38%" stop-color="#3F3A34" stop-opacity="0.42" />
          <stop offset="100%" stop-color="#2C2A26" stop-opacity="0" />
        </radialGradient>
        <radialGradient :id="`${uid}-cinnabar`" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#A64834" stop-opacity="0.7" />
          <stop offset="42%" stop-color="#8C3A28" stop-opacity="0.34" />
          <stop offset="100%" stop-color="#8C3A28" stop-opacity="0" />
        </radialGradient>
        <radialGradient :id="`${uid}-cyan`" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stop-color="#6E8B87" stop-opacity="0.55" />
          <stop offset="50%" stop-color="#8FA9A6" stop-opacity="0.22" />
          <stop offset="100%" stop-color="#8FA9A6" stop-opacity="0" />
        </radialGradient>
      </defs>

      <g class="ink-splash" :filter="`url(#${uid}-soft)`">
        <ellipse
          v-for="(b, i) in blots"
          :key="i"
          class="ink-blot-shape"
          :cx="b.cx"
          :cy="b.cy"
          :rx="b.rx"
          :ry="b.ry"
          :transform="`rotate(${b.rot} ${b.cx} ${b.cy})`"
          :fill="fillOf(b.kind)"
          :opacity="b.op"
          :style="{ animationDelay: `${b.delay}ms` }"
        />
      </g>

      <g class="ink-flecks" :filter="`url(#${uid}-edge)`" fill="#2C2A26">
        <template v-for="(f, i) in flecks" :key="'f' + i">
          <circle v-if="!f.rx" :cx="f.x" :cy="f.y" :r="f.r" opacity="0.4" />
          <ellipse
            v-else
            :cx="f.x" :cy="f.y" :rx="f.rx" :ry="f.ry"
            :transform="`rotate(${f.rot || 0} ${f.x} ${f.y})`"
            opacity="0.35"
          />
        </template>
      </g>

      <rect width="100" height="100" :filter="`url(#${uid}-grain)`" class="ink-grain" />
    </svg>

    <!-- 径向揭开：中心先透出省图 -->
    <div class="ink-reveal-hole" />
  </div>
</template>

<style scoped>
.ink-bloom-root {
  isolation: isolate;
}
.ink-paper-veil {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 90% 75% at var(--ox) var(--oy),
      rgba(247, 241, 228, 0.2) 0%,
      rgba(232, 220, 196, 0.72) 28%,
      rgba(226, 212, 184, 0.94) 62%,
      rgba(214, 199, 168, 0.98) 100%),
    linear-gradient(155deg, #F4EEE2 0%, #E8DCC4 55%, #DCCFAF 100%);
  mix-blend-mode: multiply;
  animation: paperVeil var(--dur) cubic-bezier(0.22, 0.08, 0.16, 1) forwards;
}
.ink-splash {
  animation: splashBloom var(--dur) cubic-bezier(0.16, 0.72, 0.2, 1) forwards;
  transform-box: view-box;
  transform-origin: var(--ox) var(--oy);
}
.ink-blot-shape {
  animation: blotLive calc(var(--dur) * 0.9) cubic-bezier(0.14, 0.82, 0.2, 1) forwards;
}
.ink-flecks {
  animation: fleckIn calc(var(--dur) * 0.7) ease-out forwards;
}
.ink-grain {
  opacity: 0;
  animation: grainFade var(--dur) ease-in-out forwards;
  pointer-events: none;
}
.ink-reveal-hole {
  position: absolute;
  inset: -12%;
  background: radial-gradient(
    circle at var(--ox) var(--oy),
    transparent 0%,
    transparent 6%,
    rgba(242, 236, 224, 0.45) 18%,
    rgba(232, 220, 196, 0.88) 42%,
    rgba(226, 212, 184, 0.97) 100%
  );
  animation: holeOpen var(--dur) cubic-bezier(0.2, 0.1, 0.15, 1) forwards;
}

@keyframes paperVeil {
  0% { opacity: 0; }
  12% { opacity: 1; }
  48% { opacity: 0.92; }
  100% { opacity: 0; }
}
@keyframes splashBloom {
  0% { opacity: 0; transform: scale(0.12); }
  16% { opacity: 1; transform: scale(0.55); }
  48% { opacity: 0.95; transform: scale(1.25); }
  100% { opacity: 0; transform: scale(2.35); }
}
@keyframes blotLive {
  0% { opacity: 0; }
  18% { opacity: inherit; }
  100% { opacity: 0; }
}
@keyframes fleckIn {
  0% { opacity: 0; }
  22% { opacity: 0.55; }
  100% { opacity: 0; }
}
@keyframes grainFade {
  0% { opacity: 0; }
  18% { opacity: 0.45; }
  55% { opacity: 0.28; }
  100% { opacity: 0; }
}
@keyframes holeOpen {
  0% {
    opacity: 1;
    background: radial-gradient(
      circle at var(--ox) var(--oy),
      transparent 0%,
      rgba(242, 236, 224, 0.65) 3%,
      rgba(232, 220, 196, 0.95) 14%,
      rgba(226, 212, 184, 0.99) 100%
    );
  }
  40% {
    opacity: 1;
    background: radial-gradient(
      circle at var(--ox) var(--oy),
      transparent 0%,
      transparent 24%,
      rgba(242, 236, 224, 0.5) 44%,
      rgba(232, 220, 196, 0.88) 68%,
      rgba(226, 212, 184, 0.96) 100%
    );
  }
  100% {
    opacity: 0;
    background: radial-gradient(
      circle at var(--ox) var(--oy),
      transparent 0%,
      transparent 72%,
      rgba(242, 236, 224, 0.12) 100%
    );
  }
}

@media (prefers-reduced-motion: reduce) {
  .ink-bloom-root { display: none; }
}
</style>
