# 2026-10-20 review 验证与修复

原始记录见 [CODE_REVIEW_2026-10-20.md](CODE_REVIEW_2026-10-20.md)。本文件记录对当前代码的逐项验证与修复，不改写历史审查结论。

## 结论

12 项问题的代码依据均成立，本次全部修复并加入回归验证。没有需要驳回的 finding；F11/F12 确实尚无生产调用，不能把潜在缺陷描述成已发生的线上数据问题。修复采用局部责任拆分，保留已有领域接口及旧存储数据。

| 项目 | 当前代码验证 | 修复及验证位置 |
| --- | --- | --- |
| F01 / P1 旧快照覆盖 | planner / degree 确实只初始化读取，再把本地整个快照 setValue；订阅本身不足以解决并发 | storage `mutations.ts` 定义具体动作，background 唯一实例化 `writer.ts` 队列，所有排课/学位/清除操作串行读取最新值再更新；页面 watch 并在订阅后补读启动数据，保存失败可见。`writer.test.ts` 覆盖交错导入/偏好、独立导入、学位更新、清除与失败恢复；`plannerPage.test.ts` 覆盖真实页面模块；浏览器新增跨文档并发导入与旧页面偏好操作。 |
| F02 / P2 缺失组件 | `other` 确实被当作新的主课边界，能够漏掉必需辅课 | 未知/缺失组件不能开始或结束可信分组，导入拒绝；只有明确已识别主课能结束当前分组。`sectionGroups.test.ts` 覆盖缺失与未知标签，既有测试继续验证组件完整性。 |
| F03 / P2 学期身份 | course/section ID 原来只含代码和班号，Added 与 merge 不区分学期 | 采用单学期 planner 契约，新增可选 schema-v2 `term`；只有来源学期一致才认定 Added，保存端再次检查。旧记录归一化为 null、保留 ID/课程/历史且不推断学期，非空未知学期或不同学期的计划拒绝新导入。`offeringTerm.test.ts`、`enhancePage.test.ts`、`writer.test.ts` 及浏览器跨学期测试覆盖。 |
| F04 / P2 无界计算 | 生产页面确实穷举全部候选再评分，每个搜索结果行重复求解，关闭提示仍提前计算 | `searchSchedules` 逐步搜索；`rankedScheduleSearch` 限制 2,000 个候选 / 20,000 步，仅保留最优八项；宿主每约 8 ms 让出事件循环并支持取消。content 每份 planner 状态仅计算一次并显式传给 adapter，关闭提示不计算。结果不完整显示 count+ 和说明，不声称全局最优或已证明无解。`search.test.ts` 覆盖 7×7 低冲突全流程、穷举排序对照、节点预算和取消。 |
| F05 / P2 总开关 | 续期确实只检查 keepSessionAlive，已装 Enter handler 也没有总开关检查 | 续期同时检查 enabled；关闭时 abort adapter 搜索监听并释放标记，重新启用重建。`content.test.ts`、包含真实 adapter 的 `contentAdapter.test.ts` 覆盖停用和重新注入。 |
| F06 / P2 自身冲突 | 原逻辑比较所有候选 option，包含同 courseId | 预览冲突比较排除同课程；不同学期也不交叉比较。`enhancePage.test.ts` 覆盖自身、替代班次和真正跨课程冲突。 |
| F07 / P2 周末缺失 | 日历确实硬编码五天，领域支持七天 | 当前候选有周六/周日时增加对应日期列和网格列数。真实页面模块测试与浏览器测试验证两个周末 meeting 均显示。 |
| F08 / P2 虚假备用 | robustness 的重复资格逻辑确实遗漏 optionIds 和精确 option lock | `schedule/eligibility.ts` 统一资格判断，由 solver 和 robustness 共用；精确锁定、允许列表、组件锁定和排除均被遵守。`ranking.test.ts` 新增四种约束下备用分数为 0 的测试；solver 性质测试继续通过。 |
| F09 / P3 fixture 回放 | 原 capture 克隆 section 丢掉祖先身份，并删除公开解析 class；原测试仅验证人工结构 | 改为输出规范化 data-ae 解析输入，保留课程/学期、组件有序分组、教师、逐次地点和分类；不可读行保留为导入屏障。`fixtureCapture.test.ts` 对 ML、公开搜索、programming 三种样本的 parse 和 group 完整往返比较，并保留脱敏测试。 |
| F10 / P3 监听器遗留 | 原 cleanup 确实未移除搜索 input/button handler 及标记，旧 settings 闭包会被保留 | 每个 root 的显式上下文持有 AbortController 和最新 settings；`disposeAlbertPage` 释放监听和标记、恢复标题、移除面板。真实 content + adapter 生命周期测试覆盖失效、保留 DOM、新设置重新初始化。 |
| F11 / P3 无效 meeting | Provider 原来 filter 掉坏 meeting 后仍保留 option，能够丢失时间约束 | 含任意无效 option/component meeting 的 option 整体拒绝；缺失或非数组 meeting、NaN/Infinity 同样拒绝；显式空数组表示 TBA，可保留。`courseDataProvider.test.ts` 覆盖以上边界。仍未接入 entrypoint。 |
| F12 / P3 否定状态 | 原 enrolled 单词匹配确实会误识别否定/失败消息 | 先拒绝否定、失败、要求等上下文，再做正向检测；歧义 unknown。`statusDetector.test.ts` 覆盖 review 的两个例子及否定 waitlist。仍未接入注册状态。 |

