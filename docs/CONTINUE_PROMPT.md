# HealthLoop 全新克隆接续 Prompt

将下面正文交给下一次 Codex 会话，并在已核验 GitHub 仓库的**全新 clone 根目录**运行。远端 URL 从此次交付记录取得，不凭空猜测。建议 clone 到无空格路径，例如自选工作目录下的 `healthloop`。旧机器资料已可能删除，不能依赖旧路径、旧 `/tmp` 数据库/Pods、已有 worktree 或本机运行时缓存。

---

请继续实现本仓库 HealthLoop。目标是完成可验证的纵向流程及仍未验收的需求，不是重建脚手架、只写方案或重复汇报历史测试。请先检查实际文件、git 状态和当前依赖；保留他人修改。使用相对仓库路径记录证据，不设开发周或交付时间表。

## 必须先读

依次阅读适用的 `AGENTS.md`、完整 `MEGA_PROMPT.md`、`docs/requirements.md` 或 JSON、`docs/UNFINISHED_REPORT.md`、`docs/IMPLEMENTATION_STATUS.md`、`docs/TEST_EVIDENCE.md`、`docs/DEVICE_SETUP.md`、`docs/BACKEND_NOTES.md`、`docs/DECISIONS.md`、`docs/SECURITY.md`、`docs/PRIVACY_DATA_MAP.md`、`apps/mobile/NATIVE_VERIFICATION.md`。若实际文件位置不同，先定位，不编造读取结果。`docs/DEVELOPMENT_KIT.md` 是补充资料说明，原始 58 项需求与本仓库产品边界仍是执行依据。

所有 58 个 ID、优先级、依赖、B/C owner 与交叉 reviewer 必须保留。B 主责移动端/设备，C 主责后端/权限/账务；A 负责商业产品法律协调，D 支持设计 QA。代码或 AI 测试不代替 B/C 人工验收、法律意见、独立审计。

## 不可越过的范围

- iOS-first 原生应用，成人、简体中文、`Asia/Hong_Kong` 任务时区。核心奖励是不可转让、无现金价值积分，不承诺未来换币；加入不需钱包或广告同意。
- HealthKit 只读已有资料，不写入假样本、不虚构读取；缺失不能当作零或已知拒绝授权。手动/未知来源不发奖，手机/手表重叠不相加；原始健康数据与 provider ID 留在设备，不进入仓库、日志或对话。
- 同意读取、同步、行销分开。撤回、离线、重连、账户切换和删除要 fail closed；不得让晚到错误恢复权限或跨账户执行领取。先理解已有 `consent-controller.ts`、`activity-sync.ts`、`account-sequence.ts` 和实际 hook，再修改。
- 服务器决定权益、积分、库存与权限；客户端不得提交 user ID、任意奖分或完成标记。保留 RLS、业务唯一键、事务锁、幂等和不可覆写账本，更正必须补偿分录。应用管理员由服务器角色/MFA决定，不能由项目字母或用户 metadata 推断。
- 不把健康数据、推导标签、达标状态或钱包用于赞助投放/事件；观看或点击广告不发奖。
- Lab 使用独立 app/身份/会话/数据库，仅合成任务，无核心健康到 token 路径；唯一远端链为 Base Sepolia `84532`。核心分发构建必须排除 Lab 与 synthetic provider。P1/P2 是需另行批准的条件 backlog，mainnet 不在当前 brief 内。
- 当前授权允许本地实现与合成测试。未经明确批准，不产生费用、不公开发布、不操作正式生产、不创建远端资源、不部署/广播链交易、不购买 Apple 资格或云构建。不得将 service-role key 放进客户端/GitHub，也不得收集私钥/助记词。新会话不可把上一轮“GitHub 备份及本机清理”理解为继续删除新环境或公开发布的授权。

## 第一步：从空环境重建自动化基线

先检查 `git status --short`、当前 commit/branch/remote、Node/pnpm/PostgreSQL/Deno 版本，确认仓库是真实克隆且没有缺失文件。历史基线为 Node **24.19.0**、pnpm **11.19.0**、PostgreSQL **17.11**、Deno **2.7.1**；Node/pnpm 约束以 `.nvmrc` 和 `package.json` 为准。使用已安装的兼容工具或按官方说明准备，不偷换到宿主默认 Node；需要操作者密码、系统安装器或付费操作时先报告准确前提。不要引用历史 bundled Node 的绝对路径。

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

