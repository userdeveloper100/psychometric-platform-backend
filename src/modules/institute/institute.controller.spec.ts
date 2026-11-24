import * as instituteController from './institute.controller';
import * as instituteService from './institute.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./institute.service');
jest.mock('../../config/prisma', () => ({
    __esModule: true,
    default: { institute: { count: jest.fn().mockResolvedValue(7) } },
}));

const svc = instituteService as jest.Mocked<typeof instituteService>;
const meta = { total: 7, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

describe('institute.controller', () => {
    describe('createInstitute', () => {
        test('201 on success', async () => {
            svc.createInstitute.mockResolvedValue({ id: 'i1' } as any);
            const req = mockRequest({ body: { name: 'Acme', email: 'a@b.com' } });
            const res = mockResponse();

            await instituteController.createInstitute(req, res);

            expect(statusCode(res)).toBe(201);
        });

        test('400 when fields missing', async () => {
            const req = mockRequest({ body: { name: 'Acme' } });
            const res = mockResponse();

            await instituteController.createInstitute(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('409 on duplicate email', async () => {
            svc.createInstitute.mockRejectedValue(new Error('Institute with this email already exists'));
            const req = mockRequest({ body: { name: 'Acme', email: 'a@b.com' } });
            const res = mockResponse();

            await instituteController.createInstitute(req, res);

            expect(statusCode(res)).toBe(409);
        });
    });

    describe('getInstitutes', () => {
        test('200 paginated from service meta', async () => {
            svc.getInstitutes.mockResolvedValue({ data: [{ id: 'i1' }], meta } as any);
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await instituteController.getInstitutes(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(7);
        });
    });

    describe('getAllInstitutes', () => {
        test('200 paginated from prisma count', async () => {
            svc.getAllInstitutes.mockResolvedValue([{ id: 'i1' }] as any);
            const req = mockRequest({ query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await instituteController.getAllInstitutes(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(7);
        });
    });

    describe('getInstituteById', () => {
        test('404 when not found', async () => {
            svc.getInstituteById.mockRejectedValue(new Error('Institute not found'));
            const req = mockRequest({ params: { id: 'i1' } });
            const res = mockResponse();

            await instituteController.getInstituteById(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('200 on success', async () => {
            svc.getInstituteById.mockResolvedValue({ id: 'i1' } as any);
            const req = mockRequest({ params: { id: 'i1' } });
            const res = mockResponse();

            await instituteController.getInstituteById(req, res);

            expect(statusCode(res)).toBe(200);
        });
    });

    describe('updateInstitute', () => {
        test('200 on success', async () => {
            svc.updateInstitute.mockResolvedValue({ id: 'i1', name: 'New' } as any);
            const req = mockRequest({ params: { id: 'i1' }, body: { name: 'New' }, user: { userId: 'u1' } });
            const res = mockResponse();

            await instituteController.updateInstitute(req, res);

            expect(statusCode(res)).toBe(200);
        });
    });

    describe('deleteInstitute', () => {
        test('404 when not found', async () => {
            svc.deleteInstitute.mockRejectedValue(new Error('Institute not found'));
            const req = mockRequest({ params: { id: 'i1' }, user: { userId: 'u1' } });
            const res = mockResponse();

            await instituteController.deleteInstitute(req, res);

            expect(statusCode(res)).toBe(404);
        });
    });

    // SEC-02: the tenant scope comes only from req.user. Query and body instituteId values are ignored.
    describe('SEC-02 tenant scope from req.user', () => {
        const adminA = { userId: 'u1', role: 'ADMIN', instituteId: 'institute-a' };
        const spoof = 'institute-b';

        test('getInstituteById passes the requester institute, ignoring a spoofed query instituteId', async () => {
            svc.getInstituteById.mockResolvedValue({ id: 'institute-a' } as any);
            const req = mockRequest({ params: { id: 'institute-a' }, query: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await instituteController.getInstituteById(req, res);

            expect(svc.getInstituteById).toHaveBeenCalledWith('institute-a', 'institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('getInstituteById maps another institute to 404', async () => {
            svc.getInstituteById.mockRejectedValue(new Error('Institute not found'));
            const req = mockRequest({ params: { id: spoof }, user: adminA });
            const res = mockResponse();

            await instituteController.getInstituteById(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('updateInstitute forwards only the name from the body and the requester institute', async () => {
            svc.updateInstitute.mockResolvedValue({ id: 'institute-a' } as any);
            const req = mockRequest({
                params: { id: 'institute-a' },
                body: { name: 'New', instituteId: spoof },
                user: adminA,
            });
            const res = mockResponse();

            await instituteController.updateInstitute(req, res);

            expect(svc.updateInstitute).toHaveBeenCalledWith('institute-a', { name: 'New' }, 'u1', 'institute-a');
            expect(statusCode(res)).toBe(200);
        });

        test('updateInstitute maps another institute to 404', async () => {
            svc.updateInstitute.mockRejectedValue(new Error('Institute not found'));
            const req = mockRequest({ params: { id: spoof }, body: { name: 'Hijack' }, user: adminA });
            const res = mockResponse();

            await instituteController.updateInstitute(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('deleteInstitute passes the requester institute and maps another institute to 404', async () => {
            svc.deleteInstitute.mockRejectedValue(new Error('Institute not found'));
            const req = mockRequest({ params: { id: spoof }, body: { instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await instituteController.deleteInstitute(req, res);

            expect(svc.deleteInstitute).toHaveBeenCalledWith(spoof, 'u1', 'institute-a');
            expect(statusCode(res)).toBe(404);
        });

        test('getAllInstitutes lists only the requester institute, ignoring a spoofed query instituteId', async () => {
            svc.getAllInstitutes.mockResolvedValue([{ id: 'institute-a' }] as any);
            const req = mockRequest({ query: { page: '1', limit: '10', instituteId: spoof }, user: adminA });
            const res = mockResponse();

            await instituteController.getAllInstitutes(req, res);

            expect(svc.getAllInstitutes).toHaveBeenCalledWith({ page: 1, limit: 10, instituteId: 'institute-a' });
            expect(statusCode(res)).toBe(200);
        });
    });
});
