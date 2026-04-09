import React from 'react';
import type { EncarParsedData } from '@/core/types/ParsedData.js';
import { formatYearMonth } from '@/core/parsers/utils/text.js';

interface CarStripProps {
  parsed: EncarParsedData;
  carId: string;
}

const formatMileage = (km: number | undefined): string | undefined => {
  if (km === undefined) return undefined;
  return `${km.toLocaleString()}km`;
};

const formatPrice = (man: number | undefined): string | undefined => {
  if (man === undefined || man === 0) return undefined;
  if (man >= 10000) {
    const eok = Math.floor(man / 10000);
    const rest = man % 10000;
    return rest > 0 ? `${eok}억 ${rest.toLocaleString()}만원` : `${eok}억원`;
  }
  return `${man.toLocaleString()}만원`;
};

export const css: string = `
.car-strip {
  padding: 11px 14px;
  border-bottom: 4px double #000;
  display: flex;
  flex-direction: column;
  gap: 3px;
  background: #fff;
}
.car-strip-make {
  font-family: 'Archivo Black', sans-serif;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0;
  color: #000;
}
.car-strip-spec {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  opacity: 0.75;
  color: #000;
}
.car-strip-price {
  font-family: 'Archivo Black', sans-serif;
  font-size: 18px;
  margin-top: 4px;
  color: #000;
}
`;

export const CarStrip: React.FC<CarStripProps> = ({ parsed, carId }) => {
  const base = parsed.raw.base;

  if (base.kind !== 'value') {
    return (
      <div className="car-strip">
        <div className="car-strip-make">— NO CAR DATA —</div>
        <div className="car-strip-spec">{`#${carId}`}</div>
        <div className="car-strip-price">가격 미공개</div>
      </div>
    );
  }

  const b = base.value;
  const make = [b.category.manufacturerName, b.category.modelName]
    .filter(Boolean)
    .join(' ');
  const grade = b.category.gradeName ?? b.category.gradeDetailName;
  const ym = formatYearMonth(b.category.yearMonth);
  const mi = formatMileage(b.spec.mileage);
  const pr = formatPrice(b.advertisement.price);

  const makeLabel = make + (grade ? ` · ${grade}` : '');
  const specParts = [ym, mi, `#${carId}`].filter(
    (s): s is string => s !== undefined && s !== null,
  );

  return (
    <div className="car-strip">
      <div className="car-strip-make">{makeLabel}</div>
      <div className="car-strip-spec">{specParts.join(' · ')}</div>
      <div className="car-strip-price">{pr ?? '가격 미공개'}</div>
    </div>
  );
};
