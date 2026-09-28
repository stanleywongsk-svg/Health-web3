# HealthLoop 本机／全新克隆接续 Prompt

将下面正文交给下一次 Codex 会话，在当前仓库根目录执行。用户已改变清理策略：源码恢复到 `/Users/wi/healthloop`，`/Users/wi/web3 health` 是兼容符号链接；本机分支为 `codex/resume-core`。保留此目录，不再次删除。先检查本机 git 状态；不要用较旧 GitHub 备份覆盖本机新提交。若换机器才从已核验远端克隆，并核对是否包含最新本机 checkpoint。旧临时数据库/Pods 仍不可假定存在。

最新 UI checkpoint 为 2026-09-28：真正本机 OTP 登录、首次同意、页面操作、登录态冷启动保留及退出后冷启动保持登出已在原生模拟器完成并录制；详见 [SIMULATOR_WALKTHROUGH_20260928.md](SIMULATOR_WALKTHROUGH_20260928.md) 和 [公开成片说明](evidence/recordings/README.md)。实机 HealthKit 验收仍为 0。用户已批准当前源码、相关证据及两份简体中文提案上传 GitHub；实际完成状态以 [GITHUB_BACKUP.md](GITHUB_BACKUP.md) 的核验记录为准，上传后仍保留本机文件。提案供讨论，不修改现行 brief 或授权主网／代币操作。

---

请继续实现本仓库 HealthLoop。目标是完成可验证的纵向流程及仍未验收的需求，不是重建脚手架、只写方案或重复汇报历史测试。请先检查实际文件、git 状态和当前依赖；保留他人修改。使用相对仓库路径记录证据，不设开发周或交付时间表。

## 必须先读

遵守当前会话的用户指令；用户已重新提供并确认本仓库 AGENTS.md 适用，必须先阅读它及所有适用的目录指令，再阅读完整 `MEGA_PROMPT.md`、`docs/requirements.md` 或 JSON、`docs/UNFINISHED_REPORT.md`、`docs/IMPLEMENTATION_STATUS.md`、`docs/TEST_EVIDENCE.md`、`docs/DEVICE_SETUP.md`、`docs/BACKEND_NOTES.md`、`docs/DECISIONS.md`、`docs/SECURITY.md`、`docs/PRIVACY_DATA_MAP.md`、`apps/mobile/NATIVE_VERIFICATION.md`。若实际文件位置不同，先定位，不编造读取结果。`docs/DEVELOPMENT_KIT.md` 是补充资料说明，原始 58 项需求与本仓库产品边界仍是执行依据。

所有 58 个 ID、优先级、依赖、B/C owner 与交叉 reviewer 必须保留。B 主责移动端/设备，C 主责后端/权限/账务；A 负责商业产品法律协调，D 支持设计 QA。代码或 AI 测试不代替 B/C 人工验收、法律意见、独立审计。

## 不可越过的范围

- iOS-first 原生应用，成人、简体中文、`Asia/Hong_Kong` 任务时区。核心奖励是不可转让、无现金价值积分，不承诺未来换币；加入不需钱包或广告同意。
- HealthKit 只读已有资料，不写入假样本、不虚构读取；缺失不能当作零或已知拒绝授权。手动/未知来源不发奖，手机/手表重叠不相加；原始健康数据与 provider ID 留在设备，不进入仓库、日志或对话。
- 同意读取、同步、行销分开。撤回、离线、重连、账户切换和删除要 fail closed；不得让晚到错误恢复权限或跨账户执行领取。先理解已有 `consent-controller.ts`、`activity-sync.ts`、`account-sequence.ts` 和实际 hook，再修改。
- 服务器决定权益、积分、库存与权限；客户端不得提交 user ID、任意奖分或完成标记。保留 RLS、业务唯一键、事务锁、幂等和不可覆写账本，更正必须补偿分录。应用管理员由服务器角色/MFA决定，不能由项目字母或用户 metadata 推断。
- 不把健康数据、推导标签、达标状态或钱包用于赞助投放/事件；观看或点击广告不发奖。
- Lab 使用独立 app/身份/会话/数据库，仅合成任务，无核心健康到 token 路径；唯一远端链为 Base Sepolia `84532`。核心分发构建必须排除 Lab 与 synthetic provider。P1/P2 是需另行批准的条件 backlog，mainnet 不在当前 brief 内。
- 当前授权允许本地实现与合成测试，以及本轮明确指定的现有 GitHub 仓库源码／相关资料上传。未经另行明确批准，不产生费用、不操作正式生产、不创建远端资源、不部署/广播链交易、不购买 Apple 资格或云构建，也不扩大公开发布范围。不得将 service-role key 放进客户端/GitHub，也不得收集私钥/助记词。旧“备份后清理”指令已撤销；上传不构成删除本机环境的授权。

