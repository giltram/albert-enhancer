# 全仓库首次系统代码审查

- 审查日期：2026-10-20（Asia/Shanghai）
- 审查提交：`867321879729d79a20667d33a0f2e9754cb1116b`
- 审查方式：只读源码审查、依赖图检查、现有测试及临时复现验证。
- 本文记录此前审查结果；生成本文没有修复或重新验证实现。文件和行号以被审查提交为准。

## 1. 执行摘要

确认 **12 项 findings：P1 1 项、P2 7 项、P3 4 项，没有 P0**。最高优先级是已打开的排课页面可能用旧快照覆盖新导入数据，造成静默数据丢失。

领域核心的模块边界和依赖方向清晰。主要风险集中在持久化更新所有权、Albert 导入完整性与学期身份、同步排课计算，以及设置和内容脚本的生命周期。

没有在已检查的第一方代码中确认可利用的安全漏洞。第三方依赖公告检查、真实浏览器端到端测试和登录态 Albert 验证仍有覆盖限制，不能据此认定不存在安全问题。

原审查没有修改仓库文件，也没有提交或推送。本文是用户随后明确要求新增的本地审查记录。

## 2. 优先级 Findings

### F01 · P1 · 已打开的排课页面可能覆盖新导入数据

**位置：** [planner/main.tsx:14](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/planner/main.tsx:14)、[planner/main.tsx:78](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/planner/main.tsx:78)。

**证据：** 页面启动时读取一次 planner，后续操作直接保存整个本地状态快照。通过真实 React 页面模块的临时 JSDOM 测试复现：页面先加载课程 A；存储随后新增课程 B；在原页面切换 “Avoid Friday” 后，持久化结果只剩 A。

**影响：** Albert 新导入的课程或其他页面刚保存的修改可能被静默删除。Degree Planner 也使用启动读取、整份快照保存的模式。

**建议修复：** 由统一持久化入口串行执行数据变更，页面订阅最新状态。仅添加订阅不能解决并发读改写竞争。增加旧页面操作与新导入交错执行的回归测试。

### F02 · P2 · 缺失组件元数据时可以导入不完整选课组合

**位置：** [sectionGroups.ts:38](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/sectionGroups.ts:38)、[courseParser.ts:162](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/courseParser.ts:162)。

**证据：** 缺失或无法识别的 `Component:` 被规范化为 `other`，分组逻辑将它视为下一主课的边界。在现有 Machine Learning fixture 中，仅移除 recitation 002 的组件标签，保留后面的真实 lecture 003；lecture 001 随即产生 `choices=[]`，builder 生成只包含 lecture 001 的 option。

**影响：** 页面局部加载或组件字段变化可能导致漏掉必需 recitation/lab，违反文档中遇到未知组件应拒绝导入的契约。

**建议修复：** 保留组件元数据是否存在且被识别的信息；未知身份的中间行应使导入失败。只有明确识别出的主课才能结束当前分组，并为缺失/未知组件增加回归测试。

### F03 · P2 · 持久化课程班次身份未包含学期

**位置：** [courseParser.ts:184](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/courseParser.ts:184)、[courseParser.ts:226](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/courseParser.ts:226)、[enhancePage.ts:94](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/enhancePage.ts:94)。

**证据：** course/section ID 仅由课程代码和班号构成。保存 programming lecture 001 与 lab 002 后，将 fixture 的 Spring 改成 Fall，并将 lecture 时间从 09:45 改成 13:45；新页面仍显示禁用的 “Added”，存储继续保留旧时间。

**影响：** 新学期班次与旧学期无法区分；不同班号的导入还可能在同一 planner 中混合多个学期的数据。

**建议修复：** 明确 planner 与 offering 的学期契约，持久化学期身份，对导入、比较与合并执行学期一致性检查，并显式迁移旧记录。

### F04 · P2 · 无界同步排课计算可能阻塞页面

