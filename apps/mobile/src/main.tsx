import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/big-shoulders-display';
import '@fontsource-variable/instrument-sans';
import '@plyo/tokens/tokens.css';
import './mobile.css';
import { App } from './App.tsx';
import { initNative, isNative } from './native.ts';

document.documentElement.classList.toggle('native', isNative);
void initNative();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
