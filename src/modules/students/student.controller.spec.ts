import * as studentController from './student.controller';
import * as studentService from './student.service';
import { mockRequest, mockResponse, jsonBody, statusCode } from '../../test-utils/express-mocks';

jest.mock('./student.service');
// Stub prisma so auto-mocking the service doesn't instantiate a real PrismaClient
// (the controller itself doesn't use prisma directly).
jest.mock('../../config/prisma', () => ({ __esModule: true, default: {} }));

const svc = studentService as jest.Mocked<typeof studentService>;
const authUser = { userId: 'u1', instituteId: 'i1' };
const meta = { total: 2, totalPages: 1, hasNextPage: false, hasPreviousPage: false };

describe('student.controller', () => {
    describe('getStudents', () => {
        test('200 paginated from service meta', async () => {
            svc.getStudents.mockResolvedValue({ data: [{ id: 's1' }], meta } as any);
            const req = mockRequest({ user: authUser, query: { page: '1', limit: '10' } });
            const res = mockResponse();

            await studentController.getStudents(req, res);

            expect(statusCode(res)).toBe(200);
            expect(jsonBody(res).meta.pagination.total).toBe(2);
        });

        test('401 when no institute context', async () => {
            const req = mockRequest({ query: {} });
            const res = mockResponse();

            await studentController.getStudents(req, res);

            expect(statusCode(res)).toBe(401);
        });
    });

    describe('createStudent', () => {
        test('201 on success', async () => {
            svc.createStudent.mockResolvedValue({ id: 's1' } as any);
            const req = mockRequest({ body: { name: 'Sam', email: 's@b.com' }, user: authUser });
            const res = mockResponse();

            await studentController.createStudent(req, res);

            expect(statusCode(res)).toBe(201);
        });

        test('400 when name/email missing', async () => {
            const req = mockRequest({ body: { name: 'Sam' }, user: authUser });
            const res = mockResponse();

            await studentController.createStudent(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('409 when student already exists', async () => {
            svc.createStudent.mockRejectedValue(new Error('Student with this email already exists'));
            const req = mockRequest({ body: { name: 'Sam', email: 's@b.com' }, user: authUser });
            const res = mockResponse();

            await studentController.createStudent(req, res);

            expect(statusCode(res)).toBe(409);
        });
    });

    describe('bulkUploadStudents', () => {
        test('201 on success', async () => {
            svc.bulkUploadStudents.mockResolvedValue({
                createdCount: 2,
                skippedCount: 0,
                message: '2 created',
            } as any);
            const req = mockRequest({
                body: { students: [{ name: 'A', email: 'a@b.com' }, { name: 'B', email: 'b@b.com' }] },
                user: authUser,
            });
            const res = mockResponse();

            await studentController.bulkUploadStudents(req, res);

            expect(statusCode(res)).toBe(201);
            expect(jsonBody(res).data.createdCount).toBe(2);
        });

        test('400 when students is not a non-empty array', async () => {
            const req = mockRequest({ body: { students: [] }, user: authUser });
            const res = mockResponse();

            await studentController.bulkUploadStudents(req, res);

            expect(statusCode(res)).toBe(400);
        });

        test('400 when an entry is missing fields', async () => {
            const req = mockRequest({ body: { students: [{ name: 'A' }] }, user: authUser });
            const res = mockResponse();

            await studentController.bulkUploadStudents(req, res);

            expect(statusCode(res)).toBe(400);
        });
    });

    describe('deleteStudent', () => {
        test('404 when not found', async () => {
            svc.deleteStudent.mockRejectedValue(new Error('Student not found'));
            const req = mockRequest({ params: { id: 's1' }, user: authUser });
            const res = mockResponse();

            await studentController.deleteStudent(req, res);

            expect(statusCode(res)).toBe(404);
        });

        test('200 on success', async () => {
            svc.deleteStudent.mockResolvedValue({ success: true } as any);
            const req = mockRequest({ params: { id: 's1' }, user: authUser });
            const res = mockResponse();

            await studentController.deleteStudent(req, res);

            expect(statusCode(res)).toBe(200);
        });
    });
});
