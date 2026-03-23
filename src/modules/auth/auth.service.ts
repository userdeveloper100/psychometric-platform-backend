import prisma from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { Prisma } from '@prisma/client';
import { generateToken } from '../../utils/jwt';


interface RegisterInstituteAdminInput {
    instituteName: string;
    email: string;
    password: string;
}

interface LoginInput {
    email: string;
    password: string;
}

export async function registerInstituteAdmin({
    instituteName,
    email,
    password
}: RegisterInstituteAdminInput) {
    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const { user } = await prisma.$transaction(async (tx) => {
            // 1. Create institute
            const institute = await tx.institute.create({
                data: { name: instituteName, email }
            });

            // 2,3,4. Create ADMIN user linked to institute with hashed password
            const userRecord = await tx.user.create({
                data: {
                    email,
                    password: hashedPassword,
                    role: "ADMIN",
                    instituteId: institute.id
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
