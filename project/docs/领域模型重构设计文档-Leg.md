# 拾程 · 领域模型重构设计文档（Leg 行程段）

> 版本：v0.2　日期：2026-11-18　状态：**L01–L04 已落地（v4.8.0，`07a6aee`），L05–L06 留给后续里程碑**
> 定位：回应"同一天跨城处理差"这一架构级问题。D 系列管"长什么样"，O 系列管"自己用顺不顺"，**L 系列管"数据怎么建模"**。
> 实施版与原始设计的差异见文末 §9「落地决策与偏差」——以 §9 为准。本文对应主设计文档表 M 的 **D100**；L05/L06 未做缺口已同步登记在主文档附录 12.5。

---

## 0. 一句话结论

现在的数据模型是 **"一天 = 一座城 + 一串 POI"**；你的真实心智是 **"一次旅行 = 若干城市停留 + 城际移动"**。
病的根子不是交互，是**缺了一个叫 Leg（行程段）的一等公民**。补上它，跨城才从"一句文案"变成"可编辑的字段"。

---

## 1. 问题诊断（为什么不是改交互能解决的）

### 1.1 现状模型（代码事实）

| 事实 | 代码位置 | 后果 |
|---|---|---|
| `DayPlan` 只有一个 `city: string` | `types/index.ts:58-68` | 一天只能属于一座城，"同日跨城"无处安放 |
| 跨城靠时间轴插一句文字表达 | `timeline.ts:22-24`：`翌日 · 赴${day.city}` | 是**渲染出来的文案**，不是数据，不可编辑、不可删除、不参与计算 |
| `TransportSegment` 只连两个 POI | `types/index.ts:33-46` | 没有"城→城"这种段，大理到丽江只能挂在大理某个 POI 和丽江某个 POI 之间 |
| 交通方式有 4 种，都不是城际语义 | `MODE_LABEL`：步行/打车/公交/骑行 | 高铁、飞机、自驾、长途大巴——真正的城际方式一个都没有 |
| 估算按直线 × 经验速度 | `estimate.ts:34` | 跨城几百公里按"步行 5km/h"算，数字失真 |

### 1.2 症状与病根

- **症状**：你想表达"上午在大理古城，下午坐动车去丽江，晚上住丽江"——做不到。系统逼你拆成两天，或塞一条假文案。
- **病根**：模型把"城市"绑死在"天"上，把"移动"降格为 POI 之间的附属物。
- **判据**：如果一种信息在 UI 上是**文字**（`divider`）而不是**字段**，且不能选中/修改/删除，那它就不是模型的一部分——这就是架构债的明确信号。

### 1.3 类比

现在的模型像**一本按天分页的日记，每页贴一个城市的邮票**；
你要的是**一张 itinerary 行程单：哪天在哪停留、搭什么从 A 到 B、几点发几点到**。
日记能读，但不能拿来订票。

---

## 2. 目标模型：引入 Leg 一等公民

### 2.1 核心概念（三元组）

```
Trip（一卷攻略）
 ├─ CityStay（城市停留）：在某城待多久、住哪、玩哪些点
 └─ Leg（行程段）：从一座城 → 另一座城的一次移动
```

- **CityStay** 取代现在 `DayPlan.city` 的"绑城"职责——一天可以有多个 CityStay（同日跨城），一个 CityStay 也可以跨多天（大理待三天）。
- **Leg** 是独立实体，有自己的方式、时刻、时长、花费、票据信息，**可选中、可编辑、可删除、可重排**。

### 2.2 数据结构（建议）

```ts
// 城际交通方式——与市内 MODE 分开，不要混用
export type LegMode = 'train' | 'highspeed' | 'flight' | 'car' | 'coach' | 'ship' | 'walk'

export interface CityStay {
  id: string
  city: string            // 城市名
  dayIndex: number        // 归属第几天（同日可多条 → 支持同日跨城）
  poiIds: string[]        // 该停留内的 POI
  basePoiId?: string      // 驻地
  departTime?: string     // 该段开始时刻
  stayMinutes?: number    // 停留时长（可选，用于时间轴）
}

export interface Leg {
  id: string
  tripId: string
  fromCity: string
  toCity: string
  mode: LegMode           // 高铁/飞机/自驾…
  departTime?: string     // 发车/起飞时刻
  arriveTime?: string     // 到达时刻
  durationMin?: number
  cost?: number           // 分
  note?: string           // 车次/航班号
  // 与现有 POI 段的关系：可选，城际段两端可挂"车站/机场"POI
  fromPoiId?: string
  toPoiId?: string
  estimated: boolean      // 沿用"估"语义
}
```

