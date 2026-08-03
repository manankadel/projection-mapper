import { UI } from './ui/UI';
import { Onboarding } from './ui/Onboarding';
import { Chatbot } from './ui/Chatbot';
import { SurfaceScanner } from './ui/SurfaceScanner';
import { ContentTemplateEngine } from './ui/ContentTemplates';
import { PhysicalSetupGuide } from './ui/PhysicalSetupGuide';
import './style.css';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
if (!canvas) throw new Error('Canvas not found');

// @ts-ignore - expose globally for inline event handlers
window.ui = new UI(canvas);

// Initialize chatbot
// @ts-ignore
window.chatbot = new Chatbot();

// Initialize content template engine
const templateEngine = new ContentTemplateEngine();
// @ts-ignore
window.templateEngine = templateEngine;

// Populate template menu
const templateMenu = document.getElementById('templateMenu');
if (templateMenu) {
  const templates = templateEngine.getTemplates();
  const categories = templateEngine.getCategories();
  let html = '';
  for (const cat of categories) {
    html += `<div class="dropdown-header">${cat}</div>`;
    for (const t of templates.filter(t => t.category === cat)) {
      html += `<button onclick="ui.applyTemplate('${t.id}')">${t.icon} ${t.name}</button>`;
    }
  }
  templateMenu.innerHTML = html;
}

// Initialize surface scanner
// @ts-ignore
window.surfaceScanner = new SurfaceScanner((surfaces) => {
  // When surfaces are scanned, create them in the app
  // @ts-ignore
  surfaces.forEach(s => {
    // Convert scanned points to surface coordinates
    // @ts-ignore
    window.ui.addScannedSurface(s.points, s.color);
  });
});

// Initialize physical setup guide
// @ts-ignore
window.setupGuide = new PhysicalSetupGuide();

// Show onboarding if first time
if (!Onboarding.hasCompleted()) {
  // @ts-ignore
  window.onboarding = new Onboarding(() => {
    const answers = Onboarding.getSavedAnswers();
    // @ts-ignore
    window.chatbot.setContext(answers);
  });
} else {
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
