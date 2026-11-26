/**
 * CSV export of a test report. Pure: takes the report that getTestReport already scoped and returns text.
 * RFC 4180 quoting, CRLF line endings. Text cells that start with = + - @ or a tab or CR are prefixed with an
 * apostrophe, so a spreadsheet cannot run them as a formula (CSV injection). Numbers are never prefixed.
 */

const FORMULA_START = /^[=+\-@\t\r]/;

export const csvCell = (value: string | number | null | undefined): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'number') return Number.isFinite(value) ? String(value) : '';

    const guarded = FORMULA_START.test(value) ? `'${value}` : value;
    return /[",\r\n]/.test(guarded) ? `"${guarded.replace(/"/g, '""')}"` : guarded;
};

export interface CsvReport {
    cohort: {
        dimensionAverages: Array<{ dimensionId: string; dimensionName: string }>;
    };
    students: Array<{
        studentId: string;
        studentName: string;
        status: string | null;
        compositeScore: number | null;
        percentileRank: number | null;
        performanceBand: string | null;
        dimensions: Array<{ dimensionId: string; normalizedScore: number | null }>;
    }>;
}

/** One row per invited student. Dimension columns use the normalized (0..100) score. */
export const buildTestReportCsv = (report: CsvReport): string => {
    const header = [
        'studentId',
        'studentName',
        'status',
        'compositeScore',
        'percentileRank',
        'performanceBand',
        ...report.cohort.dimensionAverages.map((d) => `${d.dimensionName} (normalized)`),
    ];

    const rows = report.students.map((s) => {
        const byDimension = new Map(s.dimensions.map((d) => [d.dimensionId, d.normalizedScore]));
        return [
            s.studentId,
            s.studentName,
            s.status ?? 'NOT_INVITED',
            s.compositeScore,
            s.percentileRank,
            s.performanceBand,
            ...report.cohort.dimensionAverages.map((d) => byDimension.get(d.dimensionId) ?? null),
        ].map((cell) => csvCell(cell as string | number | null));
    });

    return [header.map((h) => csvCell(h)), ...rows].map((line) => line.join(',')).join('\r\n') + '\r\n';
};
