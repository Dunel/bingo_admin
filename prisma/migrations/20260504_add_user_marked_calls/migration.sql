CREATE TABLE "UserMarkedCall" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "UserMarkedCall_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserMarkedCall_userId_number_key" ON "UserMarkedCall"("userId", "number");
CREATE INDEX "UserMarkedCall_userId_idx" ON "UserMarkedCall"("userId");

ALTER TABLE "UserMarkedCall"
  ADD CONSTRAINT "UserMarkedCall_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
