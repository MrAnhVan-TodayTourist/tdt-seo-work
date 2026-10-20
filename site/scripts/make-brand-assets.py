#!/usr/bin/env python3
"""Sinh bộ icon + ảnh chia sẻ mặc định (SEO) cho site.

Nguồn: `content/vi/images/logo.png` (biểu trưng tròn + chữ "todaytourist").
Icon/favicon chỉ lấy phần biểu trưng — ở 16-32px chữ trong logo không đọc được.

Ghi ra `site/public/`:
    favicon.ico, favicon-32/48/96/192/512.png  — favicon (tab trình duyệt + Google)
    apple-touch-icon.png                       — 180x180 cho iOS
    og-default.jpg                             — 1200x630 cho og:image mặc định

`site.webmanifest` viết tay (không sinh ở đây).

Cần: pip install pillow
Chạy: python site/scripts/make-brand-assets.py

Chạy lại khi đổi logo thương hiệu.
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parent
PUBLIC = ROOT / "public"

# Ảnh logo gốc 74x80: vòng tròn ở nửa trên, chữ "todaytourist" bắt đầu từ hàng 65.
LOGO_PATH = REPO / "content" / "vi" / "images" / "logo.png"
EMBLEM_BOX = (3, 0, 68, 65)
ICON_MASTER = 512

# Palette — phải khớp token trong site/src/styles/global.css
SAND = (250, 246, 238)
SEA_DEEP = (17, 94, 89)
ACCENT = (249, 115, 22)
INK = (31, 42, 55)
INK_SOFT = (92, 102, 114)

FONT_BOLD_CANDIDATES = (
    r"C:\Windows\Fonts\segoeuib.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
)
FONT_REGULAR_CANDIDATES = (
    r"C:\Windows\Fonts\segoeui.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
)


def load_font(candidates, size):
    for path in candidates:
        try:
            return ImageFont.truetype(path, size)
        except Exception:
            continue
    return ImageFont.load_default()


def load_emblem():
    """Biểu trưng tròn, phóng to + làm nét nhẹ (nguồn gốc chỉ ~65px)."""
    emblem = Image.open(LOGO_PATH).convert("RGBA").crop(EMBLEM_BOX)
    icon = emblem.resize((ICON_MASTER, ICON_MASTER), Image.LANCZOS)
    rgb = icon.convert("RGB").filter(
        ImageFilter.UnsharpMask(radius=2, percent=80, threshold=2)
    )
    return Image.merge("RGBA", (*rgb.split(), icon.split()[3]))


def make_icon(size, background=None, padding=0.0):
    """Icon vuông từ biểu trưng; `background` để lấp nền (iOS không nhận alpha)."""
    inner = max(1, int(size * (1 - 2 * padding)))
    icon = load_emblem().resize((inner, inner), Image.LANCZOS)
    canvas = Image.new("RGBA", (size, size), background or (0, 0, 0, 0))
    off = (size - inner) // 2
    canvas.alpha_composite(icon, (off, off))
    return canvas


def save_icon(img, path, **kwargs):
    """Lưu PNG 256 màu — giữ gradient nhưng nhẹ hơn nhiều so với RGBA."""
    img.quantize(colors=256, method=Image.FASTOCTREE).save(path, "PNG", optimize=True, **kwargs)


def make_og_image():
    """Ảnh chia sẻ mặc định 1200x630 (Facebook/Zalo/Twitter card)."""
    width, height = 1200, 630
    bar = 108  # chiều cao dải thông tin dưới
    img = Image.new("RGB", (width, height), SAND)
    draw = ImageDraw.Draw(img)

    # Khối thương hiệu: biểu trưng logo thay cho chữ "T" cũ
    emblem = load_emblem().resize((96, 96), Image.LANCZOS)
    img.paste(emblem, (72, 86), emblem)

    draw.text((196, 96), "TODAYTOURIST", font=load_font(FONT_BOLD_CANDIDATES, 60), fill=INK)
    draw.text(
        (196, 166),
        "Cùng bạn đi khắp năm châu",
        font=load_font(FONT_REGULAR_CANDIDATES, 30),
        fill=SEA_DEEP,
    )

    draw.line((72, 248, width - 72, 248), fill=ACCENT, width=6)

    for i, line in enumerate(
        (
            "Tour trong nước & quốc tế  ·  Vé máy bay",
            "Cho thuê xe  ·  Teambuilding & sự kiện",
        )
    ):
        draw.text(
            (72, 296 + i * 52),
            line,
            font=load_font(FONT_REGULAR_CANDIDATES, 38),
            fill=INK_SOFT,
        )

    # Dải dưới: website + hotline
    draw.rectangle((0, height - bar, width, height), fill=SEA_DEEP)
    draw.text(
        (72, height - bar + 34),
        "todaytourist.com",
        font=load_font(FONT_BOLD_CANDIDATES, 36),
        fill=SAND,
    )
    hotline = "Hotline 0913.78.76.47"
    fnt = load_font(FONT_REGULAR_CANDIDATES, 36)
    w = draw.textbbox((0, 0), hotline, font=fnt)[2]
    draw.text((width - 72 - w, height - bar + 34), hotline, font=fnt, fill=(255, 237, 213))

    return img


def main():
    PUBLIC.mkdir(parents=True, exist_ok=True)

    for size in (32, 48, 96, 192, 512):
        name = f"favicon-{size}.png"
        save_icon(make_icon(size), PUBLIC / name)
        print(f"[brand] {name} ({size}x{size})")

    # iOS không nhận nền trong suốt -> lấp nền trắng, logo thụt vào 7%.
    save_icon(
        make_icon(180, background=(255, 255, 255, 255), padding=0.07),
        PUBLIC / "apple-touch-icon.png",
    )
    print("[brand] apple-touch-icon.png (180x180)")

    ico = PUBLIC / "favicon.ico"
    load_emblem().save(ico, format="ICO", sizes=[(16, 16), (32, 32), (48, 48)])
    print("[brand] favicon.ico (16/32/48)")

    og = PUBLIC / "og-default.jpg"
    make_og_image().save(og, "JPEG", quality=88, optimize=True, progressive=True)
    print(f"[brand] {og.name} (1200x630, {og.stat().st_size // 1024} KB)")


if __name__ == "__main__":
    main()
