/**
 * Rule registry + engine. Pure: depends only on ChecklistFacts.
 */
import type { ChecklistFacts } from '../types/ChecklistFacts.js';
import type {
  Rule,
  RuleResult,
  RuleReport,
  Severity,
  Verdict,
} from '../types/RuleTypes.js';
import { isValue } from '../types/FieldStatus.js';
import type { FieldStatus } from '../types/FieldStatus.js';

const ev = (field: string, value: unknown) => ({ field, value });

// ── Rule thresholds ─────────────────────────────────────────────
/** R07: 소유자 변경 2회까지 정상, 3회부터 warn */
const R07_OWNER_WARN_THRESHOLD = 2;
/** R10: 경미 사고 상한 — 국산 200만원, 수입 400만원 */
const R10_MILD_CEILING_DOMESTIC = 2_000_000;
const R10_MILD_CEILING_IMPORT = 4_000_000;
/** R11: 신차대비 가격 비율 경계 */
const R11_SUSPICIOUSLY_LOW_RATIO = 0.45;
const R11_OVERPRICED_RATIO = 1.15;

const REASON_LABEL: Record<string, string> = {
  login_required: '🔒 로그인 필요 (엔카 로그인 후 재평가)',
  not_fetched: '수집 대기 중',
  detail_flags_unavailable: '엔카 기본 정보 누락',
  no_insurance_field_missing: '보험 공백 필드 미제공',
  uidata_missing: '이력 페이지에서 데이터 추출 실패',
  preloaded_state_missing: '페이지 상태 추출 실패',
  detail_flags_missing: '페이지 플래그 추출 실패',
  empty_dom: 'DOM 텍스트 비어있음',
  empty_diagnosis: '진단 리포트 비어있음',
  empty_inspect: '성능점검 리포트 비어있음',
  empty_accident: '사고 리포트 비어있음',
  no_frame_signal: '프레임 신호 없음',
  not_derived: '데이터 미수집',
  not_applicable_personal: '개인매물 — 해당없음',
  no_report_for_personal: '개인매물 — 엔카 리포트 없음',
  api_fetch_error: '데이터 수집 오류',
};

const humanReason = (s: FieldStatus<unknown>): string => {
  if (s.kind === 'parse_failed') return REASON_LABEL[s.reason] ?? s.reason;
  if (s.kind === 'loading') return '수집 중';
  if (s.kind === 'timeout') return '⏱ 시간 초과';
  if (s.kind === 'hidden_by_dealer') return '딜러 비공개';
  return s.kind;
};

const unknownResult = (
  ruleId: string,
  title: string,
  s: FieldStatus<unknown>,
): RuleResult => ({
  ruleId,
  title,
  severity: 'unknown',
  message: humanReason(s),
  evidence: [],
  acknowledgeable: false,
});

