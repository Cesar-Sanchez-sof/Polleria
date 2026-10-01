/**
 * Numbering for manually registered accounting journal entries.
 *
 * Manual entries are numbered with the same miscellaneous format used by the
 * seed (`MISC/YYYY/MM/NNNN`), so each month starts at 0001 and remains unique
 * in `journalEntry.code` (`@db.VarChar(20)`).
 */
import { prisma } from "@/lib/prisma";

/** Maximum length supported by `journalEntry.code`. */
const MAX_CODE_LENGTH = 20;

/** `MISC/YYYY/MM/` prefix specific to the given accounting date. */
function getPrefixForDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `MISC/${year}/${month}/`;
}

/**
 * Returns the first available `MISC/YYYY/MM/NNNN` code for the given date.
 *
 * Starts from the highest number already used in that month and increments until
 * finding an available one; if concurrent requests pick the same candidate,
 * the unique database index rejects the second one and the caller can retry.
 */
export async function generateJournalEntryCode(date: Date): Promise<string> {
  const prefix = getPrefixForDate(date);

  const existingEntries = await prisma.journalEntry.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });

  const maxNumber = existingEntries.reduce((highest, entry) => {
    const parsedNumber = Number.parseInt(entry.code.slice(prefix.length), 10);
    return Number.isNaN(parsedNumber) ? highest : Math.max(highest, parsedNumber);
  }, 0);

  for (let currentNumber = maxNumber + 1; currentNumber <= maxNumber + 50; currentNumber++) {
    const candidateCode = `${prefix}${String(currentNumber).padStart(4, "0")}`;
    if (candidateCode.length > MAX_CODE_LENGTH) break;

    const existingCode = await prisma.journalEntry.findUnique({
      where: { code: candidateCode },
      select: { id: true },
    });
    if (!existingCode) return candidateCode;
  }

  throw new Error("No se pudo generar un número de asiento disponible.");
}

// Backward-compatibility alias
