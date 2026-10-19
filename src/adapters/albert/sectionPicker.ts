import type { AlbertSectionGroup } from './sectionGroups';
import type { ParsedAlbertCourse } from './courseParser';

export const componentNames = { recitation: 'Recitation', lab: 'Lab' } as const;

export function sectionTimeLabel(parsed: ParsedAlbertCourse): string {
  const clock = (minute: number): string => `${Math.floor(minute / 60).toString().padStart(2, '0')}:${(minute % 60).toString().padStart(2, '0')}`;
  return parsed.section.meetings.map((meeting) => `${meeting.day[0]!.toUpperCase()}${meeting.day.slice(1, 3)} ${clock(meeting.startMinute)}–${clock(meeting.endMinute)}`).join(' · ') || 'Time TBA';
}

/** No storage or registration actions: returns retained alternatives or cancel. */
export function chooseAuxiliarySections(group: AlbertSectionGroup, trigger: HTMLElement): Promise<readonly string[] | undefined> {
  const doc = trigger.ownerDocument;
  // Avoid stacking pickers when several Add buttons are clicked.
  if (doc.querySelector('[data-ae-section-picker]') !== null) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const dialog = doc.createElement('dialog');
    dialog.className = 'ae-section-picker';
    dialog.dataset.aeSectionPicker = '';
    dialog.setAttribute('aria-labelledby', 'ae-picker-heading');
    dialog.setAttribute('aria-describedby', 'ae-picker-guidance');
    const heading = doc.createElement('h2');
    heading.id = 'ae-picker-heading';
    heading.textContent = 'Keep recitation / lab options';
    const course = doc.createElement('p');
    course.className = 'ae-picker-course';
    course.textContent = `${group.primary.course.code} · ${group.primary.course.title} · ${group.primary.section.componentType} ${group.primary.section.sectionCode ?? ''}`;
    const guidance = doc.createElement('p');
    guidance.id = 'ae-picker-guidance';
    guidance.textContent = 'Keep any sections you might attend, even if they currently conflict with other courses in your plan. Uncheck only those you definitely cannot attend. You can keep one, several, or all, then resolve conflicts and choose your final sections later in Schedule Lab. Your final schedule will use one section of each required type.';
    const form = doc.createElement('form');
    const choiceList = doc.createElement('div');
    choiceList.className = 'ae-picker-choices';
    const inputs: HTMLInputElement[] = [];
    const status = doc.createElement('p');
    status.className = 'ae-picker-validation';
    status.setAttribute('aria-live', 'polite');
    const submit = doc.createElement('button');
    submit.type = 'submit';
    submit.textContent = 'Add to Schedule Lab';
    const validate = (): void => {
      const missing = group.choices.filter((choice) => !inputs.some((input) => input.name === choice.componentType && input.checked));
      submit.disabled = missing.length > 0;
      status.textContent = missing.length === 0 ? '' : `Keep at least one ${missing.map((choice) => componentNames[choice.componentType].toLowerCase()).join(' and ')} option.`;
    };
    for (const choice of group.choices) {
      const fieldset = doc.createElement('fieldset');
      const legend = doc.createElement('legend');
      legend.textContent = `${componentNames[choice.componentType]} · keep at least one`;
      fieldset.append(legend);
      const all = doc.createElement('button');
      all.type = 'button';
      all.className = 'ae-picker-select-all';
      all.textContent = 'Select all';
      all.addEventListener('click', () => {
        const groupInputs = inputs.filter((item) => item.name === choice.componentType);
        const selectAll = !groupInputs.every((input) => input.checked);
        for (const input of groupInputs) input.checked = selectAll;
        validate();
      });
      fieldset.append(all);
      for (const child of choice.sections) {
        const label = doc.createElement('label');
        label.className = 'ae-picker-option';
        const input = doc.createElement('input');
        input.type = 'checkbox';
        input.name = choice.componentType;
        input.value = child.section.id;
        input.checked = true;
        input.setAttribute('aria-label', `${componentNames[choice.componentType]} ${child.section.sectionCode ?? child.section.id}`);
        input.addEventListener('change', validate);
        inputs.push(input);
        const details = doc.createElement('span');
        const title = doc.createElement('strong');
        title.textContent = `${componentNames[choice.componentType]} ${child.section.sectionCode ?? ''}${child.section.classNumber === undefined ? '' : ` · Class #${child.section.classNumber}`}`;
        details.append(title);
        for (const value of [sectionTimeLabel(child), child.section.instructors?.map((instructor) => instructor.name).join('; ') || 'Instructor TBA', child.information.location ?? 'Location TBA']) {
          const line = doc.createElement('span');
          line.textContent = value;
          details.append(line);
        }
        label.append(input, details);
        fieldset.append(label);
      }
      choiceList.append(fieldset);
    }
    const actions = doc.createElement('div');
    actions.className = 'ae-actions';
    const cancel = doc.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => dialog.close());
    actions.append(submit, cancel);
    form.append(choiceList, status, actions);
    let selection: readonly string[] | undefined;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      validate();
      if (submit.disabled) return;
      selection = inputs.filter((input) => input.checked).map((input) => input.value);
      dialog.close();
    });
    dialog.addEventListener('close', () => {
      dialog.remove();
      resolve(selection);
    }, { once: true });
    dialog.append(heading, course, guidance, form);
    doc.body.append(dialog);
    dialog.showModal();
  });
}
