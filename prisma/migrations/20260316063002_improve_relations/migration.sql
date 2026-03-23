/*
  Warnings:

  - A unique constraint covering the columns `[testId,studentId]` on the table `TestInvite` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "TestInvite" ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Dimension_testId_idx" ON "Dimension"("testId");

-- CreateIndex
CREATE INDEX "PsychometricTest_instituteId_idx" ON "PsychometricTest"("instituteId");

-- CreateIndex
CREATE INDEX "Question_dimensionId_idx" ON "Question"("dimensionId");

-- CreateIndex
CREATE INDEX "Response_studentId_idx" ON "Response"("studentId");

-- CreateIndex
CREATE INDEX "Response_questionId_idx" ON "Response"("questionId");

-- CreateIndex
CREATE INDEX "Student_instituteId_idx" ON "Student"("instituteId");

-- CreateIndex
CREATE INDEX "TestInvite_testId_idx" ON "TestInvite"("testId");

-- CreateIndex
CREATE INDEX "TestInvite_studentId_idx" ON "TestInvite"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "TestInvite_testId_studentId_key" ON "TestInvite"("testId", "studentId");

-- CreateIndex
CREATE INDEX "User_instituteId_idx" ON "User"("instituteId");

-- AddForeignKey
ALTER TABLE "Response" ADD CONSTRAINT "Response_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