## 第一步：检查现有环境并执行自动化基线

先检查 `git status --short`、当前 commit/branch/remote、Node/pnpm/PostgreSQL/Deno 版本，确认当前分支、未提交修改及本机新增提交均保留；不要为重建环境丢弃它们。历史基线为 Node **24.19.0**、pnpm **11.19.0**、PostgreSQL **17.11**、Deno **2.7.1**；Node/pnpm 约束以 `.nvmrc` 和 `package.json` 为准。使用已安装的兼容工具或按官方说明准备，不偷换到宿主默认 Node；需要操作者密码、系统安装器或付费操作时先报告准确前提。不要引用历史 bundled Node 的绝对路径。

在仓库根目录先执行以下命令，保存真实退出码与摘要；全新 clone 不使用 `--offline` 假定缓存存在：

```sh
node --version
pnpm --version
pnpm install --frozen-lockfile
pnpm check
```

然后建立**全新的、仅供本次测试的本地 PostgreSQL 17 环境**。测试 runner 会清空指定库中的 `public/private/auth` schemas，必须使用独占且可丢弃的 `healthloop_test_*` 库，绝不对生产、远端、共享开发或需保留的设备测试库运行。若尚无独立实例，可按下例创建新的 loopback cluster。先确认端口未占用；若 55432 被占用，选择空闲端口并一致更新变量，不停止未知进程。下例需 `initdb/pg_ctl/createdb` 已正确进入 PATH；不要以 root 启动 PostgreSQL。

```sh
HL_TEST_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/healthloop-rebuild.XXXXXX")"
HL_TEST_PORT=55432
initdb -D "$HL_TEST_ROOT/pg" -U healthloop_local -A trust --no-locale -E UTF8
pg_ctl -D "$HL_TEST_ROOT/pg" -l "$HL_TEST_ROOT/postgres.log" \
  -o "-h 127.0.0.1 -p $HL_TEST_PORT -c max_connections=160" start
createdb -h 127.0.0.1 -p "$HL_TEST_PORT" -U healthloop_local healthloop_test_rebuild
export HEALTHLOOP_TEST_DATABASE_URL="postgresql://healthloop_local@127.0.0.1:$HL_TEST_PORT/healthloop_test_rebuild"
export HEALTHLOOP_ALLOW_DB_RESET=local-only
pnpm test:db
pnpm test:integration
```

以上 trust 配置仅适用于本机可丢弃测试 cluster，不是部署配置。逐条检查成功再继续，不能使用忽略错误或假成功 fallback。`test:db` 必须先运行，随后 integration 使用同一专属测试库；所有 `supabase/migrations/` 文件按文件名顺序加载，不能只加载原始 migration，也不重写已应用迁移。需要继续数据库工作时保留这一个专属实例，结束会话时只停止本次自己启动的 cluster：

```sh
pg_ctl -D "$HL_TEST_ROOT/pg" stop
unset HEALTHLOOP_TEST_DATABASE_URL HEALTHLOOP_ALLOW_DB_RESET
```

完成 Edge 和 iOS JavaScript 构建基线：

```sh
pnpm typecheck:edge
pnpm test:edge
pnpm mobile:bundle
git diff --check
```

上个 checkpoint 的预期参考是：`pnpm check` **322 tests / 17 files**、`test:db` **62 组**、`test:integration` **23 tests**、`test:edge` **32 tests**，以及 iOS JS 导出/隔离检查通过。新增有效回归可增加数量，不得删测试凑数或弱化隔离检查。若基线失败先定位并修复/如实记录，不把先前结果抄成当前通过。

