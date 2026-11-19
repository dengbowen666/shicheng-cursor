# 拾程 · 国风旅行地图攻略编辑器（v4.8.2）

把「做攻略」「在路上」「回来后」三条命压到同一张水墨地图上：出发前自己选点、排日程、定交通；旅途中打开一张图点一下就能解决衣食住行；归来后归档、回顾、留题跋。设计基准见仓库内 `设计/拾程设计文档.html`（D01–D108）。

视觉走**宋代青绿山水手卷 + 文人舆图**：宣纸米白打底，远山以淡青虚写，近山用石绿染、墨线勾脊、披麻皴补笔；水系青绿染配水纹与岸线；道路只留一线赭墨，巷陌更细；田畴横斜成畦，聚落成组成村；全图覆云气与纸纹卷边，地名以毛笔行楷题识。项目是**高保真可点击交互原型**，不是生产级全栈系统。

---

## 一、跑起来

```bash
npm install
cp .env.example .env   # 填入 VITE_TMAP_KEY（腾讯位置服务 Key），不填则用内置水墨舆图
npm run dev        # http://localhost:5173
npm run typecheck  # 全项目类型检查
npm run build      # 产物在 dist/
npm run build:lan  # 内网构建：额外启用 AI 通盘建议（公网不要带）
npm run preview    # 预览构建产物
npm run shoot      # Playwright 桌面 / 移动端验收截图
npm run icons      # 生成 PWA 印章 PNG（192 / 512）
```

首次打开会自动生成一份 **「大理 · 丽江 5日」** 示例攻略（驻地锚点、跨城、四种交通段、真实种子 POI、账目与预算均已就位）。所有数据存本机 `localStorage`，不上传云端。

---

## 二、两个页面，一条主线

| 页面（hash 路由） | 作用 |
| --- | --- |
| `#/` 我的攻略 | **卷首左轴**：满幅中国地图 + 左侧卷轴（搜索 / 印记·行迹 / 列表 / 已行卷 / 设置）；印记=我的攻略、行迹=已行卷，按时间排序、按年份折叠，悬浮显归档 / 删除 |
| `#/trip/:id` 攻略编辑器 | 地图恒为背景，抽屉与弹层承载编辑；桌面左日程右抽屉，移动 DayRail + bottom sheet 三档可拖 |

编辑器里不再做「浏览 / 编辑」模式切换：点地点、点交通段、点地图空白处，都是直接操作。

---

## 三、核心能力

| 能力 | 实现 |
| --- | --- |
| 一图看全程 | 当天地点按序连成线，四段交通各有线型与图标；支持「聚焦当日 / 全程全览」 |
| 城际段 Leg | 同一天可跨城：出发 / 到达城市、交通方式、时刻独立成段，地图画城际线、时间轴列入条目 |
| 信息聚合 | 收藏池按景点 / 美食 / 住宿分组；地点卡含地址、评分、价格、营业时间、题跋 |
| 一键导航 | `qqmap://` 唤起腾讯地图 App，Web 降级到 URI 页面；按当前段方式发起 |
| 交通方式实时响应 | 打车 / 步行 / 骑行 / 公交四选一；线型、小车 / 小人动效、耗时、费用立即重算，估算标朱砂「估」 |
| 图层篆印 | 地图右上 `+/−/复` 下方唯一一组景 / 食 / 宿开关，同时过滤自有印章与腾讯底图原生 POI；桌面端不再有重复按钮组 |
| 原生地点详情 | 点击底图任意原生地点（酒店、餐馆等）弹地点卡，可收藏、可导航，但绝不自动进日程 |
| 智能辅助四件套 | 交通推荐、顺路重排、过载预警、欠载提醒——只建议，不强制；桌面左栏 + 移动「智助」页签 |
| AI 通盘建议 | 仅内网构建启用，白名单动作（改方式 / 排序 / 精简 / 补入 / 无），走与手动相同的 store 方法，撤销栈与真实路线一并继承 |
| 开销与时间 | `deriveDay()` 串联交通→到达→停留→离开；金额以「分」存储，六类账目 + 环形 / 柱状图；全程口径才标「已逾制」 |
| 今天与忆游 | 行前锦囊 / 该出发了 / 已至盖章三态；归档后可看印章分布、花费曲线、题跋集；回放已重做 |
| 行迹 | 首页「印记 · 行迹」分离；旧游落「行」印 / 零章虚边印；卷内跨城虚线；该城行迹小卷进忆游 |
| 导出三件套 | 国风长卷 PNG（自绘 canvas）、离线打印 HTML、JSON 备份 / 恢复 |
| PWA | 手写 `manifest.json` + `sw.js`（HTML network-first、资源 stale-while-revalidate），Vite `base: './'` + hash 路由，可直接静态托管 |

