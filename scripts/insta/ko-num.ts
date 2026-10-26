// 릴스 목소리 대본의 아라비아 숫자를 읽을 소리 그대로 한글로 바꾼다(2026-10-24: '24 대 5'를 '스물네 대 오'로 읽은 일).
// 사용: npx tsx scripts/insta/ko-num.ts "대본"  → 표준 출력에 바꾼 대본. 규칙은 docs/insta-style.md 4절.
const D = ['영', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];

/** 한자어 수(0 ~ 9999억) */
export function sino(n: number): string {
  if (n === 0) return '영';
  const four = (x: number) => ['천', '백', '십', ''].map((u, i) => {
    const d = Math.floor(x / 10 ** (3 - i)) % 10;
    return d ? (d === 1 && u ? '' : D[d]) + u : '';
  }).join('');
  let out = '';
  for (const [u, base] of [['억', 1e8], ['만', 1e4], ['', 1]] as const) {
    const part = Math.floor(n / base) % 1e4;
    if (part) out += (part === 1 && u === '만' ? '' : four(part)) + u;
  }
  return out;
}

/** 고유어 수(1~99, 뒤에 단위가 붙는 꼴: 한·두·세·네·스무) — 100 이상은 한자어 */
export function native(n: number): string {
  if (n < 1 || n > 99) return sino(n);
  const tens = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'][Math.floor(n / 10)];
  const ones = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'][n % 10];
  return n === 20 ? '스무' : tens + ones;
}

// 고유어로 읽는 단위(시각의 '시'는 '시즌·시리즈'가 아닐 때만, '번'은 '번 타자'가 아닐 때만)
const NATIVE = '시간|시(?!즌|리즈)|경기|개|명|번(?!\\s?타자)|살|마리|장|곳|타석|사람|가지|차례|군데|달';
const MONTH: Record<number, string> = { 6: '유월', 10: '시월' };

export function koNum(text: string): string {
  return text
    // 점수 13-1 → 십삼 대 일
    .replace(/(\d+)\s*-\s*(\d+)(?=\s|$|[^\d])/g, (_, a, b) => `${sino(+a)} 대 ${sino(+b)}`)
    // 탈삼진 9K → 삼진 아홉 개
    .replace(/(\d+)\s*K\b/g, (_, a) => `삼진 ${native(+a)} 개`)
    // 소수 7.71 → 칠 점 칠일
    .replace(/(\d+)\.(\d+)/g, (_, a, b) => `${sino(+a)} 점 ${[...b].map((d) => D[+d]).join('')}`)
    .replace(/(\d+)\s*%/g, (_, a) => `${sino(+a)} 퍼센트`)
    .replace(/(\d+)\s*월/g, (_, a) => `${MONTH[+a] ?? sino(+a) + '월'}`)
    .replace(new RegExp(`(\\d+)\\s*(${NATIVE})`, 'g'), (_, a, u) => `${native(+a)} ${u}`)
    .replace(/\d[\d,]*/g, (a) => sino(+a.replace(/,/g, '')))
    .replace(/\s+([.,!?])/g, '$1').replace(/ {2,}/g, ' ').trim();
}

if (process.argv[1]?.endsWith('ko-num.ts')) console.log(koNum(process.argv.slice(2).join(' ')));
