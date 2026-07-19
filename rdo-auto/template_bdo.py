"""
Generate a sample BDO-style PDF template using ReportLab.
Uses lorem ipsum placeholder data for layout approval.
"""
import os
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white, grey
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    Image, PageBreak, KeepTogether
)
from reportlab.platypus.flowables import HRFlowable

# ── Config ──────────────────────────────────────────────────
OUTPUT = "template_bdo_lorem.pdf"
LOGO = "logo_DH.png"  # DH logo in same folder
W, H = A4  # 210 x 297 mm

PRIMARY = HexColor("#000000")        # black (logo text)
ACCENT = HexColor("#a04000")         # copper/brown (logo mark)
WARM_BG = HexColor("#f5f0eb")        # warm beige (logo background)
WARM_LIGHT = HexColor("#faf7f4")      # lighter warm beige
WARM_BORDER = HexColor("#c0a0a0")     # muted beige border
LIGHT_GREY = WARM_BG  # reuse warm bg
BORDER_GREY = WARM_BORDER
RED_ACCENT = HexColor("#b91c1c")

# ── Styles ──────────────────────────────────────────────────
styles = getSampleStyleSheet()

title_style = ParagraphStyle("BDO_Title", parent=styles["Heading1"],
    fontSize=13, leading=16, textColor=ACCENT, spaceAfter=2*mm,
    alignment=TA_CENTER, fontName="Helvetica-Bold")

section_style = ParagraphStyle("Section", parent=styles["Heading2"],
    fontSize=9, leading=11, textColor=ACCENT, spaceBefore=4*mm,
    spaceAfter=1.5*mm, fontName="Helvetica-Bold",
    borderPadding=(0, 0, 1*mm, 0))

body_style = ParagraphStyle("Body", parent=styles["Normal"],
    fontSize=8, leading=10, textColor=black, fontName="Helvetica")

small_style = ParagraphStyle("Small", parent=styles["Normal"],
    fontSize=7, leading=9, textColor=HexColor("#6b7280"), fontName="Helvetica")

label_style = ParagraphStyle("Label", parent=styles["Normal"],
    fontSize=7, leading=9, textColor=HexColor("#374151"),
    fontName="Helvetica-Bold")

# ── Helpers ──────────────────────────────────────────────────
def hrule():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER_GREY, spaceBefore=1*mm, spaceAfter=1*mm)

def info_row(label, value, col_widths=(80, None)):
    """Two-column row: bold label | value."""
    return Table(
        [[Paragraph(label, label_style), Paragraph(value, body_style)]],
        colWidths=col_widths, hAlign="LEFT"
    )

def make_table(headers, rows, col_widths=None):
    """Create a styled data table."""
    all_rows = [[Paragraph(h, label_style) for h in headers]] + [
        [Paragraph(str(c), body_style) for c in row] for row in rows
    ]
    t = Table(all_rows, colWidths=col_widths, hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), LIGHT_GREY),
        ("LINEBELOW", (0, 0), (-1, -1), 0.3, BORDER_GREY),
        ("TOPPADDING", (0, 0), (-1, -1), 2),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t

def section_box(title, content_elements):
    """Wrap content in a bordered section with title."""
    inner = [Paragraph(title, section_style), hrule()]
    inner.extend(content_elements if isinstance(content_elements, list) else [content_elements])
    return KeepTogether(inner)