### 2.3 与现有类型的关系

| 现有 | 处置 | 理由 |
|---|---|---|
| `DayPlan.city: string` | 保留为"当日主城"（展示/聚合用），**权威来源改为 CityStay** | 向后兼容，地图印章/统计仍按主城聚合 |
| `DayPlan.poiIds` | 迁移到 `CityStay.poiIds` | 一天多城的前提 |
| `DayPlan.departTime` | 迁移到首个 CityStay 或首个 Leg | 时间轴起点 |
| `TransportSegment` | **保留**，但职责收窄为"市内 POI→POI" | 城际移动交给 Leg，不再硬套 |
| `deriveDay` 的 `divider` | 删除，改由 Leg 渲染成真实条目 | 文案变字段 |
| `Trip.cities` | 由 CityStay + Leg 自动推导去重 | 单一数据源，不再手动同步 |

---

## 3. 分阶段落地路线（每阶段可独立发布、可回滚）

### L01　先加类型，不改行为（P0，无风险）
- `types/index.ts` 新增 `LegMode`、`CityStay`、`Leg`；`Trip` 加可选 `legs?: Leg[]`、`stays?: CityStay[]`。
- `normalizeTrip`（`trip.ts`）补齐默认值与兼容旧数据。
- **验收**：typecheck 通过；现有数据加载后 `legs/stays` 为空，界面完全不变。

### L02　编辑器能"造"Leg（P0，核心）
- 新增 `LegEditor` 组件：选出发城 → 选到达城 → 选方式 → 填时刻/车次。
- store 加 `addLeg / updateLeg / removeLeg / reorderLeg`，全部进统一撤销栈（O03 已有）。
- 在 DayPanel 的跨城分隔处，把"翌日·赴X"文案替换为一个**可点击的 Leg 条**，点击进入 LegEditor。
- **验收**：自己能建出"Day1 大理 → 高铁 → 丽江"，且能改方式、删段、撤销。

### L03　时间轴与统计接入 Leg（P1）
- `deriveDay` 增加 `legs` 入参：`divider` 换成 `{ kind:'leg', legId }` 条目，显示"🚄 大理→丽江 09:30–11:05"。
- `TimelineEntry` 加 `leg` 变体；`dayStats` 把城际时长/花费计入。
- **验收**：时间轴出现真实的城际条目，到达时刻由 Leg 的 arriveTime 驱动而非拍脑袋。

### L04　地图连线接入 Leg（P1）
- `MapCanvas.visibleSegments` 之外新增 `visibleLegs`，城际用独立线型（如双虚线 + 高铁/飞机图标）绘制。
- 点线可选中、改方式、删除（复用 `selectedSegmentId` 机制，扩展为"选中段"通用）。
- **验收**：地图上大理→丽江是一条可点的城际线，区别于市内 POI 连线。

### L05　CityStay 拆分同日多城（P2）
- 把 `DayPlan.poiIds` 迁到 `CityStay`；一天可挂多个 CityStay。
- DayPanel 按 CityStay 分组渲染，组间插 Leg。
- **验收**：同一天能表达"上午大理、下午丽江"且时间轴正确串联。

### L06　城际估算与数据迁移（P2）
- `estimate.ts` 加城际档：按 city center 距离 + 方式经验速度/票价（高铁/动车/飞机/大巴）。
- 写迁移脚本：把旧数据里"跨城 divider + 首尾 POI 段"识别并转成 Leg。
- **验收**：旧攻略打开后自动升级，跨城文案变成 Leg 条目，数据不丢。

---

## 4. 关键设计决策（需你拍板）