旧 `test:db` / `test:integration` 使用合成 provider、注入 Auth claims 和传输适配器；它们不证明真实 OTP。独立 `test:local` 使用真正本机服务，范围与结果见最新 TEST_EVIDENCE。2026-09-24 原生宿主预检、fresh prebuild、97 Pods、未签署 iPhoneOS/Simulator 编译及模拟器安装/启动已成功（应用源码5e61056）。2026-09-28 使用配置完成的本地 ad-hoc 签署构建，以合成账号完成真实 OTP 登录、独立同意、页面操作、关闭提醒保存、导出分享菜单、登录态冷重启与登出后冷重启。没有读取或同步健康数据，seed demo_mode=true 未改动。完全 unsigned 的配置版会因 Keychain 缺少 entitlement 出现 -34018，不能据此弱化安全储存。没有签署实机安装或 HealthKit 读取证据；两台设备验收仍开放。重新构建前核对当前源码与生成项目，勿把旧宿主失败当作当前阻碍。

## 第二步：宿主、完整本地 Auth 与原生设备门槛

对新宿主做有限检查，不假定旧机器的失败仍存在。每个诊断进程限制约 15–20 秒，记录版本/退出码/错误；不要重复启动长时间挂起的 `firstLaunch`、`simctl` 或 Docker 调用。先执行 `pnpm mobile:preflight`（只读，失败会非零退出），检查 Xcode 首次设置、CoreSimulator 和有界的 `docker info`。若缺组件或需要 GUI/系统密码，报告具体操作者修复步骤，参考 `docs/DEVICE_SETUP.md`；不要手动复制私有 framework 或自动重装系统。确认有足够磁盘空间再生成 Pods/容器。

当前 Docker 和 pinned Supabase CLI2.117.0 已验证。按 [LOCAL_STACK_TESTING.md](LOCAL_STACK_TESTING.md) 使用以下真正本地服务；不要 `init` 覆盖配置、不要 `db reset` 作为启动动作，不复用正式/设备数据：

```sh
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:start
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm local:serve
# 另一个终端：
HEALTHLOOP_ALLOW_LOCAL_STACK=local-only pnpm test:local --reporter=verbose --disableConsoleIntercept
```

启动器为观测到的Docker Desktop端口默认不生效问题提供项目范围adapter，必须核对实际54321/54322/54324仅127.0.0.1。它保持卷数据，过滤CLI凭证日志，不改全局Docker设置。若CLI升级，不要跳过版本/端口保护；按实际新版本重新检查适配器。Edge本机env为test/real/healthloop-local-dev；无service key进入App。

HTTP suite是一个顺序场景、六组检查，已真实通过两次：本机Mailpit OTP、ES256会话/篡改拒绝、同意/合成摘要/claim/账本、RLS/撤回、提醒/导出、刷新/登出、指定任务删除/实际Auth移除/崩溃重试及旧JWT拒绝。它拒绝已有用户/摘要/待删job，仅操作本轮随机标记的合成身份，执行后恢复seed demo_mode=true；不能把运行结束的栈当作实机真实健康数据环境。独立 `test:db`/`test:integration` 的reset只用于55432专属测试库，绝不能指向这个Auth栈。

OTP过期/重发、access-token过期、真实MFA及外部SMTP仍未验证。删除worker可由HEALTHLOOP_DELETION_JOB_IDS收窄执行，空/非法值不能扩大范围；没有该配置仍处理正常队列。服务key始终只存在受信任服务器进程环境，不输出。后续优先补真实MFA与P20/P22管理流程；保留SMTP/实机验收边界。

本机合成测试环境只在loopback监听。准备实机时按DEVICE_SETUP建立分开的development/real数据库与受信任LAN连接，核对demo_mode=false并设置手机实际可达的公开配置；不要暴露当前合成栈或复用自动化fixture。手机的127.0.0.1指手机自身，不是Mac。

Xcode 宿主门槛通过后，在当前无空格 clone 中执行：

```sh
pnpm --filter @healthloop/mobile prebuild
```

重新安装原生依赖，找到本次生成的 `.xcworkspace` 并记录实际 simulator build 命令与结果（使用Xcode本地ad-hoc签署，保留Keychain所需entitlement），不假设旧产物存在。只有 native compile/link 真正通过才能标记其通过。基本模拟器 OTP 登录／登出与两次冷重启已完成，后续可独立补错码／过期／重发、账户切换、离线恢复及可及性案例；不要与要求空账号数据库的 HTTP suite 并行创建用户，保留 HealthKit 未验证状态。实机检查由操作者提供可用的 Apple Team、唯一 bundle identifier 与 HealthKit 能力后推进；不自动购买资格或发布。使用自定义 Expo development build，不能用 Expo Go 验收 HealthKit。

