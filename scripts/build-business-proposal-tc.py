"""Build the Traditional Chinese business proposal and Web3 concept companion.

Use the Codex bundled Python runtime with python-docx. Rendering and visual QA
are separate steps; this script never overwrites the earlier proposal artifacts.
"""
from pathlib import Path
import argparse
import re

from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(__file__).resolve().parents[1]
DOCUMENTS = {
    "main": ("HealthLoop_Business_Proposal_TC.md", "商業合作提案", "Business Proposal"),
    "web3": ("HealthLoop_Web3_Tokenomics_TC.md", "Web3 與代幣經濟", "Web3 and Tokenomics"),
}
FONT = "Arial Unicode MS"


def xml(tag, **attrs):
    node = OxmlElement("w:" + tag)
    for key, value in attrs.items():
        node.set(qn("w:" + key), str(value))
    return node


def style_font(style, size, bold=False):
    style.font.name = FONT
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor(0, 0, 0)
    props = style.element.get_or_add_rPr()
    fonts = props.find(qn("w:rFonts"))
    if fonts is None:
        fonts = xml("rFonts")
        props.append(fonts)
    fonts.attrib.clear()
    for key in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(qn("w:" + key), FONT)
    props.append(xml("lang", val="zh-TW", eastAsia="zh-TW"))
    for border in style.element.xpath(".//w:pBdr"):
        border.getparent().remove(border)
    style.element.get_or_add_pPr().append(xml("wordWrap", val="off"))
    style.element.get_or_add_pPr().append(xml("snapToGrid", val="0"))


def inline(paragraph, value):
    for part in re.split(r"(\*\*.*?\*\*|\[[^\]]+\]\([^)]+\))", value):
        if part.startswith("**") and part.endswith("**"):
            paragraph.add_run(part[2:-2]).bold = True
        elif (match := re.fullmatch(r"\[([^\]]+)\]\(([^)]+)\)", part)):
            link = OxmlElement("w:hyperlink")
            link.set(qn("r:id"), paragraph.part.relate_to(match[2], RT.HYPERLINK, is_external=True))
            run = xml("r")
            props = xml("rPr")
            props.append(xml("color", val="11616B"))
            run.append(props)
            text = xml("t")
            text.text = match[1]
            run.append(text)
            link.append(run)
            paragraph._p.append(link)
        else:
            paragraph.add_run(part)


