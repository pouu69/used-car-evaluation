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
  no_baseline: '신차 가격 정보 없음 (시세 비교 불가)',
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
  return s.value
    ? {
        ruleId: 'R03',
        title: '엔카진단 통과',
        severity: 'pass',
        message: '엔카진단을 통과한 차량입니다',
        evidence: [ev('isDiagnosisExist', true)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R03',
        title: '엔카진단 통과',
        severity: 'killer',
        message: '🚨 엔카진단을 받지 않은 차량입니다',
        evidence: [ev('isDiagnosisExist', false)],
        acknowledgeable: true,
      };
};

export const r04: Rule = (f) => {
  const s = f.frameDamage;
  if (!isValue(s)) return unknownResult('R04', '프레임 무사고', s);
  return !s.value.hasDamage
    ? {
        ruleId: 'R04',
        title: '프레임 무사고',
        severity: 'pass',
        message: '프레임에 사고 흔적이 없습니다',
        evidence: [ev('frameDamage', s.value)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R04',
        title: '프레임 무사고',
        severity: 'killer',
        message: '🚨 프레임 손상이 확인되었습니다',
        evidence: [ev('frameDamage', s.value)],
        acknowledgeable: true,
      };
};

export const r05: Rule = (f) => {
  const s = f.usageHistory;
  if (!isValue(s)) return unknownResult('R05', '렌트/택시 이력 없음', s);
  const { rental, taxi, business } = s.value;
  if (rental || taxi || business) {
    const tags: string[] = [];
    if (rental) tags.push('렌트');
    if (taxi) tags.push('영업용');
    if (business) tags.push('관용');
    return {
      ruleId: 'R05',
      title: '렌트/택시/영업 이력 없음',
      severity: 'killer',
      message: `🚨 ${tags.join('/')} 이력이 확인되었습니다`,
      evidence: [ev('usageHistory', s.value)],
      acknowledgeable: true,
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
  return !s.value
    ? {
        ruleId: 'R06',
        title: '전손/침수/도난 없음',
        severity: 'pass',
        message: '전손/침수/도난 이력이 없습니다',
        evidence: [ev('totalLoss', false)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R06',
        title: '전손/침수/도난 없음',
        severity: 'killer',
        message: '🚨 전손/침수/도난 이력이 확인되었습니다',
        evidence: [ev('totalLoss', true)],
        acknowledgeable: true,
      };
};

export const r07: Rule = (f) => {
  const s = f.ownerChangeCount;
  if (!isValue(s)) return unknownResult('R07', '1인 신조', s);
  if (s.value <= 1) {
    return {
      ruleId: 'R07',
      title: '1인 신조',
      severity: 'pass',
      message: '소유자 변경이 없거나 1회 입니다',
      evidence: [ev('ownerChangeCount', s.value)],
      acknowledgeable: false,
    };
  }
  return {
    ruleId: 'R07',
    title: '1인 신조',
    severity: 'warn',
    message: `소유자 변경 ${s.value}회`,
    evidence: [ev('ownerChangeCount', s.value)],
    acknowledgeable: false,
  };
};

export const r08: Rule = (f) => {
  const s = f.insuranceGap;
  if (!isValue(s))
    return unknownResult('R08', '자차보험 공백 없음', s);
  return !s.value
    ? {
        ruleId: 'R08',
        title: '자차보험 공백 없음',
        severity: 'pass',
        message: '자차보험 공백이 없습니다',
        evidence: [ev('insuranceGap', false)],
        acknowledgeable: false,
      }
    : {
        ruleId: 'R08',
        title: '자차보험 공백 없음',
        severity: 'killer',
        message: '🚨 자차보험 미가입 기간이 존재합니다',
        evidence: [ev('insuranceGap', true)],
        acknowledgeable: true,
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
  if (!isValue(s)) return unknownResult('R10', '자잘한 사고 처리', s);
  const { ownDamageWon, otherDamageWon, domestic } = s.value;
  const threshold = domestic ? 1_000_000 : 2_000_000;
  const max = Math.max(ownDamageWon, otherDamageWon);
  if (max === 0) {
    return {
      ruleId: 'R10',
      title: '자잘한 사고 처리',
      severity: 'pass',
      message: '보험 처리 기록이 없습니다',
      evidence: [ev('damages', s.value)],
      acknowledgeable: false,
    };
  }
  if (max >= threshold) {
    return {
      ruleId: 'R10',
      title: '자잘한 사고 처리',
      severity: 'warn',
      message: `⚠ 보험처리 금액 ${max.toLocaleString()}원 (임계 ${threshold.toLocaleString()}원)`,
      evidence: [ev('damages', s.value)],
      acknowledgeable: false,
    };
  }
  return {
    ruleId: 'R10',
    title: '자잘한 사고 처리',
    severity: 'pass',
    message: `보험처리 ${max.toLocaleString()}원 (임계 미만)`,
    evidence: [ev('damages', s.value)],
    acknowledgeable: false,
  };
};

export const r11: Rule = (f) => {
  const s = f.priceVsMarket;
  if (!isValue(s)) return unknownResult('R11', '가격 적정성', s);
  const { ratio } = s.value;
  if (ratio === 0)
    return unknownResult('R11', '가격 적정성', {
      kind: 'parse_failed',
      reason: 'no_baseline',
    });
  if (ratio < 0.5) {
    return {
      ruleId: 'R11',
      title: '가격 적정성',
      severity: 'warn',
      message: `⚠ 신차대비 ${Math.round(ratio * 100)}% — 의심스러울 정도로 저가`,
      evidence: [ev('ratio', ratio)],
      acknowledgeable: false,
    };
  }
  if (ratio > 1.0) {
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

export const ALL_RULES: Rule[] = [
  r01, r02, r03, r04, r05, r06, r07, r08, r09, r10, r11,
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
  const results = registry.map((rule) => rule(facts));
  const killers = results.filter((r) => r.severity === 'killer');
  const warns = results.filter((r) => r.severity === 'warn');
  const verdict: Verdict =
    killers.length > 0
      ? 'NEVER'
      : warns.length > 0
        ? 'CAUTION'
        : results.some((r) => r.severity === 'unknown')
          ? 'UNKNOWN'
          : 'OK';
  const max = registry.length * 10;
  const sum = results.reduce((acc, r) => acc + SEVERITY_SCORE[r.severity], 0);
  const score = max === 0 ? 0 : Math.round((sum / max) * 100);
  return { verdict, score, results, killers, warns };
};
