"""Build the two public Chinese proposal documents from their Markdown sources.

Requires Python 3.11+ and python-docx 1.2.0. Rendering/visual QA is a separate gate.
Usage: python scripts/build-proposals.py
"""
from pathlib import Path
import re
from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.opc.constants import RELATIONSHIP_TYPE as RT

ROOT = Path(__file__).resolve().parents[1]
FONT = "Arial Unicode MS"


def font_style(style, size, bold=False):
    style.font.name = FONT
    style.font.size = Pt(size)
    style.font.bold = bold
    style.font.color.rgb = RGBColor(0, 0, 0)
    props = style.element.get_or_add_rPr()
    fonts = props.find(qn("w:rFonts"))
    if fonts is None:
        fonts = OxmlElement("w:rFonts")
        props.append(fonts)
    for key in list(fonts.attrib):
        if key.lower().endswith("theme"):
            del fonts.attrib[key]
    for key in ("ascii", "hAnsi", "eastAsia", "cs"):
        fonts.set(qn("w:" + key), FONT)
    lang = OxmlElement("w:lang")
    lang.set(qn("w:val"), "zh-CN")
    lang.set(qn("w:eastAsia"), "zh-CN")
    props.append(lang)
    for border in style.element.xpath(".//w:pBdr"):
        border.getparent().remove(border)
    # Keep numbers and Latin words intact in Chinese paragraphs (OOXML wordWrap).
    wrap = OxmlElement("w:wordWrap")
    wrap.set(qn("w:val"), "off")
    style.element.get_or_add_pPr().append(wrap)


def inline(p, text):
    for part in re.split(r"(\*\*.*?\*\*|\[[^\]]+\]\([^)]+\))", text):
        if part.startswith("**") and part.endswith("**"):
            p.add_run(part[2:-2]).bold = True
        elif (m := re.fullmatch(r"\[([^\]]+)\]\(([^)]+)\)", part)):
            h = OxmlElement("w:hyperlink")
            h.set(qn("r:id"), p.part.relate_to(m[2], RT.HYPERLINK, is_external=True))
            r = OxmlElement("w:r")
            rp = OxmlElement("w:rPr")
            color = OxmlElement("w:color")
            color.set(qn("w:val"), "075D75")
            rp.append(color)
            r.append(rp)
            t = OxmlElement("w:t")
            t.text = m[1]
            r.append(t)
            h.append(r)
            p._p.append(h)
        else:
            p.add_run(part.replace("`", ""))


def table(doc, rows):
    n = len(rows[0])
    widths = {2: [1.40, 5.50], 3: [1.30, 2.65, 2.95],
              4: [1.55, 1.25, 1.40, 2.70], 5: [1.25, 1.00, 1.05, 1.65, 1.95]}[n]
    t = doc.add_table(rows=0, cols=n)
    t.alignment = WD_TABLE_ALIGNMENT.CENTER
    t.autofit = False
    for col, width in zip(t.columns, widths):
        col.width = Inches(width)
    props = t._tbl.tblPr
    borders = OxmlElement("w:tblBorders")
    for edge in ("top", "left", "bottom", "right", "insideH", "insideV"):
        e = OxmlElement("w:" + edge)
        for key, value in {"val": "single", "sz": "5", "color": "D9D9D9"}.items():
            e.set(qn("w:" + key), value)
        borders.append(e)
    props.append(borders)
    margins = OxmlElement("w:tblCellMar")
    for edge, value in (("top", "100"), ("bottom", "100"), ("left", "115"), ("right", "115")):
        e = OxmlElement("w:" + edge)
        e.set(qn("w:w"), value)
        e.set(qn("w:type"), "dxa")
        margins.append(e)
    props.append(margins)
    for i, values in enumerate(rows):
        row = t.add_row()
        trp = row._tr.get_or_add_trPr()
        trp.append(OxmlElement("w:cantSplit"))
        if i == 0:
            trp.append(OxmlElement("w:tblHeader"))
        for j, (cell, value) in enumerate(zip(row.cells, values)):
            cell.width = Inches(widths[j])
            cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
            shade = OxmlElement("w:shd")
            shade.set(qn("w:fill"), "193B4C" if i == 0 else ("F0F4F7" if i % 2 else "FFFFFF"))
            cell._tc.get_or_add_tcPr().append(shade)
            p = cell.paragraphs[0]
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.line_spacing = 1.12
            if i == 0 or (j > 0 and len(value) < 15):
                p.alignment = WD_ALIGN_PARAGRAPH.CENTER
            inline(p, value)
            for run in p.runs:
                run.font.size = Pt(10)
                run.font.bold = i == 0
                run.font.color.rgb = RGBColor.from_string("FFFFFF" if i == 0 else "000000")
    doc.add_paragraph().paragraph_format.space_after = Pt(2)


