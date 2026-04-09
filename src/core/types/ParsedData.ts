/**
 * Layer A — site-specific raw parsed data.
 * Only the fields actually consumed by the bridge + rules are kept.
 */
import type { FieldStatus } from './FieldStatus.js';

/**
 * Contact block author type. Observed values across samples:
 *   'DEALER' — used-car dealer (default, all fixtures 001–005)
 *   'CLIENT' — individual private seller (sample 006)
 * Keep as a union so future values (e.g. 'PARTNER_DEALER') surface as type
 * errors rather than silent regressions.
 */
export type EncarUserType = 'CLIENT' | 'DEALER';

/**
 * Import origin classification. The set grows over time; extend as needed.
 *   'REGULAR_IMPORT'   — standard parallel-import dealer (samples 004, 005)
 *   'BRAND_IMPORT'     — brand-certified import
 *   'NONE_IMPORT_TYPE' — personal listing with no import channel (sample 006)
 */
export type EncarImportType =
  | 'REGULAR_IMPORT'
  | 'BRAND_IMPORT'
  | 'NONE_IMPORT_TYPE'
  | (string & {});

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
    importType?: EncarImportType | null;
  };
  advertisement: {
    price: number;
    preVerified: boolean;
    trust: string[];
    oneLineText?: string | null;
    homeService?: boolean;
    advertisementType?: 'AD_NORMAL' | 'NORMAL' | (string & {});
    diagnosisCar?: boolean;
  };
  spec: {
    mileage: number;
    fuelName?: string;
    transmissionName?: string;
    colorName?: string;
    bodyName?: string;
    /**
     * `'D'` dealer, `'I'` individual (consignment), `null` when omitted by
     * Encar — personal listings (sample 006) set this to `null`, not `'I'`.
     */
    tradeType?: 'D' | 'I' | null;
  };
  condition?: {
    accident?: { recordView: boolean };
    seizing?: { mortgage: number; seizing: number };
  };
  contact?: {
    address?: string;
    phone?: string;
    /**
     * `'CLIENT'` for personal sellers, `'DEALER'` for dealers. Central
     * discriminator for the dealer-vs-personal branch in `encar-to-facts`.
     */
    userType?: EncarUserType;
    isVerifyOwner?: boolean;
    isOwnerPartner?: boolean;
  };
  partnership?: {
    dealer?: { name: string; shop: string } | null;
    isPartneredVehicle?: boolean;
  };
  manage?: { regDate?: string; viewCnt?: number; wishCnt?: number };
  /** Personal listings omit this — treat `null` as "not disclosed", not missing. */
  vin?: string | null;
  vehicleNo?: string;
}

export interface DetailFlags {
  isInsuranceExist: boolean;
  isHistoryView: boolean;
  isDiagnosisExist: boolean;
  /**
   * `true` for all dealer listings, `false` for personal (sample 006). This
   * is the *authoritative* discriminator; `spec.tradeType` is too loose
   * (can be `null` on personal) and `partnership.dealer` can be null on
   * dealer-seller listings too.
   */
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
