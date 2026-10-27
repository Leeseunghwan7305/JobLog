-- CreateTable
CREATE TABLE "CompanyProfile" (
    "companyName" TEXT NOT NULL,
    "nps" JSONB,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompanyProfile_pkey" PRIMARY KEY ("companyName")
);
