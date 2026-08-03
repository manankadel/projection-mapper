import { UI } from './ui/UI';
import './style.css';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// @ts-ignore - expose UI globally for inline event handlers
window.ui = new UI(canvas);

// Handle show file import
document.getElementById('showFileInput')?.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    // @ts-ignore
    window.ui.importShow(file);
    input.value = '';
  }
});

// Auto-save every 30 seconds
setInterval(() => {
  // @ts-ignore
  window.ui.saveShow();
}, 30000);

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});
