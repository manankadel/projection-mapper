import './style.css';

function showError(msg: string) {
  const el = document.getElementById('app');
  if (el) {
    el.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:#ff3366;font-family:system-ui;padding:40px;text-align:center">
        <div>
          <h1 style="font-size:24px;margin-bottom:12px">Projection Mapper</h1>
          <p style="color:#888;font-size:14px;margin-bottom:16px">${msg}</p>
          <p style="color:#555;font-size:12px">Open Chrome DevTools (Cmd+Option+I) → Console for details</p>
        </div>
      </div>`;
  }
}

async function init() {
  try {
    const { UI } = await import('./ui/UI');
    const canvas = document.getElementById('gl-canvas') as HTMLCanvasElement;
    if (!canvas) { showError('Canvas element not found in HTML'); return; }

    // @ts-ignore
    window.ui = new UI(canvas);

    try {
      const { Chatbot } = await import('./ui/Chatbot');
      // @ts-ignore
      window.chatbot = new Chatbot();
    } catch (e) { console.warn('Chatbot init failed:', e); }

    try {
      const { ContentTemplateEngine } = await import('./ui/ContentTemplates');
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
    } catch (e) { console.warn('Template engine init failed:', e); }

    try {
      const { SurfaceScanner } = await import('./ui/SurfaceScanner');
      // @ts-ignore
      window.surfaceScanner = new SurfaceScanner((surfaces: any[]) => {
        surfaces.forEach((s: any) => {
          // @ts-ignore
          window.ui.addScannedSurface(s.points, s.color);
        });
      });
    } catch (e) { console.warn('Surface scanner init failed:', e); }

    try {
      const { PhysicalSetupGuide } = await import('./ui/PhysicalSetupGuide');
      // @ts-ignore
      window.setupGuide = new PhysicalSetupGuide();
    } catch (e) { console.warn('Setup guide init failed:', e); }

    try {
      const { Onboarding } = await import('./ui/Onboarding');
      if (!Onboarding.hasCompleted()) {
        // @ts-ignore
        window.onboarding = new Onboarding(() => {
          const answers = Onboarding.getSavedAnswers();
          // @ts-ignore
          if (window.chatbot) window.chatbot.setContext(answers);
        });
      } else {
        const answers = Onboarding.getSavedAnswers();
        // @ts-ignore
        if (window.chatbot) window.chatbot.setContext(answers);
      }
      window.addEventListener('onboarding:test-pattern', ((e: CustomEvent) => {
        // @ts-ignore
        window.ui.setTestPattern(e.detail.type);
      }) as EventListener);
    } catch (e) { console.warn('Onboarding init failed:', e); }

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

    console.log('Projection Mapper initialized successfully');
  } catch (e: any) {
    console.error('Init failed:', e);
    showError(e.message || 'Failed to initialize');
  }
}

init();