在至少两台真实 iPhone 按 `apps/mobile/NATIVE_VERIFICATION.md` 执行：OTP → 分开同意 → 唯读现有健康资料 → 最小摘要 → 服务端 claim → 积分流水。再验证无资料、拒绝/撤回、手机/手表重叠、未知/手动来源、睡眠/心率可选状态、离线重启、前后台、恢复同步、丢响应重试、截止边界、账号切换、删除及大字体/VoiceOver。记录 commit/build、设备/iOS、案例结果和 B/C 复核，真实读数或未遮蔽截图留在设备测试环境，不进 repo/对话。未取得两台设备证据不能关闭 P03/P31/P32。

宿主不可用时如实保留阻塞，继续下面可独立执行的代码工作，不把失败轮询当作进度。

## 第三步：从已实现的审查／兑换切片继续

本机恢复后的切片已加入 `202609200002_appeal_adjustments.sql`、严格 P21 API、日/周补偿分录、signed balance/可花费额度、示范奖励移动端与最小持久重试 intent。先阅读这些实际实现和最新 TEST_EVIDENCE，不重复重建。同意撤回会阻止新的审批；既有兑换 key 可在撤回后查询原结果，取消退款仍可进行，新 key 不能花分。申诉审批只选现有保留期内 pending revision，不能提交任意分数或新过期健康数据；第二人必须有服务器 reviewer 角色和 signed aal2。测试注入角色/claims 不是真实 MFA。

按照依赖选择下一条完整流程：

1. P20/P22：建立独立最小管理员界面与任务草稿／预览／版本发布流程。复用已有审查 API、双人审批、MFA/角色拒绝和事故暂停，不在客户端使用 service role，不追溯改写任务或账本。真正 MFA 注册／会话验证仍需完整本地 Auth；不可用时保留其阻塞，但可以测试客户端状态、权限拒绝和服务器事务。
2. P25/P27：在独占可丢弃数据库执行真实备份／还原／删除 tombstone 重放及账本/库存对账。恢复环境先封闭流量、暂停发奖，重放删除后验证旧令牌不能读取/同步/领取。GitHub 源码备份不能替代此验收。补保留调度及有界来源 pin/修订元数据清理；保留法律批准为人工前提。
3. P23/P24：通用非个性化赞助界面与独立聚合事件，测试无健康/身份/钱包关联键及点击不发奖。真实赞助素材须批准，不能虚构商户。
4. P29 已有完整代码切片：`202609200003_notification_preferences.sql`、严格 API、`reminder-controller.ts`、设置画面、Expo 本地 driver 和移除远程推送 entitlement 的 config plugin。不要重建；保持默认关闭、独立许可、香港安静时段、冲突重读、离线停止记录及仅通用文案。通知 API/native 失败不得封锁核心使用；真正 Auth 失效仍必须 fail closed。追加通知实机许可／投递／生命周期检查，继续 P30 第一方指标、P28 设备可及性与 P01/P03/P31/P32 真实 Auth/双设备验收。

本次实现不能把 P21/P16/P17 标成人工验收完成；需要管理界面、真实 MFA、native 操作及 B/C 签认。保留全部其他 P0，修复新检查暴露的缺陷再继续，不因宿主不可用而伪造成功。更新全量实施状态和未完成报告，按依赖及验收推进，不设固定日期。

## 后续 Lab、协作与结束要求

核心验收依赖满足后，按 L01→L02/L04→L03→L05→L06→L07→L08 实现独立合成 Lab。可以准备本地合约/签名/防重放测试，但远端 Base Sepolia 部署与广播仍需要明确批准；MetaMask/Trust Wallet 各十次验收必须真实执行。任何 P1/P2 扩展先说明触发条件和现有授权，不默默启动主网或商业功能。

可并行的任务明确文件归属，提醒其他工作者不要回退彼此更改；迁移及共享契约先协调。不要把实施进度视作外部审核已完成。每个阶段以依赖、可复现案例和真实失败为依据推进。

结束会话时报告本次实际改变的 ID/相对路径、命令与结果、仍阻塞的具体环节，以及下个可执行任务。停止本次自行启动的测试进程，保留必要且脱敏的证据；不删除无关文件、不启动自动接续。远端提交/推送遵循当次明确授权，不把当前 prompt 当作发布或清理许可。最终交接文档必须让下一次全新 clone 能继续，不能依赖未提交代码或旧机器缓存。
