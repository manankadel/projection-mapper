import { UI } from './ui/UI';
import { Onboarding } from './ui/Onboarding';
import { Chatbot } from './ui/Chatbot';
import { SurfaceScanner } from './ui/SurfaceScanner';
import { ContentTemplateEngine } from './ui/ContentTemplates';
import { PhysicalSetupGuide } from './ui/PhysicalSetupGuide';
import { DemoManager } from './demos/DemoManager';
import './style.css';

console.log('[Main] Script started');

const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
console.log('[Main] Canvas:', canvas);
if (!canvas) {
  document.body.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ff3366;font-family:system-ui;font-size:20px">Canvas not found — check HTML</div>';
  throw new Error('Canvas not found');
}

try {
  // @ts-ignore
  window.ui = new UI(canvas);
  console.log('[Main] UI created successfully');
  // Auto-restore last show so the projector picks up where we left off
  try {
    // @ts-ignore
    window.ui.loadShow();
    console.log('[Main] Show restored from localStorage');
  } catch (e) {
    console.warn('[Main] Show restore:', e);
  }
} catch (e: any) {
  console.error('[Main] UI init failed:', e);
  document.body.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ff3366;font-family:system-ui;padding:40px;text-align:center"><div><h1 style="font-size:24px;margin-bottom:12px">Projection Mapper</h1><p style="color:#888;font-size:14px;margin-bottom:16px">${e.message}</p><p style="color:#555;font-size:12px">Open DevTools (Cmd+Option+I) → Console</p></div></div>`;
  throw e;
}

try {
  // @ts-ignore
  window.chatbot = new Chatbot();
  console.log('[Main] Chatbot created');
} catch (e) { console.warn('[Main] Chatbot:', e); }

try {
  const templateEngine = new ContentTemplateEngine();
  // @ts-ignore
  window.templateEngine = templateEngine;
  // @ts-ignore
  ui.setTemplateEngine(templateEngine);
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
  console.log('[Main] Template engine created');
} catch (e) { console.warn('[Main] Templates:', e); }

try {
  // @ts-ignore
  window.demoManager = new DemoManager();
  // @ts-ignore
  ui.demoManager = window.demoManager;
  // @ts-ignore
  window.demoManager.registerDemos(ui.contentManager, ui.renderer);
  const demoMenu = document.getElementById('demoMenu');
  if (demoMenu) {
    const demos = // @ts-ignore
      window.demoManager.getDemos();
    demoMenu.innerHTML = demos.map((d: any) =>
      `<button onclick="ui.assignDemo('${d.id}')">${d.icon} ${d.name}</button>`
    ).join('');
  }
  window.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) {
      // @ts-ignore
      window.demoManager?.stopActiveDemo();
    } else {
      // @ts-ignore
      window.demoManager?.startActiveDemo();
    }
  });
  console.log('[Main] Demo manager created');
} catch (e) { console.warn('[Main] Demos:', e); }

try {
  // @ts-ignore
  window.surfaceScanner = new SurfaceScanner((surfaces) => {
    surfaces.forEach(s => {
      // @ts-ignore
      window.ui.addScannedSurface(s.points, s.color);
    });
  });
  console.log('[Main] Surface scanner created');
} catch (e) { console.warn('[Main] Scanner:', e); }

try {
  // @ts-ignore
  window.setupGuide = new PhysicalSetupGuide();
  console.log('[Main] Setup guide created');
} catch (e) { console.warn('[Main] Setup guide:', e); }

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
  console.log('[Main] Onboarding created');
} catch (e) { console.warn('[Main] Onboarding:', e); }

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

console.log('[Main] Initialization complete');