# 拾程 · AI 辅助设计文档（A 系列）

> 版本：**v0.2（大幅收窄）**　日期：2026-11-18　适用：shicheng v4.7.1
> 定位：D 系列管"长什么样"，O 系列管"自己用顺不顺"，L 系列管"数据怎么建模"，**A 系列管"大模型怎么接进来"**。
> 状态：**待落地，未改任何源码。**

---

## 0. 一句话结论

**只在「智能小助手」里加一张 AI 卡。** AI 不写新功能，只从现有的四个动作里挑一个、给一个目标、说明理由；点「采用」走的是你已经在用的 `trip.setSegmentMode` / `addToDay` / `removeFromDay` / `reorderByOrder`。**数据模型零改动，导出零改动，撤销栈零改动。**

> v0.1 的 A01–A05（题跋代笔、闲章、城市题识、忆游小记、锦囊）全部移出本期。第六节留档，不删除，但不做。

---

## 1. 收窄后的范围

| 项 | v0.1 | **v0.2（本期）** |
|---|---|---|
| 功能数 | 5 | **1**（智能提示内的一张卡） |
| `types/index.ts` 改动 | 加 `noteAi` / `sealAi` / `titleAi` / `aiLog` | **无** |
| 新组件 | `AiSeal.vue` | **无** |
| `export.ts` 改动 | 题跋追加「（拟）」 | **无** |
| 改动文件数 | 13 | **6** |

**零数据模型改动是本版最大的价值**：AI 的产物不是"内容"，而是一次"动作"。动作执行完就消失，落库的是 `mode='bike'` 这种原本就存在的字段——所以回头看没有任何"AI 污染"问题，也就不需要「拟」字印、不需要导出标记、不需要动撤销栈。

---

## 2. 为什么 AI 放在这里才算"有意义"

现有四张卡是纯规则（`SmartAssist.vue`）：

| 卡 | 判据 | 规则能做到 | 规则做不到 |
|---|---|---|---|
| ① 距离推荐 | `recommendMode(km)` | 800m/3km 阈值 | 同上缓坡、带老人、正午暴晒 |
| ② 顺路重排 | 最近邻 | 几何最优 | 上午爬山下午喝茶的语义顺路 |
| ③ 过载预警 | `stopCount > 8` 或 `travelMin > 180` | 计数 | 这 7 个点里哪个最不值 |
| ④ 欠载提醒 | `endMin < 15:00` | 时刻 | 补哪个点、为什么是它 |

规则的强项是**数字**，弱项是**理由与取舍**。所以 AI 的价值不是"多一条建议"，而是**在同样的四个动作上，用语义和人话给出取舍**。它不该新增动作类型——一旦新增，就变成新功能，又要重新设计交互、撤销、持久化。

**这也正好回答了"为什么只要一个"**：四个杠杆已经够用，缺的只是"该拉哪一根、为什么"。

---

## 3. 交互形态

### 3.1 位置

`SmartAssist.vue` 面板内，四张规则卡之上，第五张卡：

```
┌─ 智能小助手 ────────── 只建议 · 取弃由你 ─┐
│  ┌ 拟 ─────────────────────────┐        │  ← 新增
│  │ 午后两点最晒，上山恐吃力。    │        │
│  │ 不如把「寂照庵」挪到次日晨间，│        │
│  │ 今日改往「大理博物馆」。      │        │
│  │           [ 采用 ] [ 忽略 ]   │        │
│  └──────────────────────────────┘        │
│  ① 这段约 4.2km，宜打车 …                │
│  ② 顺路重排 · 预览 …                     │
└──────────────────────────────────────────┘
```

### 3.2 触发：**手动，不自动**

**关键决定**：不在 `onMounted` 或 `watch(dayIndex)` 时自动请求。

理由：切天、改一个点、调一次顺序都会触发 computed 重算，自动请求等于每动一下打一次模型——延迟、配额、以及"面板在抖"。改为：

