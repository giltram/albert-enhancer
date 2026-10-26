# Albert 页面适配

架构入口：[docs/architecture.md](../../../docs/architecture.md)。本模块拥有 Albert 选择器、页面解析、增强渲染及跨世界事件契约。它不执行选课、退课、换课或候补提交。

## 文件与公共契约

| 文件 | 责任 / 接口 |
| --- | --- |
| `selectors.ts` | `ALBERT_SELECTORS`，集中定义公开搜索页、登录页及学期页的定位方式 |
| `courseParser.ts` | `parseCourse(Element)` 返回 `ParsedAlbertCourse` 或 `undefined`；包含 `Course`、`Section` 和高亮信息；支持多种页面结构 |
| `offeringTerm.ts` | `readOfferingTerm` 从显式标签读取来源学期；缺失或歧义返回 undefined |
| `sectionGroups.ts` | `readSectionGroup`、`optionsForSectionGroup`：读取同课程同学期的有序主课/辅课块，调用 builder 形成完整组合 |
| `sectionPicker.ts` | 原生 dialog 多选辅课；展示班号、时间、老师、地点，返回保留的 section ID 或取消 |
| `plannerImport.ts` | 编排自动添加/弹窗、验证结果未变化和学期来源；发送导入命令，由后台统一串行合并 |
| `enhancePage.ts` | `enhanceAlbertPage(root, settings, planner?, preview?)` / `disposeAlbertPage(root)`，应用偏好、缩写、高亮、工具栏、添加课程动作及当前计划冲突提示 |
| `campusAdapter.ts` | 收集实际校区值；`applyCampusPreference` 应用精确匹配的已保存值 |
| `termAdapter.ts` | `applyTermPreference` 根据学期标签匹配；每个已渲染分组/偏好只自动应用一次 |
| `homeToolbar.ts` | `ensureHomeToolbar(root, actions)` 在原生学期容器顶部显示 Schedule Lab / Degree Planner / Settings，继承宿主容器边界，不显示品牌文字；通过回调导航 |
| `sessionKeeper.ts` | 定位到期确认控件、验证续期 URL、发送固定续期事件 |
| `searchBridge.ts` | 两个内容脚本共享的搜索、学期、续期事件名，无扩展 API 依赖 |
| `fixtureCapture.ts` | `captureSanitizedFixture`，输出脱敏后的规范化解析输入，保留课程/学期身份、有序组件分组及逐次 meeting 地点，供开发模式下载 |
| `statusDetector.ts` | `detectRegistrationStatus`，文本结果为 enrolled/full/waitlisted/unknown；当前仅被测试调用 |
| `enhancements.css` | 注入页面的增强样式；由 content entrypoint 加载，首页导航按钮外观复用 `styles/navigationButtons.css`，与 Popup 一致 |

常规能力从 `index.ts` 导出；桥接常量从 `searchBridge.ts` 直接导入。`parseCourse` 的输入必须是当前课程/section 对应的元素，不能从其他搜索结果借用课程身份。

直接依赖：core（课程契约、分类与冲突）、features（设置、缩写、校区选择、高亮）、curricula/nyush（分类数据）、storage/commands（导入变更）和 storage/planner（数据类型）。模块没有导入 entrypoints。

## 宿主生命周期与事件

`entrypoints/content.ts` 读取设置与计划，安装 MutationObserver，并在 planner 或设置变化时刷新面板。content 使用有预算的异步分片排课并将预览传给 adapter；每份 planner 状态只计算一次，停用冲突提示则不计算，更新和失效时取消旧任务。adapter 不自行求解。冲突提示以预览候选为参考，排除同课程；搜索不完整时提示可能存在其他不冲突方案。

每个 root 的 `EnhancementContext` 显式保存最新设置、AbortController 与监听元素。`disposeAlbertPage` 终止搜索输入/按钮监听、移除归属标记与面板并恢复标题；content 失效或总开关关闭时调用。重新启用会创建新上下文，避免旧设置闭包。会话续期同时要求 enabled 与 keepSessionAlive。

| 事件常量 / 字符串 | 发送方 → 接收方 | 行为 |
| --- | --- | --- |
| `albertTitleSearchEvent` / `albert-enhancer:submit-title-search` | adapter → MAIN 脚本 | 使用固定 action `BUTTON_SMALL` 提交搜索 |
| `albertDescriptionSearchEvent` / `albert-enhancer:submit-description-search` | adapter → MAIN 脚本 | 使用固定 action `SMALL_BUTTON` 提交搜索 |
| `albertSelectTermEvent` / `albert-enhancer:select-term` | termAdapter → MAIN 脚本 | 从目标学期链接冒泡、可取消；MAIN 校验选择器、可交互状态及一致的 ID / data-termclass，依次调用 `IS.SSS.ShopCartTermSelect(tab)`、`makeTablesResponsivePostLoad(group)`、`DisplayToggleButton(term)` 后以 `preventDefault()` 确认处理；三个函数未就绪时不调用、不确认，允许重试 |
| `albertSessionConfirmEvent` / `albert-enhancer:confirm-session` | sessionKeeper → MAIN 脚本 | 重新检查到期控件和 URL，尝试重置 opener 计时，导航续期并关闭提示窗 |
| `albertMainBridgeReadyEvent` / `albert-enhancer:main-bridge-ready` | MAIN 脚本 → content | 桥接就绪后重试增强和续期检查 |