**位置：** [planner/main.tsx:80](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/planner/main.tsx:80)、[ranking.ts:170](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/core/schedule/ranking.ts:170)、[enhancePage.ts:35](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/enhancePage.ts:35)。

**证据：** solver 保留所有可行方案，ranking 对全部方案同步评分和排序，UI 最终仅展示前八项。真实领域实现的基准：7 门必选课程、每门 7 个互不冲突的备选，产生 **823,543** 个方案；求解约 **946 ms**，评分排序约 **4,843 ms**，堆内存约 **337 MiB**。数值依赖运行环境。Albert 冲突高亮还会对每个解析行重复求解/排序；即使关闭冲突高亮，参数仍提前计算。

**影响：** 常规增加备选、修改偏好或渲染搜索结果可能长时间阻塞主线程，并显著增加内存占用。

**建议修复：** 同一 planner 状态只计算一次共享结果；建立有预算、可取消的搜索契约，并将昂贵计算移出主线程。限制枚举时应明确提示结果不完整，不能把最先找到的 DFS 结果直接宣称为全局最优。性能测试应覆盖低冲突输入下的求解和评分全流程。

### F05 · P2 · 总开关关闭后仍执行会话续期和搜索拦截

**位置：** [content.ts:27](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/content.ts:27)、[enhancePage.ts:186](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/enhancePage.ts:186)。

**证据：** `confirmSessionExpiry` 仅接收 `keepSessionAlive`，未检查 `settings.enabled`。临时测试执行真实 content 脚本与会话工具，在 `{ enabled: false, keepSessionAlive: true }` 下仍收到续期事件。已安装的 Enter 监听器在关闭总开关后仍阻止原生处理并派发搜索请求；只有缩写替换检查了总开关。

**影响：** 用户明确关闭扩展增强后，页面操作仍被扩展改变，与 master switch 的公开含义不一致。

**建议修复：** 会话续期同时检查两个开关；关闭总开关时禁用或移除现有搜索监听器。增加已增强页面动态关闭功能的集成测试。

### F06 · P2 · 已导入课程会与自身产生冲突警告

**位置：** [enhancePage.ts:37](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/enhancePage.ts:37)。

**证据：** 搜索班次与当前候选中的所有 option 比较，包括相同 `courseId`。仅导入 programming 一门课程后，其 lecture 出现 `CONFLICT CSCI-SHU 11 · Tue · 09:45–11:35`。同一课程的替代班次也可能与它要替换的 option 产生警告。

**影响：** 默认冲突提示会在成功导入后立即产生误报，降低其可信度。

**建议修复：** 排除相同 `courseId` 的已选 option。回归测试同时覆盖已导入班次、同课程替代班次和真正的跨课程冲突。

### F07 · P2 · 周末课程不会显示在日历中

**位置：** [planner/main.tsx:186](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/planner/main.tsx:186)。

**证据：** 领域模型支持一周七天，但日历固定渲染 Monday 至 Friday。真实 React 页面模块的临时测试中，周六课程出现在已选组件摘要，日历的 meeting 方块数量却为零。

**影响：** 用户可能误以为周末没有课程，尽管生成方案实际包含周末安排。

**建议修复：** 当已选方案含周末 meeting 时显示对应日期列，并增加周六、周日的页面测试。

### F08 · P2 · Robustness 将被约束禁止的 option 计为备用方案

**位置：** [ranking.ts:116](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/core/schedule/ranking.ts:116)。

**证据：** 备用判定重复实现 solver 的部分过滤条件，却遗漏 `CourseIntent.optionIds` 和精确 option 锁定。课程存在 a1、a2 两个备选时，仅允许 a1，或精确锁定 a1，solver 均只返回 a1；robustness 仍因计入不可用的 a2 而返回 **100**。

**影响：** 界面错误报告存在备用方案；默认 robustness 权重为 1，最高可将基于不可行备选的 100 分加入总分。

**建议修复：** 在 schedule 模块内统一 option eligibility 的所有权，由 solver 与 robustness 共用，完整处理允许列表、精确锁定和组件约束。增加受约束备用方案测试。

