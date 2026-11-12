import { createRoot } from 'react-dom/client';
// Base styles must load before component overrides. Keep this import above App.
import '../../../../../packages/hud/styles.css';
import './style.css';
import App from './App';
const root = createRoot(document.getElementById('root')!);
root.render(<App />);
if (import.meta.hot) import.meta.hot.dispose(() => root.unmount());
