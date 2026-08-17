-- Create verificationToken table for better-auth emailOTP plugin
CREATE TABLE IF NOT EXISTS "verificationToken" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "token" TEXT NOT NULL UNIQUE,
  "type" TEXT NOT NULL,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS "idx_verificationToken_email" ON "verificationToken"("email");
CREATE INDEX IF NOT EXISTS "idx_verificationToken_token" ON "verificationToken"("token");
CREATE INDEX IF NOT EXISTS "idx_verificationToken_expiresAt" ON "verificationToken"("expiresAt");
