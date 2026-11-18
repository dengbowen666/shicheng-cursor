<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useGuideStore } from '../stores/guides'
import { useUIStore } from '../stores/ui'
import CityCover from '../components/overlay/CityCover.vue'
import { Plus, Trash2, Download, Upload, MapPin, Calendar, ArrowRight, Compass, Route } from 'lucide-vue-next'

const guideStore = useGuideStore()
const uiStore = useUIStore()
const { guides } = storeToRefs(guideStore)

const fileInput = ref<HTMLInputElement | null>(null)

function openGuide(id: string) {
  guideStore.openGuide(id)
  uiStore.gotoGuide()
}

function del(id: string, name: string) {
  if (confirm(`确定删除「${name}」的攻略吗？此操作不可恢复。`)) {
    guideStore.removeGuide(id)
  }
}

function totalNodes(g: any) {
  return g.days.reduce((s: number, d: any) => s + d.nodes.length, 0)
}
function totalDays(g: any) {
  return g.days.filter((d: any) => d.nodes.length > 0).length || g.days.length
}

function exportAll() {
  const json = guideStore.exportGuides()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `行旅攻略备份_${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function importAll() {
  fileInput.value?.click()
}
function onFile(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const n = guideStore.importGuides(String(reader.result))
      alert(`成功导入 ${n} 份攻略`)
    } catch {
      alert('导入失败：文件格式不正确')
    }
  }
  reader.readAsText(file)
  ;(e.target as HTMLInputElement).value = ''
}

const sortedGuides = computed(() => [...guides.value].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
</script>

<template>
  <div class="w-full h-full overflow-y-auto drawer-scroll paper-texture">
    <div class="max-w-[1180px] mx-auto px-5 md:px-8 py-6 md:py-8">
      <!-- 头部 -->
      <div class="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div class="flex items-center gap-3">
          <div class="seal w-11 h-11 text-base flex-col animate-seal-in"><span>攻</span><span>略</span></div>
          <div>
            <h1 class="font-brush text-2xl md:text-3xl text-ink tracking-song">我的攻略库</h1>
            <p class="font-cn text-[11px] text-inkLight tracking-[0.25em] mt-0.5">踏过的山河 · 都在这里</p>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button class="h-9 px-3 paper-card flex items-center gap-1.5 font-cn text-xs text-inkLight hover:text-ink" @click="importAll">
            <Upload :size="14" /> 导入
          </button>
          <button class="h-9 px-3 paper-card flex items-center gap-1.5 font-cn text-xs text-inkLight hover:text-ink" @click="exportAll" :disabled="!guides.length" :class="!guides.length ? 'opacity-40' : ''">
            <Download :size="14" /> 导出
          </button>
          <button class="h-9 px-4 bg-cinnabar text-mist flex items-center gap-1.5 font-cn text-xs hover:bg-cinnabarDeep btn-seal shadow-seal" @click="uiStore.gotoExplore()">
            <Plus :size="14" /> 新建攻略
          </button>
          <input ref="fileInput" type="file" accept=".json" class="hidden" @change="onFile" />
        </div>
      </div>

      <div class="ink-divider mb-6"></div>

      <!-- 攻略卡片 -->
      <div v-if="sortedGuides.length" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <div v-for="g in sortedGuides" :key="g.id" class="paper-card overflow-hidden group">
          <button class="block w-full text-left" @click="openGuide(g.id)">
            <div class="relative h-40 overflow-hidden img-fallback">
              <CityCover :city="g.cityName" class="group-hover:scale-105 transition-transform duration-500" />
              <div class="absolute inset-0 bg-gradient-to-t from-ink/45 via-transparent to-transparent"></div>
              <div class="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-ink/85 via-ink/45 to-transparent"></div>
              <!-- 印章 -->
              <div class="absolute top-3 right-3 seal w-12 h-12 text-sm flex-col opacity-90">
                <span>{{ g.cityName.slice(0,1) }}</span>
                <span class="text-[8px] font-cn tracking-tighter">攻略</span>
              </div>
              <div class="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                <div>
                  <h3 class="font-brush text-2xl text-mist drop-shadow">{{ g.cityName }}</h3>
                  <p class="font-cn text-[10px] text-mist/80 tracking-widest">{{ g.province }}</p>
                </div>
              </div>
            </div>
          </button>

          <div class="px-4 py-3">
            <div class="flex items-center gap-4 font-cn text-[11px] text-inkLight mb-3">
              <span class="flex items-center gap-1"><Calendar :size="12" /> {{ totalDays(g) }} 天</span>
              <span class="flex items-center gap-1"><MapPin :size="12" /> {{ totalNodes(g) }} 处</span>
              <span class="flex items-center gap-1"><Route :size="12" /> ¥{{ g.expenses.reduce((s:number,e:any)=>s+e.amount,0) }}</span>
            </div>
            <div class="flex items-center gap-2">
              <button class="flex-1 h-8 bg-mist border border-celadon text-celadonDeep font-cn text-xs hover:bg-celadon/10 flex items-center justify-center gap-1" @click="openGuide(g.id)">
                继续编辑 <ArrowRight :size="13" />
              </button>
              <button class="w-8 h-8 flex items-center justify-center border border-ink/20 text-inkLight/60 hover:text-cinnabar hover:border-cinnabar/40" @click="del(g.id, g.cityName)" title="删除">
                <Trash2 :size="14" />
              </button>
            </div>
            <p class="font-cn text-[9px] text-inkLight/60 mt-2 text-right">更新于 {{ new Date(g.updatedAt).toLocaleDateString('zh-CN') }}</p>
          </div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="text-center py-20">
        <div class="seal w-16 h-16 text-2xl mx-auto mb-4 opacity-80">空</div>
        <p class="font-brush text-xl text-ink/70">还没有攻略</p>
        <p class="font-cn text-xs text-inkLight mt-2 mb-5">去九州图上选一座城，开始你的第一份行旅</p>
        <button class="h-10 px-6 bg-cinnabar text-mist font-cn text-sm hover:bg-cinnabarDeep btn-seal shadow-seal inline-flex items-center gap-2" @click="uiStore.gotoExplore()">
          <Compass :size="16" /> 去看山河
        </button>
      </div>
    </div>
  </div>
</template>
