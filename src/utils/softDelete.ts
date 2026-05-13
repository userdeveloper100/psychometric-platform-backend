import prisma from '../config/prisma';

interface SoftDeleteOptions {
  userId: string;
  cascadeRules?: Record<string, string[]>;
}

const modelFieldMap: Record<string, string> = {
  'institute': 'instituteId',
  'student': 'studentId',
  'psychometricTest': 'testId',
  'dimension': 'testId',
  'question': 'dimensionId',
  'response': 'questionId',
  'testInvite': 'studentId'
};

export async function performSoftDelete(
  model: keyof typeof prisma,
  recordId: string,
  options: SoftDeleteOptions
) {
  const { userId, cascadeRules = {} } = options;
  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const cascadeModels = cascadeRules[model as string] || [];

    for (const cascadeModel of cascadeModels) {
      const lookupField = modelFieldMap[cascadeModel] || `${cascadeModel}Id`;
      const data: Record<string, unknown> = {
        isActive: false,
        updatedBy: userId,
        updatedAt: now
      };

      await (tx[cascadeModel as keyof typeof tx] as any).updateMany({
        where: { [lookupField]: recordId },
        data
      });
    }

    const data: Record<string, unknown> = {
      isActive: false,
      updatedBy: userId,
      updatedAt: now
    };

    return (tx[model as keyof typeof tx] as any).update({
      where: { id: recordId },
      data
    });
  });
}

export async function cascadeSoftDelete(
  model: keyof typeof prisma,
  recordId: string,
  cascadeModels: string[],
  userId: string
) {
  const now = new Date();
  const data = {
    isActive: false,
    updatedBy: userId,
    updatedAt: now
  };

  return prisma.$transaction(async (tx) => {
    for (const cascadeModel of cascadeModels) {
      const lookupField = modelFieldMap[cascadeModel] || `${String(model)}Id`;
      await (tx[cascadeModel as keyof typeof tx] as any).updateMany({
        where: { [lookupField]: recordId },
        data
      });
    }

    return (tx[model as keyof typeof tx] as any).update({
      where: { id: recordId },
      data
    });
  });
}
