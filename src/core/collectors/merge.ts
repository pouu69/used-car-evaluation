/**
 * Multi-source field merge — combine several `FieldStatus<T>` candidates
 * (each produced by a different source) into a single final status.
 *
 * The bridge currently reads from a single source per field (R01–R03 from
 * detailFlags, R05–R10 from recordApi, etc.). As we add cross-validation —
 * e.g. `inspectionApi.master.detail.waterlog` vs `recordApi.floodTotalLossCnt`
 * for R06 — we need a small, well-tested merge primitive that:
 *
 *   1. Picks the best successful source (highest priority).
 *   2. Detects conflicts among successful sources and downgrades confidence
 *      or emits a warning.
 *   3. Propagates the loudest failure when all sources fail.
 *
 * Merge policy is *deterministic* and *pure* — no side effects. Warnings
 * come back in the return value so the caller can append them to
 * `ChecklistFacts.bridgeWarnings`.
 */
import type { FieldStatus } from '../types/FieldStatus.js';
import type { SourceId } from './sources.js';
import { SOURCE_REGISTRY } from './sources.js';

export interface MergeCandidate<T> {
  source: SourceId;
  status: FieldStatus<T>;
}

export interface MergeResult<T> {
  status: FieldStatus<T>;
  /** Which source provided the final value (if any). */
  chosenSource?: SourceId;
  /**
   * Warnings (conflict between two successful sources, all sources failed,
   * etc.). Empty array = perfect agreement or single successful source.
   */
  warnings: string[];
}

const defaultEquality = <T>(a: T, b: T): boolean => {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object') return false;
  if (a === null || b === null) return false;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
};

/**
 * Merge a list of `MergeCandidate<T>` into a single `FieldStatus<T>`.
 *
 * Rules (in order):
 *
 *  R1. If any candidate is `value`, the merged result is `value` — pick the
 *      one whose source has the highest `SOURCE_REGISTRY[id].priority`.
 *  R2. If two or more `value` candidates disagree under `equality`, the
 *      winner is still the highest-priority one, but a warning is emitted
 *      listing the conflicting sources.
 *  R3. If every candidate is `loading`, the merged result is `loading`.
 *  R4. If at least one candidate is `loading` and none is `value`, the
 *      merged result is `loading`.
 *  R5. If every candidate is `hidden_by_dealer`, return `hidden_by_dealer`.
 *  R6. Otherwise (all failed/timed out) return `parse_failed` with a reason
 *      summarising each source's failure.
 *
 * Empty input → `parse_failed('no_sources')`.
 */
export const mergeFieldStatus = <T>(
  candidates: readonly MergeCandidate<T>[],
  equality: (a: T, b: T) => boolean = defaultEquality,
): MergeResult<T> => {
  if (candidates.length === 0) {
    return {
      status: { kind: 'parse_failed', reason: 'no_sources' },
      warnings: [],
    };
  }

  const values: Array<MergeCandidate<T> & { status: { kind: 'value'; value: T } }> = [];
  for (const c of candidates) {
    if (c.status.kind === 'value') {
      values.push(
        c as MergeCandidate<T> & { status: { kind: 'value'; value: T } },
      );
    }
  }

  if (values.length > 0) {
    values.sort(
      (a, b) =>
        SOURCE_REGISTRY[b.source].priority - SOURCE_REGISTRY[a.source].priority,
    );
    const winner = values[0]!;
    const warnings: string[] = [];

    for (const other of values.slice(1)) {
      if (!equality(winner.status.value, other.status.value)) {
        warnings.push(
          `merge_conflict:${winner.source}≠${other.source}`,
        );
      }
    }

    return {
      status: winner.status,
      chosenSource: winner.source,
      warnings,
    };
  }

  // No value. Check if anything is still loading.
  if (candidates.some((c) => c.status.kind === 'loading')) {
    return { status: { kind: 'loading' }, warnings: [] };
  }

  // All hidden?
  if (candidates.every((c) => c.status.kind === 'hidden_by_dealer')) {
    return { status: { kind: 'hidden_by_dealer' }, warnings: [] };
  }

  // Otherwise, summarise the failures.
  const reasons = candidates.map((c) => {
    if (c.status.kind === 'parse_failed') {
      return `${c.source}:${c.status.reason}`;
    }
    return `${c.source}:${c.status.kind}`;
  });
  return {
    status: {
      kind: 'parse_failed',
      reason: `all_sources_failed(${reasons.join(',')})`,
    },
    warnings: [],
  };
};

/** Convenience overload: accept named map `{ [source]: FieldStatus<T> }`. */
export const mergeFieldStatusMap = <T>(
  map: Partial<Record<SourceId, FieldStatus<T>>>,
  equality?: (a: T, b: T) => boolean,
): MergeResult<T> => {
  const candidates: MergeCandidate<T>[] = (
    Object.entries(map) as Array<[SourceId, FieldStatus<T> | undefined]>
  )
    .filter(([, status]) => status !== undefined)
    .map(([source, status]) => ({ source, status: status as FieldStatus<T> }));
  return mergeFieldStatus(candidates, equality);
};
