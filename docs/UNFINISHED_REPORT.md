# HealthLoop 未完成事项与交接报告

记录日期：2026-09-28。当前成果是已实现并经过本地自动化测试、已有基本模拟器操作证据的核心纵向流程，**不是完整产品、两台实机验收通过或可发布版本**。本报告覆盖原有全部 58 项需求：P0 36 项、LAB 8 项、条件 P1 8 项、条件 P2 6 项。技术 owner 与人工 reviewer 仅为 B/C；所有人工复核仍待实际签认。A 负责商业、产品及法律协调，D 提供设计与 QA 支持，项目字母不自动赋予管理员权限。

需求原文与正式验收以 [requirements.md](requirements.md) 为准；逐项代码位置见 [IMPLEMENTATION_STATUS.md](IMPLEMENTATION_STATUS.md)，实际测试记录见 [TEST_EVIDENCE.md](TEST_EVIDENCE.md)。本报告不会把已有代码、合成测试或本文编写当作新验收证据。

## 已保存的能力与证据边界

已有 iOS 原生应用源码、只读 HealthKit 模块、来源聚合、分开同意、最小摘要同步、服务器任务判定、积分账本、示范兑换移动端与后端、双人审批／日周补偿、通知偏好／安静时段／本地提醒、删除工作器及测试。主要路径为 `apps/mobile/`、`packages/domain/`、`packages/health-provider/`、`packages/api-client/`、`supabase/`。同意与同步控制器已接入移动端实际 hook，覆盖撤回、重新连接、旧账户晚到响应、内存内重试及幂等处理。真实本地 Auth/Edge/PostgREST 已通过新增 HTTP 流程；真实设备与剩余 Auth/MFA 场景仍需验收。

用户已撤销清理策略并恢复本机开发：仓库 `/Users/wi/healthloop`、分支 `codex/resume-core`，原路径为兼容符号链接。用户另已批准当前源码、相关证据和两份简体中文提案上传现有 GitHub 仓库；实际远端覆盖以 [GITHUB_BACKUP.md](GITHUB_BACKUP.md) 的已完成核验为准。上传后仍保留本机文件和新提交，不用旧备份覆盖。恢复后已重新安装锁定依赖并执行检查，最新准确结果以 TEST_EVIDENCE 顶部为准；历史记录不能代替新机器的重跑。

| 检查 | 最近记录的结果 | 能证明的范围 |
|---|---|---|
| `pnpm check` | 通过；322 个测试、17 个文件；lint 零警告；根目录及移动端 TypeScript 通过；27 个客户端文件及全部 58 项责任边界通过 | 已实现代码的自动化检查 |
| `pnpm test:db` | 62 组真实 PostgreSQL 检查通过，含两组 100 请求并发领取、100 次并行审批重播及 100 次相同偏好重试 | SQL 权限、锁、事务、幂等、截止、撤回、兑换及删除等；Auth claims 由测试夹具注入 |
| `pnpm test:integration` | 23 个测试通过 | 合成 provider → 客户端 → 实际 HTTP handler → 真实 PostgreSQL；Auth 与 PostgREST 传输为注入适配器 |
| `pnpm typecheck:edge` / `pnpm test:edge` | 类型检查通过；32 个 Edge/worker 测试通过 | Edge/删除工作器静态检查与注入 Auth/RPC 的 HTTP 测试 |
| `pnpm mobile:bundle` | iOS Hermes 导出及隔离检查通过；845 modules，约 3.4 MB | JavaScript 构建含原生模块引用，并排除合成 provider/policy；不证明 Swift 编译或原生运行 |

本次 fresh Expo prebuild 与97个Pods安装、宿主预检、真正 iPhoneOS/Simulator 编译均通过；模拟器已安装启动并检查简体中文画面。生成配置没有APNs或远程通知后台模式。iPhoneOS产物未签署，不能当作可安装发布包。详见 [DEVICE_SETUP.md](DEVICE_SETUP.md) 和 [NATIVE_BUILD_EVIDENCE.md](NATIVE_BUILD_EVIDENCE.md)。

2026-09-28 原生模拟器实际完成本地 OTP 登录、成人确认与可选同意全部关闭、首页／任务／积分／账号页面操作、关闭状态提醒保存、导出分享菜单（取消分享）、已登录冷启动与退出后冷启动。成片已遮蔽验证码，见 [录像说明](evidence/recordings/README.md) 及 [完整记录](SIMULATOR_WALKTHROUGH_20260928.md)。这是无健康读取、无同步、无发奖或兑换的空数据路径；没有验证通知投递或 UI 删除。清理仅处理本轮测试账号，保留卷和源码；应用测试套件未因这次 UI 记录重跑。

