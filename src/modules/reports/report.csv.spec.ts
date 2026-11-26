import { buildTestReportCsv, csvCell } from './report.csv';

describe('csvCell', () => {
    test('plain text is not quoted', () => {
        expect(csvCell('Jane Doe')).toBe('Jane Doe');
    });

    test('text with a comma, a quote or a line break is quoted, and quotes are doubled', () => {
        expect(csvCell('Doe, Jane')).toBe('"Doe, Jane"');
        expect(csvCell('say "hi"')).toBe('"say ""hi"""');
        expect(csvCell('line\nbreak')).toBe('"line\nbreak"');
    });

    test.each(['=HYPERLINK("http://x")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd'])(
        'text that starts with a formula character (%j) is prefixed with an apostrophe',
        (value) => {
            expect(csvCell(value).replace(/^"|"$/g, '').startsWith("'")).toBe(true);
        }
    );

    test('numbers are never prefixed, so a negative score stays a number', () => {
        expect(csvCell(-5)).toBe('-5');
        expect(csvCell(62.5)).toBe('62.5');
    });

    test('null, undefined and non-finite numbers are empty cells', () => {
        expect(csvCell(null)).toBe('');
        expect(csvCell(undefined)).toBe('');
        expect(csvCell(Number.NaN)).toBe('');
    });
});

describe('buildTestReportCsv', () => {
    const report = {
        cohort: {
            dimensionAverages: [
                { dimensionId: 'd1', dimensionName: 'Openness' },
                { dimensionId: 'd2', dimensionName: 'Stability' },
            ],
        },
        students: [
            {
                studentId: 's1',
                studentName: 'Jane, Doe',
                status: 'COMPLETED',
                compositeScore: 62.5,
                percentileRank: 50,
                performanceBand: 'AVERAGE',
                dimensions: [
                    { dimensionId: 'd1', normalizedScore: 75 },
                    { dimensionId: 'd2', normalizedScore: 50 },
                ],
            },
            {
                studentId: 's2',
                studentName: 'Pending Candidate',
                status: 'PENDING',
                compositeScore: null,
                percentileRank: null,
                performanceBand: null,
                dimensions: [{ dimensionId: 'd1', normalizedScore: null }],
            },
        ],
    };

    test('header, one row per student, CRLF line endings and a trailing newline', () => {
        const csv = buildTestReportCsv(report);
        expect(csv).toBe(
            [
                'studentId,studentName,status,compositeScore,percentileRank,performanceBand,Openness (normalized),Stability (normalized)',
                's1,"Jane, Doe",COMPLETED,62.5,50,AVERAGE,75,50',
                's2,Pending Candidate,PENDING,,,,,',
            ].join('\r\n') + '\r\n'
        );
    });

    test('a dimension a student has no score for is an empty cell, in the dimension column order', () => {
        const csv = buildTestReportCsv(report);
        const pendingRow = csv.split('\r\n')[2];
        expect(pendingRow.split(',').length).toBe(8);
    });

    test('an empty cohort gives the header only', () => {
        const csv = buildTestReportCsv({ cohort: { dimensionAverages: [] }, students: [] });
        expect(csv).toBe('studentId,studentName,status,compositeScore,percentileRank,performanceBand\r\n');
    });

    test('a candidate name that starts with a formula is neutralised in the export', () => {
        const csv = buildTestReportCsv({
            cohort: { dimensionAverages: [] },
            students: [
                {
                    studentId: 's9',
                    studentName: '=cmd|"/c calc"!A0',
                    status: 'COMPLETED',
                    compositeScore: 1,
                    percentileRank: 1,
                    performanceBand: 'LOW',
                    dimensions: [],
                },
            ],
        });
        expect(csv).toContain(`s9,"'=cmd|""/c calc""!A0",COMPLETED`);
    });
});