### F09 · P3 · 真实页面的脱敏 fixture 无法回放解析器

**位置：** [fixtureCapture.ts:16](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/fixtureCapture.ts:16)。

**证据：** capture 只克隆 section 根节点，漏掉登录页面解析课程身份所需的祖先和标题，并删除公开页面解析依赖的 class。执行 capture → 替换 DOM → parse 的往返验证：Machine Learning 从 **5 个可解析 section 变成 0 个**；公开搜索从 **1 个变成 0 个**；人工 `data-ae-*` fixture 则保持 1 个。

**影响：** 文档推荐的 fixture 捕获流程无法为两种真实页面格式生成有效回归样本，现有测试仅覆盖人工标记。

**建议修复：** 捕获最小完整课程/学期结构，使用明确的解析属性白名单；或输出规范化的人工解析输入。为两种已有真实页面 fixture 增加往返测试。

### F10 · P3 · 内容脚本失效后遗留搜索监听器和归属标记

**位置：** [content.ts:15](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/content.ts:15)、[content.ts:50](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/entrypoints/content.ts:50)、[enhancePage.ts:184](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/enhancePage.ts:184)。

**证据：** 清理会删除面板、observer 和存储订阅，却保留 input/button 监听器与 `data-ae-abbreviation-search`。真实初始化 → 失效 → 新模块初始化的测试，在新设置要求 `XX → New phrase` 时仍得到 `XX → Old phrase`。

**影响边界：** 主要影响保留 DOM 的重新注入/热重载场景。README 要求扩展重载后完整刷新 Albert 标签页，该操作可以清除此问题，因此优先级较低。

**建议修复：** 给 adapter 安装的监听器提供明确的释放契约，使用 abort signal，并在释放时移除归属标记。生命周期测试应包含真实 adapter。

### F11 · P3 · 尚未接入的 Provider 丢弃无效时间后仍保留 option

**位置：** [nyuProvider.ts:61](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/nyu-course-data/nyuProvider.ts:61)。

**证据：** decoder 过滤无法识别的 meeting，但保留其所属 option。临时测试将带错误星期字段的定时课程解码为空 meetings，solver 随后将它与相同时段的另一课程视为可共存。

**影响边界：** 当前没有 entrypoint 调用该 Provider，尚无已确认的线上用户路径。未来接入后，外部数据错误可能静默移除冲突约束。

**建议修复：** 对包含无效 meeting 的 option 整体拒绝，或返回显式解码错误。区分原本就是 TBA 的课程与解析失败的课程，并在接入前验证。

### F12 · P3 · 尚未接入的状态检测器将否定消息判断为已选上

**位置：** [statusDetector.ts:7](/Users/wezy/Documents/ChatGPT/albert_enhancer/src/adapters/albert/statusDetector.ts:7)。

**证据：** `You are not enrolled in this class.` 与 `Enrollment failed: you must be enrolled in the linked lab first.` 均返回 `enrolled`，因为匹配了没有上下文限制的 enrolled 单词。

**影响边界：** 当前仅测试调用该函数，没有生产调用方；但行为违反“歧义保留 unknown”的保守契约。

**建议修复：** 先拒绝否定/失败上下文，再识别明确的成功确认。在接入 UI 前增加否定和失败消息测试。

## 3. 架构健康评估

- 第一方代码使用 TypeScript、WXT 与 React，构建为 Chrome MV3 扩展；没有自建后端。
- entrypoints 负责宿主生命周期和 UI；Albert adapter 负责 DOM/桥接；storage 负责本地持久化；features 和 curricula 向下依赖平台无关 core。
- core 内部由 builder 负责合法组件组合，solver 将完整 option 作为原子选择，registration 负责纯状态转换。该职责分离与文档一致。
- 使用 TypeScript 模块解析检查 **65 个源文件、160 条本地 import/export 边**，未发现文件循环依赖或顶层模块边界违规。
- 实质性架构问题是持久化更新缺少统一所有权、solver/ranking 重复资格判定，以及 DOM 渲染期间重复运行昂贵计算。这些已经对应可复现行为问题，应随相关修复解决。
- MAIN 桥接使用固定动作，学期元数据和续期 URL 有检查；已检查路径未确认权限提升、任意代码执行或自动提交注册操作。