`pnpm test:local` 新增一个顺序 HTTP 场景、六组流程，已在真正本机 Auth/Mailpit/ES256/PostgREST/Edge 上连续两次通过，无需重置：OTP、同意、合成最小摘要、服务器计分、账本、RLS、提醒偏好、刷新/登出、实际删除工作器与故障重试。它不注入 Auth claims，但健康值仍全为合成夹具。结束时Auth用户、活跃profile、pending删除和摘要均为0，seed demo_mode已恢复true。使用方法见 [LOCAL_STACK_TESTING](LOCAL_STACK_TESTING.md)。

当前真实 iPhone HealthKit 验收与钱包验收仍为 0。本地 OTP 送达／签名会话／删除工作器及上述模拟器冷启动会话路径已验证；OTP 过期、重发限流、access JWT 过期、真实 MFA、外部 SMTP、原生账户切换／离线恢复／长时会话、VoiceOver／大字体、真人审核、备份还原及 Lab 仍待验证。Gateway verify_jwt 开关保持 false，由 handler getUser 和 PostgREST 验证实际 token。远端 CI、法律审核及独立安全审计仍无完成证据。两份商业与代币经济提案为讨论文件，不改变当前需求或授权 live crypto／主网实现。

## P0：核心产品剩余验收（36 项）

表中“已有”均表示实现或自动化证据，尚不代表人工验收完成。每行保留 owner/reviewer 及原始依赖，剩余工作须按依赖推进，不设时间表。

