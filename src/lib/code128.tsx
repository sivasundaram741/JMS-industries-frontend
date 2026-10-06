// Code 128 barcode (code set B: letters, digits and punctuation), drawn as SVG bars. No library needed.
// Each symbol is 6 alternating bar/space widths (11 modules); the stop symbol has 7 (13 modules).
const PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];
const START_B = 104, STOP = 106;

// Characters Code 128 B can carry (ASCII 32–126); anything else is replaced with '?'
export const clean128 = (s: string) => s.normalize('NFKD').replace(/[^\x20-\x7e]/g, '?');

// Bar widths (in modules) for the text, alternating bar, space, bar… with start, checksum and stop
export function code128Widths(text: string): number[] {
  const values = Array.from(clean128(text)).map((ch) => ch.charCodeAt(0) - 32);
  let sum = START_B;
  values.forEach((v, i) => { sum += v * (i + 1); });
  const codes = [START_B, ...values, sum % 103, STOP];
  return codes.flatMap((c) => PATTERNS[c].split('').map(Number));
}

// SVG markup for the barcode with a quiet zone of 10 modules each side
export function Code128({ value, height = 40, module = 1.4, fill = false, color = '#000' }: { value: string; height?: number; module?: number; fill?: boolean; color?: string }) {
  const widths = code128Widths(value);
  const total = widths.reduce((a, b) => a + b, 0) + 20;
  let x = 10;
  const bars: Array<{ x: number; w: number }> = [];
  widths.forEach((w, i) => { if (i % 2 === 0) bars.push({ x, w }); x += w; });
  return (
    <svg viewBox={`0 0 ${total} ${height}`} width={fill ? '100%' : total * module} height={height} preserveAspectRatio="none" role="img" aria-label={`Barcode ${value}`} style={{ maxWidth: '100%', display: 'block' }}>
      <rect x={0} y={0} width={total} height={height} fill="#fff" />
      {bars.map((b, i) => <rect key={i} x={b.x} y={0} width={b.w} height={height} fill={color} />)}
    </svg>
  );
}
