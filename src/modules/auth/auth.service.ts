import prisma from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { generateToken } from '../../utils/jwt';


interface RegisterInstituteAdminInput {
    instituteName: string;
    email: string;
    password: string;
    createdBy?: string;
}

interface LoginInput {
    email: string;
    password: string;
}

interface GetAllUsersOptions {
    page?: number;
    limit?: number;
    instituteId: string;
}

export async function registerInstituteAdmin({
    instituteName,
    email,
    password,
    createdBy
}: RegisterInstituteAdminInput) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const { user } = await prisma.$transaction(async (tx) => {
            // 1. Create institute
            const institute = await tx.institute.create({
                data: { name: instituteName, email, createdBy }
            });

            // 2,3,4. Create ADMIN user linked to institute with hashed password
            const userRecord = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: "ADMIN",
                    instituteId: institute.id,
                    createdBy
                },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    instituteId: true
                }
            });

            return { institute, user: userRecord };
        });

        // 5. Generate JWT token
        const token = generateToken({
            userId: user.id,
            role: user.role,
            instituteId: user.instituteId
        });

        // 6. Return token and user info
        return { token, user };
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            throw new Error('Email already registered');
        }
        throw new Error('Failed to register institute admin');
    }
}

export async function login({ email, password }: LoginInput) {
    try {
        // 1. Find user by email
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            throw new Error('Invalid credentials');
        }

        // 2. Compare password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            throw new Error('Invalid credentials');
        }

        // 3. Generate JWT token
        const token = generateToken({
            userId: user.id,
            role: user.role,
            instituteId: user.instituteId
        });

        // 4. Return token and user data
        return {
            token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                instituteId: user.instituteId
            }
        };
    } catch (error) {
        if (error instanceof Error && error.message === 'Invalid credentials') {
            throw error;
        }
        throw new Error('Login failed');
    }
}

/**
 * Step 12 release gate: the user list is limited to the requester's institute. It used to list the users of every
 * institute. Fail-closed: an empty scope throws and never queries.
 */
export async function getAllUsers({
    page = 1,
    limit = 10,
    instituteId
}: GetAllUsersOptions) {
    if (!instituteId) throw new Error('Institute scope is required');
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.user.findMany({
        where: { isActive: true, instituteId },
        skip,
        take: currentLimit,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            email: true,
            role: true,
            instituteId: true,
            createdAt: true,
            updatedAt: true
        }
    });
}

// Not routed. Scoped anyway (Step 12 release gate): an admin can only deactivate a user of their own institute.
export async function deleteUser(userId: string, adminId: string, instituteId: string) {
    if (!instituteId) throw new Error('Institute scope is required');
    const user = await prisma.user.findFirst({
        where: { id: userId, instituteId, isActive: true }
    });
    
    if (!user) {
        throw new Error('User not found');
    }
    
    return prisma.user.update({
        where: { id: userId },
        data: {
            isActive: false,
            updatedBy: adminId,
            updatedAt: new Date()
        }
    });
}
