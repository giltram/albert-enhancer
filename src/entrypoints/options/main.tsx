import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import type { AlbertEnhancerSettings, CustomAbbreviation, HighlightSettings } from '../../features/settings';
import { deleteAllLocalData, exportLocalData, settingsItem } from '../../storage/settings';
import { campusOptionsItem } from '../../storage/campuses';
import { builtInAbbreviations } from '../../features/abbreviations';
import './style.css';

const [initialSettings, observedCampuses] = await Promise.all([settingsItem.getValue(), campusOptionsItem.getValue()]);
const extensionVersion = browser.runtime.getManifest().version;
const highlightLabels: Readonly<Record<keyof HighlightSettings, string>> = {
  time: 'Time', location: 'Location', instructor: 'Instructor', prerequisites: 'Prerequisites',
  extraFees: 'Extra fees', specialRules: 'Special rules', conflicts: 'Schedule conflicts',
  degreeClassification: 'Major requirement classification',
};

function downloadJson(contents: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([contents], { type: 'application/json' }));
  link.download = 'albert-enhancer-data.json';
  link.click();
  URL.revokeObjectURL(link.href);
}

function App(): React.JSX.Element {
  const [settings, setSettings] = useState<AlbertEnhancerSettings>(initialSettings);
  const [saved, setSaved] = useState(false);
  const update = (next: AlbertEnhancerSettings): void => { setSaved(false); setSettings(next); };
  const updateCustom = (index: number, next: CustomAbbreviation): void => {
    update({ ...settings, customAbbreviations: settings.customAbbreviations.map((item, itemIndex) => itemIndex === index ? next : item) });
  };
  const updateCampusValue = (value: string): void => {
    update({
      ...settings,
      campus: value.length === 0 ? { enabled: false } : { enabled: true, preferredValue: value },
    });
  };

  return <main>
    <header><p>ALBERT ENHANCER · v{extensionVersion}</p><h1>Settings</h1></header>
    <section>
      <label className="switch"><input type="checkbox" checked={settings.enabled} onChange={(event) => update({ ...settings, enabled: event.target.checked })} /> Albert Enhancer enabled</label>
    </section>
    <section>
      <h2>School preference</h2>
      <label className="switch"><input type="checkbox" checked={settings.campus.enabled} onChange={(event) => update({ ...settings, campus: { ...settings.campus, enabled: event.target.checked } })} /> Enable auto-select School in Course Search</label>
      <label>Default School<select value={settings.campus.preferredValue ?? ''} onChange={(event) => updateCampusValue(event.target.value)}><option value="">Other / No automatic selection</option>{observedCampuses.map((campus) => <option value={campus.value} key={campus.value}>{campus.label}</option>)}</select></label>
      <small>{observedCampuses.length === 0 ? 'Open logged-in Albert → Course Search once; the extension will learn the exact School options.' : 'School options were learned from Albert. If the saved School is absent, the current selection is preserved.'}</small>
    </section>
    <section>
      <h2>Default semester tab</h2>
      <label>Default semester<input value={settings.preferredTerm ?? ''} placeholder="Spring 2027" onChange={(event) => update({ ...settings, preferredTerm: event.target.value })} /></label>
      <small>Enter the semester tab label shown above your Albert shopping cart, such as Spring 2027. It is selected once each time you open the page; you can still switch tabs afterward. Leave blank to turn this off. If the semester is unavailable, the current tab is preserved.</small>
    </section>
    <section>
      <h2>Custom abbreviations</h2>
      <p><strong>Built in:</strong> {Object.entries(builtInAbbreviations).map(([key, value]) => `${key} → ${value}`).join(' · ')}</p>
      <label className="switch"><input type="checkbox" checked={settings.abbreviationExpansion} onChange={(event) => update({ ...settings, abbreviationExpansion: event.target.checked })} /> Abbreviation expansion</label>
      {settings.customAbbreviations.map((item, index) => <div className="abbreviation-row" key={index}>
        <input aria-label={`Abbreviation ${index + 1}`} value={item.abbreviation} placeholder="EAP" onChange={(event) => updateCustom(index, { ...item, abbreviation: event.target.value })} />
        <span>→</span>
        <input aria-label={`Expansion ${index + 1}`} value={item.expansion} placeholder="English for Academic Purposes" onChange={(event) => updateCustom(index, { ...item, expansion: event.target.value })} />
        <label className="inline"><input type="checkbox" checked={item.enabled} onChange={(event) => updateCustom(index, { ...item, enabled: event.target.checked })} /> Enabled</label>
        <button className="quiet" onClick={() => update({ ...settings, customAbbreviations: settings.customAbbreviations.filter((_, itemIndex) => itemIndex !== index) })}>Delete</button>
      </div>)}
      <button className="secondary" onClick={() => update({ ...settings, customAbbreviations: [...settings.customAbbreviations, { abbreviation: '', expansion: '', enabled: true }] })}>Add abbreviation</button>
    </section>
    <section>
      <h2>Session timeout helper</h2>
      <label className="switch"><input type="checkbox" checked={settings.keepSessionAlive ?? false} onChange={(event) => update({ ...settings, keepSessionAlive: event.target.checked })} /> Automatically click OK on Albert session-expiry warning windows</label>
      <small>Off by default. When enabled, the extension only clicks an exact “OK” button on an NYU page that explicitly says the session is about to expire.</small>
    </section>
    <section>
      <h2>Course highlights</h2>
      <div className="checks">{Object.entries(highlightLabels).map(([key, label]) => <label key={key}><input type="checkbox" checked={settings.highlights[key as keyof HighlightSettings]} onChange={(event) => update({ ...settings, highlights: { ...settings.highlights, [key]: event.target.checked } })} /> {label}</label>)}</div>
    </section>
    <section>
      <h2>Experimental</h2>
      <label className="switch"><input type="checkbox" checked={settings.experimentalStatusDetection} onChange={(event) => update({ ...settings, experimentalStatusDetection: event.target.checked })} /> Registration status detection (display only)</label>
    </section>
    <footer>
      <button onClick={() => { void settingsItem.setValue({ ...settings, preferredTerm: settings.preferredTerm?.trim() ?? '' }).then(() => setSaved(true)); }}>{saved ? 'Saved' : 'Save settings'}</button>
      <button className="secondary" onClick={() => { void exportLocalData().then(downloadJson); }}>Export local data</button>
      <button className="danger" onClick={() => { if (confirm('Delete all Albert Enhancer local data?')) void deleteAllLocalData().then(() => location.reload()); }}>Delete all local data</button>
    </footer>
  </main>;
}

ReactDOM.createRoot(document.querySelector('#root')!).render(<React.StrictMode><App /></React.StrictMode>);