以上 trust 配置仅适用于本机可丢弃测试 cluster，不是部署配置。逐条检查成功再继续，不能使用忽略错误或假成功 fallback。`test:db` 必须先运行，随后 integration 使用同一专属测试库；所有 `supabase/migrations/` 文件按文件名顺序加载，不能只加载原始 migration，也不重写已应用迁移。需要继续 P21 数据库工作时保留这一个专属实例，结束会话时只停止本次自己启动的 cluster：

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

上个 checkpoint 的预期参考是：`pnpm check` **159 tests / 10 files**、`test:db` **28 组**、`test:integration` **10 tests**、`test:edge` **12 tests**，以及 iOS JS 导出/隔离检查通过。新增有效回归可增加数量，不得删测试凑数或弱化隔离检查。若基线失败先定位并修复/如实记录，不把先前结果抄成当前通过。

这些 DB/集成测试使用合成 provider、注入 Auth claims 和传输适配器；即使全过，也不能声称真实 OTP/JWT 网关、原生 Swift、HealthKit 或两台设备通过。历史 Expo prebuild、Swift parse、95 Pods 安装也不等于 native build。先前 `xcodebuild` 在源码编译前因缺 CoreSimulator 失败；旧 Pods 已删除，当前必须重新生成和安装。

## 第二步：宿主、完整本地 Auth 与原生设备门槛

对新宿主做有限检查，不假定旧机器的失败仍存在。每个诊断进程限制约 15–20 秒，记录版本/退出码/错误；不要重复启动长时间挂起的 `firstLaunch`、`simctl` 或 Docker 调用。检查 Xcode 首次设置、CoreSimulator 和 `docker info`。若缺组件或需要 GUI/系统密码，报告具体操作者修复步骤，参考 `docs/DEVICE_SETUP.md`；不要手动复制私有 framework 或自动重装系统。确认有足够磁盘空间再生成 Pods/容器。

Docker 可用且本地 Supabase CLI 已准备后，在当前 clone 根目录使用现有 `supabase/config.toml` 启动本地服务，不运行 `supabase init` 覆盖它。不启动云端项目，不复用正式数据。按需要新建被 gitignore 的本地环境文件，参考已有 `.env.example`，不输出或提交 secrets：

```sh
supabase start
supabase functions serve core --env-file supabase/functions/core/.env.local
```

Edge 本地配置应为 `HEALTHLOOP_ENV=development`、`HEALTHLOOP_BUILD_MODE=real`、`HEALTHLOOP_PROJECT_LABEL=healthloop-local-dev`，CORS 使用实际开发 origin。仅在明确可丢弃的新本地项目中才运行 `supabase db reset --local`。seed 会开启 demo 模式，所以实机真实读取前必须在该本地库执行并确认：

```sql
UPDATE private.system_settings SET demo_mode=false WHERE singleton;
SELECT demo_mode FROM private.system_settings WHERE singleton;
```

确认结果是 false，Edge 与 App 同为 real 模式。每次重用 seed 后重查。App 的 `apps/mobile/.env` 使用 development/real、同一 Mac 私网地址的本地 Supabase/Core API 和**公开 anon/publishable key**；手机的 `127.0.0.1` 指手机自己。服务角色 key 只供服务器工作器使用。连接和日志不得把真实健康资料上传到编码会话。

先用本地邮件测试介面取得真正由 Supabase Auth 产生的 OTP（配置端口 54324），验证正确/错误/过期/重发、JWT/会话隔离、登出/撤回及最近 OTP 删除；这仍不证明外部 SMTP 寄达。运行真实删除工作器需仅本地合成账户与安全服务配置，核验重复执行及旧 JWT 拒绝，不以静态检查代替它。

Xcode 宿主门槛通过后，在当前无空格 clone 中执行：

```sh
pnpm --filter @healthloop/mobile prebuild
```

重新安装原生依赖，找到本次生成的 `.xcworkspace` 并记录实际 unsigned simulator build 命令与结果，不假设旧产物存在。只有 native compile/link 真正通过才能标记其通过。之后由操作者提供可用的 Apple Team、唯一 bundle identifier 与 HealthKit 能力；不自动购买资格或发布。使用自定义 Expo development build，不能用 Expo Go 验收 HealthKit。

