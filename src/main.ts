import { UI } from './ui/UI';
import { Onboarding } from './ui/Onboarding';
import { Chatbot } from './ui/Chatbot';
import { SurfaceScanner } from './ui/SurfaceScanner';
import { ContentTemplateEngine } from './ui/ContentTemplates';
import { PhysicalSetupGuide } from './ui/PhysicalSetupGuide';
import './style.css';

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
if (!canvas) {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ff3366;font-family:system-ui;font-size:20px">Canvas not found — check HTML</div>';
  throw new Error('Canvas not found');
}

try {
  // @ts-ignore
  window.ui = new UI(canvas);
  console.log('UI initialized');
} catch (e: any) {
  console.error('UI init failed:', e);
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ff3366;font-family:system-ui;padding:40px;text-align:center"><div><h1 style="font-size:24px;margin-bottom:12px">Projection Mapper</h1><p style="color:#888;font-size:14px;margin-bottom:16px">${e.message}</p><p style="color:#555;font-size:12px">Open DevTools (Cmd+Option+I) → Console</p></div></div>`;
  throw e;
}

try {
  // @ts-ignore
  window.chatbot = new Chatbot();
} catch (e) { console.warn('Chatbot:', e); }

try {
  const templateEngine = new ContentTemplateEngine();
  // @ts-ignore
  window.templateEngine = templateEngine;
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
} catch (e) { console.warn('Templates:', e); }

try {
  // @ts-ignore
  window.surfaceScanner = new SurfaceScanner((surfaces) => {
    surfaces.forEach(s => {
      // @ts-ignore
      window.ui.addScannedSurface(s.points, s.color);
    });
  });
} catch (e) { console.warn('Scanner:', e); }

try {
  // @ts-ignore
  window.setupGuide = new PhysicalSetupGuide();
} catch (e) { console.warn('Setup guide:', e); }

try {
  if (!Onboarding.hasCompleted()) {
    // @ts-ignore
    window.onboarding = new Onboarding(() => {
      const answers = Onboarding.getSavedAnswers();
      // @ts-ignore
      window.chatbot?.setContext(answers);
    });
  } else {
    const answers = Onboarding.getSavedAnswers();
    // @ts-ignore
    window.chatbot?.setContext(answers);
  }
  window.addEventListener('onboarding:test-pattern', ((e: CustomEvent) => {
    // @ts-ignore
    window.ui.setTestPattern(e.detail.type);
  }) as EventListener);
} catch (e) { console.warn('Onboarding:', e); }

document.getElementById('showFileInput')?.addEventListener('change', (e) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) {
    // @ts-ignore
    window.ui.importShow(file);
    input.value = '';
  }
});

setInterval(() => {
  // @ts-ignore
  if (window.ui) window.ui.saveShow();
}, 30000);

window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});
