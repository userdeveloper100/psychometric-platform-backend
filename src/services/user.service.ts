import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { User } from '../models/user.model';

export class UserService {
    private prisma: PrismaClient;

    constructor() {
        this.prisma = new PrismaClient();
    }

    async registerUser(userData: User): Promise<User> {
        const hashedPassword = await bcrypt.hash(userData.password, 10);
        const newUser = await this.prisma.user.create({
            data: {
                ...userData,
                password: hashedPassword,
            },
        });
        return newUser;
    }

    async findUserByEmail(email: string): Promise<User | null> {
        const user = await this.prisma.user.findUnique({
            where: { email },
        });
        return user;
    }

    async updateUser(id: string, userData: Partial<User>): Promise<User> {
        const updatedUser = await this.prisma.user.update({
            where: { id },
            data: userData,
        });
        return updatedUser;
    }

    async deleteUser(id: string): Promise<User> {
        const deletedUser = await this.prisma.user.delete({
            where: { id },
        });
        return deletedUser;
    }
}