"""
One-shot script: generate a Canva-ready PDF brand kit reference.
Run: python scripts/generate-brand-kit-pdf.py
Output: docs/boss-daddy-brand-kit.pdf
"""

import os
from reportlab.lib.pagesizes import LETTER
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT  = os.path.join(ROOT, "docs", "boss-daddy-brand-kit.pdf")
LOGO = os.path.join(ROOT, "public", "images", "bd-logo-final.png")

PAGE_W, PAGE_H = LETTER

# Colors
BD_ORANGE      = HexColor("#CC5500")
BD_ORANGE_LT   = HexColor("#D96200")
BD_ORANGE_GLOW = HexColor("#E87030")
BD_BLACK       = HexColor("#0B0B0D")
BD_SURFACE     = HexColor("#141418")
BD_RAISED      = HexColor("#1C1C22")
BD_BORDER      = HexColor("#28282E")
BD_TEXT        = HexColor("#F5F5F5")
BD_MUTED       = HexColor("#A8A8B0")
BD_FAINT       = HexColor("#6A6A72")
BD_PAPER       = HexColor("#EDE6D3")

PRIMARY_PALETTE = [
    ("Boss Orange",  "#CC5500", "Primary brand — CTAs, marquee"),
    ("Orange Hover", "#D96200", "Hover, secondary accent"),
    ("Orange Glow",  "#E87030", "Light accent on dark"),
    ("Orange Deep",  "#A34400", "Borders, pressed state"),
    ("Orange Earth", "#7D3300", "Deep accent"),
    ("Orange Shadow","#5C2600", "Background tints"),
    ("Orange Pit",   "#3D1A00", "Deepest tint"),
]

FORGE_PALETTE = [
    ("Forge Black",   "#0B0B0D", "Page background"),
    ("Forge Surface", "#141418", "Card surfaces"),
    ("Forge Raised",  "#1C1C22", "Raised cards"),
    ("Forge Border",  "#28282E", "Hairlines, dividers"),
]

TEXT_PALETTE = [
    ("Text Bright", "#F5F5F5", "Primary text on dark"),
    ("Text Muted",  "#A8A8B0", "Secondary text"),
    ("Text Faint",  "#6A6A72", "Captions, tertiary"),
]

CREAM_PALETTE = [
    ("Cream Paper", "#EDE6D3", "Editorial moments"),
    ("Cream Muted", "#C9BFA8", "Cream secondary"),
]

FONTS = [
    ("Montserrat",      "Display / Headings", "800, 900 (Black)",      "BOSS DADDY",          "All caps, tight tracking"),
    ("Geist",           "Body / UI",          "400, 500, 600, 700",    "Real dads, real reviews.", "Body copy, buttons, labels"),
    ("Source Serif 4",  "Editorial Serif",    "400, 600",              "Built for the long read.", "Pull quotes, second voice"),
]

TAGLINES = [
    ("Primary",   "Dad like a BOSS",                "Hero, masthead, merch, marketing"),
    ("Secondary", "Real dads, Real reviews, Smart tech", "Review/tech pillar"),
    ("Merch",     "Boss Stuff for Boss Dads",       "Shop, /stuff hub"),
]

WORDMARK_RULES = [
    ("BOSS DADDY",  "All caps", "Logos, hero, taglines, OG cards, merch"),
    ("Boss Daddy",  "Title case", "Editorial body, dashboards, in-narrative"),
    ("BOSS",        "Caps, alone", "Direct address — “Stay locked in, BOSS.”"),
]

# ─── Page setup ─────────────────────────────────────────────────────────────

c = pdfcanvas.Canvas(OUT, pagesize=LETTER)


def fill_bg(color=BD_BLACK):
    c.setFillColor(color)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)


def draw_eyebrow(text, x, y, color=BD_ORANGE_LT):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x, y, text.upper())


def draw_h1(text, x, y, size=36, color=BD_TEXT):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x, y, text)


def draw_h2(text, x, y, size=20, color=BD_TEXT):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold", size)
    c.drawString(x, y, text)


def draw_body(text, x, y, size=10, color=BD_MUTED, font="Helvetica"):
    c.setFillColor(color)
    c.setFont(font, size)
    c.drawString(x, y, text)


def draw_swatch(name, hex_code, note, x, y, w=2.4 * inch, h=1.1 * inch):
    c.setFillColor(HexColor(hex_code))
    c.rect(x, y, w, h, fill=1, stroke=0)
    # Hex label sits in bottom-right of swatch
    is_dark = int(hex_code[1:3], 16) + int(hex_code[3:5], 16) + int(hex_code[5:7], 16) < 380
    text_color = white if is_dark else black
    c.setFillColor(text_color)
    c.setFont("Helvetica-Bold", 11)
    c.drawString(x + 8, y + h - 18, name)
    c.setFont("Helvetica", 9)
    c.drawString(x + 8, y + h - 32, hex_code.upper())
    c.setFont("Helvetica", 7.5)
    c.drawString(x + 8, y + 8, note)


