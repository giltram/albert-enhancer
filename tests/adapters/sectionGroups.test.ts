// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { hasComponentFilters, optionsForSectionGroup, readSectionGroup } from '../../src/adapters/albert/sectionGroups';
import { solveSchedules } from '../../src/core/schedule';

function load(file: string): void {
  document.body.innerHTML = readFileSync(`tests/fixtures/albert/${file}`, 'utf8');
}
function section(index: number): Element {
  return document.getElementById(`win0divNYU_CLS_DTL_CLASS_NBR$${index}`)!;
}

describe('linked Albert component groups', () => {
  it('pairs both Machine Learning lectures with their own recitation', () => {
    load('logged-in-machine-learning.html');
    expect(readSectionGroup(section(1))?.choices[0]?.sections.map((child) => child.section.classNumber)).toEqual(['18020']);
    const wang = readSectionGroup(section(3))!;
    expect(wang.choices[0]?.sections.map((child) => child.section.classNumber)).toEqual(['18022']);
    expect(readSectionGroup(section(2))).toBeUndefined();
    const options = optionsForSectionGroup(wang, ['CSCI-SHU 360:004']);
    expect(options[0]?.sectionIds).toEqual(['CSCI-SHU 360:003', 'CSCI-SHU 360:004']);
    expect(options[0]?.meetings).toHaveLength(3);
  });

  it('retains multiple labs as alternative complete options with separate teachers', () => {
    load('linked-programming.html');
    const group = readSectionGroup(section(0))!;
    expect(group.choices.map((choice) => [choice.componentType, choice.sections.length])).toEqual([['lab', 6]]);
    const options = optionsForSectionGroup(group, ['CSCI-SHU 11:002', 'CSCI-SHU 11:003']);
    expect(options).toHaveLength(2);
    expect(options[0]?.instructors).toEqual([{ name: 'Gu, Xianbin' }, { name: 'Feng, Jingyi' }]);
    const schedules = solveSchedules({ intents: [{ courseId: 'CSCI-SHU 11', required: true }], options, registration: { optionStatuses: {}, excludedOptionIds: [] } });
    expect(schedules).toHaveLength(2);
    expect(schedules.every((schedule) => schedule.options.length === 1 && schedule.options[0]?.components?.filter((component) => component.componentType === 'lab').length === 1)).toBe(true);
  });

  it('requires one recitation and one lab when both types appear', () => {
    load('linked-programming.html');
    section(1).querySelector('div:last-of-type')!.textContent = 'Component: Recitation';
    const group = readSectionGroup(section(0))!;
    expect(optionsForSectionGroup(group, ['CSCI-SHU 11:003'])).toEqual([]);
    const options = optionsForSectionGroup(group, ['CSCI-SHU 11:002', 'CSCI-SHU 11:003', 'CSCI-SHU 11:004']);
    expect(options).toHaveLength(2);
    expect(options.every((option) => option.sectionIds.length === 3)).toBe(true);
  });

  it('rejects an overlapping lecture and lab without saving an incomplete lecture', () => {
    load('linked-programming.html');
    section(1).innerHTML = section(1).innerHTML.replace('Wed 12.45 PM - 2.35 PM', 'Tue 9.45 AM - 11.35 AM');
    const group = readSectionGroup(section(0))!;
    expect(optionsForSectionGroup(group, ['CSCI-SHU 11:002'])).toEqual([]);
    expect(optionsForSectionGroup(group, [])).toEqual([]);
  });

  it('does not cross a term list or unreadable section boundary', () => {
    load('linked-programming.html');
    const list = section(0).closest('[id="win0divSELECT_CLASS$0"]')!;
    list.insertAdjacentHTML('afterend', '<div id="win0divSELECT_CLASS$9"></div>');
    document.getElementById('win0divSELECT_CLASS$9')!.append(section(6).parentElement!);
    expect(readSectionGroup(section(0))?.choices[0]?.sections).toHaveLength(5);
    section(1).textContent = 'Unreadable section';
    expect(readSectionGroup(section(0))).toBeUndefined();
  });

  it('flags component filters that can hide required linked sections', () => {
    load('linked-programming.html');
    document.body.insertAdjacentHTML('afterbegin', '<select id="NYU_CLS_WRK_SSR_COMPONENT$27$"><option>Lecture</option><option value=""> </option></select>');
    expect(hasComponentFilters(section(0))).toBe(true);
    document.querySelector('select')!.value = '';
    expect(hasComponentFilters(section(0))).toBe(false);
  });
});
