export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'RECRUITER' | 'EVALUATOR' | 'STUDENT';

export interface JwtPayload {
    userId: string;
    role: UserRole;
}
