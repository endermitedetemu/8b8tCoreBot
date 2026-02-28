import json
import os
from collections import defaultdict
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
)

DATA_FILE = os.path.join(os.path.dirname(__file__), "joindate_data.json")
PDF_PLAYERS = os.path.join(os.path.dirname(__file__), "8b8t_players.pdf")
PDF_METRICS = os.path.join(os.path.dirname(__file__), "8b8t_metrics.pdf")
PDF_GRAPHS  = os.path.join(os.path.dirname(__file__), "8b8t_graphs.pdf")


def load_data():
    if not os.path.exists(DATA_FILE):
        return {"players": {}, "peak_online": 0, "whitelist": [], "blacklist": []}
    with open(DATA_FILE, "r") as f:
        data = json.load(f)
    if "blacklist" not in data: data["blacklist"] = []
    return data


def title_style():
    return ParagraphStyle("title", fontSize=20, fontName="Helvetica-Bold",
                          alignment=TA_CENTER, spaceAfter=6,
                          textColor=colors.HexColor("#1a1a2e"))

def sub_style():
    return ParagraphStyle("sub", fontSize=10, fontName="Helvetica",
                          alignment=TA_CENTER, spaceAfter=12, textColor=colors.grey)

def h2_style():
    return ParagraphStyle("h2", fontSize=13, fontName="Helvetica-Bold",
                          spaceAfter=8, spaceBefore=16,
                          textColor=colors.HexColor("#16213e"))

def legend_style():
    return ParagraphStyle("leg", fontSize=9, fontName="Helvetica",
                          alignment=TA_CENTER, spaceAfter=16,
                          textColor=colors.HexColor("#555555"))

def bar_chart(data_dict, max_bar=38, color_hex="#3498db"):
    if not data_dict:
        return None
    max_val = max(data_dict.values()) or 1
    rows = [["Label", "Count", "Bar"]]
    for label, val in sorted(data_dict.items()):
        bar_len = int(val / max_val * max_bar)
        rows.append([str(label), str(val), "█" * bar_len])
    t = Table(rows, colWidths=[1.3*inch, 0.7*inch, 4.5*inch])
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0,0), (-1,0), colors.HexColor("#16213e")),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,-1), 8),
        ("ALIGN",         (0,0), (1,-1), "CENTER"),
        ("ALIGN",         (2,0), (2,-1), "LEFT"),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, colors.HexColor("#f0f4ff")]),
        ("GRID",          (0,0), (-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("TEXTCOLOR",     (2,1), (2,-1), colors.HexColor(color_hex)),
    ]))
    return t