def build(source):
    d = Document()
    s = d.sections[0]
    s.page_width, s.page_height = Inches(8.5), Inches(11)
    s.top_margin, s.bottom_margin = Inches(.65), Inches(.65)
    s.left_margin, s.right_margin = Inches(.80), Inches(.80)
    s.header_distance, s.footer_distance = Inches(.25), Inches(.25)
    for name, size, bold in (("Normal", 11, False), ("Title", 24, True),
                             ("Subtitle", 11, False), ("Heading 1", 16, True),
                             ("Heading 2", 12, True), ("List Bullet", 11, False)):
        font_style(d.styles[name], size, bold)
    normal = d.styles["Normal"].paragraph_format
    normal.line_spacing, normal.space_after = 1.25, Pt(8)
    if "应用说明" in source.name:
        normal.space_after = Pt(5)
    for name in ("Heading 1", "Heading 2"):
        d.styles[name].paragraph_format.keep_with_next = True
        d.styles[name].paragraph_format.space_before = Pt(12)
        d.styles[name].paragraph_format.space_after = Pt(7)
    d.styles["Title"].paragraph_format.space_after = Pt(16)
    footer = s.footer.paragraphs[0]
    footer.alignment = WD_ALIGN_PARAGRAPH.RIGHT
    r = footer.add_run("HealthLoop  |  ")
    r.font.size = Pt(8)
    fld = OxmlElement("w:fldSimple")
    fld.set(qn("w:instr"), "PAGE")
    footer._p.append(fld)
    lines = source.read_text().splitlines()
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        if not line:
            i += 1
            continue
        if line == "<!-- pagebreak -->":
            d.add_page_break()
        elif line.startswith("|"):
            rows = []
            while i < len(lines) and lines[i].strip().startswith("|"):
                row = [c.strip() for c in lines[i].strip().strip("|").split("|")]
                if not all(re.fullmatch(r":?-+:?", c) for c in row):
                    rows.append(row)
                i += 1
            table(d, rows)
            continue
        elif line.startswith("# "):
            inline(d.add_paragraph(style="Title"), line[2:])
        elif line.startswith("## "):
            inline(d.add_paragraph(style="Heading 1"), line[3:])
        elif line.startswith("### "):
            inline(d.add_paragraph(style="Heading 2"), line[4:])
        elif line.startswith("- "):
            p = d.add_paragraph(style="List Bullet")
            inline(p, line[2:])
        else:
            inline(d.add_paragraph(), line)
        i += 1
    d.core_properties.author = "HealthLoop 项目团队"
    d.core_properties.last_modified_by = "HealthLoop 项目团队"
    d.core_properties.title = next(l[2:] for l in lines if l.startswith("# "))
    d.core_properties.subject = "2026-09-28 简体中文方案"
    d.core_properties.comments = ""
    output = source.with_suffix(".docx")
    d.save(output)
    print(output.relative_to(ROOT))


if __name__ == "__main__":
    sources = sorted((ROOT / "docs/proposals").glob("HealthLoop_*.md"))
    if len(sources) != 2:
        raise SystemExit("Expected exactly two proposal Markdown sources")
    for source in sources:
        build(source)
