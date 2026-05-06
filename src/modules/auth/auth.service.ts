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

export async function getAllUsers({
    page = 1,
    limit = 10
}: GetAllUsersOptions = {}) {
    const currentPage = Number(page) || 1;
    const currentLimit = Number(limit) || 10;
    const skip = (currentPage - 1) * currentLimit;

    return prisma.user.findMany({
        where: { isActive: true },
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

// Add to auth.service.ts
export async function deleteUser(userId: string, adminId: string) {
    const user = await prisma.user.findFirst({
        where: { id: userId, isActive: true }
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
