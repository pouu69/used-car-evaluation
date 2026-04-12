// src/compare/components/SpecSection.tsx
import React from 'react';
import type { CompareCarData } from '../App.js';
import { fmtMileage, fmtPrice } from '@/sidepanel/lib/format.js';

interface SpecSectionProps {
  cars: CompareCarData[];
  colCount: number;
}

export const SpecSection: React.FC<SpecSectionProps> = ({ cars, colCount }) => (
  <>
    <tr>
      <td className="ct-section-header" colSpan={colCount}>
        Specs
      </td>
    </tr>
    <tr>
      <td className="ct-label">Price</td>
      {cars.map((c) => (
        <td key={c.carId} style={{ fontWeight: 600 }}>
          {fmtPrice(c.priceWon)}
        </td>
      ))}
    </tr>
    <tr>
      <td className="ct-label">Year</td>
      {cars.map((c) => (
        <td key={c.carId}>{c.year ?? '—'}</td>
      ))}
    </tr>
    <tr>
      <td className="ct-label">Mileage</td>
      {cars.map((c) => (
        <td key={c.carId}>{fmtMileage(c.mileageKm)}</td>
      ))}
    </tr>
    <tr>
      <td className="ct-label">Fuel</td>
      {cars.map((c) => (
        <td key={c.carId}>{c.fuelType ?? '—'}</td>
      ))}
    </tr>
  </>
);
