import * as inviteController from './invite.controller';
import * as inviteService from './invite.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./invite.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { testInvite: { count: jest.fn().mockResolvedValue(4) } },
}));

const svc = inviteService as jest.Mocked<typeof inviteService>;
const authUser = { userId: 'u1', instituteId: 'i1' };

describe('invite.controller', () => {
    describe('inviteStudents', () => {
        test('201 on success', async () => {
            svc.inviteStudents.mockResolvedValue({ created: 2, skipped: 1 } as any);
            const req = mockRequest({ params: { testId: 't1' }, body: { studentIds: ['s1', 's2'] }, user: authUser });
            const res = mockResponse();

            await inviteController.inviteStudents(req, res);

            expect(statusCode(res)).toBe(201);
            expect(jsonBody(res).data).toEqual({ created: 2, skipped: 1 });
        });

        test('400 when studentIds empty', async () => {
            const req = mockRequest({ params: { testId: 't1' }, body: { studentIds: [] }, user: authUser });
            const res = mockResponse();

            await inviteController.inviteStudents(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('401 when unauthenticated', async () => {
            const req = mockRequest({ params: { testId: 't1' }, body: { studentIds: ['s1'] } });
            const res = mockResponse();

            await inviteController.inviteStudents(req, res);

            expect(statusCode(res)).toBe(401);
        });

        test('403 on access denied', async () => {
            svc.inviteStudents.mockRejectedValue(new Error('access denied'));
            const req = mockRequest({ params: { testId: 't1' }, body: { studentIds: ['s1'] }, user: authUser });
            const res = mockResponse();

            await inviteController.inviteStudents(req, res);

            expect(statusCode(res)).toBe(403);
        });
    });

    describe('getTestInvites', () => {
        test('200 with list', async () => {
            svc.getTestInvites.mockResolvedValue([{ id: 'inv1' }] as any);
            const req = mockRequest({ params: { testId: 't1' }, user: authUser });
            const res = mockResponse();

            await inviteController.getTestInvites(req, res);

            expect(statusCode(res)).toBe(200);
        });

        test('404 when not found', async () => {
            svc.getTestInvites.mockRejectedValue(new Error('Test not found'));
            const req = mockRequest({ params: { testId: 't1' }, user: authUser });
            const res = mockResponse();

            await inviteController.getTestInvites(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });

    describe('getAllInvites', () => {
        test('200 paginated', async () => {
            svc.getAllInvites.mockResolvedValue([{ id: 'inv1' }] as any);
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await inviteController.getAllInvites(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(4);
        });
    });

    describe('deleteInvite', () => {
        test('409 when invite already completed', async () => {
            svc.deleteInvite.mockRejectedValue(new Error('Cannot delete a completed invite'));
            const req = mockRequest({ params: { id: 'inv1' }, user: authUser });
            const res = mockResponse();

            await inviteController.deleteInvite(req, res);

            expect(statusCode(res)).toBe(409);
        });

        test('200 on success', async () => {
            svc.deleteInvite.mockResolvedValue({ success: true } as any);
            const req = mockRequest({ params: { id: 'inv1' }, user: authUser });
            const res = mockResponse();

            await inviteController.deleteInvite(req, res);

            expect(statusCode(res)).toBe(200);
        });
    });
});