## 4. Codex Readability 评估

架构入口、模块 README、描述性命名、规模较小且责任明确的领域模块，以及对应测试，使新 agent 能较快建立上下文。领域核心的文档与实现基本一致。

需要优先改进的是 `latestSettings` 隐式模块状态、缺少释放契约的 adapter 监听器，以及 UI/adapter 中的应用编排与重复求解。建议围绕已确认缺陷做增量结构修复，不建议开展无关的大规模重写或纯外观重构。

## 5. 建议修复顺序

1. **F01：** 先阻止跨页面旧快照覆盖和数据丢失。
2. **F02、F03：** 保证导入组合完整、学期身份一致。
3. **F04、F05：** 限制计算成本并正确遵守总开关。
4. **F06、F07、F08：** 修正冲突提示、周末日历和备用评分。
5. **F09、F10：** 修复 fixture 工作流与监听器生命周期。
6. **F11、F12：** 在接入 Provider 和状态检测器之前收紧其契约。

## 6. 覆盖范围、验证及限制

### 模块检查清单

所有第一方 TypeScript/TSX 源模块均已检查：

| 模块 | 源文件数 | 已检查内容 |
| --- | ---: | --- |
| core | 20 | 课程契约、builder、solver、ranking、冲突分析、registration、curriculum |
| curricula | 4 | 专业规则脚手架及组合关系 |
| Albert adapter | 14 | 解析、分组、picker、导入、桥接、会话、校区/学期、脱敏、生命周期 |
| Course Provider | 4 | 公共契约、Mock、外部数据解码 |
| features | 11 | 缩写、校区、高亮、日历、设置契约 |
| storage | 5 | 持久化、兼容处理、合并/移除、导出/清除 |
| entrypoints | 7 | content/MAIN、background、四个 React 页面 |
| **合计** | **65** | **全部第一方 TypeScript/TSX 源文件** |

同时检查相关 CSS/HTML、架构和模块文档、真实/人工 fixtures、配置、全部 **29 个单元/性质测试文件**、4 个 E2E 源文件及浏览器回放 harness。Lockfile 元数据与捕获的供应商资源仅做了针对性检查，不代表完整第三方源码审计。

### 已执行验证

- `npm run lint`：通过。
- `npm run typecheck`：通过。
- `npm test`：**29 个文件、118 个测试通过**。
- 在临时副本执行 production WXT build：通过。
- 临时 JSDOM/TypeScript 测试及纯函数基准验证了上述 findings；没有向仓库增加复现测试或修复代码。
- 原审查开始和结束时 Git 状态干净；对 `.git`、`node_modules` 之外的 **178 个文件**进行哈希比对，没有新增、删除或内容变化。生成本文之后，该文件本身是预期新增内容。

### 未完成的验证与剩余工作

- **浏览器 E2E：** 21 个案例均在执行断言前因 Chromium 启动时 SIGABRT 中止；不能认定通过，也不能据此判断产品断言失败。
- **依赖漏洞公告：** `npm audit` 因 `registry.npmjs.org` DNS 解析失败而未完成，需在可联网环境补查。
- **真实 Albert：** 本次未执行登录态真实页面验证；DOM/桥接结论基于源码、已有 fixture 及临时复现。
- **课程政策：** curricula 明确属于初步脚手架，仅检查实现一致性，未按官方 Bulletin 认证学位政策、先修或双重计入规则。
- **第三方资源：** 未逐行审计所有传递依赖、lockfile 内容和捕获的供应商 JS/CSS。

因此，本次完成了全部第一方源模块的系统审查，但运行环境、第三方依赖与外部政策的验证并未达到完整覆盖。