# ─── PAGE 1: Cover ──────────────────────────────────────────────────────────

fill_bg(BD_BLACK)

# Logo
if os.path.exists(LOGO):
    try:
        logo = ImageReader(LOGO)
        lw = 3.2 * inch
        lh = lw  # assume roughly square
        c.drawImage(logo, (PAGE_W - lw) / 2, PAGE_H - 4.2 * inch,
                    width=lw, height=lh, mask='auto', preserveAspectRatio=True)
    except Exception:
        pass

# Wordmark
draw_h1("BOSS DADDY", (PAGE_W - 270) / 2, PAGE_H - 5.0 * inch, size=42)

# Tagline
c.setFillColor(BD_ORANGE_LT)
c.setFont("Helvetica-Bold", 14)
text = "DAD LIKE A BOSS"
tw = c.stringWidth(text, "Helvetica-Bold", 14)
c.drawString((PAGE_W - tw) / 2, PAGE_H - 5.5 * inch, text)

# Divider
c.setStrokeColor(BD_BORDER)
c.setLineWidth(1)
c.line(PAGE_W / 2 - 40, PAGE_H - 5.9 * inch, PAGE_W / 2 + 40, PAGE_H - 5.9 * inch)

# Subtitle
c.setFillColor(BD_MUTED)
c.setFont("Helvetica", 12)
text = "Brand Kit Reference  ·  v1.0  ·  May 2026"
tw = c.stringWidth(text, "Helvetica", 12)
c.drawString((PAGE_W - tw) / 2, PAGE_H - 6.3 * inch, text)

# Footer
c.setFillColor(BD_FAINT)
c.setFont("Helvetica", 8)
text = "bossdaddylife.com"
tw = c.stringWidth(text, "Helvetica", 8)
c.drawString((PAGE_W - tw) / 2, 0.7 * inch, text)

c.showPage()


# ─── PAGE 2: Color Palette ──────────────────────────────────────────────────

fill_bg(BD_BLACK)

draw_eyebrow("01 / Color System", 0.75 * inch, PAGE_H - 0.7 * inch)
draw_h1("Color Palette", 0.75 * inch, PAGE_H - 1.05 * inch, size=28)
draw_body("Forge Base — earthy orange on warm-black. Never use vivid #F97316.",
          0.75 * inch, PAGE_H - 1.35 * inch, size=10, color=BD_MUTED)


def render_palette(title, palette, y_top):
    draw_h2(title, 0.75 * inch, y_top, size=14, color=BD_ORANGE_LT)
    cols = 3
    sw = 2.3 * inch
    sh = 1.0 * inch
    gap = 0.15 * inch
    x0 = 0.75 * inch
    for i, (name, hex_code, note) in enumerate(palette):
        col = i % cols
        row = i // cols
        x = x0 + col * (sw + gap)
        y = y_top - 0.35 * inch - (row + 1) * (sh + gap)
        draw_swatch(name, hex_code, note, x, y, sw, sh)
    rows = (len(palette) + cols - 1) // cols
    return y_top - 0.35 * inch - rows * (sh + gap) - 0.15 * inch


y = PAGE_H - 1.7 * inch
y = render_palette("Primary Brand — Earthy Orange", PRIMARY_PALETTE, y)
y = render_palette("Forge Base — Warm Black UI", FORGE_PALETTE, y - 0.1 * inch)
y = render_palette("Text", TEXT_PALETTE, y - 0.1 * inch)
y = render_palette("Editorial Cream", CREAM_PALETTE, y - 0.1 * inch)

# Footer
c.setFillColor(BD_FAINT)
c.setFont("Helvetica", 7)
c.drawString(0.75 * inch, 0.5 * inch, "Source: app/globals.css  ·  docs/brand-guide.md")
c.drawRightString(PAGE_W - 0.75 * inch, 0.5 * inch, "Page 2 / 4")

c.showPage()


# ─── PAGE 3: Typography ─────────────────────────────────────────────────────

fill_bg(BD_BLACK)

draw_eyebrow("02 / Typography", 0.75 * inch, PAGE_H - 0.7 * inch)
draw_h1("Type System", 0.75 * inch, PAGE_H - 1.05 * inch, size=28)
draw_body("All three fonts are free on Google Fonts and available in Canva by default.",
          0.75 * inch, PAGE_H - 1.35 * inch, size=10, color=BD_MUTED)

