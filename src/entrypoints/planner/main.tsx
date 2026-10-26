import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { EnrollmentComponent, EnrollmentOption, Meeting, SectionComponentType, Weekday } from '../../core/courses';
import type { RegistrationEvent } from '../../core/registration';
import { analyzeCourseConflict } from '../../core/schedule';
import type { RankedSchedule } from '../../core/schedule';
import { calendarBounds, calendarPlacement } from '../../features/planner/calendarLayout';
import { calendarCourseColors, calendarCourseTitle, plannerComponentLabel } from '../../features/planner/calendarAppearance';
import { normalizePlannerData, plannerItem } from '../../storage/planner';
import { updatePlanner } from '../../storage/commands';
import type { PlannerMutation } from '../../storage/mutations';
import { useStoredValue } from '../shared/useStoredValue';
import { useSchedules } from './useSchedules';
import './style.css';

const initialData = normalizePlannerData(await plannerItem.getValue());
const shortDays: Record<Weekday, string> = { monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun' };
const componentLabels: Record<SectionComponentType, string> = { lecture: 'Lecture', recitation: 'Recitation', lab: 'Lab', seminar: 'Seminar', workshop: 'Workshop', discussion: 'Discussion', other: 'Section' };

function time(minute: number): string {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
}

function optionTime(option: EnrollmentOption): string {
  return option.meetings.map((meeting) => `${shortDays[meeting.day]} ${time(meeting.startMinute)}–${time(meeting.endMinute)}`).join(' · ') || 'Time TBA';
}

interface DisplayComponent extends EnrollmentComponent {
  readonly meetings: readonly Meeting[];
}

function componentsForOptions(options: readonly EnrollmentOption[]): readonly DisplayComponent[] {
  const components = new Map<string, DisplayComponent>();
  for (const option of options) {
    if (option.components !== undefined && option.components.length > 0) {
      for (const component of option.components) {
        if (!components.has(component.sectionId)) components.set(component.sectionId, { ...component, meetings: component.meetings ?? [] });
      }
    } else {
      for (const sectionId of option.sectionIds) {
        if (!components.has(sectionId)) components.set(sectionId, {
          sectionId,
          componentType: 'other',
          meetings: option.sectionIds.length === 1 ? option.meetings : [],
          instructors: option.sectionIds.length === 1 ? option.instructors : [],
        });
      }
    }
  }
  return [...components.values()].sort((left, right) => left.componentType.localeCompare(right.componentType) || left.sectionId.localeCompare(right.sectionId));
}

function componentTime(component: DisplayComponent): string {
  return component.meetings.map((meeting) => `${shortDays[meeting.day]} ${time(meeting.startMinute)}–${time(meeting.endMinute)}`).join(' · ') || 'Time TBA';
}

function optionMeetingEntries(option: EnrollmentOption): readonly { meeting: Meeting; component?: EnrollmentComponent }[] {
  if (option.components !== undefined && option.components.some((component) => (component.meetings?.length ?? 0) > 0)) {
    return option.components.flatMap((component) => (component.meetings ?? []).map((meeting) => ({ meeting, component })));
  }
  return option.meetings.map((meeting) => ({ meeting }));
}

function Score({ schedule }: { schedule: RankedSchedule }): React.JSX.Element {
  return <div className="score-grid">
    <span>Professor <b>{schedule.score.professorScore}</b></span><span>Time <b>{schedule.score.timeScore}</b></span>
    <span>Compact <b>{schedule.score.compactnessScore}</b></span><span>Days off <b>{schedule.score.daysOffScore}</b></span>
    <span>Robustness <b>{schedule.score.robustnessScore}</b></span><span>Sections <b>{schedule.score.sectionPreferenceScore}</b></span>
  </div>;
}

function App(): React.JSX.Element {
  const data = useStoredValue(plannerItem, initialData, normalizePlannerData);
  const [saveError, setSaveError] = useState<string>();
  const [selectedPlan, setSelectedPlan] = useState(0);
  const [lastChange, setLastChange] = useState<string>();
  const persist = (change: PlannerMutation): void => {
    void updatePlanner(change).then(() => setSaveError(undefined), (error: unknown) => setSaveError(error instanceof Error ? error.message : 'Could not save.'));
  };
  const problem = useMemo(() => ({ intents: data.intents, options: data.options, registration: data.registration.present }), [data]);
  const search = useSchedules(problem, data.preferences);
  const schedules = search?.schedules ?? [];
  const current = schedules[Math.min(selectedPlan, Math.max(0, schedules.length - 1))];
  const courseTitles = useMemo(() => new Map(data.courses.map((course) => [course.id, calendarCourseTitle(course)])), [data.courses]);
  const courseColors = useMemo(() => calendarCourseColors([
    ...data.courses.map((course) => course.id),
    ...data.options.map((option) => option.courseId),
  ]), [data.courses, data.options]);
  const candidateMeetings = current?.options.flatMap((option) => option.meetings) ?? [];
  const bounds = calendarBounds(candidateMeetings);
  const calendarSpan = bounds.endMinute - bounds.startMinute;
  const hourMarks = Array.from({ length: Math.floor(calendarSpan / 60) + 1 }, (_, index) => bounds.startMinute + index * 60);

  const removeCourse = (courseId: string): void => {
    persist({ type: 'remove', courseId });
    setSelectedPlan(0);
    setLastChange(undefined);
  };
  const registrationEvent = (event: RegistrationEvent, message: string): void => {
    const before = search?.count ?? 0;
    persist({ type: 'registration', event });
    setSelectedPlan(0);
    setLastChange(`${message} · ${before} possibilities before update`);
  };
  const toggleIntentSection = (courseId: string, field: 'preferredSectionIds' | 'requiredSectionIds' | 'excludedSectionIds', sectionId: string): void => {
    const active = !(data.intents.find((intent) => intent.courseId === courseId)?.[field] ?? []).includes(sectionId);
    persist({ type: 'section', courseId, field, sectionId, active });
    setSelectedPlan(0);
  };
  const resetIntentSections = (courseId: string): void => {
    persist({ type: 'reset-sections', courseId });
    setSelectedPlan(0);
  };
  const conflicts = data.courses
    .flatMap((left, leftIndex) => data.courses.slice(leftIndex + 1).map((right) => analyzeCourseConflict(left.id, right.id, data.options)));

  return <main>
    <header><div><p>ALBERT ENHANCER</p><h1>Schedule Lab</h1></div><div className="header-stat"><b>{search === undefined ? '…' : `${search.count}${search.complete ? '' : '+'}`}</b><span>valid schedules</span></div></header>
    {saveError !== undefined && <p role="alert">{saveError}</p>}
    {data.courses.length > 0 && <p className="change">Semester: {data.term ?? 'Unknown (legacy data). Export or remove these courses before importing a known semester.'}</p>}
    {search !== undefined && !search.complete && <p role="status" className="change">Search limit reached. Showing the best plans found so far; more plans may exist and the global best is not guaranteed. Narrow your section choices to complete the search.</p>}
    {data.courses.length === 0 ? <section className="empty"><h2>No courses yet</h2><p>Open a supported course page in Albert and choose “Add to Schedule Lab.”</p></section> : <>
      <div className="workspace">
        <aside className="courses panel">
          <div className="panel-heading"><h2 className="panel-label">COURSES</h2></div>
          {data.courses.map((course) => {
            const intent = data.intents.find((item) => item.courseId === course.id)!;
            const courseOptions = data.options.filter((option) => option.courseId === course.id);
            const components = componentsForOptions(courseOptions);
            const isMultiComponent = courseOptions.some((option) => option.sectionIds.length > 1);
            const hasComponentAlternatives = components.some((component) => components.filter((item) => item.componentType === component.componentType).length > 1);
            const hasSectionChoices = [intent.preferredSectionIds, intent.requiredSectionIds, intent.excludedSectionIds].some((ids) => (ids?.length ?? 0) > 0);
            const compatibleComponents = components.filter((component) => (intent.excludedSectionIds ?? []).includes(component.sectionId) || courseOptions.some((option) => option.sectionIds.includes(component.sectionId)
              && (intent.requiredSectionIds ?? []).every((id) => option.sectionIds.includes(id))
              && option.sectionIds.every((id) => !(intent.excludedSectionIds ?? []).includes(id))));
            return <article className="course" key={course.id}>
              <div className="course-title"><div><b>{course.code}</b><span>{course.title}</span></div><button type="button" className="remove-course" aria-label={`Remove ${course.code}`} title={`Remove ${course.code} from Schedule Lab`} onClick={() => removeCourse(course.id)}>Remove</button></div>
              <label><input type="checkbox" checked={intent.required} onChange={(event) => persist({ type: 'required', courseId: course.id, required: event.target.checked })} /> Required</label>
              {isMultiComponent ? <>{(hasComponentAlternatives || hasSectionChoices) && <div className="component-default"><span>Any compatible component by default</span><button className="tiny" onClick={() => resetIntentSections(course.id)}>Reset choices</button></div>}<div className="component-groups">{[...new Set(compatibleComponents.map((component) => component.componentType))].map((type) => <section className="component-group" key={type}>
                <h3>{componentLabels[type]}</h3>
                {compatibleComponents.filter((component) => component.componentType === type).map((component) => {
                  const preferred = intent.preferredSectionIds?.includes(component.sectionId) ?? false;
                  const required = intent.requiredSectionIds?.includes(component.sectionId) ?? false;
                  const excluded = intent.excludedSectionIds?.includes(component.sectionId) ?? false;
                  // Count imported sections before intent filtering so narrowing choices never hides their controls.
                  const hasAlternatives = components.filter((item) => item.componentType === type).length > 1;
                  return <div className={`component-row ${required ? 'required' : ''} ${excluded ? 'excluded' : ''}`} key={component.sectionId}>
                    <b>{plannerComponentLabel(component)}</b>
                    <span>{component.instructors?.map((instructor) => instructor.name).join(', ') || 'Instructor TBA'}</span>
                    <small>{componentTime(component)}</small>
                    {(hasAlternatives || preferred || required || excluded) && <div className="row-actions">
                      {(hasAlternatives || preferred) && <button className={preferred ? 'tiny active' : 'tiny'} onClick={() => toggleIntentSection(course.id, 'preferredSectionIds', component.sectionId)}>{preferred ? 'Unprefer' : 'Prefer'}</button>}
                      {(hasAlternatives || required) && <button className={required ? 'tiny active' : 'tiny'} onClick={() => toggleIntentSection(course.id, 'requiredSectionIds', component.sectionId)}>{required ? 'Any' : 'Require'}</button>}
                      {(hasAlternatives || excluded) && <button className={excluded ? 'tiny active danger' : 'tiny'} onClick={() => toggleIntentSection(course.id, 'excludedSectionIds', component.sectionId)}>{excluded ? 'Include' : 'Exclude'}</button>}
                    </div>}
                  </div>;
                })}
              </section>)}</div></> : courseOptions.map((option) => {
                const status = data.registration.present.optionStatuses[option.id] ?? 'available';
                const excluded = data.registration.present.excludedOptionIds.includes(option.id);
                return <details key={option.id}><summary>{option.sectionIds.join(' + ')} <em>{status}{excluded ? ' · excluded' : ''}</em></summary>
                  <p>{optionTime(option)}</p><div className="row-actions">
                    <button className="tiny" onClick={() => status === 'locked'
                      ? registrationEvent({ type: 'set-status', optionId: option.id, status: 'available' }, `${option.id} unlocked`)
                      : registrationEvent({ type: 'got-it', optionId: option.id }, `${option.id} locked`)}>{status === 'locked' ? 'Unlock' : 'Lock'}</button>
                    <button className="tiny" onClick={() => registrationEvent({ type: excluded ? 'include' : 'exclude', optionId: option.id }, excluded ? `${option.id} included` : `${option.id} excluded`)}>{excluded ? 'Include' : 'Exclude'}</button>
                  </div>
                </details>;
              })}
              {isMultiComponent && <details className="exact-options"><summary>Exact enrollment options ({courseOptions.length})</summary>{courseOptions.map((option) => {
                const status = data.registration.present.optionStatuses[option.id] ?? 'available';
                const excluded = data.registration.present.excludedOptionIds.includes(option.id);
                return <div className="exact-option" key={option.id}><span>{option.components?.map(plannerComponentLabel).join(' + ') ?? option.sectionIds.join(' + ')}</span><div className="row-actions"><button className="tiny" onClick={() => status === 'locked'
                  ? registrationEvent({ type: 'set-status', optionId: option.id, status: 'available' }, `${option.id} unlocked`)
                  : registrationEvent({ type: 'got-it', optionId: option.id }, `${option.id} locked`)}>{status === 'locked' ? 'Unlock exact' : 'Lock exact'}</button><button className="tiny" onClick={() => registrationEvent({ type: excluded ? 'include' : 'exclude', optionId: option.id }, `${option.id} ${excluded ? 'included' : 'excluded'}`)}>{excluded ? 'Include' : 'Exclude'}</button></div></div>;
              })}</details>}
            </article>;
          })}
        </aside>

        <section className="calendar panel">
          <div className="panel-heading"><div><small className="panel-label">CURRENT CANDIDATE</small><h2>{current === undefined ? (search === undefined ? 'Searching…' : search.complete ? 'No feasible schedule' : 'No plan found within search limit') : `Plan ${String.fromCharCode(65 + Math.min(selectedPlan, 25))}`}</h2></div></div>
          {current === undefined ? <div className="zero"><b>{search === undefined ? 'Searching…' : '0 results'}</b><p>Undo the last registration change, unlock a section, or make a course optional.</p></div> : <div className="calendar-grid" style={{ '--calendar-hours': calendarSpan / 60, '--calendar-days': 5 + Number(candidateMeetings.some((meeting) => meeting.day === 'saturday')) + Number(candidateMeetings.some((meeting) => meeting.day === 'sunday')) } as React.CSSProperties}>
            <div className="time-axis"><b aria-hidden="true">Time</b><div className="day-track">{hourMarks.map((minute) => <span className="time-label" key={minute} style={{ top: `${(minute - bounds.startMinute) / calendarSpan * 100}%` }}>{time(minute)}</span>)}</div></div>
            {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).filter((day) => !['saturday', 'sunday'].includes(day) || candidateMeetings.some((meeting) => meeting.day === day)).map((day) => <div className="day" key={day}><b>{shortDays[day]}</b><div className="day-track">{current.options.flatMap((option) => optionMeetingEntries(option).filter(({ meeting }) => meeting.day === day).map(({ meeting, component }, meetingIndex) => {
              const placement = calendarPlacement(meeting, bounds);
              const color = courseColors.get(option.courseId);
              return <div
                className={`meeting component-${component?.componentType ?? 'other'}`}
                data-course-id={option.courseId}
                data-start-minute={meeting.startMinute}
                key={`${option.id}-${component?.sectionId ?? ''}-${meeting.startMinute}-${meetingIndex}`}
                style={{
                  top: `${placement.topPercent}%`, height: `${placement.heightPercent}%`,
                  borderLeftColor: color?.border, backgroundColor: color?.background,
                }}
              >
                <strong>{courseTitles.get(option.courseId) ?? option.courseId}</strong>
                {component !== undefined && option.sectionIds.length > 1 && <small>{plannerComponentLabel(component)}</small>}
              </div>;
            }))}</div></div>)}
          </div>}
          {current !== undefined && <div className="candidate-components">{current.options.map((option) => <article key={option.id}><b>{courseTitles.get(option.courseId) ?? option.courseId}</b>{option.components !== undefined && option.components.length > 1 ? option.components.map((component) => <div key={component.sectionId}><strong>{plannerComponentLabel(component)}</strong><span>{componentTime({ ...component, meetings: component.meetings ?? [] })}</span></div>) : <span>{optionTime(option)}</span>}</article>)}</div>}
          {current !== undefined && <Score schedule={current} />}
        </section>

        <aside className="ranking panel">
          <div className="panel-heading"><h2 className="panel-label">RANKING</h2></div>
          {schedules.slice(0, 8).map((schedule, index) => <button className={`plan ${current?.id === schedule.id ? 'selected' : ''}`} key={schedule.id || 'empty'} onClick={() => setSelectedPlan(index)}><span>Plan {String.fromCharCode(65 + index)}</span><b>{schedule.score.totalScore}</b><small>robustness {schedule.score.robustnessScore}</small></button>)}
          <div className="preference"><h3>Preferences</h3>
            <label><input type="checkbox" checked={data.preferences.avoidBeforeMinute !== undefined} onChange={(event) => persist({ type: 'avoid-early', value: event.target.checked })} /> Avoid classes before 10:00</label>
            <label><input type="checkbox" checked={data.preferences.avoidFriday} onChange={(event) => persist({ type: 'avoid-friday', value: event.target.checked })} /> Avoid Friday</label>
          </div>
        </aside>
      </div>

      <section className="registration panel">
        <div className="panel-heading"><div><small>REGISTRATION SIMULATOR</small><h2>Update section outcomes</h2></div><div className="row-actions"><button className="secondary" disabled={data.registration.past.length === 0} onClick={() => { persist({ type: 'undo' }); setSelectedPlan(0); setLastChange('Last change undone'); }}>Undo</button><button className="secondary" onClick={() => registrationEvent({ type: 'reset' }, 'Registration state reset')}>Reset</button></div></div>
        {lastChange !== undefined && <p className="change">{lastChange} → {search === undefined ? '…' : `${search.count}${search.complete ? '' : '+'}`} possibilities now</p>}
        <div className="simulation-options">{data.courses.flatMap((course) => {
          const options = data.options.filter((option) => option.courseId === course.id);
          if (!options.some((option) => option.sectionIds.length > 1)) return options.map((option) => <div key={option.id}><b>{option.id}</b><div><button onClick={() => registrationEvent({ type: 'got-it', optionId: option.id }, `${option.id} Got it`)}>Got it</button><button onClick={() => registrationEvent({ type: 'full', optionId: option.id }, `${option.id} Full`)}>Full</button><button onClick={() => registrationEvent({ type: 'waitlisted', optionId: option.id }, `${option.id} Waitlisted`)}>Waitlisted</button></div></div>);
          return componentsForOptions(options).map((component) => <div key={component.sectionId}><b>{plannerComponentLabel(component)}</b><div><button onClick={() => registrationEvent({ type: 'section-got-it', sectionId: component.sectionId }, `${component.sectionId} required`)}>Got it</button><button onClick={() => registrationEvent({ type: 'section-full', sectionId: component.sectionId }, `${component.sectionId} Full`)}>Full</button><button onClick={() => registrationEvent({ type: 'section-waitlisted', sectionId: component.sectionId }, `${component.sectionId} Waitlisted`)}>Waitlisted</button></div></div>);
        })}</div>
      </section>

      <section className="possibility panel"><div className="panel-heading"><div><small>POSSIBILITY VIEW</small><h2>All component meeting times</h2></div></div><div className="possibility-grid">{data.courses.flatMap((course) => componentsForOptions(data.options.filter((option) => option.courseId === course.id)).map((component) => <div className={`component-${component.componentType}`} key={`${course.id}-${component.sectionId}`}><b>{plannerComponentLabel(component)}</b><span>{componentTime(component)}</span></div>))}</div></section>
      <section className="matrix panel"><div className="panel-heading"><div><small>CONFLICT MATRIX</small><h2>Course-pair bottlenecks</h2></div></div>
        {conflicts.length === 0 ? <p>Add at least two courses to compare option conflicts.</p> : <table><thead><tr><th>Courses</th><th>Conflict ratio</th><th>Conflicting pairs</th></tr></thead><tbody>{conflicts.map((conflict) => <tr key={`${conflict.leftCourseId}-${conflict.rightCourseId}`}><td>{conflict.leftCourseId} × {conflict.rightCourseId}</td><td><b>{Math.round(conflict.ratio * 100)}%</b></td><td>{conflict.conflictingPairs.map((pair) => `${pair.leftOptionId} × ${pair.rightOptionId}`).join(', ') || 'None'}</td></tr>)}</tbody></table>}
      </section>
    </>}
  </main>;
}

ReactDOM.createRoot(document.querySelector('#root')!).render(<React.StrictMode><App /></React.StrictMode>);