# ─── PDF 1: Players ─────────────────────────────────────────────────────────
def generate_players_pdf(data):
    doc = SimpleDocTemplate(PDF_PLAYERS, pagesize=letter,
                            rightMargin=0.4*inch, leftMargin=0.4*inch,
                            topMargin=0.6*inch, bottomMargin=0.6*inch)
    story = []
    players   = data.get("players", {})
    blacklist = [b.lower() for b in data.get("blacklist", [])]
    now = datetime.now()

    story.append(Paragraph("8b8t.me — Player Join Date Registry", title_style()))
    story.append(Paragraph(
        f"Generated: {now.strftime('%Y-%m-%d %H:%M')}  |  Total: {len(players)}",
        sub_style()))

    if not players:
        story.append(Paragraph("No player data yet.", getSampleStyleSheet()["Normal"]))
        doc.build(story)
        return

    sorted_players = sorted(
        players.items(),
        key=lambda x: (0 if x[0].lower() in blacklist else 1,
                       x[1] if x[1] else "0000"),
    )

    recent   = [u for u, d in sorted_players
                if d and (now - datetime.strptime(d, "%Y-%m-%d")).days <= 365]
    bl_count = len([u for u in players if u.lower() in blacklist])
    java_c   = len([u for u in players if not u.startswith(".")])
    bedrock_c= len([u for u in players if u.startswith(".")])

    story.append(Paragraph(
        f"Blacklisted: {bl_count}  |  Recent (&lt;1yr): {len(recent)}  |  "
        f"Java: {java_c}  |  Bedrock: {bedrock_c}",
        legend_style()))

    # Tabla: #, Username, Platform, Join Date, Days Ago, Status
    table_data = [["#", "Username", "Plat", "Join Date", "Days Ago", "Status"]]
    row_styles = []

    for i, (username, join_date) in enumerate(sorted_players, 1):
        days_ago = "?"
        is_bl    = username.lower() in blacklist
        is_recent= False
        platform = "Bedrock" if username.startswith(".") else "Java"

        if join_date:
            try:
                jd = datetime.strptime(join_date, "%Y-%m-%d")
                days_ago  = str((now - jd).days)
                is_recent = int(days_ago) <= 365
            except: pass

        if is_bl:
            status = "BLACKLIST"
            row_styles += [
                ("BACKGROUND", (0,i), (-1,i), colors.HexColor("#ffd6d6")),
                ("TEXTCOLOR",  (0,i), (-1,i), colors.HexColor("#cc0000")),
                ("FONTNAME",   (0,i), (-1,i), "Helvetica-Bold"),
            ]
        elif not join_date:
            status = "PENDING"
        elif is_recent:
            status = "RECENT"
            row_styles += [("TEXTCOLOR", (5,i), (5,i), colors.HexColor("#e74c3c"))]
        else:
            status = ""

        table_data.append([str(i), username, platform, join_date or "?", days_ago, status])

    col_w = [0.35*inch, 1.9*inch, 0.75*inch, 1.15*inch, 0.75*inch, 0.9*inch]
    t = Table(table_data, colWidths=col_w, repeatRows=1)
    base = [
        ("BACKGROUND",    (0,0), (-1,0), colors.HexColor("#1a1a2e")),
        ("TEXTCOLOR",     (0,0), (-1,0), colors.white),
        ("FONTNAME",      (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0), (-1,0), 8),
        ("ALIGN",         (0,0), (-1,-1), "CENTER"),
        ("FONTNAME",      (0,1), (-1,-1), "Helvetica"),
        ("FONTSIZE",      (0,1), (-1,-1), 7),
        ("ROWBACKGROUNDS",(0,1), (-1,-1), [colors.white, colors.HexColor("#f0f4ff")]),
        ("GRID",          (0,0), (-1,-1), 0.4, colors.HexColor("#cccccc")),
        ("TOPPADDING",    (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]
    t.setStyle(TableStyle(base + row_styles))
    story.append(t)
    doc.build(story)


# ─── PDF 2: Metrics ─────────────────────────────────────────────────────────
def generate_metrics_pdf(data):
    doc = SimpleDocTemplate(PDF_METRICS, pagesize=letter,
                            rightMargin=0.5*inch, leftMargin=0.5*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    story = []
    players   = data.get("players", {})
    blacklist = [b.lower() for b in data.get("blacklist", [])]
    peak      = data.get("peak_online", 0)
    now       = datetime.now()

    story.append(Paragraph("8b8t.me — Server Metrics Report", title_style()))
    story.append(Paragraph(f"Generated: {now.strftime('%Y-%m-%d %H:%M')}", sub_style()))

    total        = len(players)
    known_dates  = [(u,d) for u,d in players.items() if d]
    recent_count = sum(1 for u,d in known_dates
                       if (now - datetime.strptime(d,"%Y-%m-%d")).days <= 365)
    bl_count     = len([u for u in players if u.lower() in blacklist])
    java_c       = len([u for u in players if not u.startswith(".")])
    bedrock_c    = len([u for u in players if u.startswith(".")])

    story.append(Paragraph("General Summary", h2_style()))
    summary = [
        ["Metric", "Value"],
        ["Total players tracked",        str(total)],
        ["Java players",                 str(java_c)],
        ["Bedrock players",              str(bedrock_c)],
        ["Players with known join date", str(len(known_dates))],
        ["Peak concurrent online",       str(peak)],
        ["Players joined in last year",  str(recent_count)],
        ["Blacklisted players",          str(bl_count)],
        ["Report generated",             now.strftime("%Y-%m-%d %H:%M")],
    ]
    ts = Table(summary, colWidths=[3*inch, 2.5*inch])
    ts.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0), colors.HexColor("#16213e")),
        ("TEXTCOLOR",     (0,0),(-1,0), colors.white),
        ("FONTNAME",      (0,0),(-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,-1), 9),
        ("ALIGN",         (0,0),(-1,-1), "LEFT"),
        ("LEFTPADDING",   (0,0),(-1,-1), 8),
        ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f0f4ff")]),
        ("GRID",          (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING",    (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
        ("TEXTCOLOR",     (1,7),(1,7),  colors.HexColor("#cc0000")),
        ("FONTNAME",      (1,7),(1,7),  "Helvetica-Bold"),
    ]))
    story.append(ts)

    if not known_dates:
        story.append(Paragraph("No join date data yet.", getSampleStyleSheet()["Normal"]))
        doc.build(story)
        return

    story.append(Paragraph("Joins per Month (last 24)", h2_style()))
    monthly = defaultdict(int)
    for u, d in known_dates:
        try: monthly[datetime.strptime(d,"%Y-%m-%d").strftime("%Y-%m")] += 1
        except: pass
    t2 = bar_chart(dict(list(sorted(monthly.items()))[-24:]))
    if t2: story.append(t2)

    story.append(Paragraph("Joins per Year", h2_style()))
    yearly = defaultdict(int)
    for u, d in known_dates:
        try: yearly[datetime.strptime(d,"%Y-%m-%d").year] += 1
        except: pass
    t3 = bar_chart(dict(sorted(yearly.items())), color_hex="#27ae60")
    if t3: story.append(t3)

    doc.build(story)