def add_table(doc, rows):
    count = len(rows[0])
    assert count == 3, "This proposal uses three-column comparison tables"
    if rows[0][0] in ("項目", "研究用途"):
        widths = [2.50, 2.00, 2.00]
    elif rows[0][0] == "分配用途":
        widths = [3.00, 1.00, 2.50]
    elif rows[0][0] == "同權合格參與人數":
        widths = [2.40, 2.05, 2.05]
    else:
        widths = [1.50, 2.20, 2.80]
    table = doc.add_table(rows=0, cols=count)
    table.alignment = WD_TABLE_ALIGNMENT.CENTER
    table.autofit = False
    for column, width in zip(table.columns, widths):
        column.width = Inches(width)
    props = table._tbl.tblPr
    borders = xml("tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        borders.append(xml(edge, val="single", sz="5", color="D9D9D9"))
    props.append(borders)
    margins = xml("tblCellMar")
    for edge in ("top", "bottom", "left", "right"):
        margins.append(xml(edge, w="95", type="dxa"))
    props.append(margins)
    for i, values in enumerate(rows):
        row = table.add_row()
        trp = row._tr.get_or_add_trPr()
        trp.append(xml("cantSplit"))
        if i == 0:
            trp.append(xml("tblHeader"))
        for j, (cell, value) in enumerate(zip(row.cells, values)):
            cell.width = Inches(widths[j])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            cell._tc.get_or_add_tcPr().append(xml("shd", fill="173B49" if i == 0 else ("F1F5F7" if i % 2 else "FFFFFF")))
            p = cell.paragraphs[0]
            p.paragraph_format.space_before = Pt(0)
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = Pt(14.5)
            p._p.get_or_add_pPr().append(xml("snapToGrid", val="0"))
            if i == 0 or (j > 0 and re.fullmatch(r"[\d,% .]+", value)):
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            inline(p, value)
            for run in p.runs:
                run.font.size = Pt(10.5)
                if i == 0:
                    run.font.bold = True
                    run.font.color.rgb = RGBColor(255, 255, 255)
    spacer = doc.add_paragraph()
    spacer.paragraph_format.space_after = Pt(0)
    spacer.paragraph_format.line_spacing = 1
    spacer.add_run().font.size = Pt(3)


def build(key):
    filename, label, subtitle = DOCUMENTS[key]
    source = ROOT / "docs/proposals" / filename
    lines = source.read_text().splitlines()
    title = next(line[2:] for line in lines if line.startswith("# "))
    doc = Document()
    section = doc.sections[0]
    section.page_width = Inches(8.27)
    section.page_height = Inches(11.69)
    section.top_margin = Inches(.72)
    section.bottom_margin = Inches(.70)
    section.left_margin = section.right_margin = Inches(.885)
    section.header_distance = section.footer_distance = Inches(.30)
    for name, size, bold in (("Normal", 11, False), ("Title", 25, True),
                              ("Subtitle", 12, False), ("Heading 1", 18, True),
                              ("Heading 2", 12.5, True), ("Header", 8, False),
                              ("Footer", 8, False), ("List Bullet", 11, False)):
        style_font(doc.styles[name], size, bold)
    normal = doc.styles["Normal"].paragraph_format
    normal.line_spacing = Pt(16)
    normal.space_after = Pt(7)
    normal.widow_control = True
    for name in ("Heading 1", "Heading 2"):
        fmt = doc.styles[name].paragraph_format
        fmt.space_before = Pt(11 if name == "Heading 2" else 0)
        fmt.space_after = Pt(7)
        fmt.line_spacing = Pt(23 if name == "Heading 1" else 18)
        fmt.keep_with_next = True
    title_fmt = doc.styles["Title"].paragraph_format
    title_fmt.space_after = Pt(8)
    title_fmt.line_spacing = Pt(31)
    title_fmt.keep_with_next = True
    header = section.header.paragraphs[0]
    header.text = "HEALTHLOOP　" + label
    footer = section.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    footer.add_run("2026 年 10 月　　")
    field = xml("fldSimple", instr="PAGE")
    footer._p.append(field)
    doc.core_properties.title = title
    doc.core_properties.subject = label
    doc.core_properties.author = "HealthLoop"
    doc.core_properties.keywords = "HealthLoop, " + subtitle
    doc.core_properties.comments = ""
    doc.styles["Subtitle"].font.italic = False
    i = 0
    page_break_pending = False
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line == "<!-- pagebreak -->":
            page_break_pending = True
        elif line.startswith("| "):
            rows = []
            while i < len(lines) and lines[i].lstrip().startswith("|"):
                values = [part.strip() for part in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", value) for value in values):
                    rows.append(values)
                i += 1
            add_table(doc, rows)
            continue
        elif line.startswith("# "):
            doc.add_paragraph(line[2:], "Title")
        elif line.startswith("## "):
            heading = doc.add_paragraph(line[3:], "Heading 1")
            if page_break_pending:
                heading.paragraph_format.page_break_before = True
                page_break_pending = False
        elif line.startswith("### "):
            doc.add_paragraph(line[4:], "Heading 2")
        elif line.startswith("- "):
            p = doc.add_paragraph(style="List Bullet")
            inline(p, line[2:])
            p.paragraph_format.space_after = Pt(6)
        elif line == subtitle:
            doc.add_paragraph(line, "Subtitle")
        else:
            inline(doc.add_paragraph(), line)
        i += 1
    target = source.with_suffix(".docx")
    doc.save(target)
    print(target)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--document", choices=("main", "web3", "all"), default="all")
    selected = parser.parse_args().document
    for key in DOCUMENTS if selected == "all" else (selected,):
        build(key)