| # | 决策点 | 选项 A | 选项 B | 我的建议 |
|---|---|---|---|---|
| D1 | Leg 归属 | 挂在 `Trip.legs`（全局） | 挂在 `DayPlan.legs`（按天） | **A**：城际移动常跨天，全局更自然；用 `dayIndex` 标记归属 |
| D2 | 城市→天的关系 | 一天多城（CityStay） | 保持一天一城，跨城必换日 | **A**：这才是你要的"同日跨城" |
| D3 | 城际方式 | 复用现有 4 种 | 新增高铁/飞机/自驾等 | **B**：市内与城际语义不同，必须分开 |
| D4 | 旧数据 | 自动迁移 | 不迁移，新数据才用 | **A**：迁移脚本兜底，避免你现有攻略变样 |
| D5 | 车站/机场 | 作为 POI 挂在 Leg 两端 | 不建，只记城市名 | **B 起步**：先轻量，需要时再升级为 POI |

---

## 5. 与已落地 O01–O13 的关系

- **O01（跨城）是过渡方案**：它让 `day.city` 可编辑，实现"换天跨城"。L02 落地后，O01 的入口应升级为"创建 Leg"，但 `day.city` 保留作主城展示。
- **O04（增量重建）要适配**：Leg 的改动不应触发市内段的全量重建；两者独立。
- **O03（统一撤销）可直接复用**：Leg 的所有操作进同一快照栈。

---

## 6. 风险与代价（实话）

- **这是本次三个问题里最贵的一项**：动到 `types`、`trip.ts`、`timeline.ts`、`MapCanvas`、DayPanel/ItineraryDrawer/TodayView 三处调用——约 8 个核心文件。
- **L05（同日多城）改动最大**，会触及 POI 归属，建议最后做，甚至可作为独立里程碑。
- **收益**：之后"从哪出发、怎么去、几点到、花了多少"全是字段，能支撑导出行程单、报销、真实时刻表——现在这些全是幻影。

---

## 7. 最小可感版本（如果你想先尝一口）

只做 **L01 + L02 + L03**：加类型、编辑器能建 Leg、时间轴显示 Leg。**不动地图、不动 POI 归属**。
这样你就能在编辑器里表达"大理 →高铁→ 丽江"，时间轴出现真实城际条目——用最小代价验证模型是否顺手，再决定要不要继续 L04–L06。

---

## 8. 待你确认

1. 第 4 节的 5 个决策点（尤其 D1/D2/D3）。
2. 是否按第 7 节"最小可感版本"先做 L01–L03，再评估后续。
3. 确认后我另开任务逐条落地，每步可独立发布/回滚。

> 原设计稿到此为止。以下为实际落地记录。

---

## 9. 落地决策与偏差（2026-11-18 实施版，本节优先于上文）

用户授权"哪种最符合习惯和直觉就怎么做"，未逐条拍板。我按最符合真实旅行心智、同时代价可控的原则做了如下决策，并已落地 **L01–L04**。

### 9.1 五个决策点的最终选择
| # | 决策 | 最终选择 | 理由 |
|---|---|---|---|
| D1 | Leg 归属 | **全局 `Trip.legs` + `day.legIds` 引用**（等价原 A） | 按到达日引用，一条段可被地图全览与时间轴各自取用 |
| D2 | 城市与天 | **务实折中：`DayPlan.city` 仍为单一"当日主城"，不拆 CityStay**；同日跨城用"当日多条 legIds"表达 | 完整 CityStay 要重排 POI 归属，代价最大；用户痛点核心是"能否表达城际移动"，不是"同日在两城各玩哪些点" |
| D3 | 城际方式 | **B：新增 6 种城际方式**（高铁/火车/飞机/自驾/大巴/徒步），与市内 4 种彻底分开 | 市内"步行/公交"无法表达高铁/航班 |
| D4 | 旧数据 | **A：平滑兼容**，`normalizeTrip` 补 `legs:{}` / `legIds:[]`，丢弃悬空引用；seed 自带一条示范段 | 老攻略打开不变样，且一进 demo 就能看到效果 |
| D5 | 车站/机场 | **B 起步**：只记城市名 + 文本车次/航班号，不建 POI | 轻量、够用 |

