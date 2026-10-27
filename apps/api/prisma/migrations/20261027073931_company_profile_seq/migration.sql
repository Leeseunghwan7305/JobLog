/*
  Warnings:

  - The primary key for the `CompanyProfile` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `companyName` on the `CompanyProfile` table. All the data in the column will be lost.
  - Added the required column `name` to the `CompanyProfile` table without a default value. This is not possible if the table is not empty.
  - Added the required column `seq` to the `CompanyProfile` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "CompanyProfile" DROP CONSTRAINT "CompanyProfile_pkey",
DROP COLUMN "companyName",
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "seq" TEXT NOT NULL,
ADD CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("seq");
