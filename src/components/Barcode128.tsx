import React, { useMemo } from 'react';

// Code 128 Patterns (107 patterns, 0..106)
// Each digit represents alternating bar and space width (in modules)
const CODE128_PATTERNS: string[] = [
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
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

const START_CODE_B = 104;
const STOP_CODE = 106;

export interface Barcode128Props {
  value: string;
  moduleWidth?: number; // width per module (px)
  height?: number;       // height of bars (px)
  displayValue?: boolean;
  fontSize?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Barcode128: React.FC<Barcode128Props> = ({
  value,
  moduleWidth = 1.6,
  height = 42,
  displayValue = true,
  fontSize = 11,
  className = '',
  style = {},
}) => {
  const barcodeData = useMemo(() => {
    if (!value || typeof value !== 'string') return null;

    // Filter characters to ASCII 32..126
    const cleanChars: number[] = [];
    for (let i = 0; i < value.length; i++) {
      const code = value.charCodeAt(i);
      if (code >= 32 && code <= 126) {
        cleanChars.push(code - 32);
      }
    }

    if (cleanChars.length === 0) return null;

    // Calculate Checksum
    let checksum = START_CODE_B;
    for (let i = 0; i < cleanChars.length; i++) {
      checksum += cleanChars[i] * (i + 1);
    }
    checksum = checksum % 103;

    // Sequence: START_B, data..., checksum, STOP
    const symbolCodes = [START_CODE_B, ...cleanChars, checksum, STOP_CODE];

    // Build rectangles for bars
    const quietZoneModules = 10;
    let currentModule = quietZoneModules;
    const bars: Array<{ x: number; width: number }> = [];

    for (const symbolCode of symbolCodes) {
      const pattern = CODE128_PATTERNS[symbolCode];
      if (!pattern) continue;

      let isBar = true;
      for (let p = 0; p < pattern.length; p++) {
        const width = parseInt(pattern[p], 10);
        if (isBar) {
          bars.push({
            x: currentModule * moduleWidth,
            width: width * moduleWidth,
          });
        }
        currentModule += width;
        isBar = !isBar;
      }
    }

    currentModule += quietZoneModules;
    const totalWidth = currentModule * moduleWidth;
    const totalHeight = displayValue ? height + fontSize + 6 : height;

    return {
      bars,
      totalWidth,
      totalHeight,
    };
  }, [value, moduleWidth, height, displayValue, fontSize]);

  if (!barcodeData) {
    return <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{value}</span>;
  }

  return (
    <div
      className={`barcode-container ${className}`}
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#ffffff',
        padding: '2px 4px',
        ...style,
      }}
    >
      <svg
        width={barcodeData.totalWidth}
        height={barcodeData.totalHeight}
        viewBox={`0 0 ${barcodeData.totalWidth} ${barcodeData.totalHeight}`}
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="crispEdges"
        style={{ display: 'block' }}
      >
        <rect width={barcodeData.totalWidth} height={barcodeData.totalHeight} fill="#ffffff" />
        {barcodeData.bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={0}
            width={bar.width}
            height={height}
            fill="#000000"
          />
        ))}
        {displayValue && (
          <text
            x={barcodeData.totalWidth / 2}
            y={height + fontSize}
            textAnchor="middle"
            fontFamily="monospace, 'Courier New', sans-serif"
            fontSize={fontSize}
            fontWeight="600"
            letterSpacing="1px"
            fill="#000000"
          >
            {value}
          </text>
        )}
      </svg>
    </div>
  );
};

export default Barcode128;
