/**
 * Pure psychometric calculations. No database, no HTTP, no clock. Every function is deterministic, so the rules
 * can be tested directly. Results are rounded to two decimals.
 *
 * Formulas:
 *   - Normalized answer:      (answer - scaleMin) / (scaleMax - scaleMin) * 100, clamped to [0, 100].
 *   - Normalized dimension:   mean of the normalized answers of that dimension.
 *   - Composite:              weighted mean of the normalized dimension scores, sum(w * s) / sum(w).
 *                             With no weights, or all weights equal, it is the plain mean.
 *   - Percentile rank:        (below + 0.5 * equal) / n * 100, against the cohort (midrank method).
 *   - Band:                   LOW < 20 <= BELOW_AVERAGE < 40 <= AVERAGE < 60 <= ABOVE_AVERAGE < 80 <= HIGH.
 *   - Cohort statistics:      count, mean, median, population standard deviation, min, max.
 */

export type PerformanceBand = 'LOW' | 'BELOW_AVERAGE' | 'AVERAGE' | 'ABOVE_AVERAGE' | 'HIGH';

export interface AnsweredItem {
    answer: number;
    scaleMin: number;
    scaleMax: number;
}

export interface WeightedScore {
    score: number | null;
    /** Optional. Missing, non-finite or non-positive weights count as zero. */
    weight?: number;
}

export interface CohortStatistics {
    count: number;
    mean: number;
    median: number;
    stdDev: number;
    min: number;
    max: number;
}

export const round2 = (value: number): number => Math.round(value * 100) / 100;

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const mean = (values: number[]): number => values.reduce((sum, v) => sum + v, 0) / values.length;

/**
 * Normalizes one answer to 0..100 within its question's scale. Returns null when the scale has no range
 * (scaleMax <= scaleMin) or a value is not finite, so the answer is left out instead of producing NaN or Infinity.
 */
export const normalizeAnswer = (answer: number, scaleMin: number, scaleMax: number): number | null => {
    if (!isFiniteNumber(answer) || !isFiniteNumber(scaleMin) || !isFiniteNumber(scaleMax)) return null;
    if (scaleMax <= scaleMin) return null;
    const pct = ((answer - scaleMin) / (scaleMax - scaleMin)) * 100;
    return Math.min(100, Math.max(0, pct));
};

/**
 * Normalized score of one dimension (0..100): the mean of its valid normalized answers. Null when no answer
 * has a usable scale, so a dimension with nothing to measure is not scored as zero.
 */
export const dimensionNormalizedScore = (items: AnsweredItem[]): number | null => {
    const values = items
        .map((item) => normalizeAnswer(item.answer, item.scaleMin, item.scaleMax))
        .filter((v): v is number => v !== null);
    return values.length === 0 ? null : round2(mean(values));
};

/** Raw dimension score: the mean of the raw answers, 0 when there are none. Kept for the existing report field. */
export const dimensionRawScore = (answers: number[]): number => {
    const valid = answers.filter(isFiniteNumber);
    return valid.length === 0 ? 0 : round2(mean(valid));
};

/**
 * Weighted composite of the dimension scores. Dimensions without a score are left out. If no weight is usable
 * (all missing, zero or invalid), the composite is the plain mean, which is the default for this schema.
 */
export const weightedComposite = (entries: WeightedScore[]): number | null => {
    const scored = entries.filter((e): e is { score: number; weight?: number } => isFiniteNumber(e.score));
    if (scored.length === 0) return null;

    const weightOf = (e: { weight?: number }) => (isFiniteNumber(e.weight) && e.weight > 0 ? e.weight : 0);
    const totalWeight = scored.reduce((sum, e) => sum + weightOf(e), 0);

    if (totalWeight === 0) return round2(mean(scored.map((e) => e.score)));
    const weighted = scored.reduce((sum, e) => sum + weightOf(e) * e.score, 0);
    return round2(weighted / totalWeight);
};

/**
 * Midrank percentile of a value in a cohort, 0..100. A value equal to others counts half of them.
 * Null for an empty cohort or a non-finite value.
 */
export const percentileRank = (value: number, cohort: number[]): number | null => {
    if (!isFiniteNumber(value) || cohort.length === 0) return null;
    const below = cohort.filter((c) => c < value).length;
    const equal = cohort.filter((c) => c === value).length;
    return round2(((below + 0.5 * equal) / cohort.length) * 100);
};

/** Band for a percentile. Each lower bound belongs to the higher band: 20 is BELOW_AVERAGE, 40 is AVERAGE, and so on. */
export const performanceBand = (percentile: number | null): PerformanceBand | null => {
    if (percentile === null || !isFiniteNumber(percentile)) return null;
    if (percentile < 20) return 'LOW';
    if (percentile < 40) return 'BELOW_AVERAGE';
    if (percentile < 60) return 'AVERAGE';
    if (percentile < 80) return 'ABOVE_AVERAGE';
    return 'HIGH';
};

/** Cohort statistics over finite values. Standard deviation is the population form (divide by n). Null when empty. */
export const cohortStatistics = (values: number[]): CohortStatistics | null => {
    const valid = values.filter(isFiniteNumber);
    if (valid.length === 0) return null;

    const sorted = [...valid].sort((a, b) => a - b);
    const n = sorted.length;
    const middle = Math.floor(n / 2);
    const median = n % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
    const avg = mean(sorted);
    const variance = sorted.reduce((sum, v) => sum + (v - avg) ** 2, 0) / n;

    return {
        count: n,
        mean: round2(avg),
        median: round2(median),
        stdDev: round2(Math.sqrt(variance)),
        min: round2(sorted[0]),
        max: round2(sorted[n - 1]),
    };
};