在至少两台真实 iPhone 按 `apps/mobile/NATIVE_VERIFICATION.md` 执行：OTP → 分开同意 → 唯读现有健康资料 → 最小摘要 → 服务端 claim → 积分流水。再验证无资料、拒绝/撤回、手机/手表重叠、未知/手动来源、睡眠/心率可选状态、离线重启、前后台、恢复同步、丢响应重试、截止边界、账号切换、删除及大字体/VoiceOver。记录 commit/build、设备/iOS、案例结果和 B/C 复核，真实读数或未遮蔽截图留在设备测试环境，不进 repo/对话。未取得两台设备证据不能关闭 P03/P31/P32。

宿主不可用时如实保留阻塞，继续下面可独立执行的代码工作，不把失败轮询当作进度。

## 第三步：独立可做的 P21 申诉审批与补偿分录

Owner C、reviewer B；依赖 P19，协同 P12/P13/P15/P22。先检查现有申诉、risk flags、活动修订日志、`packages/domain/src/rules.ts`、SQL profile 锁和不可变账本，再实现一个完整、可测试的本地纵向切片：

1. 用新增前向迁移建立申请/审批状态机和明确服务器权限。要求理由、原任务/原分录关联、审批审计；高风险调整由另一授权人复核，申请者不能批准自己，普通用户/伪造 metadata 不得提升权限；复用并验证适用 MFA 门槛。
2. 服务端基于固定规则/已确认更正计算差额，不信任客户端任意金额。调整每日权益时重算受影响的同周资格；已不满足三天条件的周奖也用补偿分录处理。不能因截止/版本变化误改其他任务，不能重新打开过期的普通领取路径。
3. 已记账历史不可改删，理由、旧/新权益及每日/周补偿可追溯。防止撤回/删除/停奖/普通领取与审批并发造成重复或错账；定义重复请求原结果和变更重放冲突。
4. 已花费积分后发生负向更正，账本仍反映真实余额；可消费额度最低为零，不能继续兑换，不能为避免负数静默放弃冲销或改写历史。
5. 在自己的可丢弃真实 PostgreSQL 库补充越权、自审、MFA、同请求重试、不同键并发、部分事务失败回滚、日更正牵连周奖、已消费后更正/兑换竞争及删除/撤回边界回归；同步严格 API schema 和最小管理/用户状态展示。不要通过直接 owner SQL 绕过生产权限来演示“成功”。

检查受影响的既有用例，更新 `docs/IMPLEMENTATION_STATUS.md`、`docs/TEST_EVIDENCE.md` 和相关操作文档；人工审批是产品角色执行动作，不是 Codex 自行给自己签收。完成此切片再按依赖推进完整 P20/P22 管理、P16/P17 示范奖励 UI、P25/P27 删除保留/还原演练、本地 pin 元数据清理与跨安装恢复、P23/P24 赞助隔离、P29/P30 通知/指标及 P28 实机可及性。不要忘记其他 P0，也不要同时大改所有模块。

## 后续 Lab、协作与结束要求

核心验收依赖满足后，按 L01→L02/L04→L03→L05→L06→L07→L08 实现独立合成 Lab。可以准备本地合约/签名/防重放测试，但远端 Base Sepolia 部署与广播仍需要明确批准；MetaMask/Trust Wallet 各十次验收必须真实执行。任何 P1/P2 扩展先说明触发条件和现有授权，不默默启动主网或商业功能。

可并行的任务明确文件归属，提醒其他工作者不要回退彼此更改；迁移及共享契约先协调。不要把实施进度视作外部审核已完成。每个阶段以依赖、可复现案例和真实失败为依据推进。

结束会话时报告本次实际改变的 ID/相对路径、命令与结果、仍阻塞的具体环节，以及下个可执行任务。停止本次自行启动的测试进程，保留必要且脱敏的证据；不删除无关文件、不启动自动接续。远端提交/推送遵循当次明确授权，不把当前 prompt 当作发布或清理许可。最终交接文档必须让下一次全新 clone 能继续，不能依赖未提交代码或旧机器缓存。
