export type DetectedRegistrationStatus = 'enrolled' | 'full' | 'waitlisted' | 'unknown';

/** Conservative display-only detection; ambiguous text always remains unknown. */
export function detectRegistrationStatus(text: string): DetectedRegistrationStatus {
  const normalized = text.trim().toLocaleLowerCase('en-US');
  if (/\b(?:not|never|cannot|can't|failed|failure|unsuccessful|must|unable|error)\b/.test(normalized)) return 'unknown';
  const matches: DetectedRegistrationStatus[] = [];
  if (/\b(enrolled|successfully enrolled)\b/.test(normalized)) matches.push('enrolled');
  if (/\b(class full|section full|closed)\b/.test(normalized)) matches.push('full');
  if (/\b(waitlisted|on the waitlist)\b/.test(normalized)) matches.push('waitlisted');
  return new Set(matches).size === 1 ? matches[0]! : 'unknown';
}
