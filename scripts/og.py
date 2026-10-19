# 공유 미리보기 이미지(1200x630 PNG) 만들기 — public/og/<팀 id>.png, league.png
# 팀 컬러·짧은 이름이 바뀌면 다시 실행: python3 scripts/og.py (macOS 시스템 글꼴 Apple SD Gothic Neo 사용)
# 구단 로고는 쓰지 않는다(CLAUDE.md). 팀 컬러 바탕 + 이름 글자 + 빠따닷컴 로고. 앱 아이콘·탭 아이콘도 여기서 만든다.
import os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
f = lambda size, idx=16: ImageFont.truetype(FONT, size, index=idx)  # 16=Heavy, 6=Bold, 2=Medium
W, H = 1200, 630
out = os.path.join(ROOT, 'public', 'og')
os.makedirs(out, exist_ok=True)


LOGO = Image.open(os.path.join(ROOT, 'public', 'brand', 'bbadda-logo.webp')).convert('RGBA')
LOGO = LOGO.crop(LOGO.getbbox())  # 원본 267x96 — 크게 쓰면 흐려서 2배 이내로만 키운다


def logo(width):
    return LOGO.resize((width, round(LOGO.height * width / LOGO.width)), Image.LANCZOS)


def card(path, bg, big, line1, line2):
    """팀 카드: 팀 컬러 바탕, 왼쪽 위 흰 배지에 빠따닷컴 로고, 팀 이름 글자"""
    im = Image.new('RGBA', (W, H), bg)
    d = ImageDraw.Draw(im)
    lg = logo(340)
    d.rounded_rectangle((64, 52, 64 + lg.width + 48, 52 + lg.height + 36), radius=28, fill='white')
    im.alpha_composite(lg, (88, 70))
    d.text((80, 230), big, font=f(200 if len(big) <= 3 else 150), fill='white')
    d.text((84, 455), line1, font=f(56, 6), fill='white')
    d.text((84, 530), line2, font=f(36, 2), fill=(255, 255, 255, 220))
    im.convert('RGB').save(path, optimize=True)


def league(path):
    """대표 카드: 흰 바탕 가운데 로고 + 한 줄 소개"""
    im = Image.new('RGBA', (W, H), 'white')
    d = ImageDraw.Draw(im)
    lg = logo(520)
    im.alpha_composite(lg, ((W - lg.width) // 2, 120))
    d.text((W / 2, 440), 'KBO 10개 구단 소식을 한 곳에', font=f(54, 6), fill='#1D1D1F', anchor='mm')
    d.text((W / 2, 515), '하루 두세 번, 잠깐만 들러도 충분해요', font=f(36, 2), fill='#5B5B60', anchor='mm')
    im.convert('RGB').save(path, optimize=True)


# teams.yaml 에서 id·name·short·color 만 읽는다(외부 모듈 없이)
src = open(os.path.join(ROOT, 'config', 'teams.yaml'), encoding='utf8').read()
teams = [dict(re.findall(r'^\s+(name|short|color): "?(#[0-9A-Fa-f]{6}|[^"#\n]+?)"?\s*(?:#.*)?$', b, re.M), id=b.split('\n')[0].strip())
         for b in src.split('  - id: ')[1:]]
for t in teams:
    card(os.path.join(out, f"{t['id']}.png"), t['color'], t['short'], t['name'], '오늘의 소식 · 하루 두세 번 업데이트')
league(os.path.join(out, 'league.png'))
print('저장:', out)

# 홈 화면 아이콘(앱 아이콘) — public/icons/. 흰 배경에 로고(저장소 주인 결정, 2026-10-19)
icons = os.path.join(ROOT, 'public', 'icons')
os.makedirs(icons, exist_ok=True)
def icon(size, name, frac):
    im = Image.new('RGBA', (size, size), 'white')
    lg = logo(int(size * frac))
    im.alpha_composite(lg, ((size - lg.width) // 2, (size - lg.height) // 2 + int(size * 0.01)))
    im.convert('RGB').save(os.path.join(icons, name), optimize=True)
icon(180, 'apple-touch-icon.png', 0.86)  # iOS 가 모서리를 직접 둥글게 깎는다
icon(192, 'icon-192.png', 0.86)
icon(512, 'icon-512.png', 0.86)
icon(512, 'maskable-512.png', 0.70)  # 안드로이드 원형 마스크 안전 영역
print('저장:', icons)

# 브라우저 탭 아이콘 — 로고 앞의 'B' 만(전체 로고는 16~32px 에서 안 보인다)
b = LOGO.crop((0, 0, 70, LOGO.height)); b = b.crop(b.getbbox())
side = max(b.size) + 8
fav = Image.new('RGBA', (side, side), 'white'); fav.alpha_composite(b, ((side - b.width) // 2, (side - b.height) // 2))
fav.resize((48, 48), Image.LANCZOS).convert('RGB').save(os.path.join(ROOT, 'public', 'favicon.png'), optimize=True)
print('저장: public/favicon.png')