| ID | Owner / reviewer | 依赖 | 当前状态与未完成验收 |
|---|---|---|---|
| P01 | B / C | P36 | 已有电邮 OTP/会话代码；本地错码/重播/刷新/登出已验证；模拟器实际 OTP 登录、登录态冷启动及退出后冷启动通过。待 OTP 过期/重发、账户切换及两台设备敏感缓存清理；不要求钱包。外部 SMTP 寄达另需实际证据。 |
| P02 | B / C | — | 已有成人声明、独立健康读取/云同步/行销同意及版本记录；待 B/C 验收和合适的隐私文案审批，不得把同意捆绑或视为医疗服务。 |
| P03 | B / C | P02 | 原生模块与只读声明已写；实际原生编译已通过；待签署/安装，并在至少两部 iPhone 读取已有当日步数，验证拒绝/撤回不崩溃。 |
| P04 | B / C | P03 | 已有步数首页与七天历史；待真实来源、更新时间、缺失不等于零及图表可读性核对。 |
| P05 | B / C | P03 | 已有可选睡眠读取与区间合并；待真实来源/区间及无资料提示验收，保持原始睡眠不上传。 |
| P06 | B / C | P03 | 已有可选心率显示；待最近值、单位、测量时间及无资料状态实测，不虚构、不诊断、不按心率发奖。 |
| P07 | B / C | P03 | 已有来源白名单、保守去重、日界线与每日来源固定；待真实手机/手表重叠及来源替换验证，显示步数和可奖励步数须区分。来源标签并非运动真实性证明。 |
| P08 | C / B | P07;P36 | 已有严格最小摘要、修订日志、服务器时间与幂等同步；真实本地Auth/Edge已通过合成摘要；待设备链路及重装/跨设备来源pin恢复。不得上传原始 provider 标识。 |
| P09 | B / C | P04;P08 | 同意/同步控制器自动化通过；待实机离线重启、前后台、撤回/重连及账户切换。撤回即停新读取/上传，离线不发奖；内存待发操作不保证进程重启后存续。本地 pin/修订元数据清理仍未完成。 |
| P10 | B / C | P36 | 已有任务列表、门槛、积分、上限、截止及版本；待真实设备与人工 UX 核对，冻结任务版本不能追溯改动。 |
| P11 | C / B | P08;P10 | 每日 3000/5000/7000 步对应最高 10/20/30 分、升级补差额已通过自动化；待 B/C 复核及真实数据路径验收。 |
| P12 | C / B | P11 | 三个不同达标日、周上限／截止及审批更正时的周奖补偿已通过 SQL/跨层检查；待 B/C 复核与真实数据验收。休息不得罚款。 |
| P13 | C / B | P11 | 不可覆写账本、服务器汇总、原账链接及有符号补偿已实现；posting epoch 防止冲销后合法恢复权益撞旧唯一键；待独立人工账务审查。 |
| P14 | C / B | P13 | 两组 100 并发、业务唯一键及幂等自动化已通过；待人工复核和真实服务集成，客户端不能指定余额或发放额。 |
| P15 | B / C | P13 | 已显示可用积分、真实负余额、退款、更正总额及关联理由／流水；待实机大字体／操作／原账追溯验收。不得暗示现金或未来代币。 |
| P16 | B / C | P15 | 移动端示范奖励／徽章目录已接真实服务器库存，明确不可真实核销；待 native UI／可及性验收，不冒称商户。 |
| P17 | C / B | P16 | 移动端兑换确认、示范码、历史、取消退款及最小持久 intent 已接原子 SQL。合成 Auth 下控制器→API→Edge→SQL 丢响应／重启恢复通过；待真实设备／会话生命周期验收。 |
| P18 | B / C | P07 | 已排除手动/未知来源奖励并有申诉入口；待真实元数据与未知来源待核实处置，解释清楚但不得伪造核验结论。 |
| P19 | C / B | P11;P14 | 日上限、频率、pending 修订及最新版本审批处置已实现；待浏览器操作后台、规则校准及真实来源验证。F05 仍是条件项。 |
| P20 | C / B | P10;P13 | 仅有不可变版本数据基础；任务配置后台尚未实现，需草稿、预览、发布及权限检查，不得追溯修改已完成实例。 |
| P21 | C / B | P19 | 已实现现有 pending 版本提案、第二人 aal2 审批、理由／审计／原账链接、日周补偿、负余额、过期快照／幂等／并发／回滚。待浏览器审查界面、真实 MFA／人工审核操作及 B/C 验收；不接受任意金额或新过期摘要。 |
| P22 | C / B | P20 | 已实现服务器角色＋aal2、禁止自审、审查队列、补偿审计及暂停奖励。待 P20 管理界面、角色管理和真实 MFA 登入流程；测试注入 claims 不是登入验收。 |
| P23 | B / C | P02 | 尚未实现直接赞助卡片；需真实批准的通用素材及非健康版位轮播，不按健康值、达标或推导标签投放。 |
| P24 | C / B | P23 | 尚无赞助事件采集器；需独立聚合存储、无健康关联键及封包测试，排除健康值/标签/钱包，观看/点击不得发奖。 |
| P25 | C / B | P08;P13 | 已实现核心／审查资料导出、近期 OTP 删除门槛、立即停用、SQL purge／retry 及保留期清理。实际本地 Auth 删除/worker 重试通过；模拟器导出打开分享菜单并取消。UI 删除、保留依据／调度及备份 tombstone 重放仍待验证；审计 UUID／digest 不保证匿名。 |
| P26 | C / B | P36 | 已实现范围内 RLS/密钥/环境隔离自动化通过；待实际服务配置与最终客户端密钥检查，新增 admin/Lab 仍需独立边界测试。用户 A 不能读 B，service role 不进入客户端。 |
| P27 | C / B | P13;P26 | 已有事故暂停 SQL 与操作草案；待真实可丢弃环境备份/还原演练，恢复删除标记后才开放流量，暂停新奖须保留历史账。GitHub 源码备份不能替代数据库还原验收。 |
| P28 | B / C | P04;P15 | 已有简体中文/i18n/可及性组件；待实机 VoiceOver、大字体、触控目标与非颜色状态识别，不以 JS bundle 代替检查。 |
| P29 | C / B | P10 | 已有 own-account SQL/API、简体设置、香港安静时段及可选本地 iOS 提醒，默认关闭；显式保存与系统许可后才安排。离线关闭、丢响应、冲突、账户切换与删除已自动化验证，模拟器关闭状态保存通过。待实机许可／投递／时区／前后台及 B/C 验收；无 APNs、健康文案或催促运动。 |
| P30 | C / B | P08;P11 | 尚未实现受保护的第一方最小事件与指标报表；需定义 activation、cohort、成熟 D7/D28 分母，不将健康值发送第三方分析。 |
| P31 | B / C | P14;P17;P24;P25 | 单元、SQL、Edge、合成跨层与 JavaScript bundle 检查已覆盖新增审批／兑换；完整真实 Auth/native、赞助隔离、删除及管理验收仍未齐，不按测试数量签收。 |
| P32 | B / C | P31 | 尚无可验收的签署安装包；宿主与未签署编译已通过；待开发团队/能力配置、实机安装及与实际数据使用一致的隐私材料；不含隐藏 mainnet 模块。发布仍需另行批准。 |
| P33 | B / C | — | 原始 58 项规格已保留；待 B/C 技术复核、A 产品范围批准及每项 P0 验收人确认，P1/P2 不挤占主路径。 |
| P34 | B / C | P33 | 已有首用/健康/任务/积分/设置交互源码，基本空数据流程已在实际原生模拟器操作并录制。待更完整错误场景、实机交互评审和 D 支持的 QA；模拟器录像不是两台 iPhone 验收。 |
| P35 | C / B | P02 | 数据地图、安全及保留文档为草稿；待实际处理者清单/协议、用途、保留与删除依据及合适的法律文案审阅。 |
| P36 | C / B | P33 | 已从 GitHub 全新 clone 恢复本机、重装锁定依赖并重跑检查。完整本地 Supabase 栈已验证；待可核验远端 CI。后续源码同步以 GITHUB_BACKUP 中的远端核验记录为准，环境示例不含密钥。 |

