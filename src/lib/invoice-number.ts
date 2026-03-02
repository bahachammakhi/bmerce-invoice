import { PrismaClient } from '@/generated/prisma';

export async function generateNextInvoiceNumber(db: PrismaClient, userId: string): Promise<string> {
  // Get the latest invoice for this user
  const latestInvoice = await db.invoice.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: { number: true },
  });

  if (!latestInvoice) {
    // First invoice for this user
    return 'INV-001';
  }

  // Try to extract number from existing invoice number
  const match = latestInvoice.number.match(/(\d+)$/);
  
  if (match) {
    const lastNumber = parseInt(match[1], 10);
    const nextNumber = lastNumber + 1;
    const prefix = latestInvoice.number.replace(/\d+$/, '');
    return `${prefix}${nextNumber.toString().padStart(3, '0')}`;
  }

  // Fallback to timestamp-based if we can't parse the number
  return `INV-${Date.now().toString().slice(-6)}`;
}

export async function validateInvoiceNumber(db: PrismaClient, number: string, userId: string, excludeId?: string): Promise<boolean> {
  const existing = await db.invoice.findFirst({
    where: {
      number,
      userId,
      ...(excludeId && { id: { not: excludeId } }),
    },
  });

  return !existing; // Return true if no existing invoice found (valid)
}

export function formatInvoiceNumber(number: string): string {
  // Return the number exactly as the user entered it — no prefix added
  return number;
}