/**
 * Chuyển đổi số tiền thành chữ Tiếng Việt chuẩn kế toán
 * Ví dụ: 18500000 -> "Mười tám triệu năm trăm nghìn đồng chẵn."
 */
export function convertNumberToVietnameseWords(n: number): string {
  const nInt = Math.round(n);
  if (isNaN(nInt) || nInt === 0) return 'Không đồng chẵn.';
  if (nInt < 0) return 'Âm ' + convertNumberToVietnameseWords(Math.abs(nInt));

  const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
  const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];

  function readThree(val: number, isFirst: boolean): string {
    const h = Math.floor(val / 100);
    const t = Math.floor((val % 100) / 10);
    const o = val % 10;
    const res: string[] = [];

    if (h > 0 || !isFirst) {
      res.push(digits[h] + ' trăm');
      if (t === 0 && o > 0) res.push('lẻ');
    }

    if (t > 1) {
      res.push(digits[t] + ' mươi');
      if (o === 1) res.push('mốt');
      else if (o === 5) res.push('lăm');
      else if (o > 0) res.push(digits[o]);
    } else if (t === 1) {
      res.push('mười');
      if (o === 5) res.push('lăm');
      else if (o > 0) res.push(digits[o]);
    } else if (o > 0) {
      res.push(digits[o]);
    }

    return res.join(' ');
  }

  const groups: number[] = [];
  let temp = nInt;
  while (temp > 0) {
    groups.push(temp % 1000);
    temp = Math.floor(temp / 1000);
  }

  const words: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const grp = groups[i];
    if (grp > 0) {
      const grpWords = readThree(grp, i === groups.length - 1);
      const u = units[i];
      if (u) {
        words.push(`${grpWords} ${u}`);
      } else {
        words.push(grpWords);
      }
    }
  }

  const resultStr = words.join(' ').trim();
  if (!resultStr) return 'Không đồng chẵn.';
  return resultStr.charAt(0).toUpperCase() + resultStr.slice(1) + ' đồng chẵn.';
}