# ── Build PDF ────────────────────────────────────────────────
def build():
    doc = SimpleDocTemplate(
        OUTPUT, pagesize=A4,
        leftMargin=15*mm, rightMargin=15*mm,
        topMargin=-2*mm, bottomMargin=22*mm
    )
    story = []

    # ── Header (drawn via on_page callback for every page) ───

    # ── Project Info Box ─────────────────────────────────────
    info_data = [
        [info_row("Cliente:", "Artesano — Ribeirão Preto - SP"), info_row("Data:", "21/03/2026")],
        [info_row("Sonda:", "A10"), info_row("Nº do BDO:", "BDO-021")],
        [info_row("Turno:", "07h x 17h"), info_row("Tipo:", "Perfuração")],
    ]
    info_table = Table(info_data, colWidths=[85*mm, 85*mm])
    info_table.setStyle(TableStyle([
        ("BOX", (0, 0), (-1, -1), 0.8, ACCENT),
        ("INNERGRID", (0, 0), (-1, -1), 0.3, BORDER_GREY),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("BACKGROUND", (0, 0), (-1, -1), HexColor("#faf7f4")),
    ]))
    story.append(info_table)
    story.append(Spacer(1, 3*mm))
    story.append(hrule())

    # ── Perfuração ───────────────────────────────────────────
    perf_content = [
        info_row("Profundidade:", "0,00 → 45,50 m (perfurado: 45,50 m)"),
        info_row("Formação:", "Serra Geral (topo: 0,00 m — base: 45,50 m)"),
        Spacer(1, 1.5*mm),
        Paragraph("<b>Dados de Broca (Atual)</b>", label_style),
        make_table(
            ["Fabricante", "Série", "Ø (pol)", "Modelo IADC", "Jatos", "Perfurado", "Oper. (h)", "ROP médio"],
            [["Baker", "BKR-8821", "8,5", "517", "16-16-16", "45,5 m", "8,0 h", "5,7 m/h"]],
        ),
        Spacer(1, 2*mm),
        Paragraph("<b>Composição da Coluna (BHA)</b>", label_style),
        make_table(
            ["Item", "Qtd", "ID (pol)", "OD (pol)", "Compr. (m)", "Total (m)"],
            [
                ["DP 3 1/2", "4", "3,50", "5,00", "9,15", "36,60"],
                ["DC 6 1/4", "2", "6,25", "8,00", "9,15", "18,30"],
                ["Estabilizador 8 1/2", "1", "6,25", "8,50", "1,83", "1,83"],
            ],
        ),
    ]
    story.append(section_box("1. Perfuração", perf_content))

    # ── Operações ────────────────────────────────────────────
    ops_content = [
        make_table(
            ["Início", "Término", "Descritivo"],
            [
                ["07:00", "09:30", "Perfuração fase 8 1/2 de 0 a 25 m. Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."],
                ["09:30", "10:00", "Parada para manutenção: troca de jato da broca. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat."],
                ["10:00", "17:00", "Perfuração fase 8 1/2 de 25 a 45,5 m. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur."],
            ],
            col_widths=[45, 45, 75*mm],
        ),
    ]
    story.append(section_box("2. Operações Realizadas", ops_content))

    # ── Equipe ───────────────────────────────────────────────
    equipe_content = [
        make_table(
            ["Função", "Nome"],
            [
                ["Sondador", "Cassio Silva"],
                ["Torrista", "Laron Oliveira"],
                ["Plataformista / Aux. 1", "Pedro Santos"],
                ["Plataformista / Aux. 2", "—"],
                ["TST", "Murilo Pedro"],
                ["Geólogo", "Murilo Pedro"],
                ["Coordenador", "Fernando Costa"],
            ],
            col_widths=[70*mm, 100*mm],
        ),
    ]
    story.append(section_box("3. Equipe", equipe_content))

    # ── HSE ──────────────────────────────────────────────────
    hse_content = [
        info_row("DDS realizado:", "Sim"),
        info_row("EPIs vistoriados:", "Sim"),
        info_row("Horas-homem expostas:", "72,0 h"),
        info_row("Incidentes:", "Nenhum. Lorem ipsum dolor sit amet, consectetur adipiscing elit."),
        info_row("Quase-acidentes:", "Nulla facilisi. Mauris euismod lacus vel nisi tincidunt, eget aliquet nunc faucibus."),
    ]
    story.append(section_box("4. HSE / Segurança", hse_content))

    # ── Fluido ───────────────────────────────────────────────
    fluido_content = [
        make_table(
            ["Parâmetro", "Valor", "Unidade"],
            [
                ["Densidade", "9,2", "lb/gal"],
                ["Viscosidade Marsh", "45", "s/qt"],
                ["Filtrado API", "12,0", "mL"],
                ["pH", "9,5", "—"],
                ["Areia", "1,5", "%"],
                ["Sólidos", "8,0", "%"],
            ],
            col_widths=[60*mm, 40*mm, 40*mm],
        ),
        Spacer(1, 2*mm),
        Paragraph("<b>Consumo de Químicos</b>", label_style),
        make_table(
            ["Produto", "Consumo (kg)", "Estoque (kg)"],
            [
                ["Bentonita", "150", "850"],
                ["CMC", "25", "475"],
                ["Soda Cáustica", "10", "190"],
                ["Barrilha", "5", "145"],
            ],
            col_widths=[60*mm, 40*mm, 40*mm],
        ),
    ]
    story.append(section_box("5. Fluido e Químicos", fluido_content))

    # ── Clima ────────────────────────────────────────────────
    clima_content = [
        info_row("Condição:", "Bom"),
        info_row("Choveu no dia?:", "Não"),
    ]
    story.append(section_box("6. Condições Climáticas", clima_content))

    # ── Observações ──────────────────────────────────────────
    obs_content = [
        Paragraph(
            "TESTE DE MUDANÇAS Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt "
            "ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco "
            "laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in "
            "voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat "
            "non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.",
            body_style
        ),
        Spacer(1, 3*mm),
        Paragraph("<b>Planejamento — Próximo Turno:</b>", label_style),
        Paragraph(
            "Continuar perfuração fase 8 1/2 até 120 m. Prever revestimento de 6 5/8. "
            "Curabitur pretium tincidunt lacus. Nulla gravida orci a odio. Nullam varius, "
            "turpis et commodo pharetra, est eros bibendum elit, nec luctus magna felis sollicitudin mauris.",
            body_style
        ),
    ]
    story.append(section_box("7. Observações e Planejamento", obs_content))

    # ── Aprovação ────────────────────────────────────────────
    apr_content = [
        make_table(
            ["Responsável", "Nome", "Assinatura"],
            [
                ["Geólogo", "Murilo Pedro", ""],
                ["Ger. Operações", "Fernando Costa", ""],
                ["Preposto 1", "Carlos Garcia", ""],
                ["Preposto 2", "Vivian Perissin", ""],
            ],
            col_widths=[50*mm, 60*mm, 60*mm],
        ),
    ]
    story.append(section_box("8. Aprovação", apr_content))

    # ── Header bar (25mm, logo right-aligned, Platypus) ──────
    if os.path.exists(LOGO):
        logo_img = Image(LOGO, width=42*mm, height=21*mm)
        # Single-cell table: full width, 25mm tall, logo right-aligned, vertically centered
        header_cell = Table([[logo_img]], colWidths=[W])
        header_cell.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (0, 0), (-1, -1), "RIGHT"),
            ("TOPPADDING", (0, 0), (-1, -1), 2*mm),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2*mm),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10*mm),
            ("BACKGROUND", (0, 0), (-1, -1), HexColor("#ffffff")),
            
        ]))
        story.insert(0, header_cell)

    # ── Title ────────────────────────────────────────────────
    story.insert(1, Paragraph("BOLETIM DIÁRIO DE OBRAS", title_style))
    #story.insert(1 if os.path.exists(LOGO) else 1, hrule())

    # ── Footer callback (all pages) ──────────────────────────
    def draw_footer(canvas, doc):
        canvas.saveState()
        footer_y = 15*mm
        canvas.setStrokeColor(WARM_BORDER)
        canvas.setLineWidth(0.5)
        canvas.line(doc.leftMargin, footer_y + 8*mm, W - doc.rightMargin, footer_y + 8*mm)
        canvas.setFont("Helvetica", 6)
        canvas.setFillColor(HexColor("#9ca3af"))
        canvas.drawString(doc.leftMargin, footer_y, "RDO Auto — DH Perfuração")
        canvas.drawCentredString(W / 2, footer_y, "Documento gerado em 21/03/2026")
        canvas.drawRightString(W - doc.rightMargin, footer_y, f"Página {canvas.getPageNumber()}")
        canvas.restoreState()

    doc.build(story, onFirstPage=draw_footer, onLaterPages=draw_footer)
    print(f"PDF gerado: {OUTPUT} ({os.path.getsize(OUTPUT)} bytes)")

if __name__ == "__main__":
    build()
