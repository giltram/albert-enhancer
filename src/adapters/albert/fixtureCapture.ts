import { ALBERT_SELECTORS } from './selectors';

const sensitive = [
  /\bN\d{8}\b/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:student\s*id|netid|gpa|grade)\s*[:#]?\s*[^<\n]+/gi,
];

function redact(value: string): string {
  return sensitive.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value);
}

/** Captures only parser inputs, not the surrounding student portal. */
export function captureSanitizedFixture(root: ParentNode): string {
  const container = document.createElement('main');
  for (const course of root.querySelectorAll(ALBERT_SELECTORS.courseRoot)) container.append(course.cloneNode(true));
  for (const campus of root.querySelectorAll(ALBERT_SELECTORS.campusSelect)) container.append(campus.cloneNode(true));
  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    for (const attribute of [...element.attributes]) {
      if (!['data-ae-course', 'data-ae-field', 'data-ae-campus', 'id', 'name', 'value', 'disabled', 'selected'].includes(attribute.name)) element.removeAttribute(attribute.name);
    }
  }
  return redact(container.innerHTML);
}
