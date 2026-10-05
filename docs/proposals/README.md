# HealthLoop 商业提案与演示材料

## 繁體中文策略合作提案

2026-10-05 按使用者要求修訂為兩份獨立文件：

- [4 頁 Word 商業提案](HealthLoop_Business_Proposal_TC.docx)及[Markdown 原稿](HealthLoop_Business_Proposal_TC.md)：保留 App 定位、產品體驗、X-to-Earn 產品方向、商業價值及收入模式；已完整刪除指定的定價、單位貢獻、市場進入、付費試點、擴大投入、初始資源、發展路線及內部來源索引內容。
- [5 頁 Web3 與代幣經濟 Word](HealthLoop_Web3_Tokenomics_TC.docx)及[Markdown 原稿](HealthLoop_Web3_Tokenomics_TC.md)：獨立說明 Web3 Lab、錢包驗證、候選供應與分配、歸屬、預算、效用、銷毀及治理。代幣參數屬研究假設，核心積分及測試幣均不承諾兌換未來代幣。

兩份文件依現行首發範圍表達平台徽章及原生產品邊界，保留現有工程與擬議能力的區別。被刪除的商業定價、試點及資源預算沒有搬入新文件。沒有修改應用程式、58 項需求或既有 PowerPoint。

使用 Codex workspace dependency loader 返回的 bundled Python 執行 `scripts/build-business-proposal-tc.py`，預設從 Markdown 重建以上兩份 DOCX；可用 `--document main` 或 `--document web3` 只重建其中一份。字體為 Arial Unicode MS；渲染器須能讀取包含此字體的系統字體目錄。最終共 9 頁已逐頁檢視，XML、連結、全文渲染及代幣算式檢查通過。內部 PDF、PNG 與驗證記錄位於忽略的 `.local/proposal-split/`。

此修訂取代上一版 8 頁繁體中文提案；下一項可執行文件工作是按後續指示修訂指定原稿並重建對應 Word。沒有安排自動後續、發送或外部發布。

## 英文研究提案 PowerPoint

2026-10-05 按提供的 COMM7115 模板完成了 [19 页英文 PowerPoint](HealthLoop_Business_Proposal_Research_Report.pptx)，保留原 17 页结构并新增单位经济、验收依赖两页备查内容。每页附讲者备注和证据出处；[Markdown 源稿](HealthLoop_Business_Proposal_Research_Report.md) 保留全部正文和备注。

材料引用既有商业提案、2026-09-24 至 09-28 及另一应用会话新增的 2026-10-05 技术记录，以及 2026-10-05 核对的官方资料。本提案会话没有重跑应用测试。旧版模拟器录像不能作为当前改版界面的验收。用户访谈、人物画像、留存门槛、价格和经营情景明确区分为待验证假设；没有新增真实用户研究、收入或实机验收记录，也不推进任何技术需求的验收状态。

原始模板逐字节保存在 [templates/Business_Proposal_Research_Report_Template.pptx](templates/Business_Proposal_Research_Report_Template.pptx)。使用本目录已固定版本的 Python 依赖，在仓库根目录运行：

```sh
python scripts/build-research-proposal.py
```

生成器保留模板的配色、比例、分区和计时；字体使用 macOS 的 `Charter` 家族名称，对应模板的 `Bitstream Charter`。需在目标演示电脑上保留该字体或重新检查替代字体的排版。作者内容在生成器内，生成后仍可直接编辑 PowerPoint；再次运行生成器会覆盖同名 PPTX 和 Markdown。

本次用 bundled LibreOffice 渲染并逐页检查 19 页；字体替代、少量文字换行及分隔线交叠在最终检查前已修正。内部 PDF/PNG 和检查文件位于忽略的 `.local/business-proposal/`，不作为交付文件。商业提案的下一项证据工作是落实经批准的用户及买方研究；产品仍须完成两部 iPhone 的原生验收和现有 release gates。

## 简体中文 Word 提案

本目录保留 Word 交付文件及对应的 Markdown 源稿。内容基准日期为 2026-09-28，商业参数与代币参数均为供讨论的假设，不是已实现功能、客户承诺、收益保证或发行批准。

- [应用说明与商业提案](HealthLoop_应用说明与商业提案_简体中文.docx)
- [Train to Earn 代币经济与路线图](HealthLoop_Train_to_Earn代币经济与路线图_简体中文.docx)

现行实现范围仍以根目录 AGENTS.md、MEGA_PROMPT.md 和 requirements 为准。核心积分不可转让、无现金价值，不承诺换币；独立 Lab 只使用合成数据与 Base Sepolia 84532。提案中的真实 Train-to-Earn 属于需要另行决策的未来产品。

## 重新生成 Word

使用独立 Python 环境安装本目录 requirements.txt，再于仓库根目录运行：

```sh
python scripts/build-proposals.py
```

此脚本只读取本目录两个 `HealthLoop_*.md` 文件并生成同名 DOCX，不属于 App 的运行依赖。Word 使用 Arial Unicode MS；在其他电脑排版时应确认可用中文字体。生成后需使用 Word 或兼容的渲染器逐页检查标题、中文字符、表格分页及超链接。渲染中间文件不作为产品源码或公开交付物。

商业与技术提案不代替 B/C 交叉验收、平台审查、法律意见或独立安全审计。当前完成度与实际测试范围见 [IMPLEMENTATION_STATUS](../IMPLEMENTATION_STATUS.md) 和 [TEST_EVIDENCE](../TEST_EVIDENCE.md)。
