import plotly.express as px
import plotly.graph_objects as go
import pandas as pd
from datetime import datetime

data = [
    ("OKRs + CFRs", "Treinamento OKR", "2026-07-07", "2026-07-08", "#2C3E50"),
    ("OKRs + CFRs", "1o OKR definido", "2026-07-14", "2026-07-15", "#2C3E50"),
    ("OKRs + CFRs", "Revisao mensal", "2026-08-06", "2026-08-07", "#2C3E50"),
    ("OKRs + CFRs", "Revisao mensal", "2026-09-05", "2026-09-06", "#2C3E50"),
    ("OKRs + CFRs", "Fechamento OKRs", "2026-10-05", "2026-10-06", "#2C3E50"),
    ("Automacao de RDO", "Desenvolvimento RDO digital", "2026-07-07", "2026-08-06", "#2980B9"),
    ("Radar Operacional", "Desenvolvimento Painel web", "2026-08-06", "2026-09-05", "#27AE60"),
    ("Linha de Base", "Planner + 1a obra", "2026-09-05", "2026-10-05", "#8E44AD"),
    ("Consultoria", "Ritos, Treinamentos, Modelos, RECS", "2026-07-07", "2026-10-05", "#95A5A6"),
]

df = pd.DataFrame(data, columns=["Section", "Task", "Start", "End", "Color"])
df["Start"] = pd.to_datetime(df["Start"])
df["End"] = pd.to_datetime(df["End"])

colors = {
    "OKRs + CFRs": "#2C3E50",
    "Automacao de RDO": "#2980B9",
    "Radar Operacional": "#27AE60",
    "Linha de Base": "#8E44AD",
    "Consultoria": "#95A5A6",
}

fig = px.timeline(
    df, x_start="Start", x_end="End", y="Section",
    color="Section", color_discrete_map=colors, text="Task",
    title="Cronograma de Entregas - 3 Meses",
)

fig.update_traces(
    marker=dict(line=dict(width=0.5, color="rgba(255,255,255,0.3)")),
    textposition="inside",
    textfont=dict(size=12, color="white"),
    insidetextanchor="start",
)

fig.update_layout(
    title=dict(font=dict(size=18, color="#1a1a1a"), x=0.01),
    xaxis=dict(
        title=None, dtick="M1", tickformat="%b",
        tickfont=dict(size=11, color="#666"),
        showgrid=True, gridcolor="#eee", zeroline=False,
    ),
    yaxis=dict(
        title=None,
        tickfont=dict(size=13, color="#333"),
        categoryorder="array",
        categoryarray=["Consultoria", "Linha de Base", "Radar Operacional", "Automacao de RDO", "OKRs + CFRs"],
    ),
    showlegend=False,
    plot_bgcolor="#fafafa",
    paper_bgcolor="white",
    margin=dict(l=20, r=20, t=55, b=60),
    height=450,
    width=1200,
    bargap=0.3,
)

# Month separators
for m in ["2026-08-01", "2026-09-01"]:
    fig.add_vline(x=pd.Timestamp(m), line_width=0.5, line_color="#ddd", line_dash="dash")

# Payment markers
payments = [
    ("Entrega 1 - R$10.000", "2026-08-06"),
    ("Entrega 2 - R$10.000", "2026-09-05"),
    ("Entrega 3 - R$10.000", "2026-10-05"),
]
for label, date in payments:
    fig.add_annotation(
        x=pd.Timestamp(date), y=-0.45,
        text=label,
        showarrow=True, arrowhead=2, arrowcolor="#E74C3C", arrowsize=1.5, arrowwidth=2,
        font=dict(size=9, color="#E74C3C"),
        bgcolor="#FFF5F5", borderpad=4,
        ax=0, ay=-25,
    )

# Consultoria payment note
fig.add_annotation(
    x=pd.Timestamp("2026-08-20"), y=-0.82,
    text="Consultoria: R$15.000 (4 parcelas nos dias 15, 45, 75 e 90)",
    showarrow=False,
    font=dict(size=9, color="#888"),
)

fig.write_html("DH/cronograma_plotly.html", include_plotlyjs="cdn")
print("HTML saved. Screenshotting via Edge...")

import subprocess, os
html_path = "file:///C:/Users/igore/Coding%20Playground/Book-To-Skill/DH/cronograma_plotly.html"
png_path = "C:/Users/igore/Coding Playground/Book-To-Skill/DH/cronograma.png"
subprocess.run([
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "--headless",
    f"--screenshot={png_path}",
    "--window-size=1400,580",
    html_path,
], check=True)
print("OK: DH/cronograma.png")
