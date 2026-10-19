# Albert 页面适配

架构入口：[docs/architecture.md](../../../docs/architecture.md)。本模块拥有 Albert 选择器、页面解析、增强渲染及跨世界事件契约。它不执行选课、退课、换课或候补提交。

## 文件与公共契约

| 文件 | 责任 / 接口 |
| --- | --- |
| `selectors.ts` | `ALBERT_SELECTORS`，集中定义公开搜索页、登录页及学期页的定位方式 |
| `courseParser.ts` | `parseCourse(Element)` 返回 `ParsedAlbertCourse` 或 `undefined`；包含 `Course`、`Section` 和高亮信息；支持多种页面结构 |
| `sectionGroups.ts` | `readSectionGroup`、`optionsForSectionGroup`：读取同课程同学期的有序主课/辅课块，调用 builder 形成完整组合 |
| `sectionPicker.ts` | 原生 dialog 多选辅课；展示班号、时间、老师、地点，返回保留的 section ID 或取消 |
| `plannerImport.ts` | 编排自动添加/弹窗、验证结果未变化、串行化本页保存；调用纯数据 merge |
| `enhancePage.ts` | `enhanceAlbertPage(root, settings, planner?)`，应用偏好、缩写、高亮、工具栏、添加课程动作及当前计划冲突提示 |
| `campusAdapter.ts` | 收集实际校区值；`applyCampusPreference` 应用精确匹配的已保存值 |
| `termAdapter.ts` | `applyTermPreference` 根据学期标签匹配；每个已渲染分组/偏好只自动应用一次 |
| `sessionKeeper.ts` | 定位到期确认控件、验证续期 URL、发送固定续期事件 |
| `searchBridge.ts` | 两个内容脚本共享的事件名，无扩展 API 依赖 |
| `fixtureCapture.ts` | `captureSanitizedFixture`，裁剪并脱敏解析相关 DOM，供开发模式下载 |
| `statusDetector.ts` | `detectRegistrationStatus`，文本结果为 enrolled/full/waitlisted/unknown；当前仅被测试调用 |
| `enhancements.css` | 注入页面的增强样式；由 content entrypoint 加载 |

常规能力从 `index.ts` 导出；桥接常量从 `searchBridge.ts` 直接导入。`parseCourse` 的输入必须是当前课程/section 对应的元素，不能从其他搜索结果借用课程身份。

直接依赖：core（课程契约、分类、冲突与排课评分）、features（设置、缩写、校区选择、高亮）、curricula/nyush（分类数据）、storage/planner（由 plannerImport 编排持久化）。模块没有导入 entrypoints。

## 宿主生命周期与事件

`entrypoints/content.ts` 读取设置与计划，调用增强并安装 MutationObserver；设置或计划变化时，移除已注入面板后刷新。`data-ae-enhancement` 等 DOM 标记避免重复插入。`enhancePage.ts` 的 `latestSettings` 当前是事件处理使用的隐式模块状态，后续调整编排时应改为显式上下文。

| 事件常量 / 字符串 | 发送方 → 接收方 | 行为 |
| --- | --- | --- |
| `albertTitleSearchEvent` / `albert-enhancer:submit-title-search` | adapter → MAIN 脚本 | 使用固定 action `BUTTON_SMALL` 提交搜索 |
| `albertDescriptionSearchEvent` / `albert-enhancer:submit-description-search` | adapter → MAIN 脚本 | 使用固定 action `SMALL_BUTTON` 提交搜索 |
| `albertSessionConfirmEvent` / `albert-enhancer:confirm-session` | sessionKeeper → MAIN 脚本 | 重新检查到期控件和 URL，尝试重置 opener 计时，导航续期并关闭提示窗 |
| `albertMainBridgeReadyEvent` / `albert-enhancer:main-bridge-ready` | MAIN 脚本 → content | 桥接就绪后重试增强和续期检查 |

事件不携带可执行代码、任意 action ID 或目标 URL。由于页面也能发送 DOM 事件，它们不构成可信授权边界；MAIN handler 必须自行校验当前 DOM 与允许的目标。

## 不变量与现存限制

- 校区必须使用页面收集到的精确 option value；不存在时保留当前值。默认学期只在唯一匹配且可交互时切换，保留后续手动选择。
- `keepSessionAlive` 默认关闭；URL 只接受 NYU HTTPS 主机和 `cmd=resettimeout`，不执行页面提供的 `javascript:` 字符串。
- 组件按 `Component:` 分类。在 `SELECT_CLASS` 学期列表内，一个主课后直到下一个非 REC/LAB 组件之前的辅课属于该主课。不能跨课程/学期，也不能根据“不是第一行”、老师、教室、按钮缺失来分类。
- 这一有序块约定已在 Spring 2027 上海校区的 CSCI-SHU 360、CSCI-SHU 11 页面核对；后者原生 Related Sections 页面也列出相同六个必选 lab。它不是全校通用的关联 API。不同布局或显式 recitation → lab 特定关联需新增 adapter 数据来源，不能默认笛卡尔组合。
- `readSectionGroup` 遇到不可解析子行时拒绝整个导入；可能隐藏组件的筛选器要求先清除。无主课的 recitation/lab 不可单独导入。
- 每种组件只有一项时自动带入；某种有多项时打开 dialog，默认保留全部，允许一项/多项/全选，每种至少一项。每组的 `Select all` 在全部选中时取消该组全部选择，否则选中全部；全不选时禁止提交。文案明确允许暂时保留与其他课程冲突的时段，稍后在 Schedule Lab 解决冲突并决定最终选择。
- dialog 显式设置 fixed、inset 与 auto margin，以抵抗 Albert 的全局 `* { margin: 0; padding: 0; }` 重置，始终在所属 iframe 视口内居中；辅课列表单独滚动。
- builder 要求每种组件恰好一项并排除内部时间冲突。多个保留辅课存成互斥 option，绝不合并为同时要上的 meeting。只有完整组合成功写入后才显示 Added。
- `mergeEnrollmentOptions` 更新当前主课的备选，升级此组的旧单组件记录，保留其他主课及有效模拟状态。schema 仍为 v2。`plannerImport` 仅串行化当前文档写入，跨页面并发仍没有事务。
- 状态检测器尚未连接 DOM 增强或模拟状态；不能把解析出的文字当作已确认的注册结果。
- 解析器产生普通数据；DOM 定位问题应在本模块修正，不应让 core 理解 Albert 页面结构。

测试位于 `tests/adapters/`，脱敏页面样本位于 `tests/fixtures/albert/`；完整注入、搜索桥接、续期、添加课程流程在 `tests/e2e/extension.spec.ts`。解析缺陷应先增加最小脱敏 fixture，再增加回归断言。真实页面检查参见 [Manual checkpoint](../../../docs/MANUAL_CHECKPOINT_1.md)。
