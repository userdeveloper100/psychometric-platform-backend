// Calculates dimension scores for a psychometric test
export interface QuestionResponse {
    dimensionId: string;
    answer: number;
}

export interface DimensionScore {
    dimensionId: string;
    score: number;
}

export function calculateDimensionScores(responses: QuestionResponse[]): DimensionScore[] {
    const dimensionMap: { [dimensionId: string]: number[] } = {};
    responses.forEach(({ dimensionId, answer }) => {
        if (!dimensionMap[dimensionId]) dimensionMap[dimensionId] = [];
        dimensionMap[dimensionId].push(answer);
    });
    return Object.entries(dimensionMap).map(([dimensionId, answers]) => ({
        dimensionId,
        score: answers.reduce((a, b) => a + b, 0) / answers.length,
    }));
}
