import prisma from '../../config/prisma';
import { Prisma } from '@prisma/client';
import logger from '../../config/logger';

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface CreateStudentInput {
    name: string;
    email: string;
}

interface GetStudentsOptions {
    page?: number;
    limit?: number;
    search?: string;
}

<<<<<<< HEAD
interface GetAllStudentsOptions {
    page?: number;
    limit?: number;
}

// ─── Get Students (Paginated) ─────────────────────────────────────────────────

export async function getStudents(
    instituteId: string,
    { page = 1, limit = 10, search = '' }: GetStudentsOptions = {}
) {
    logger.info('Fetching students', { instituteId, page, limit });
    try {
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const skip = (page - 1) * safeLimit;

        const where: Prisma.StudentWhereInput = {
            instituteId,
            isActive: true,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        const [total, students] = await prisma.$transaction([
            prisma.student.count({ where }),
            prisma.student.findMany({
                where,
                skip,
                take: safeLimit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    instituteId: true,
                    createdAt: true
                }
            })
        ]);

        const totalPages = Math.ceil(total / safeLimit);

        logger.info('Students fetched', { instituteId, total });
        return {
            data: students,
            meta: {
                total,
                page,
                limit: safeLimit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    } catch (error) {
        logger.error('Failed to fetch students', {
            error: error instanceof Error ? error.message : error
        });
        throw new Error('Failed to fetch students');
    }
}

=======
>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
// ─── Create Student ───────────────────────────────────────────────────────────

export async function createStudent(
    instituteId: string,
    data: CreateStudentInput,
    userId: string
) {
    logger.info('Creating student', { instituteId, email: data.email });
    try {
        // Check duplicate email within the same institute (tenant-scoped)
        const existing = await prisma.student.findFirst({
            where: {
                email: data.email,
                instituteId,
                isActive: true
            }
        });

        if (existing) {
            throw new Error('Student email already exists in this institute');
        }

        const student = await prisma.student.create({
            data: {
                name: data.name,
                email: data.email,
                instituteId,
                isActive: true,
                createdBy: userId
            }
        });

        logger.info('Student created', { studentId: student.id });
        return student;
    } catch (error) {
        logger.error('Failed to create student', {
            error: error instanceof Error ? error.message : error
        });
        if (error instanceof Error) throw error;
        throw new Error('Failed to create student');
    }
}

// ─── Bulk Upload Students ─────────────────────────────────────────────────────

export async function bulkUploadStudents(
    instituteId: string,
    students: CreateStudentInput[],
    userId: string
) {
    logger.info('Bulk uploading students', { instituteId, count: students.length });
    try {
        if (!students.length) {
            throw new Error('No students provided for bulk upload');
        }

        // Fetch existing active emails in this institute to detect duplicates
        const existingEmails = await prisma.student.findMany({
            where: {
                instituteId,
                isActive: true,
                email: { in: students.map((s) => s.email) }
            },
            select: { email: true }
        });

        const existingEmailSet = new Set(existingEmails.map((s) => s.email));

        // Filter out duplicates
        const newStudents = students.filter(
            (s) => !existingEmailSet.has(s.email)
        );

        const skippedCount = students.length - newStudents.length;

        if (!newStudents.length) {
            return {
                createdCount: 0,
                skippedCount,
                message: 'All students already exist'
            };
        }

        // Bulk insert using createMany
        const result = await prisma.student.createMany({
            data: newStudents.map((s) => ({
                name: s.name,
                email: s.email,
                instituteId,
                isActive: true,
                createdBy: userId
            })),
            skipDuplicates: true
        });

        logger.info('Bulk upload complete', {
            created: result.count,
            skipped: skippedCount
        });

        return {
            createdCount: result.count,
            skippedCount,
            message: `${result.count} students created, ${skippedCount} skipped`
        };
    } catch (error) {
        logger.error('Bulk upload failed', {
            error: error instanceof Error ? error.message : error
        });
        if (error instanceof Error) throw error;
        throw new Error('Failed to bulk upload students');
    }
}

<<<<<<< HEAD
=======
// ─── Get Students (Paginated) ─────────────────────────────────────────────────

export async function getStudents(
    instituteId: string,
    { page = 1, limit = 10, search = '' }: GetStudentsOptions = {}
) {
    logger.info('Fetching students', { instituteId, page, limit });
    try {
        const safeLimit = Math.min(Math.max(limit, 1), 100);
        const skip = (page - 1) * safeLimit;

        const where: Prisma.StudentWhereInput = {
            instituteId,
            isActive: true,
            ...(search && {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            })
        };

        const [total, students] = await prisma.$transaction([
            prisma.student.count({ where }),
            prisma.student.findMany({
                where,
                skip,
                take: safeLimit,
                orderBy: { createdAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    email: true,
                    instituteId: true,
                    createdAt: true
                }
            })
        ]);

        const totalPages = Math.ceil(total / safeLimit);

        logger.info('Students fetched', { instituteId, total });
        return {
            data: students,
            meta: {
                total,
                page,
                limit: safeLimit,
                totalPages,
                hasNextPage: page < totalPages,
                hasPreviousPage: page > 1
            }
        };
    } catch (error) {
        logger.error('Failed to fetch students', {
            error: error instanceof Error ? error.message : error
        });
        throw new Error('Failed to fetch students');
    }
}

>>>>>>> 11519917377035306673a076a7e613f111ba9d8f
// ─── Soft Delete Student ──────────────────────────────────────────────────────

export async function deleteStudent(
    studentId: string,
    instituteId: string,
    userId: string
) {
    logger.info('Soft deleting student', { studentId, userId });
    try {
        // Tenant-scoped lookup before delete
        const student = await prisma.student.findFirst({
            where: {
                id: studentId,
                instituteId,
                isActive: true
            }
        });

        if (!student) {
            throw new Error('Student not found');
        }

        const updated = await prisma.student.update({
            where: { id: studentId },
            data: {
                isActive: false,
                updatedBy: userId
            }
        });

        logger.info('Student soft deleted', { studentId });
        return updated;
    } catch (error) {
        logger.error('Failed to delete student', {
            error: error instanceof Error ? error.message : error,
            studentId
        });
        if (error instanceof Error) throw error;
        throw new Error('Failed to delete student');
    }
}