## 对建议方案的取舍

- F01 不采用“只加 watch”：跨文档的读改写必须有统一所有者。清除数据也通过同一个队列，避免与未完成保存交错恢复旧 planner/degree 快照。
- F03 不给旧记录猜学期或直接重写 ID：采用明确的单学期计划范围，使现有 ID 在范围内唯一。旧数据可继续查看、模拟、移除及导出；导入明确学期前，需按需导出并移除旧课程。空计划允许绑定新学期。
- F04 采纳问题及预算/取消要求，但采用有界生成器和异步分片，未引入 Worker。当前默认预算和有限保留集消除了无界枚举/内存，分片避免长时间独占事件循环；这是较小的实现，不是硬实时保证。若将来需要明显扩大搜索规模，应另行评估 Worker 或其他搜索策略。
- F09 采用原建议允许的“规范化人工解析输入”，不继续保留大段原门户 DOM。真实 fixture 的原始内容没有被伪装成另一套 DOM；缺失的来源学期只在浏览器回放 harness 中显式补充。

## 额外发现

实际跑通此前受环境阻碍的浏览器测试后，发现重复导入另一主课会把已有课程移到列表末尾，导致日历颜色变化。已在本次涉及的 merge 中改为原位更新课程；增加课程顺序单测，已有颜色稳定性浏览器断言通过。

## 验证

- 修复前基线：29 个单元/性质测试文件，118 项通过。
- 修复后：`npm test` 36 个文件，159 项通过，包含完整本地 import/export（含类型依赖）无环及模块方向检查。
- `npm run lint`、`npm run typecheck`：通过。
- `npm run build`：通过。
- `npm run test:e2e`：22 项通过。沙箱内 Chromium 启动 SIGABRT；经允许在沙箱外执行后完成所有断言。
- `git diff --check`：通过。

## 验证边界与剩余架构事项

- 浏览器验证使用生产扩展及本地脱敏/人工页面回放，没有本次登录态真实 Albert 验证。未识别/含歧义学期来源的布局会明确拒绝导入，不静默猜测；新增来源布局应先保留脱敏样本。
- 搜索预算结果可能不完整；界面明确告知。异步分片是协作式调度，单次资格准备/评分仍在主线程。
- storage 队列协调所有遵循生产命令协议的写入；Chrome storage 本身没有跨文档事务，直接外部修改 storage 不受此队列协调。
- 本任务没有重新执行第三方漏洞公告审计或学位政策认证，也没有将 Provider / 状态检测器接入生产。
- adapter 仍直接发送导航消息；这个剩余边界问题不影响本次修复，后续涉及导航功能时再注入动作回调。未开展无关重构。
- 未提交或推送代码。