## LAB：独立合成数据实验室（8 项，均未开始）

Lab 属独立范围，不能借用核心健康身份、会话、数据库或真实健康记录。先满足相关核心依赖，再实现隔离的本地合成流程。唯一允许的远端链为 **Base Sepolia，chain ID 84532**；写代码或本地测试并不授权开通远端资源、部署或广播交易。

| ID | Owner / reviewer | 依赖 | 未完成工作与验收 |
|---|---|---|---|
| L01 | B / C | P36 | 建立不同 project/package/database 的 sandbox 与合成任务；不得读取 HealthKit 或导入核心/production 账户，加入导入与身份边界测试。 |
| L02 | B / C | L01 | Reown 连接 MetaMask、Trust Wallet；两钱包各验证连接、断开、拒签并记录版本，不能用模拟按钮替代钱包验收。 |
| L03 | C / B | L02 | SIWE 单次 nonce、域名、URI、chain、期限及会话验证；错域、错链、过期、重放必须拒绝。 |
| L04 | C / B | L01 | 固定供应 TEST-HLT 合约与本地测试；远端仅 Base Sepolia，清楚标示无价值/无兑换权，部署须单独批准。 |
| L05 | C / B | L03;L04 | 合成任务授权一次性领取，绑定接收者、金额及签名、防重放；远端链固定 84532，不能接入核心健康积分。 |
| L06 | B / C | L05 | 钱包交易 pending/成功/失败、gas、hash、错链及重试；须核实 receipt，不能因前端发送成功就显示已领取。 |
| L07 | C / B | L06 | 两款钱包各完成 10 次用例，重复领取 0；测试权限、签名、失败/重试并留证，不收集私钥或助记词。 |
| L08 | C / B | L07;P32 | 核心分发包排除 Lab；白皮书与演示区分非现金积分和 test token，不承诺将来换币。 |

## 条件 P1（8 项，未授权启动）

这些是条件 backlog，并非本次未完成的默认交付承诺。先满足原依赖、商业/平台条件及明确范围批准，再实施；不得因已有技术接口便默认为获准。

| ID | Owner / reviewer | 依赖 | 条件与验收 |
|---|---|---|---|
| F01 | B / C | P07 | Android Health Connect 正式接入；按真实设备、权限、来源和去重规则验收。 |
| F02 | B / C | P17 | 已签商户优惠及核销后台；先有合约、库存/退款规则、码防重用和获准的数据分享范围。 |
| F03 | B / C | P30 | 企业健康计划管理；初期只交付行政参与数据，健康报表另作平台与法律评估。 |
| F04 | B / C | P24 | AdMob 非奖励广告；先审政策与 SDK 封包，不按健康投放、不因观看或点击发奖。 |
| F05 | C / B | P19 | 装置认证及更强风控；验证请求风险，不将 attestation 宣称为真人步行证明。 |
| F06 | B / C | P32 | 订阅/支付；先确认地区及商店规则，不能用 token 绕过 IAP，不自动建立收费服务。 |
| F07 | B / C | P30 | 自愿、化名的社区功能；默认不公开健康信息，具备举报与封锁。 |
| F08 | B / C | P05 | 可选睡眠习惯支持；不按睡得更久发奖、不诊断，重视规律与休息。 |

