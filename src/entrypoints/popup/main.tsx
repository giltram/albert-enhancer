import React from 'react';
import ReactDOM from 'react-dom/client';
import './style.css';

function Popup(): React.JSX.Element {
  return <main><h1>Albert Enhancer <small>v{browser.runtime.getManifest().version}</small></h1><p>Understand courses. Prepare better schedules.</p><div className="ae-popup-navigation">
    <button type="button" className="ae-navigation-button" onClick={() => { void browser.tabs.create({ url: browser.runtime.getURL('/planner.html') }); }}>Schedule Lab</button>
    <button type="button" className="ae-navigation-button" onClick={() => { void browser.tabs.create({ url: browser.runtime.getURL('/degree.html') }); }}>Degree Planner</button>
    <button type="button" className="ae-navigation-button" onClick={() => { void browser.tabs.create({ url: browser.runtime.getURL('/options.html') }); }}>Settings</button>
  </div></main>;
}

ReactDOM.createRoot(document.querySelector('#root')!).render(<React.StrictMode><Popup /></React.StrictMode>);
