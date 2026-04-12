/**
 * UI-only metadata for rules: icon + category + short label.
 * Keyed by ruleId. Keeps core/rules decoupled from presentation.
 */
export type Category = '투명성' | '차량 상태' | '이력' | '사고' | '가격';

export interface RuleMeta {
  icon: string;
  category: Category;
  shortTitle: string;
}

export const RULE_META: Record<string, RuleMeta> = {
  R01: { icon: '📋', category: '투명성', shortTitle: '보험이력 공개' },
  R02: { icon: '🔍', category: '투명성', shortTitle: '성능점검 공개' },
  R03: { icon: '🏅', category: '차량 상태', shortTitle: '엔카진단' },
  R04: { icon: '🛠', category: '차량 상태', shortTitle: '프레임/외판' },
  R05: { icon: '🚕', category: '이력', shortTitle: '렌트·택시 이력' },
  R06: { icon: '💦', category: '이력', shortTitle: '전손·침수·도난' },
  R07: { icon: '👤', category: '이력', shortTitle: '소유자 변경' },
  R08: { icon: '🛡', category: '이력', shortTitle: '자차보험 공백' },
  R09: { icon: '📝', category: '사고', shortTitle: '수리비 확정' },
  R10: { icon: '🔨', category: '사고', shortTitle: '보험처리 규모' },
  R11: { icon: '💰', category: '가격', shortTitle: '가격 적정성' },
  R12: { icon: '🛢', category: '차량 상태', shortTitle: '누유 여부' },
};

export const CATEGORY_ORDER: Category[] = [
  '차량 상태',
  '이력',
  '사고',
  '가격',
  '투명성',
];