## 条件 P2（6 项，未授权；mainnet 不在当前 brief 内）

此处仅保存依赖和条件，不授权代币发行、主网切换、交易所接洽、公开销售、做市、支付或链上广播。A 的协调不能替代合资格法律意见；AI 自测不能替代独立审计。

| ID | Owner / reviewer | 依赖 | 条件与验收 |
|---|---|---|---|
| T01 | C / B | 商业验证 | 代币法律分类及司法辖区评估；须有适用地区的专业法律意见与业务边界。 |
| T02 | C / B | T01 | 经济模型、压力测试及白皮书；区分供应/流通/解锁/费用，不承诺价格或收益。 |
| T03 | C / B | T02 | 独立审计、多签与归属期机制；critical/high 清零、权限演练及合约验证，不能以 AI 自审签收。 |
| T04 | C / B | T01;T03 | 主网领取与财务运营；须重新批准且具客服、税务、对账及 gas 预算，当前不实施。 |
| T05 | C / B | T04 | 合规市场/流动性与独立交易所审批；区分报价资产，无刷量或价格保证，当前不实施。 |
| T06 | C / B | T04 | 透明度报告；披露供应、解锁、支出、链上事件与风险暂停机制，不虚构完成情况。 |

## 可执行的接续顺序

1. 继续当前 `/Users/wi/healthloop`，先检查 git 和最新证据，保留本轮新提交；换机器才全新 clone 并核对备份是否足够新。按 [CONTINUE_PROMPT.md](CONTINUE_PROMPT.md) 执行适用检查。数据库测试只能使用新建、明确可丢弃的本地 `healthloop_test_*` 库，不能恢复执行旧测试库的破坏性重置命令。
2. 分开检查宿主与代码：本机Docker/Auth与Xcode编译已通过，重用经过保护的local:start/serve/test:local流程；准备签署后按 [NATIVE_VERIFICATION.md](../apps/mobile/NATIVE_VERIFICATION.md) 做两台 iPhone 验收。宿主阻塞只记录实际错误，不循环启动安装器或声称原生通过。
3. 基于已实现 P21 API 与 P16/P17 移动端，继续 P20/P22 管理／版本发布、P25/P27 删除保留／备份还原演练，再推进元数据清理、赞助隔离、指标及通知／设备可及性验收。优先完成一条可测试流程，不重复重建已完成模块。
4. 核心验收依赖满足后推进独立 Lab 的本地合成实现。所有外部动作分别确认现有授权，P1/P2 继续保留为条件项。

## GitHub 与本机恢复说明

较早源码备份及原始资料已在 [Health-web3](https://github.com/stanleywongsk-svg/Health-web3) 核验，历史清理已完成，详见 [GITHUB_BACKUP](GITHUB_BACKUP.md)。本次按用户新策略继续开发并准备已获批准的资料上传，**保留本机源码、依赖和本轮提交，上传后也不删除**。最新上传是否完成及覆盖哪些文件以该核验记录为准；不能用较旧远端覆盖本机新提交。资料上传与提案不授权生产变更、付费操作、链上广播或修改核心健康与代币的隔离边界。

源码备份不包含私人 `.env`、真实数据、密钥、Pods、node_modules 或数据库。历史日志保存在 `docs/archive/environment-evidence`；它们不是当前 native 运行证明。设备配置与签署条件由操作者安全提供；本机接续不会自动在会话结束后运行。
# Current iOS release amendment — 2026-10-05

The user has since adopted and implemented the health/points/achievement first-release plan in `AGENTS.md`. Read the newest `IMPLEMENTATION_STATUS.md` and `TEST_EVIDENCE.md` before the historical register below. P16 now uses server-derived personal badges; P17 permits only historical demo reconciliation/cancellation/refunds in the shipping app. New demo-voucher spending, NFT/wallet reward boosts and unimplemented ad/payment providers are absent from the release. Future optional closed-loop ad cosmetics require a separate verified integration; the old blanket reward-ad wording below is not the current policy.

The immutable 58-ID requirement register and B/C ownership remain unchanged. This amendment does not complete the remaining physical-device, signing, admin, processor/legal, production-operation or Apple review gates. `APP_STORE_REVIEW_NOTES.md` and `APP_PRIVACY_DISCLOSURES.md` describe the actual first-release handoff. Do not reintroduce the old demo storefront or implement future token conversion while resuming.