---

## 四、数据与隐私

| 数据 | 来源 | 说明 |
| --- | --- | --- |
| 大理 / 丽江 / 北京种子 POI | 腾讯位置服务连接器实采（2026-11-17） | GCJ-02 坐标，未编造；见 `src/seed/` |
| 其余城市 POI 快照 | `src/mock/cities-poi.json` | 无 Key 搜索兜底 |
| 城市天气 | Open-Meteo 免 Key 为主 | 城市中心 WGS-84 查询，24h 缓存；失败回落 `SEED_WEATHER` |
| 交通段真实路线 | 腾讯 WebService `direction/v1` | 有 Key 时驾车 / 步行 / 骑行 / 公交四条通道实时请求，返回真实距离、耗时、票价与折线；失败保留估算 |
| 城市底图 | 腾讯 GL（`baseMap.features` 取 base/road/building/point） | 压成宣纸色调；原生 POI 由景 / 食 / 宿图层篆印统一控制显隐与点击；GL 失败或无 Key 回落自绘舆图 |
| 省界与南海诸岛 | 阿里 DataV `100000_full.json` | 构建期转 SVG path，见 `src/data/china-paths.json` |
| 交通时长 / 费用 | 本地经验估算 | `src/lib/estimate.ts`：步行 4.5、骑行 12、打车 30 km/h（+5min）；公交无 Key 不估 |

**Key 说明**：设置里填的腾讯 Key 只存 `localStorage`（`shicheng:key`），仅在浏览器端用于 WebService / GL 视觉层；status 199 会弹权限引导。生产环境请改用安全密钥或服务端代理，不要把正式 Key 硬编码进前端。

**AI 建议（默认关闭，仅内网构建）**：`npm run build:lan` 会注入 `VITE_AI_ENABLED=1`，智能小助手才出现「请 AI 通盘看一眼」；公网 `npm run build` 不带此项，触发按钮与设置里的 AI 段整块不渲染（明文内网端点在 https 页面会被 mixed content 拦截）。开启后，点击时仅把当日地点名、类别、时刻与收藏池候选发往设置里填的 Dify 端点（`shicheng:aiBase` / `shicheng:aiKey`，只存本机），不发送账号、坐标与账目明细。AI 只提出一条受限动作建议，采用时走与手动操作完全相同的 store 方法；请求失败或返回畸形时静默不显示卡片，不打断编辑。

**本地存储键**：`shicheng:trips`、`shicheng:key`、`shicheng:weather`、`shicheng:hot`。清空数据需二次确认，并建议先导出 JSON。

---

## 五、地图三层架构

