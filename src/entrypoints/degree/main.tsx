import React, { useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { CourseProgress, DegreePlanEntry } from '../../core/curriculum';
import { degreeProgressColumns, dependencyWarnings, evaluateCurriculum } from '../../core/curriculum';
import { csPrerequisites, nyushComputerScience, nyushCsEconomics, nyushEconomics } from '../../curricula/nyush';
import { degreePlanItem } from '../../storage/degreePlan';
import './style.css';

const initialEntries = await degreePlanItem.getValue();
const curricula = [nyushCsEconomics, nyushComputerScience, nyushEconomics];
const labels: Record<CourseProgress, string> = { taken: 'Taken', 'in-progress': 'In Progress', planned: 'Planned' };

function App(): React.JSX.Element {
  const [entries, setEntries] = useState<readonly DegreePlanEntry[]>(initialEntries);
  const [curriculumId, setCurriculumId] = useState(nyushCsEconomics.id);
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [term, setTerm] = useState('');
  const curriculum = curricula.find((item) => item.id === curriculumId)!;
  const coverage = useMemo(() => evaluateCurriculum(curriculum, entries), [curriculum, entries]);
  const warnings = useMemo(() => dependencyWarnings(entries, csPrerequisites), [entries]);
  const persist = (next: readonly DegreePlanEntry[]): void => { setEntries(next); void degreePlanItem.setValue(next); };
  const setProgress = (id: string, progress: CourseProgress): void => persist(entries.map((entry) => entry.courseId === id ? { ...entry, progress } : entry));
  const addCourse = (): void => {
    const normalized = courseId.trim().toLocaleUpperCase('en-US');
    if (normalized.length === 0 || entries.some((entry) => entry.courseId === normalized)) return;
    persist([...entries, { courseId: normalized, progress: 'planned', credits: 4, ...(title.trim() ? { title: title.trim() } : {}), ...(term.trim() ? { term: term.trim() } : {}) }]);
    setCourseId(''); setTitle(''); setTerm('');
  };

  return <main><header><div><p>ALBERT ENHANCER</p><h1>Degree Planner</h1></div><select value={curriculumId} onChange={(event) => setCurriculumId(event.target.value)}>{curricula.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select></header>
    <section className="add"><input aria-label="Course code" placeholder="Course code" value={courseId} onChange={(event) => setCourseId(event.target.value)} /><input aria-label="Course title" placeholder="Title (optional)" value={title} onChange={(event) => setTitle(event.target.value)} /><input aria-label="Term" placeholder="Fall 2027" value={term} onChange={(event) => setTerm(event.target.value)} /><button onClick={addCourse}>Add planned course</button></section>
    <div className="board">{degreeProgressColumns.map((progress) => <section className="column" data-progress={progress} key={progress} onDragOver={(event) => event.preventDefault()} onDrop={(event) => setProgress(event.dataTransfer.getData('text/plain'), progress)}><h2>{labels[progress]}</h2>{entries.filter((entry) => entry.progress === progress).map((entry) => <article draggable onDragStart={(event) => event.dataTransfer.setData('text/plain', entry.courseId)} key={entry.courseId}><b>{entry.courseId}</b><span>{entry.title ?? 'Untitled course'}</span>{entry.term !== undefined && <small>{entry.term}</small>}<div><select aria-label={`${entry.courseId} status`} value={entry.progress} onChange={(event) => setProgress(entry.courseId, event.target.value as CourseProgress)}>{degreeProgressColumns.map((option) => <option value={option} key={option}>{labels[option]}</option>)}</select><button aria-label={`Remove ${entry.courseId}`} onClick={() => persist(entries.filter((item) => item.courseId !== entry.courseId))}>×</button></div></article>)}</section>)}
      <section className="column remaining"><h2>Remaining</h2>{coverage.map((item) => <article key={item.requirementId} className={item.satisfied ? 'done' : ''}><b>{item.label}</b><span>{item.unit === 'manual' ? 'Needs manual verification' : `${item.completed} / ${item.needed} ${item.unit}`}</span>{item.needsManualVerification && <small>Policy note — verify with advisor</small>}</article>)}</section>
    </div>
    {warnings.length > 0 && <section className="warnings"><h2>Dependency warnings</h2>{warnings.map((warning) => <p key={warning.courseId}><b>{warning.courseId}</b> is missing {warning.result.missingGroups.map((group) => group.join(' or ')).join('; ')}{warning.result.needsManualVerification ? ' (a documented manual alternative may apply)' : ''}.</p>)}</section>}
  </main>;
}

ReactDOM.createRoot(document.querySelector('#root')!).render(<React.StrictMode><App /></React.StrictMode>);
