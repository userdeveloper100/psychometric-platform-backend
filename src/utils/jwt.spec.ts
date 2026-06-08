import { generateToken, verifyToken, AppJwtPayload } from './jwt';

describe('jwt util', () => {
    const payload: AppJwtPayload = {
        userId: 'user-123',
        role: 'ADMIN',
        instituteId: 'inst-1',
    };

    test('generateToken produces a verifiable token round-trip', () => {
        const token = generateToken(payload);
        expect(typeof token).toBe('string');

        const decoded = verifyToken(token);
        expect(decoded.userId).toBe(payload.userId);
        expect(decoded.role).toBe(payload.role);
        expect(decoded.instituteId).toBe(payload.instituteId);
    });

    test('verifyToken throws on a tampered token', () => {
        const token = generateToken(payload);
        const tampered = token.slice(0, -2) + 'xx';
        expect(() => verifyToken(tampered)).toThrow();
    });

    test('verifyToken throws on a non-JWT string', () => {
        expect(() => verifyToken('not-a-token')).toThrow();
    });
});
