-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'USER');

-- CreateEnum
CREATE TYPE "ImageMimeType" AS ENUM ('IMAGE_JPG', 'IMAGE_JPEG', 'IMAGE_PNG');

-- CreateEnum
CREATE TYPE "BingoCardStatus" AS ENUM ('UPLOADED', 'PROCESSED', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BingoCard" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sourceImageUrl" TEXT NOT NULL,
    "sourceMimeType" "ImageMimeType" NOT NULL,
    "status" "BingoCardStatus" NOT NULL DEFAULT 'UPLOADED',
    "detectedGrid" JSONB,
    "correctedGrid" JSONB,
    "markedNumbers" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "aiConfidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BingoCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "BingoCard_userId_idx" ON "BingoCard"("userId");

-- CreateIndex
CREATE INDEX "BingoCard_status_idx" ON "BingoCard"("status");

-- AddForeignKey
ALTER TABLE "BingoCard" ADD CONSTRAINT "BingoCard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;



