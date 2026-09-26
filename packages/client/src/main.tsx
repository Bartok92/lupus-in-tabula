import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { sbloccaAudio } from './suoni';
import './stile.css';

// I browser avviano l'audio solo dopo un gesto: lo sblocchiamo al primo tocco.
window.addEventListener('pointerdown', sbloccaAudio, { once: true });

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
