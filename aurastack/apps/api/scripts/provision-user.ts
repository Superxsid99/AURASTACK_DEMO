import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";

type Role = "admin" | "operator" | "reviewer";

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const derived = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
}

function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

function domainFromEmail(email: string): string {
  const [, domain = ""] = normalizeEmail(email).split("@");
  return domain;
}

async function main(): Promise<void> {
  const prisma = new PrismaClient();
  const [emailArg, nameArg, roleArg, passwordArg] = process.argv.slice(2);
  const email = normalizeEmail(emailArg ?? "");
  const name = (nameArg ?? "").trim();
  const role = (roleArg ?? "").trim().toLowerCase() as Role;
  const password = passwordArg ?? "";

  const allowedDomains = (process.env.ACCOUNT_ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);

  if (!email || !name || !password || !role) {
    throw new Error("Usage: npm run -w apps/api provision:user -- <email> <name> <admin|operator|reviewer> <password>");
  }
  if (!["admin", "operator", "reviewer"].includes(role)) {
    throw new Error("Invalid role. Allowed: admin, operator, reviewer");
  }
  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  if (allowedDomains.length > 0 && !allowedDomains.includes(domainFromEmail(email))) {
    throw new Error(`Email domain is not allowed. Allowed domains: ${allowedDomains.join(", ")}`);
  }

  const user = await prisma.user.upsert({
    where: { email },
    create: {
      email,
      name,
      role,
      passwordHash: hashPassword(password)
    },
    update: {
      name,
      role,
      passwordHash: hashPassword(password)
    }
  });

  console.log(`Provisioned user: ${user.email} (${user.role})`);
  await prisma.$disconnect();
}

void main();
