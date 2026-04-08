/**
 * Layer A — site-specific raw parsed data.
 * Only the fields actually consumed by the bridge + rules are kept.
 */
import type { FieldStatus } from './FieldStatus.js';

export interface EncarCarBase {
  category: {
    manufacturerName: string;
    modelGroupName?: string;
    modelName: string;
    gradeName?: string;
    gradeDetailName?: string;
    yearMonth: string;
    formYear?: string;
    newPrice?: number;
    domestic: boolean;
    importType?: string;
  };
  advertisement: {
    price: number;
    preVerified: boolean;
    trust: string[];
    oneLineText?: string;
    homeService?: boolean;
  };
  spec: {
    mileage: number;
    fuelName?: string;
    transmissionName?: string;
    colorName?: string;
    bodyName?: string;
    tradeType?: 'D' | 'I';
  };
  condition?: {
    accident?: { recordView: boolean };
    seizing?: { mortgage: number; seizing: number };
  };
  contact?: { address?: string; phone?: string };
  partnership?: { dealer?: { name: string; shop: string } };
  manage?: { regDate?: string; viewCnt?: number; wishCnt?: number };
  vin?: string;
  vehicleNo?: string;
}

export interface DetailFlags {
  isInsuranceExist: boolean;
  isHistoryView: boolean;
  isDiagnosisExist: boolean;
  isDealer?: boolean;
}

export interface EncarParsedData {
  schemaVersion: 1;
  source: 'encar';
  url: string;
  carId: string;
  /** Internal vehicle id from __PRELOADED_STATE__.cars.base.vehicleId (may differ from listing carId). */
  vehicleId?: number;
  /** Vehicle number plate, used by some APIs. */
  vehicleNo?: string;
  fetchedAt: number;
  loginState: 'logged_in' | 'logged_out' | 'unknown';
  raw: {
    base: FieldStatus<EncarCarBase>;
    detailFlags: FieldStatus<DetailFlags>;
    recordApi: FieldStatus<import('../parsers/encar/api-record.js').RecordApi>;
    diagnosisApi: FieldStatus<
      import('../parsers/encar/api-diagnosis.js').DiagnosisApi
    >;
    inspectionApi: FieldStatus<
      import('../parsers/encar/api-inspection.js').InspectionApi
    >;
  };
}
