import { parseCourse } from './courseParser';
import { ALBERT_SELECTORS } from './selectors';

const sensitive = [
  /\bN\d{8}\b/gi,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,
  /\b(?:student\s*id|netid|gpa|grade)\s*[:#]?\s*[^<\n]+/gi,
];

function redact(value: string): string {
  return sensitive.reduce((result, pattern) => result.replace(pattern, '[REDACTED]'), value);
}

/** Export canonical parser inputs, preserving ordered course/term lists without portal DOM. */
export function captureSanitizedFixture(root: ParentNode): string {
  const doc = root instanceof Document ? root : root.ownerDocument ?? document;
  const container = doc.createElement('main');
  const lists = new Map<Element, Element>();
  for (const source of root.querySelectorAll(ALBERT_SELECTORS.courseRoot)) {
    const parsed = parseCourse(source);
    let parent: Element = container;
    const list = source.closest(ALBERT_SELECTORS.loggedSectionList);
    if (list !== null) {
      let target = lists.get(list);
      if (target === undefined) {
        target = doc.createElement('section');
        target.id = `win0divSELECT_CLASS$${lists.size}`;
        lists.set(list, target);
        container.append(target);
      }
      parent = target;
    }
    const article = doc.createElement('article');
    article.dataset.aeCourse = '';
    // Keep unreadable rows as barriers: omitting one could create an incomplete group.
    if (parsed === undefined) { parent.append(article); continue; }
    if (parsed.term !== undefined) article.dataset.aeTerm = parsed.term;
    const field = (name: string, value: string | undefined): void => {
      if (value === undefined) return;
      const node = doc.createElement('div');
      node.dataset.aeField = name;
      node.textContent = redact(value);
      article.append(node);
    };
    field('course-code', parsed.course.code);
    field('course-title', parsed.course.title);
    field('section-code', parsed.section.sectionCode);
    field('class-number', parsed.section.classNumber);
    field('component', parsed.section.componentType);
    field('location', parsed.information.location);
    for (const instructor of parsed.section.instructors ?? []) field('instructor', instructor.name);
    field('prerequisite', parsed.information.prerequisite);
    field('extra-fee', parsed.information.extraFee);
    field('special-rule', parsed.information.specialRule);
    for (const meeting of parsed.section.meetings) {
      // Use minute-derived 24-hour text accepted by the canonical parser.
      const clock = (minute: number) => `${Math.floor(minute / 60)}:${String(minute % 60).padStart(2, '0')}`;
      const node = doc.createElement('div');
      node.dataset.aeField = 'meeting';
      node.textContent = `${meeting.day} ${clock(meeting.startMinute)}-${clock(meeting.endMinute)}`;
      if (meeting.location !== undefined) node.dataset.aeMeetingLocation = redact(meeting.location);
      article.append(node);
    }
    for (const label of parsed.information.degreeLabels ?? []) field('degree-label', label);
    parent.append(article);
  }
  for (const campus of root.querySelectorAll(ALBERT_SELECTORS.campusSelect)) {
    const copy = campus.cloneNode(true) as Element;
    for (const unsafe of copy.querySelectorAll('script, style, iframe, object, embed')) unsafe.remove();
    for (const element of [copy, ...copy.querySelectorAll('*')]) {
      for (const attribute of [...element.attributes]) {
        if (!['data-ae-campus', 'id', 'name', 'value', 'disabled', 'selected'].includes(attribute.name)) element.removeAttribute(attribute.name);
      }
    }
    container.append(copy);
  }
  return redact(container.innerHTML);
}
