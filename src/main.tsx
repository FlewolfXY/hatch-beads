import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { initTrack, track } from './lib/track';
import { initialShare } from './lib/share';

initTrack();
if (initialShare) track('open-invite');

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