1. **视觉层**：三档底图，`src/lib/tmap.ts` 动态加载腾讯 JS API GL。
   - `水墨舆图`：自绘 SVG，纯离线可用（山峦 / 水系 / 田畴 / 聚落）。
   - `真实·纸色`（默认）：真实路网 + `filter` / `mix-blend-mode: color` 压成宣纸单色调；底图原生 POI 的显隐由右上景 / 食 / 宿图层篆印统一控制（关闭的类别在 GL 样式里设 `visibility:off`）。
   - `真实·标准`：保留路名与地点标注，找路最直接；有图层过滤时套 `shicheng-std-filter`，只改 POI 显隐、底色仍为 normal。
   - 真实底图**淡入**在水墨舆图之上：瓦片未铺满时不会出现空白米色；GL 失败自动退回水墨舆图。**拖动与缩放已交还腾讯 GL 原生引擎**（GPU 合成、跟手、松手无回弹），覆盖层逐帧跟随视野；焦点 / ± / 复位转发到 GL 方法。水墨档仍用上层 SVG transform 模拟拖拽。
   - 对齐做法：`fitBounds` 的 cos 修正跨度与 Web Mercator 在小范围内同比例，按 `spanLng` 反算 zoom，再用 `getBounds()` 实测一次微调（GL 会把 zoom 吸附到瓦片精度）。
   - 首页 `ChinaInkMap.vue`：省界纸色微差 + 墨色描边，山脉以一串手绘小峰连缀，黄河（含河套回环）、长江、珠江以淡青水面 + 墨线落笔，配边缘远山、海波与闲章；下钻省级只显示目标省并题省名。
   - 城市 `InkFallbackMap.vue`：按城市 profile 生成山峦（圆浑峰头 + 皴笔 + 山脚淡入）、水系（青绿染 + 岸线双钩 + 水纹 + 沙洲）、田畴、聚落、巷陌与官道、桥、环城，外加题识、罗盘、比例尺与纸纹；未知城市按名称哈希稳定生成通用舆图。
2. **数据层**：`src/lib/jsonp.ts` 封装腾讯 WebService，统一 199 检测、超时与缓存；`city` store 提供城市与 POI 搜索、逆地理。
3. **行动层**：`src/lib/navigation.ts` 负责 URI API 导航跳转。

中国地图包含 **34 个省级行政区**，台湾单独成面，南海诸岛以左下独立插图呈现并标注「比例尺不同」；下钻省级时按惯例隐藏插图。

---

## 六、目录结构

```
src/
├─ views/            MyTripsView（首页） / TripEditorView（编辑器）
├─ router/           hash 路由，静态托管免 404
├─ stores/           trip / ui / weather / city 四个 Pinia store
├─ types/            Trip / DayPlan / POI / TransportSegment / Leg / Expense 等 v4.8 模型
├─ components/
│  ├─ map/           ChinaInkMap / MapCanvas / TencentBaseMap / InkFallbackMap / InkMarker
│  │               RouteLayer / LegLayer / SegmentAnimator / WeatherBadge / AnnotateLayer
│  ├─ editor/        DayPanel / PoiSearch / SegmentPicker / TripWizard / SmartAssist
│  ├─ layout/        AppHeader / DayRail / FabGroup / WishlistPanel / LayerSeals / CityBadge
│  │               ScrollSidebar / MapModeToggle
│  ├─ panels/        PlaceCard / ItineraryDrawer / ExpenseDrawer
│  │               TodayView / ReviewView / RolloutReplay
│  └─ overlay/       ExportModal / SettingsModal / KeyGuideModal / ToastHost / TrailCityModal
├─ lib/              estimate / timeline / jsonp / weatherApi / navigation
│                   projection / motion / export / tmap / ai
├─ seed/             大理 / 丽江 / 北京种子 POI 与示例攻略
├─ data/             china-paths.json / cities.ts
└─ styles/           global.css 设计系统
legacy/              旧「九州行旅图」架构归档（不参与构建）
scripts/             build-china-paths.mjs / shoot.mjs / zoom-map.mjs / verify-*.mjs
shots/               v4-01 ~ v4-12 验收截图 + acceptance.json
设计/                拾程设计文档.html（D01–D108）/ 体验优化设计文档.md / AI辅助设计文档-A.md / 领域模型重构设计文档-Leg.md
```

---

## 七、验收状态

