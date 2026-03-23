export type UserRole = 'ADMIN' | 'STUDENT';

export interface JwtPayload {
    userId: string;
    role: UserRole;
}
