import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export interface User {
  id: number;
  email: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export const UserModel = {
  createUser: async (data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) => {
    return await prisma.user.create({
      data,
    });
  },

  findUserByEmail: async (email: string) => {
    return await prisma.user.findUnique({
      where: { email },
    });
  },

  updateUser: async (id: number, data: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>) => {
    return await prisma.user.update({
      where: { id },
      data,
    });
  },

  deleteUser: async (id: number) => {
    return await prisma.user.delete({
      where: { id },
    });
  },
};