事件不携带可执行代码、任意 action ID 或目标 URL。由于页面也能发送 DOM 事件，它们不构成可信授权边界；MAIN handler 必须自行校验当前 DOM 与允许的目标。

## 不变量与现存限制

- 首页三个扩展按钮必须覆盖 Albert 的原生 `!important` 按钮规则；共享导航样式仅对扩展专用 class / marker 提升优先级，不改原生按钮。样式冲突回归见 `tests/features/navigationButtons.test.ts`。
- 校区必须使用页面收集到的精确 option value；不存在时保留当前值。默认学期只在唯一匹配且可交互时切换，保留后续手动选择。
- 学期选择只通过 MAIN 桥接调用页面函数；禁止从隔离世界点击 `javascript:` 链接，也不解析或执行任意 `onclick` / `href` 代码。页面函数未加载时不标记偏好已应用，bridge-ready 后可重试。
- 原生学期入口及三个函数的调用顺序于 2026-10-19 在真实 Albert 页核对；`tests/fixtures/albert/semester-tabs.html` 保留同名 API，不能再用虚构的 `selectSemester` 代替宿主契约。内置浏览器回放见 `tests/browser/README.md`。
- `keepSessionAlive` 默认关闭；URL 只接受 NYU HTTPS 主机和 `cmd=resettimeout`，不执行页面提供的 `javascript:` 字符串。
- 组件按 `Component:` 分类。在 `SELECT_CLASS` 学期列表内，一个主课后直到下一个已识别主课组件之前的辅课属于该主课。不能跨课程/学期，也不能根据“不是第一行”、老师、教室、按钮缺失来分类。
- 这一有序块约定已在 Spring 2027 上海校区的 CSCI-SHU 360、CSCI-SHU 11 页面核对；后者原生 Related Sections 页面也列出相同六个必选 lab。它不是全校通用的关联 API。不同布局或显式 recitation → lab 特定关联需新增 adapter 数据来源，不能默认笛卡尔组合。
- `readSectionGroup` 遇到不可解析、Component 缺失或未知的子行时拒绝整个导入；可能隐藏组件的筛选器要求先清除。无主课的 recitation/lab 不可单独导入。
- 每种组件只有一项时自动带入；某种有多项时打开 dialog，默认保留全部，允许一项/多项/全选，每种至少一项。每组的 `Select all` 在全部选中时取消该组全部选择，否则选中全部；全不选时禁止提交。文案明确允许暂时保留与其他课程冲突的时段，稍后在 Schedule Lab 解决冲突并决定最终选择。
- dialog 显式设置 fixed、inset 与 auto margin，以抵抗 Albert 的全局 `* { margin: 0; padding: 0; }` 重置，始终在所属 iframe 视口内居中；辅课列表单独滚动。
- builder 要求每种组件恰好一项并排除内部时间冲突。多个保留辅课存成互斥 option，绝不合并为同时要上的 meeting。只有完整组合成功写入后才显示 Added。
- `mergeEnrollmentOptions` 更新当前主课的备选，升级此组的旧单组件记录，保留其他主课及有效模拟状态。schema 仍为 v2。导入通过后台统一队列读改写，重复导入保留已有课程顺序。计划限定单一 `term`；旧数据归一化为学期未知并保留，禁止与新学期静默合并。来源学期从最近 data-ae-term、同 term list 内标签或唯一页面学期标题/已选学期读取；不推断缺失年份，不将所有课程随意归到当前偏好学期。未知来源必须补充来源标签后才能导入。
- 状态检测器尚未连接 DOM 增强或模拟状态；不能把解析出的文字当作已确认的注册结果。
- 解析器产生普通数据；DOM 定位问题应在本模块修正，不应让 core 理解 Albert 页面结构。

测试位于 `tests/adapters/`，脱敏页面样本位于 `tests/fixtures/albert/`；`tests/entrypoints/` 验证隔离脚本失效清理和 MAIN 学期桥接。完整注入、搜索桥接、续期、添加课程流程在 `tests/e2e/extension.spec.ts`。解析缺陷应先增加最小脱敏 fixture，再增加回归断言。真实页面检查参见 [Manual checkpoint](../../../docs/MANUAL_CHECKPOINT_1.md)。
