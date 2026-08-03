import { UI } from './ui/UI';
import { Onboarding } from './ui/Onboarding';
import { Chatbot } from './ui/Chatbot';
import './style.css';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// @ts-ignore - expose globally for inline event handlers
window.ui = new UI(canvas);

// Initialize chatbot
// @ts-ignore
window.chatbot = new Chatbot();

// Show onboarding if first time
if (!Onboarding.hasCompleted()) {
  // @ts-ignore
  window.onboarding = new Onboarding(() => {
    const answers = Onboarding.getSavedAnswers();
    // @ts-ignore
    window.chatbot.setContext(answers);
    // @ts-ignore
    if (answers.resolution) {
      // @ts-ignore
      window.showManager?.setOutputResolution(answers.resolution.w, answers.resolution.h);
    }
  });
} else {
  // Load saved preferences
  const answers = Onboarding.getSavedAnswers();
  // @ts-ignore
  window.chatbot.setContext(answers);
}

// Listen for onboarding test pattern requests
window.addEventListener('onboarding:test-pattern', ((e: CustomEvent) => {
  // @ts-ignore
  window.ui.setTestPattern(e.detail.type);
}) as EventListener);

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
