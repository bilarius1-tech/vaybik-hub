-- «Запомнить меня»: долгая скользящая сессия
ALTER TABLE "Session" ADD COLUMN "remember" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PendingLogin" ADD COLUMN "remember" BOOLEAN NOT NULL DEFAULT false;