export const r01: Rule = (f) => {
  const s = f.insuranceHistoryDisclosed;
  if (!isValue(s))
    return unknownResult('R01', '보험이력 공개', s);
  return s.value
    ? {
        ruleId: 'R01',
        title: '보험이력 공개',
        severity: 'pass',
        message: '딜러가 보험이력을 공개했습니다',
        evidence: [ev('isInsuranceExist', true)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R01',
        title: '보험이력 공개',
        severity: 'fail',
        message: '⚠ 딜러가 보험이력을 비공개했습니다',
        evidence: [ev('isInsuranceExist', false)],
        acknowledgeable: false,
      };
};

export const r02: Rule = (f) => {
  const s = f.inspectionReportDisclosed;
  if (!isValue(s)) return unknownResult('R02', '성능점검 공개', s);
  return s.value
    ? {
        ruleId: 'R02',
        title: '성능점검 공개',
        severity: 'pass',
        message: '성능점검 기록이 공개되어 있습니다',
        evidence: [ev('isHistoryView', true)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R02',
        title: '성능점검 공개',
        severity: 'fail',
        message: '⚠ 성능점검 기록이 비공개입니다',
        evidence: [ev('isHistoryView', false)],
        acknowledgeable: false,
      };
};

export const r03: Rule = (f) => {
  const s = f.hasEncarDiagnosis;
  if (!isValue(s)) return unknownResult('R03', '엔카진단', s);
  // 엔카진단은 "있으면 보너스" 성격. 없다고 감점 요인으로 보지 않는다.
  // → 있을 때만 pass로 노출하고, 없으면 결과에서 완전히 제외 (null 반환).
  if (!s.value) return null;
  return {
    ruleId: 'R03',
    title: '엔카진단 통과',
    severity: 'pass',
    message: '엔카진단을 통과한 차량입니다',
    evidence: [ev('isDiagnosisExist', true)],
    acknowledgeable: false,
  };
};

export const r04: Rule = (f) => {
  const s = f.frameDamage;
  if (!isValue(s)) return unknownResult('R04', '프레임/외판', s);
  const { hasDamage, parts } = s.value;
  const hasParts = parts && parts.length > 0;
  const panelSuffix = hasParts ? ` · 외부패널: ${parts.join(', ')}` : '';
  return !hasDamage
    ? {
        ruleId: 'R04',
        title: hasParts ? '프레임/외판' : '프레임 무사고',
        severity: 'pass',
        message: `프레임 무사고${panelSuffix}`,
        evidence: [ev('frameDamage', s.value)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R04',
        title: '프레임/외판',
        severity: 'killer',
        message: `🚨 프레임 손상${panelSuffix}`,
        evidence: [ev('frameDamage', s.value)],
        acknowledgeable: true,
      };
};

export const r05: Rule = (f) => {
  const s = f.usageHistory;
  if (!isValue(s)) return unknownResult('R05', '렌트/택시/영업 이력', s);
  const { rental, taxi, business } = s.value;
  // 렌트·택시는 강한 상용 운행 → killer.
  // 관용(business)은 차급·관리이력이 오히려 양호한 경우가 많아 warn 으로 완화.
  if (rental || taxi) {
    const tags: string[] = [];
    if (rental) tags.push('렌트');
    if (taxi) tags.push('영업용');
    return {
      ruleId: 'R05',
      title: '렌트/택시 이력',
      severity: 'killer',
      message: `🚨 ${tags.join('/')} 이력이 확인되었습니다`,
      evidence: [ev('usageHistory', s.value)],
      acknowledgeable: true,
    };
  }
  if (business) {
    return {
      ruleId: 'R05',
      title: '관용 이력',
      severity: 'warn',
      message: '⚠ 관용 이력이 확인되었습니다',
      evidence: [ev('usageHistory', s.value)],
      acknowledgeable: false,
    };
  }
  return {
    ruleId: 'R05',
    title: '렌트/택시/영업 이력 없음',
    severity: 'pass',
    message: '렌트/택시/영업 이력이 없습니다',
    evidence: [ev('usageHistory', s.value)],
    acknowledgeable: false,
  };
};

export const r06: Rule = (f) => {
  const s = f.totalLossHistory;
  if (!isValue(s))
    return unknownResult('R06', '전손/침수/도난 없음', s);
  const { totalLoss, floodTotal, floodPart, robber } = s.value;
  const hits: string[] = [];
  if (totalLoss > 0) hits.push(`전손 ${totalLoss}회`);
  if (floodTotal > 0) hits.push(`침수전손 ${floodTotal}회`);
  if (floodPart > 0) hits.push(`침수분손 ${floodPart}회`);
  if (robber > 0) hits.push(`도난 ${robber}회`);

  if (hits.length === 0) {
    return {
      ruleId: 'R06',
      title: '전손/침수/도난 없음',
      severity: 'pass',
      message: '전손/침수/도난 이력이 없습니다',
      evidence: [ev('totalLoss', s.value)],
      acknowledgeable: false,
    };
  }
  return {
    ruleId: 'R06',
    title: '전손/침수/도난 이력',
    severity: 'killer',
    message: `🚨 ${hits.join(', ')} 이력이 확인되었습니다`,
    evidence: [ev('totalLoss', s.value)],
    acknowledgeable: true,
  };
};

export const r07: Rule = (f) => {
  const s = f.ownerChangeCount;
  if (!isValue(s)) return unknownResult('R07', '소유자 변경', s);
  if (s.value <= R07_OWNER_WARN_THRESHOLD) {
    return {
      ruleId: 'R07',
      title: '소유자 변경',
      severity: 'pass',
      message:
        s.value === 0
          ? '소유자 변경이 없습니다'
          : `소유자 변경 ${s.value}회 (정상 범위)`,
      evidence: [ev('ownerChangeCount', s.value)],
      acknowledgeable: false,
    };
  }
  return {
    ruleId: 'R07',
    title: '소유자 변경',
    severity: 'warn',
    message: `소유자 변경 ${s.value}회 (잦은 편)`,
    evidence: [ev('ownerChangeCount', s.value)],
    acknowledgeable: false,
  };
};

const formatGapDuration = (months: number): string => {
  if (months <= 0) return '';
  if (months < 12) return `${months}개월`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m === 0 ? `${y}년` : `${y}년 ${m}개월`;
};

export const r08: Rule = (f) => {
  const s = f.insuranceGap;
  if (!isValue(s)) return unknownResult('R08', '자차보험 공백 없음', s);
  const { hasGap, totalMonths, periods } = s.value;
  if (!hasGap) {
    return {
      ruleId: 'R08',
      title: '자차보험 공백 없음',
      severity: 'pass',
      message: '자차보험 공백이 없습니다',
      evidence: [ev('insuranceGap', s.value)],
      acknowledgeable: false,
    };
  }
  const duration = formatGapDuration(totalMonths);
  const segmentSuffix = periods.length > 1 ? ` · ${periods.length}개 구간` : '';
  return {
    ruleId: 'R08',
    title: '자차보험 공백',
    severity: 'warn',
    message: `⚠ 자차보험 미가입 ${duration}${segmentSuffix}`,
    evidence: [ev('insuranceGap', s.value)],
    acknowledgeable: false,
  };
};

export const r09: Rule = (f) => {
  const s = f.unconfirmedAccident;
  if (!isValue(s)) return unknownResult('R09', '수리비 미확정 없음', s);
  return !s.value
    ? {
        ruleId: 'R09',
        title: '수리비 미확정 없음',
        severity: 'pass',
        message: '수리비 미확정 건이 없습니다',
        evidence: [ev('unconfirmed', false)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R09',
        title: '수리비 미확정 없음',
        severity: 'warn',
        message: '⚠ 수리비 미확정 건이 있습니다',
        evidence: [ev('unconfirmed', true)],
        acknowledgeable: false,
      };
};

export const r10: Rule = (f) => {
  const s = f.minorAccidents;
  if (!isValue(s)) return unknownResult('R10', '보험처리 규모', s);
  const { ownDamageWon, otherDamageWon, domestic } = s.value;

  if (ownDamageWon === 0 && otherDamageWon === 0) {
    return {
      ruleId: 'R10',
      title: '보험처리 규모',
      severity: 'pass',
      message: '보험 처리 기록이 없습니다',
      evidence: [ev('damages', s.value)],
      acknowledgeable: false,
    };
  }

  const mildCeiling = domestic ? R10_MILD_CEILING_DOMESTIC : R10_MILD_CEILING_IMPORT;
  const bracketLabel = domestic ? '국산 200만원' : '수입 400만원';
  const max = Math.max(ownDamageWon, otherDamageWon);

  const fmtMan = (won: number): string =>
    won === 0 ? '0원' : `${Math.round(won / 10_000).toLocaleString()}만원`;
  const breakdown = `내차 ${fmtMan(ownDamageWon)} · 타차 ${fmtMan(otherDamageWon)}`;

  if (max > mildCeiling) {
    return {
      ruleId: 'R10',
      title: '보험처리 규모',
      severity: 'warn',
      message: `⚠ 주의 범위 (${bracketLabel} 초과) · ${breakdown}`,
      evidence: [ev('damages', s.value)],
      acknowledgeable: false,
    };
  }

  return {
    ruleId: 'R10',
    title: '보험처리 규모',
    severity: 'pass',
    message: `경미 범위 (${bracketLabel} 이하) · ${breakdown}`,
    evidence: [ev('damages', s.value)],
    acknowledgeable: false,
  };
};

export const r11: Rule = (f) => {
  const s = f.priceVsMarket;
  if (!isValue(s)) return unknownResult('R11', '가격 적정성', s);
  const { ratio } = s.value;
  // R03 과 동일한 "보너스 전용" 패턴.
  // 엔카가 신차가(baseline)를 제공하지 않으면 시세 비교가 애초에 불가능 →
  // unknown 으로 자리만 차지하지 말고 결과에서 완전히 드랍한다.
  if (ratio === 0) return null;
  if (ratio < R11_SUSPICIOUSLY_LOW_RATIO) {
    return {
      ruleId: 'R11',
      title: '가격 적정성',
      severity: 'warn',
      message: `⚠ 신차대비 ${Math.round(ratio * 100)}% — 의심스러울 정도로 저가`,
      evidence: [ev('ratio', ratio)],
      acknowledgeable: false,
    };
  }
  if (ratio > R11_OVERPRICED_RATIO) {
    return {
      ruleId: 'R11',
      title: '가격 적정성',
      severity: 'warn',
      message: `⚠ 신차대비 ${Math.round(ratio * 100)}% — 과한 가격`,
      evidence: [ev('ratio', ratio)],
      acknowledgeable: false,
    };
  }
  return {
    ruleId: 'R11',
    title: '가격 적정성',
    severity: 'pass',
    message: `신차대비 ${Math.round(ratio * 100)}% — 정상 범위`,
    evidence: [ev('ratio', ratio)],
    acknowledgeable: false,
  };
};

export const r12: Rule = (f) => {
  const s = f.oilLeak;
  // 성능점검 데이터가 없으면 누유 판정 불가 → 결과에서 제외 (R03과 동일 패턴).
  if (!isValue(s)) return null;
  const { hasLeak, items } = s.value;
  if (!hasLeak) {
    return {
      ruleId: 'R12',
      title: '누유 여부',
      severity: 'pass',
      message: '누유 없음',
      evidence: [ev('oilLeak', s.value)],
      acknowledgeable: false,
    };
  }
  const detail = items.map((i) => `${i.part}(${i.status})`).join(', ');
  return {
    ruleId: 'R12',
    title: '누유 여부',
    severity: 'warn',
    message: `⚠ ${detail}`,
    evidence: [ev('oilLeak', s.value)],
    acknowledgeable: false,
  };
};

export const ALL_RULES: Rule[] = [
  r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r11, r12,
];

const SEVERITY_SCORE: Record<Severity, number> = {
  pass: 10,
  warn: 4,
  fail: 0,
  killer: 0,
  unknown: 5,
};

export const evaluate = (
  facts: ChecklistFacts,
  registry: Rule[] = ALL_RULES,
): RuleReport => {
  // null을 반환한 rule은 "해당 없음/비노출"로 간주하고 완전히 드랍.
  const results = registry
    .map((rule) => rule(facts))
    .filter((r): r is RuleResult => r !== null);
  const killers = results.filter((r) => r.severity === 'killer');
  const warns = results.filter((r) => r.severity === 'warn');
  const CAUTION_THRESHOLD = 2;
  const verdict: Verdict =
    killers.length > 0
      ? 'NEVER'
      : warns.length >= CAUTION_THRESHOLD
        ? 'CAUTION'
        : results.some((r) => r.severity === 'unknown')
          ? 'UNKNOWN'
          : 'OK';
  const max = results.length * 10;
  const sum = results.reduce((acc, r) => acc + SEVERITY_SCORE[r.severity], 0);
  const score = max === 0 ? 0 : Math.round((sum / max) * 100);
  return { verdict, score, results, killers, warns };
};