- 面板底部常驻一个小按钮：「请 AI 通盘看一眼」；
- 仅在 `aiReady()` 为真时渲染（无端点/无 Key/公网版 → 按钮不存在）；
- 点击后卡片位置先出一枚墨点呼吸，再落成文字。

### 3.3 采用 = 走现有动作

AI 输出被解析成一个**受限动作指令**，点「采用」后调用现有 store 方法，与手动操作完全同一条路径：

| AI 动作 | 调用 | 与现有哪个卡同源 |
|---|---|---|
| `mode` | `trip.setSegmentMode(day, segId, mode)` | ① 距离推荐 |
| `reorder` | `trip.reorderByOrder(day, order)` | ② 顺路重排 |
| `trim` | `trip.removeFromDay(poiId, day)` | ③ 过载预警 |
| `fill` | `trip.addToDay(poi, day)` | ④ 欠载提醒 |
| `none` | 不写任何东西 | — |

因为复用现有方法，**撤销、快照合并、`segmentIds` 增量重建、真实路线免于被打回「估」——全部自动继承**，一行都不用改。

### 3.4 与规则卡去重

若 AI 提议的 `mode` 动作与 ① 号卡提议的段+方式完全相同，则**不渲染 AI 卡**（避免同一建议出现两次）。检查成本约 5 行。

---

## 4. 接入层 `src/lib/ai.ts`

全文件约 100 行，对外一个函数。

```ts
export interface AdviceRequest {
  dayIndex: number
  city: string
  date?: string
  departTime: string
  stops: { name: string; category: string; stayMin: number; arrive: string }[]
  segments: { from: string; to: string; mode: string; km?: number; min: number }[]
  weather?: string
  budgetLeft?: string
  pool: string[]                 // 收藏池候选（最多 8 个）
}

export type AdviceAction =
  | { action: 'mode'; seg: [string, string]; mode: 'walk' | 'bike' | 'taxi' | 'transit'; reason: string }
  | { action: 'reorder'; order: string[]; reason: string }
  | { action: 'trim'; poi: string; reason: string }
  | { action: 'fill'; poi: string; reason: string }
  | { action: 'none'; reason: string }

export const AI_ENABLED: boolean
export function aiReady(): boolean

/** 失败一律返回 null，调用方不渲染卡片，绝不打断编辑 */
export async function advise(req: AdviceRequest): Promise<AdviceAction | null>
```

### 4.1 请求形状（Dify Service API）

配置存法沿用腾讯 Key 的范式（`ui.ts` 的 `shicheng:key`）：

| 存储键 | 内容 |
|---|---|
| `shicheng:aiBase` | `http://10.32.16.199/v1` |
| `shicheng:aiKey` | `app-xxxxxxxx` |

```
POST {base}/chat-messages
Authorization: Bearer {key}
Content-Type: application/json

{
  "inputs": { "system": "<下面这段 prompt>" },
  "query": "<AdviceRequest 拼成的纯文本>",
  "response_mode": "blocking",
  "conversation_id": "",
  "user": "shicheng-local"
}
```

三条纪律：

1. **`conversation_id` 恒为空字符串**——每次独立生成，否则上一天的建议会污染下一天。
2. **`response_mode: "blocking"`**——不做流式；拿到全文后本地按字 stagger 显现即可（复用 `motion.ts`），比 SSE 少写 60 行易错代码。
3. **`user` 用固定常量**——不要随机值，否则 Dify 日志里一堆匿名会话。

### 4.2 Prompt（放前端，Dify 侧只改一次）

现有 chatflow 只需改一次：Start 节点加一个 `system` 文本输入变量，LLM 节点的 system prompt 改为 `{{#start.system#}}`。此后 prompt 全部在前端，Dify 侧再也不用动。

