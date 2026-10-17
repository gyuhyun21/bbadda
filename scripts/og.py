# 공유 미리보기 이미지(1200x630 PNG) 만들기 — public/og/<팀 id>.png, league.png
# 팀 컬러·짧은 이름이 바뀌면 다시 실행: python3 scripts/og.py (macOS 시스템 글꼴 Apple SD Gothic Neo 사용)
# 구단 로고는 쓰지 않는다(CLAUDE.md). 팀 컬러 바탕 + 이름 글자만.
import os, re
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
f = lambda size, idx=16: ImageFont.truetype(FONT, size, index=idx)  # 16=Heavy, 6=Bold, 2=Medium
W, H = 1200, 630
out = os.path.join(ROOT, 'public', 'og')
os.makedirs(out, exist_ok=True)


def card(path, bg, big, line1, line2):
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    d.text((80, 64), 'BBADDA.com', font=f(44), fill='white')
    d.text((80, 150), big, font=f(230 if len(big) <= 3 else 170), fill='white')
    d.text((84, 440), line1, font=f(60, 6), fill='white')
    d.text((84, 520), line2, font=f(38, 2), fill=(255, 255, 255, 200))
    im.save(path, optimize=True)


# teams.yaml 에서 id·name·short·color 만 읽는다(외부 모듈 없이)
src = open(os.path.join(ROOT, 'config', 'teams.yaml'), encoding='utf8').read()
teams = [dict(re.findall(r'^\s+(name|short|color): "?(#[0-9A-Fa-f]{6}|[^"#\n]+?)"?\s*(?:#.*)?$', b, re.M), id=b.split('\n')[0].strip())
         for b in src.split('  - id: ')[1:]]
for t in teams:
    card(os.path.join(out, f"{t['id']}.png"), t['color'], t['short'], t['name'], '오늘의 소식 · 매일 아침 갱신')
card(os.path.join(out, 'league.png'), '#1D1D1F', 'KBO', 'KBO 10개 구단 소식', '팀별로 매일 아침 정리 · 빠따닷컴')
print('저장:', out)