### 9.2 与原设计的关键偏差
1. **没有引入 `CityStay`**（原 L05）。改为 `DayPlan.legIds` + 到达日主城切换。因此**"同一天上午大理玩、下午丽江玩"仍不能精确表达**——这是明确留下的能力缺口，不是遗漏。
2. **Leg 挂"到达日"而非"出发日"**。设计稿 §4 D1 建议用 dayIndex 标出发日；实施中改为到达日——因为一天的开篇是从上一城抵达，这样时间轴顺序最自然（城际段排在当日 POI 之前）。
3. **城际连线在"当日"模式裁剪到画布边缘**（画方向箭头 + 城名），只在"全程全览"模式把两端城市纳入 bounds 画真实长线。避免大理→丽江这种跨城距离把市内 POI 挤成一点。

### 9.3 已落地代码清单（L01–L04）
- `types/index.ts`：`LegMode`（6 种）、`Leg`、`LEG_MODE_LABEL/COLOR`、`DayPlan.legIds`、`Trip.legs`、`TimelineEntry` 的 `leg` 变体。
- `stores/trip.ts`：`addLeg/updateLeg/removeLeg/legsOfDay`，全部进统一撤销栈；`syncCities` 保住仅作城际端点的城市；`normalizeTrip`/`createTrip`/`addDay` 补默认字段。
- `components/editor/LegEditor.vue`（新）：新建/编辑城际段的浮层——选两城、选方式、发车/到达时刻、车次、票价、估算标记，含删除。
- `components/editor/DayPanel.vue`：城际段卡片列表（可点编辑）+ 增设入口。
- `lib/timeline.ts`：`deriveDay` 接受 `legs`，城际段渲染为真实 `leg` 条目（取代旧 divider 文案）；`dayStats` 计入城际时长与花费。
- `components/panels/ItineraryDrawer.vue`：时间轴渲染城际条目（方式图标 + 城名 + 车次 + 票价 + 估）。
- `components/map/LegLayer.vue`（新）：城际连线图层——朱砂长虚线 + 端点城名 + 方式牌，线可点选编辑；当日模式裁剪到边缘。
- `components/map/MapCanvas.vue`：`visibleLegs`、全览纳入城际端点、`select-leg` 事件。
- `seed/index.ts`：demo 自带"大理→高铁→丽江"示范段（Day4）。
- `views/TripEditorView.vue`：串起新增/编辑/删除弹层与各事件。

### 9.4 验收
- `npm run typecheck`、`npm run build` 通过。
- `scripts/verify-leg.mjs` 5/5（seed 示范段、时间轴真实条目、增设持久化+主城切换、删除可撤销、无脚本异常）。
- 既有回归无退化：`verify-o.mjs` 9/9、`verify-map.mjs` 5/5。
- 视觉验收截图：`shots/leg-01-day4.png`、`leg-02-timeline.png`、`leg-03-allmap.png`。

### 9.5 仍留待 L05–L06（明确的能力缺口）
- **同日多城停留**（上午 A 城玩、下午 B 城玩）仍做不到——当前一天只有一个主城。
- 城际**时长/票价不会自动估算**，需手填或标"估"（`estimate.ts` 城际档未做）。
- 老攻略里若有用旧 `divider` 表达的跨城，不会自动转成 Leg（`CityStay` 迁移未做）。
- 城际段**不参与导出行程单/报销**（字段已就位，但导出模板未接）。

> 若后续要做 L05，建议从"把 `DayPlan.poiIds` 按 leg 切分成停留组"入手，风险最低。

### 9.6 与主文档 v4.8 的衔接
- 本文 L01–L04 即主文档表 M 的 **D100**（Leg 城际段域模型），已随 v4.8.0 落地，数据模型增量见主文档 §6.3 的 `Leg` / `legIds` / `leg` 时间轴条目。
- L05（同日多城 CityStay）/ L06（城际估算与旧数据迁移）仍未做，已作为**明确能力缺口**登记在主文档附录 12.5，不宣称完成。
- Leg 的撤销走 O03 统一栈；v4.8 另修 `undo()` 对已删攻略的整卷恢复（主文档 D108），与 Leg 操作共用同一栈。
- 验收脚本 `verify-leg.mjs` 5/5；视觉截图 `shots/leg-01-day4.png` 等。