```
你是行程编辑，审视当日安排，只提出一条最值得改的建议。

可选动作，仅限这五种：
  mode    改某段交通方式
  reorder 调整当日各点顺序
  trim    删掉某一点
  fill    从收藏池补入某一点
  none    无可改，如实说明

规则：
- 最多一条建议；若安排已妥，用 none。
- 只许使用输入中出现的地名与交通方式，不得编造地点。
- 不得计算或自行推算输入中未给出的数字（距离、耗时、金额）。
- reason 用半文半白，四十字以内，说清"为何"而不是"是什么"。

只输出一行 JSON，不要代码块标记，不要解释：
{"action":"mode|reorder|trim|fill|none","seg":["起点名","终点名"],"mode":"walk|bike|taxi|transit","order":["名",...],"poi":"名称","reason":"……"}
按所选动作只填相关字段，其余省略。
```

样例输出：

```json
{"action":"mode","seg":["大理古城","崇圣寺三塔"],"mode":"bike","reason":"此段四里有半，午日炽烈，步行恐汗透衣衫，宜单车代步。"}
```

### 4.3 解析与校验（**不过就整条丢弃**）

```ts
function parseAdvice(raw: string): AdviceAction | null {
  // 1. 剥离可能的 ```json 包裹与前后杂字；取第一个 { 到最后一个 }
  // 2. JSON.parse 失败 → null
  // 3. action 不在白名单 → null
  // 4. 名称必须能唯一匹配到当前 day 的 stops / wishlist；匹配不到 → null
  //    重名则以 (from,to) 成对匹配 segment，仍不唯一 → null
  // 5. reorder 必须是当前 stops 的一个排列（同长、同集合）→ 否则 null
  // 6. reason 截断到 40 字
}
```

**宁可整条不显示，也不显示半截或猜出来的建议。** 这是"只建议不强制"的底线：一条错建议比没有建议更伤信任。

### 4.4 超时、缓存、降级

| 项 | 设计 |
|---|---|
| 超时 | `AbortController` 15s |
| 缓存 | `shicheng:ai:advice:{tripId}:{dayIndex}:{fingerprint}`，fingerprint = 对 `poiIds + segmentIds + modes` 的短哈希 |
| 失效 | 日程一变指纹就变，旧缓存自然不命中；面板提示「日程已变，可再请」 |
| 降级 | 任何非 2xx / 超时 / 畸形 / 校验失败 → `null`，**不弹错误 toast**，只在按钮下方淡出一行小字「未取到建议」 |
| 防抖 | 同一天 3s 内重复点击直接忽略 |
| 配额 | 单日按需；不做自动重试 |

---

## 5. 改动清单

```
新增
  src/lib/ai.ts                    接入层（约 100 行）
  .env.lan                         VITE_AI_ENABLED=1
  scripts/verify-ai.mjs            验收脚本

改动
  src/stores/ui.ts                 aiBase / aiKey / setAi（照 mapKey 范式）
  src/components/overlay/SettingsModal.vue
                                   AI 段：端点、Key、「测试连接」
  src/components/editor/SmartAssist.vue
                                   第五张卡 + 底部触发按钮 + 去重逻辑
  package.json                     build:lan
  README.md                        隐私口径 + AI 开关说明
```

**不改动**：`types/index.ts`、`trip.ts`、`export.ts`、任何地图 / 面板 / 抽屉组件。

### 5.1 部署上的那条硬限制仍然成立

公网托管必然是 `https://`，而 Dify 在 `http://10.32.16.199`——active mixed content，Chrome 直接拦，`fetch` 发不出去。**这不是配置问题，无解。** 因此仍需双构建：

| 构建 | 命令 | `VITE_AI_ENABLED` | AI 行为 |
|---|---|---|---|
| 公网版 | `npm run build` | 空 | 触发按钮**整块不渲染** |
| 内网版 | `npm run build:lan` | `1` | 设置里填端点后可用 |

公网版里**不能出现**那个按钮——否则又是一个点了必然失败、且用户无从理解为什么失败的假可供性，和 O02 同类问题。

### 5.2 隐私口径仍需改

