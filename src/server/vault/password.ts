import { randomInt } from "node:crypto";

const LOWER = "abcdefghijkmnopqrstuvwxyz";
const UPPER = "ABCDEFGHJKLMNPQRSTUVWXYZ";
const DIGITS = "23456789";
const SYMBOLS = "!@#$%^&*-_=+?";

export function generatePassword(
  length = 20,
  opts?: { symbols?: boolean },
): string {
  const alphabet =
    LOWER + UPPER + DIGITS + (opts?.symbols === false ? "" : SYMBOLS);
  const chars: string[] = [
    LOWER[randomInt(LOWER.length)]!,
    UPPER[randomInt(UPPER.length)]!,
    DIGITS[randomInt(DIGITS.length)]!,
  ];
  if (opts?.symbols !== false) {
    chars.push(SYMBOLS[randomInt(SYMBOLS.length)]!);
  }
  while (chars.length < Math.max(12, length)) {
    chars.push(alphabet[randomInt(alphabet.length)]!);
  }
  // shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j]!, chars[i]!];
  }
  return chars.join("");
}