`npm run build` 与 `npm run typecheck` 均通过。`npm run shoot` 对构建产物执行 11 项桌面 / 移动端检查，当前 **11/11 通过**，控制台无脚本异常：

首页渲染、省份水墨下钻、新建攻略向导、示例攻略编辑器、交通方式切换、记账落账、今天视图、导出三件套、移动端首页、移动端编辑器与 bottom sheet、控制台检查。

另有针对性验收脚本，当前全部通过：O 系列 9/9、Leg 5/5、回放 6/6、侧栏 10/10、卷首左轴 6/6、省视图与删除 9/9、城市地图 4/4、原生地图 5/5、图层篆印 7/7。截图与报告位于 `shots/v4-*.png` 和 `shots/acceptance.json`；`node scripts/zoom-map.mjs` 以 2 倍分辨率体检底图笔触，`node scripts/verify-route.mjs` 核对 Key 是否生效、交通段是否已换成真实路线（打印每段的距离 / 耗时 / 折线点数）。

版面约定（对应「不能挡」）：桌面为左工作台 388px / 中地图 / 右 inspector 360px 三栏，抽屉打开时地图变窄而不是被覆盖；工具条独占一行压在布局里；移动端 bottom sheet 参与 flex，三档高度（peek 76px / half 45vh / full 92vh）默认收起，地图自动让位。

---

## 八、部署到 GitHub Pages（个人自用）

仓库根已配好 `.github/workflows/deploy.yml`：**push 到 `main` 即自动构建并发布**，访问地址 `https://<用户名>.github.io/<仓库名>/`。站点在仓库子路径下也能正常工作——Vite `base: './'` + hash 路由 + `manifest/sw` 全用相对路径，无需改配置。

上线前三步（一次性）：

1. **换 Key 并配白名单**：旧 Key 已在公开仓库历史中，应作废。到腾讯位置服务控制台新建 Key，配置 Referer 域名白名单为你的 Pages 域名（如 `dengbowen666.github.io`），并设每日配额上限。
2. **存 Secret**：仓库 → Settings → Secrets and variables → Actions → New repository secret，名称 `VITE_TMAP_KEY`，值为新 Key。构建期由 Actions 注入产物，**源码与 Git 历史不留明文**；Secret 缺失时工作流会直接报错，不会产出无 Key 的成品。
3. **开启 Pages**：仓库 → Settings → Pages → Build and deployment → Source 选 **GitHub Actions**。然后 `git push origin main`，在 Actions 页看流水线跑绿即可。

访问注意：

- 必须用**新 Key 所在域名**访问；本地开发仍可继续用 `.env` 的 Key（`npm run dev` 不受影响）。
- 每次发布后，Service Worker 对 HTML 走 network-first，回访会立刻拿到新版本，不会因缓存停在旧界面。
- 部署产物由 Actions 现场构建，`dist/` 本身被 `.gitignore` 忽略，不需要手动上传。

---

## 九、已知边界

- 有 Key 时交通段走真实路线规划（真实距离 / 耗时 / 折线 / 公交票价），失败或无 Key 才退回「直线 × 经验速度」估算，并在界面标朱砂「估」。
- 打车费用服务端不返回，仍按 2.4 元/公里估算；公交票价取接口返回的票价。
- 底图 Key 在构建期被注入前端产物（`VITE_TMAP_KEY`），生产环境请改用安全密钥或服务端代理。
- 图层篆印对底图原生 POI 的显隐依赖腾讯 GL 的 POI 子类名（`poi.attraction` / `poi.catering` / `poi.hotel` 等），未用真机 Key 逐一实测；若某类不认，该类仍显示，但自有印章的过滤始终生效。隐藏某类即该类原生 POI 不可见也点不到。
- 天气是城市中心级预报，禁止与逐 POI 坐标混算；接口失败自动回落种子数据。
- PWA 安装 / Service Worker 正式生效需要 HTTPS（或 localhost）环境。
