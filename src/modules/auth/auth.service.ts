import prisma from '../../config/prisma';
import bcrypt from 'bcryptjs';
import { generateToken } from '../../utils/jwt';
import { UserRole } from './auth.types';

interface RegisterInput {
    email: string;
    password: string;
    instituteId: string;
    role: UserRole;
}

export async function register({ email, password, instituteId, role }: RegisterInput) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) throw new Error('Email already registered');
    const hashed = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
        data: { email, password: hashed, instituteId, role },
        select: { id: true, email: true, role: true, instituteId: true }
    });
    return user;
}

interface LoginInput {
    email: string;
    password: string;
}

export async function login({ email, password }: LoginInput) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new Error('Invalid credentials');
    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new Error('Invalid credentials');
    const token = generateToken({ userId: user.id, role: user.role });
    return { token, user: { id: user.id, email: user.email, role: user.role, instituteId: user.instituteId } };
}