y = PAGE_H - 2.0 * inch
for font_name, role, weights, sample, usage in FONTS:
    # Card background
    c.setFillColor(BD_SURFACE)
    c.roundRect(0.75 * inch, y - 1.7 * inch, PAGE_W - 1.5 * inch, 1.6 * inch, 8, fill=1, stroke=0)

    # Eyebrow + role
    c.setFillColor(BD_ORANGE_LT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(1.0 * inch, y - 0.3 * inch, role.upper())

    # Font name
    draw_h2(font_name, 1.0 * inch, y - 0.6 * inch, size=22, color=BD_TEXT)

    # Weights
    draw_body(f"Weights: {weights}", 1.0 * inch, y - 0.85 * inch, size=9, color=BD_MUTED)

    # Sample
    c.setFillColor(BD_PAPER)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1.0 * inch, y - 1.2 * inch, sample)

    # Usage
    draw_body(usage, 1.0 * inch, y - 1.5 * inch, size=8, color=BD_FAINT)

    y -= 1.85 * inch

# Footer
c.setFillColor(BD_FAINT)
c.setFont("Helvetica", 7)
c.drawString(0.75 * inch, 0.5 * inch, "In Canva: Brand Kit → Brand Fonts → + Add a font → search by name")
c.drawRightString(PAGE_W - 0.75 * inch, 0.5 * inch, "Page 3 / 4")

c.showPage()


# ─── PAGE 4: Voice & Wordmark ───────────────────────────────────────────────

fill_bg(BD_BLACK)

draw_eyebrow("03 / Voice", 0.75 * inch, PAGE_H - 0.7 * inch)
draw_h1("Wordmark & Taglines", 0.75 * inch, PAGE_H - 1.05 * inch, size=28)

# Taglines
draw_h2("Approved Taglines", 0.75 * inch, PAGE_H - 1.7 * inch, size=14, color=BD_ORANGE_LT)
y = PAGE_H - 2.1 * inch
for tier, text, usage in TAGLINES:
    c.setFillColor(BD_FAINT)
    c.setFont("Helvetica-Bold", 8)
    c.drawString(0.75 * inch, y, tier.upper())
    c.setFillColor(BD_TEXT)
    c.setFont("Helvetica-Bold", 16)
    c.drawString(1.4 * inch, y, text)
    c.setFillColor(BD_MUTED)
    c.setFont("Helvetica-Oblique", 9)
    c.drawString(1.4 * inch, y - 0.18 * inch, usage)
    y -= 0.55 * inch

# Wordmark casing
draw_h2("Wordmark Casing Rules", 0.75 * inch, y - 0.2 * inch, size=14, color=BD_ORANGE_LT)
y = y - 0.55 * inch
for form, rule, when in WORDMARK_RULES:
    c.setFillColor(BD_PAPER)
    c.setFont("Helvetica-Bold", 13)
    c.drawString(0.75 * inch, y, form)
    c.setFillColor(BD_ORANGE_GLOW)
    c.setFont("Helvetica", 9)
    c.drawString(2.6 * inch, y, rule)
    c.setFillColor(BD_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(3.6 * inch, y, when)
    y -= 0.35 * inch

# Voice archetype
draw_h2("Voice Archetype", 0.75 * inch, y - 0.3 * inch, size=14, color=BD_ORANGE_LT)
y = y - 0.65 * inch
draw_body("Wise Warrior / Protector King — older, wiser brother voice.",
          0.75 * inch, y, size=11, color=BD_TEXT)
y -= 0.25 * inch
draw_body("70% confident & direct  ·  20% playfully cynical toward mediocrity  ·  10% warm and present",
          0.75 * inch, y, size=9, color=BD_MUTED)
y -= 0.4 * inch
draw_body("Edge OFF for safety, struggle, loss, vulnerability.  Faith is foundation, never lecture.",
          0.75 * inch, y, size=9, color=BD_MUTED)

# Never list
draw_h2("Never use", 0.75 * inch, y - 0.5 * inch, size=14, color=BD_ORANGE_LT)
y = y - 0.85 * inch
nevers = [
    "Vivid Tailwind orange #F97316 — always use #CC5500",
    "Per-category rainbow colors — one unified treatment",
    "\"Synergy\", \"leverage\", \"level up\", \"game-changer\", generic hype",
    "Sponsored content positioned as honest reviews",
    "Punch down on struggling dads — edge is for mediocrity, not men in trenches",
]
for item in nevers:
    c.setFillColor(BD_ORANGE)
    c.setFont("Helvetica-Bold", 9)
    c.drawString(0.75 * inch, y, "✕")
    c.setFillColor(BD_MUTED)
    c.setFont("Helvetica", 9)
    c.drawString(0.95 * inch, y, item)
    y -= 0.22 * inch

# Footer
c.setFillColor(BD_FAINT)
c.setFont("Helvetica", 7)
c.drawString(0.75 * inch, 0.5 * inch, "bossdaddylife.com  ·  Brand Kit v1.0")
c.drawRightString(PAGE_W - 0.75 * inch, 0.5 * inch, "Page 4 / 4")

c.showPage()
c.save()

print(f"Wrote {OUT}")
