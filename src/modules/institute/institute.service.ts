import prisma from '../../config/prisma';

interface CreateInstituteInput {
    name: string;
    email: string;
}

export async function createInstitute({ name, email }: CreateInstituteInput) {
    const existing = await prisma.institute.findUnique({ where: { email } });
    if (existing) throw new Error('Institute email already exists');
    return prisma.institute.create({ data: { name, email } });
}
