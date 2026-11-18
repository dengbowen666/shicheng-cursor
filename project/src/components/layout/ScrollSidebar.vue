<script setup lang="ts">
/**
 * 首页右缘竖挂轴（D60/D61）：收起 ≈48px 轴条，展开 ≈340px 覆盖式卷面板。
 * 点轴头展开；点轴外 / Esc 收合；hover 微伸示意。
 */
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { unroll } from '../../lib/motion'

const props = withDefaults(defineProps<{
  open?: boolean
  title?: string
}>(), {
  open: false,
  title: '拾程 · 卷',
})

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const root = ref<HTMLElement | null>(null)
const hovering = ref(false)

function setOpen(v: boolean) { emit('update:open', v) }
function toggle() { setOpen(!props.open) }

function onDocPointer(e: PointerEvent) {
  if (!props.open) return
  const el = root.value
  if (!el) return
  if (e.target instanceof Node && el.contains(e.target)) return
  setOpen(false)
}
function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open) setOpen(false)
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointer, true)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocPointer, true)
  document.removeEventListener('keydown', onKey)
})

watch(() => props.open, async v => {
  if (v) {
    hovering.value = false
    await nextTick()
    const panel = root.value?.querySelector('.scroll-panel') as HTMLElement | null
    unroll(panel, 'right')
  }
})
</script>

<template>
  <aside
    ref="root"
    class="scroll-sidebar absolute top-0 bottom-0 right-0 z-30 flex pointer-events-none"
    :class="open ? 'is-open' : ''"
    :data-open="open ? '1' : '0'"
  >
    <!-- 收起轴条 -->
    <button
      type="button"
      class="scroll-rail pointer-events-auto relative flex flex-col items-center justify-between py-3 shrink-0 border-l border-ink/20 bg-paper/92 paper-texture shadow-[-8px_0_24px_-18px_rgba(38,35,31,.55)] transition-[width,transform] duration-300 ease-out"
      :class="open ? 'w-0 opacity-0 overflow-hidden border-0' : 'w-12'"
      :style="!open && hovering ? { transform: 'translateX(-6px)' } : undefined"
      :aria-expanded="open"
      :aria-label="open ? '收合挂轴' : '展开挂轴'"
      @mouseenter="hovering = true"
      @mouseleave="hovering = false"
      @click="toggle"
    >
      <span class="w-2.5 h-2.5 rounded-full bg-ochre/80 shadow-seal" />
      <span class="vertical-text font-cn text-[11px] tracking-[0.42em] text-ink/75 writing-vertical">{{ title }}</span>
      <span class="seal w-7 h-7 text-[10px] flex-col leading-none"><span>拾</span><span>程</span></span>
      <span class="w-2.5 h-2.5 rounded-full bg-ochre/80" />
    </button>

    <!-- 展开卷面板 -->
    <div
      class="scroll-panel pointer-events-auto relative flex flex-col h-full border-l-2 border-ink/25 bg-paper/96 paper-texture backdrop-blur-[2px] shadow-[-16px_0_40px_-24px_rgba(38,35,31,.6)] transition-[width,opacity,transform] duration-300 ease-out overflow-hidden"
      :class="open ? 'w-[min(340px,92vw)] opacity-100 translate-x-0' : 'w-0 opacity-0 translate-x-4'"
      role="dialog"
      :aria-hidden="!open"
    >
      <div class="absolute left-0 top-0 bottom-0 w-px bg-ink/15" aria-hidden="true" />
      <div class="absolute left-[3px] top-0 bottom-0 w-px bg-ink/10" aria-hidden="true" />

      <header class="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-ink/12 shrink-0">
        <div class="flex items-center gap-2 min-w-0">
          <span class="seal w-8 h-8 text-[11px] flex-col leading-none"><span>拾</span><span>程</span></span>
          <div class="min-w-0">
            <p class="font-brush text-lg text-ink leading-none">拾程 · 卷</p>
            <p class="font-cn text-[9px] tracking-[0.28em] text-inkLight mt-1">一图一轴</p>
          </div>
        </div>
        <button
          type="button"
          class="w-8 h-8 border border-ink/20 text-inkLight hover:text-cinnabar hover:border-cinnabar/40 font-cn text-xs"
          title="收合"
          @click="setOpen(false)"
        >收</button>
      </header>

      <div class="flex-1 min-h-0 flex flex-col overflow-hidden">
        <slot />
      </div>
    </div>
  </aside>
</template>

<style scoped>
.writing-vertical {
  writing-mode: vertical-rl;
  text-orientation: mixed;
}
</style>
