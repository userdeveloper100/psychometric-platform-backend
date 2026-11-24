import * as inviteController from './invite.controller';
import * as inviteService from './invite.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./invite.service');

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
            svc.countInvites.mockResolvedValue(4);
            const req = mockRequest({ query: { page: '1', limit: '10' }, user: authUser });
            const res = mockResponse();

            await inviteController.getAllInvites(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(4);
        });
    });

    // SEC-05: the tenant comes only from req.user. Query, params and body values are never the scope.
    describe('SEC-05 tenant scope and foreign invites', () => {
        const adminA = { userId: 'u1', role: 'ADMIN', instituteId: 'institute-a' };
        const spoof = 'institute-b';

        test('getAllInvites lists only the requester institute, ignoring a spoofed query instituteId', async () => {
            svc.getAllInvites.mockResolvedValue([] as any);
            svc.countInvites.mockResolvedValue(0);
            const req = mockRequest({ query: { page: '1', limit: '10', instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await inviteController.getAllInvites(req, res);

            expect(svc.getAllInvites).toHaveBeenCalledWith({ page: 1, limit: 10, instituteId: 'institute-a' });
            expect(svc.countInvites).toHaveBeenCalledWith('institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('getAllInvites without an institute in the token is refused with 403', async () => {
            svc.getAllInvites.mockRejectedValue(new Error('Institute scope is required'));
            const req = mockRequest({ query: {}, user: { userId: 'u1', role: 'ADMIN' } });
            const res = mockResponse();

            await inviteController.getAllInvites(req, res);

            expect(statusCode(res)).toBe(403);
        });

        test('getTestInvites maps a test of another institute to 404', async () => {
            svc.getTestInvites.mockRejectedValue(new Error('Test not found or access denied'));
            const req = mockRequest({ params: { testId: 'test-b' }, user: adminA });
            const res = mockResponse();

            await inviteController.getTestInvites(req, res);

            expect(svc.getTestInvites).toHaveBeenCalledWith('test-b', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('getStudentInvites maps a student of another institute to 404', async () => {
            svc.getStudentInvites.mockRejectedValue(new Error('Student not found or access denied'));
            const req = mockRequest({ params: { studentId: 'student-b' }, user: adminA });
            const res = mockResponse();

            await inviteController.getStudentInvites(req, res);

            expect(svc.getStudentInvites).toHaveBeenCalledWith('student-b', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('deleteInvite passes the requester institute and maps a foreign invite to 404', async () => {
            svc.deleteInvite.mockRejectedValue(new Error('Invite not found or access denied'));
            const req = mockRequest({ params: { id: 'invite-b' }, body: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await inviteController.deleteInvite(req, res);

            expect(svc.deleteInvite).toHaveBeenCalledWith('invite-b', 'u1', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('inviteStudents ignores a body instituteId and uses the requester institute', async () => {
            svc.inviteStudents.mockResolvedValue({ created: 1, skipped: 0 } as any);
            const req = mockRequest({
                params: { testId: 't1' },
                body: { studentIds: ['s1'], instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await inviteController.inviteStudents(req, res);

            expect(svc.inviteStudents).toHaveBeenCalledWith('t1', ['s1'], 'u1', 'institute-a');
            expect(statusCode(res)).toBe(201);
        });

        test('inviteStudents for a test of another institute is refused with 404', async () => {
            svc.inviteStudents.mockRejectedValue(new Error('Test not found or access denied'));
            const req = mockRequest({ params: { testId: 'test-b' }, body: { studentIds: ['s1'] }, user: adminA });
            const res = mockResponse();

            await inviteController.inviteStudents(req, res);

            expect(statusCode(res)).toBe(404);
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
