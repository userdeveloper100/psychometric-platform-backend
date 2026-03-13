import prisma from '../../config/prisma';

interface CreateStudentInput {
    name: string;
    email: string;
    instituteId: string;
}

export async function createStudent({ name, email, instituteId }: CreateStudentInput) {
    const existing = await prisma.student.findUnique({ where: { email } });
    if (existing) throw new Error('Student email already exists');
    return prisma.student.create({ data: { name, email, instituteId } });
}

export async function bulkUploadStudents(students: CreateStudentInput[]) {
    const created = [];
    for (const student of students) {
        try {
            const s = await createStudent(student);
            created.push(s);
        } catch (err) {
            // skip duplicates
        }
    }
    return created;
}