`SettingsModal.vue` 底部现写「所有偏好与数据仅存本机，拾程不上传、不追踪」。开启 AI 后，当日的城市、地名、时刻、停留时长会发到你配置的 Dify 端点。改为：「AI 建议默认关闭；开启后仅发送当日行程的地点名、类别与时刻至你填写的端点，不发送账号、坐标与账目明细。」

---

## 6. 不做的事（v0.1 留档）

| 编号 | 功能 | 不做原因 |
|---|---|---|
| A01 | 题跋代笔 | 需 `noteAi` 字段 + 「拟」印 + 导出标记，四处联动 |
| A02 | 闲章题名 | 同上 |
| A03 | 城市题识 | 需新缓存层与封面留白设计 |
| A04 | 忆游小记 | 需 canvas 断行改造 |
| A05 | 锦囊人话版 | 价值最低，且 `TodayView` 已有静态文案 |

若日后重启，直接取 v0.1 的对应章节，架构不变。

---

## 7. 验收（`scripts/verify-ai.mjs`）

沿用 `verify-o.mjs` 的 Playwright 范式，用 `page.route` 拦截 `**/chat-messages` 返回固定 fixture，不依赖真实 Dify。

| # | 断言 |
|---|---|
| 1 | 公网构建：面板无触发按钮，设置面板无 AI 段 |
| 2 | 内网构建但端点为空：触发按钮不渲染 |
| 3 | `action:"mode"` 正常路径：卡出现，点「采用」后该段 `mode` 变更 |
| 4 | **单次撤销**：采用后一次 `trip.undo()` 即完全回退（验证复用 store 方法未破坏快照） |
| 5 | 采用后**不破坏真实路线**：其余段 `estimated === false` 保持不变（验证 `rebuildSegments` 增量子集） |
| 6 | 畸形返回（乱码 / 空 / 无 JSON）：整条丢弃，不出卡，无错误 toast |
| 7 | 越权动作（`action:"deleteTrip"`）：被白名单拒绝，不出卡 |
| 8 | 名称不存在（`poi:"不存在的店"`）：丢弃 |
| 9 | `action:"none"`：出卡但无「采用」按钮，只有「知道了」 |
| 10 | 缓存：同一日连点两次，网络请求仅 1 次；改动日程后再点，请求 +1 |
| 11 | 与 ① 号卡去重：AI 提议同段同方式时，规则卡与 AI 卡不同时出现 |
| 12 | 控制台零脚本异常 |

---

## 8. 风险与边界

| # | 风险 | 应对 |
|---|---|---|
| R1 | 公网 HTTPS 连不上明文内网端点 | 双构建；公网版整块不渲染（§5.1） |
| R2 | 模型编造地名/数字 | 校验层强制名称回查；prompt 明令不得推算；校验不过整条丢弃（§4.3） |
| R3 | 建议质量不稳 | 手动触发 + 「忽略」持久化到 `shicheng:dismissed`（沿用 O06 机制）+ 「日程已变」时自然失效 |
| R4 | POI 名称含指令（提示注入） | 输出被锁死在 5 个动作 + 名称白名单回查，最坏情况只是提一条怪建议，不会越权写入 |
| R5 | App Key 存浏览器 | 单机自用可接受；页面若在局域网被他人打开则可读，届时改用「不提交、仅本次会话」 |
| R6 | Dify 应用被改坏导致全线静默 | 设置面板提供「测试连接」，显式回显结果，不静默失败 |
| R7 | 内网版产物误传公网 | 发布前核对 `dist` 内是否含触发按钮 |

---

## 9. 待你确认

1. 是否就做这一张卡；`reorder`（整日重排）作为可选动作，还是先只做 `mode` / `trim` / `fill` 三种单目标动作，`reorder` 留到下一版？
2. 触发按钮文案：「请 AI 通盘看一眼」是否合你口味（可换）。
3. 智能助手面板当前在桌面左栏限高 `max-h-[188px]`（`TripEditorView.vue:250`），加一张卡后会更快触底滚动。是否顺带放开到 `240px`？

> 本文档仅为设计稿，未修改任何源码。
