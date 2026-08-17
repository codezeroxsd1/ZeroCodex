-- Verifica y activa la cuenta cliente123.demo@zero.local
UPDATE "user" 
SET "emailVerified" = true, "updatedAt" = NOW()
WHERE "email" = 'cliente123.demo@zero.local';

-- Ver resultado
SELECT id, email, name, "emailVerified", role FROM "user" 
WHERE "email" = 'cliente123.demo@zero.local';
