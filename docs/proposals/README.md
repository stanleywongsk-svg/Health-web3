# 简体中文提案

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
