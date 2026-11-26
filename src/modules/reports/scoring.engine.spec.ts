import {
    cohortStatistics,
    dimensionNormalizedScore,
    dimensionRawScore,
    normalizeAnswer,
    percentileRank,
    performanceBand,
    weightedComposite,
} from './scoring.engine';

describe('normalizeAnswer', () => {
    test.each([
        [1, 1, 5, 0],
        [3, 1, 5, 50],
        [4, 1, 5, 75],
        [5, 1, 5, 100],
        [3, 0, 10, 30],
        [7, 1, 7, 100],
        [1, -2, 2, 75],
    ])('answer %p on [%p, %p] normalizes to %p', (answer, min, max, expected) => {
        expect(normalizeAnswer(answer, min, max)).toBeCloseTo(expected, 10);
    });

    test('values outside the scale are clamped to 0..100', () => {
        expect(normalizeAnswer(9, 1, 5)).toBe(100);
        expect(normalizeAnswer(-3, 1, 5)).toBe(0);
    });

    test('a scale with no range (min equals max) gives null, never NaN or Infinity', () => {
        expect(normalizeAnswer(3, 3, 3)).toBeNull();
    });

    test('an inverted scale gives null', () => {
        expect(normalizeAnswer(3, 5, 1)).toBeNull();
    });

    test('non-finite inputs give null', () => {
        expect(normalizeAnswer(Number.NaN, 1, 5)).toBeNull();
        expect(normalizeAnswer(3, Number.NaN, 5)).toBeNull();
        expect(normalizeAnswer(3, 1, Number.POSITIVE_INFINITY)).toBeNull();
    });
});

describe('dimensionNormalizedScore', () => {
    test('is the mean of the normalized answers', () => {
        expect(
            dimensionNormalizedScore([
                { answer: 4, scaleMin: 1, scaleMax: 5 },
                { answer: 2, scaleMin: 1, scaleMax: 5 },
            ])
        ).toBe(50);
    });

    test('questions on different scales are normalized before they are averaged', () => {
        // 4 of 1..5 is 75, and 3 of 0..10 is 30. Their mean is 52.5.
        expect(
            dimensionNormalizedScore([
                { answer: 4, scaleMin: 1, scaleMax: 5 },
                { answer: 3, scaleMin: 0, scaleMax: 10 },
            ])
        ).toBe(52.5);
    });

    test('a question with a degenerate scale is left out, not scored as zero', () => {
        expect(
            dimensionNormalizedScore([
                { answer: 3, scaleMin: 2, scaleMax: 2 },
                { answer: 4, scaleMin: 1, scaleMax: 5 },
            ])
        ).toBe(75);
    });

    test('no usable answer gives null, so the dimension is not reported as zero', () => {
        expect(dimensionNormalizedScore([])).toBeNull();
        expect(dimensionNormalizedScore([{ answer: 3, scaleMin: 2, scaleMax: 2 }])).toBeNull();
    });
});

describe('dimensionRawScore', () => {
    test('is the mean of the raw answers, rounded to two decimals', () => {
        expect(dimensionRawScore([4, 2])).toBe(3);
        expect(dimensionRawScore([1, 2, 2])).toBe(1.67);
    });

    test('is 0 when there are no answers (the existing report contract)', () => {
        expect(dimensionRawScore([])).toBe(0);
    });
});

describe('weightedComposite', () => {
    test('with no weights, it is the plain mean', () => {
        expect(weightedComposite([{ score: 40 }, { score: 80 }])).toBe(60);
    });

    test('with weights, it is sum(w * s) / sum(w)', () => {
        // (1 * 40 + 3 * 80) / 4 = 70
        expect(
            weightedComposite([
                { score: 40, weight: 1 },
                { score: 80, weight: 3 },
            ])
        ).toBe(70);
    });

    test('equal weights give the same result as no weights', () => {
        expect(
            weightedComposite([
                { score: 40, weight: 2 },
                { score: 80, weight: 2 },
            ])
        ).toBe(60);
    });

    test('dimensions without a score are left out', () => {
        expect(weightedComposite([{ score: null }, { score: 40 }, { score: 80 }])).toBe(60);
    });

    test('no scored dimension gives null', () => {
        expect(weightedComposite([])).toBeNull();
        expect(weightedComposite([{ score: null }])).toBeNull();
    });

    test('missing, zero, negative or non-finite weights count as zero, and all-zero weights fall back to the mean', () => {
        expect(
            weightedComposite([
                { score: 40, weight: 0 },
                { score: 80, weight: -5 },
                { score: 60, weight: Number.NaN },
            ])
        ).toBe(60);
    });
});

describe('percentileRank (midrank)', () => {
    test('a value above some of the cohort, equal to one, counts half of the equal', () => {
        // below = 2 (10, 20), equal = 1 (50), n = 4: (2 + 0.5) / 4 * 100
        expect(percentileRank(50, [10, 20, 50, 80])).toBe(62.5);
    });

    test('the lowest and highest values of the cohort', () => {
        expect(percentileRank(5, [10, 20])).toBe(0);
        expect(percentileRank(100, [10, 20])).toBe(100);
    });

    test('a single candidate is at the 50th percentile', () => {
        expect(percentileRank(70, [70])).toBe(50);
    });

    test('an empty cohort or a non-finite value gives null', () => {
        expect(percentileRank(50, [])).toBeNull();
        expect(percentileRank(Number.NaN, [10, 20])).toBeNull();
    });
});

describe('performanceBand boundaries', () => {
    test.each([
        [0, 'LOW'],
        [19.99, 'LOW'],
        [20, 'BELOW_AVERAGE'],
        [39.99, 'BELOW_AVERAGE'],
        [40, 'AVERAGE'],
        [59.99, 'AVERAGE'],
        [60, 'ABOVE_AVERAGE'],
        [79.99, 'ABOVE_AVERAGE'],
        [80, 'HIGH'],
        [100, 'HIGH'],
    ])('percentile %p is %p', (percentile, band) => {
        expect(performanceBand(percentile)).toBe(band);
    });

    test('no percentile gives no band', () => {
        expect(performanceBand(null)).toBeNull();
    });
});

describe('cohortStatistics', () => {
    test('even count: mean, median (average of the middle pair) and population standard deviation', () => {
        // values 60, 70, 80, 90: mean 75, median 75, population variance 125, sd sqrt(125) = 11.18
        expect(cohortStatistics([90, 60, 80, 70])).toEqual({
            count: 4,
            mean: 75,
            median: 75,
            stdDev: 11.18,
            min: 60,
            max: 90,
        });
    });

    test('odd count: the median is the middle value', () => {
        // values 10, 20, 60: mean 30, median 20, population variance 466.67, sd 21.6
        expect(cohortStatistics([60, 10, 20])).toEqual({
            count: 3,
            mean: 30,
            median: 20,
            stdDev: 21.6,
            min: 10,
            max: 60,
        });
    });

    test('a single value has zero spread', () => {
        expect(cohortStatistics([42])).toEqual({ count: 1, mean: 42, median: 42, stdDev: 0, min: 42, max: 42 });
    });

    test('an empty cohort gives null', () => {
        expect(cohortStatistics([])).toBeNull();
    });
});