# ─── PDF 3: Graphs ──────────────────────────────────────────────────────────
def generate_graphs_pdf(data):
    doc = SimpleDocTemplate(PDF_GRAPHS, pagesize=letter,
                            rightMargin=0.5*inch, leftMargin=0.5*inch,
                            topMargin=0.75*inch, bottomMargin=0.75*inch)
    story = []
    players = data.get("players", {})
    now     = datetime.now()

    story.append(Paragraph("8b8t.me — Player Analytics & Graphs", title_style()))
    story.append(Paragraph(f"Generated: {now.strftime('%Y-%m-%d %H:%M')}", sub_style()))

    java_players    = {u:d for u,d in players.items() if not u.startswith(".")}
    bedrock_players = {u:d for u,d in players.items() if u.startswith(".")}

    # Java vs Bedrock
    story.append(Paragraph("Java vs Bedrock Distribution", h2_style()))
    total = len(players) or 1
    dist_data = [["Platform", "Players", "% of Total", "Bar"]]
    for label, count in [("Java", len(java_players)), ("Bedrock", len(bedrock_players))]:
        pct = round(count / total * 100, 1)
        bar = "█" * int(pct / 2)
        dist_data.append([label, str(count), f"{pct}%", bar])

    td = Table(dist_data, colWidths=[1.2*inch, 0.8*inch, 0.8*inch, 3.7*inch])
    td.setStyle(TableStyle([
        ("BACKGROUND",    (0,0),(-1,0), colors.HexColor("#16213e")),
        ("TEXTCOLOR",     (0,0),(-1,0), colors.white),
        ("FONTNAME",      (0,0),(-1,0), "Helvetica-Bold"),
        ("FONTSIZE",      (0,0),(-1,-1), 9),
        ("ALIGN",         (0,0),(-1,-1), "CENTER"),
        ("ALIGN",         (3,0),(3,-1),  "LEFT"),
        ("BACKGROUND",    (0,1),(-1,1), colors.HexColor("#dce8ff")),
        ("BACKGROUND",    (0,2),(-1,2), colors.HexColor("#ffe8dc")),
        ("TEXTCOLOR",     (3,1),(3,1),  colors.HexColor("#2980b9")),
        ("TEXTCOLOR",     (3,2),(3,2),  colors.HexColor("#e67e22")),
        ("FONTNAME",      (0,1),(-1,-1),"Helvetica-Bold"),
        ("GRID",          (0,0),(-1,-1), 0.5, colors.HexColor("#cccccc")),
        ("TOPPADDING",    (0,0),(-1,-1), 5),
        ("BOTTOMPADDING", (0,0),(-1,-1), 5),
    ]))
    story.append(td)
    story.append(Spacer(1, 0.2*inch))

    # Java joins por mes
    story.append(Paragraph("Java Players — Joins per Month (last 24)", h2_style()))
    java_monthly = defaultdict(int)
    for u, d in java_players.items():
        if d:
            try: java_monthly[datetime.strptime(d,"%Y-%m-%d").strftime("%Y-%m")] += 1
            except: pass
    t_jm = bar_chart(dict(list(sorted(java_monthly.items()))[-24:]), color_hex="#2980b9")
    if t_jm: story.append(t_jm)
    story.append(Spacer(1, 0.15*inch))

    # Bedrock joins por mes
    story.append(Paragraph("Bedrock Players — Joins per Month (last 24)", h2_style()))
    bedrock_monthly = defaultdict(int)
    for u, d in bedrock_players.items():
        if d:
            try: bedrock_monthly[datetime.strptime(d,"%Y-%m-%d").strftime("%Y-%m")] += 1
            except: pass
    t_bm = bar_chart(dict(list(sorted(bedrock_monthly.items()))[-24:]), color_hex="#e67e22")
    if t_bm: story.append(t_bm)

    doc.build(story)


if __name__ == "__main__":
    data = load_data()
    generate_players_pdf(data)
    generate_metrics_pdf(data)
    generate_graphs_pdf(data)
    print("PDFs generados correctamente")