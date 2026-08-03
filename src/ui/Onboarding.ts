export class Onboarding {
  private container: HTMLElement;
  private currentStep = 0;
  private onComplete: () => void;
  private answers: Record<string, any> = {};

  constructor(onComplete: () => void) {
    this.onComplete = onComplete;
    this.container = document.createElement('div');
    this.container.id = 'onboarding';
    document.body.appendChild(this.container);
    this.render();
  }

  private render() {
    const steps = this.getSteps();
    const step = steps[this.currentStep];

    this.container.innerHTML = `
      <div class="onboarding-overlay">
        <div class="onboarding-modal">
          <div class="onboarding-progress">
            ${steps.map((_, i) => `<div class="progress-dot ${i <= this.currentStep ? 'active' : ''}"></div>`).join('')}
          </div>

          <div class="onboarding-step">
            <div class="step-icon">${step.icon}</div>
            <h2>${step.title}</h2>
            <p class="step-desc">${step.description}</p>
            <div class="step-content">${step.content()}</div>
          </div>

          <div class="onboarding-actions">
            ${this.currentStep > 0 ? '<button class="btn" onclick="onboarding.prev()">Back</button>' : '<div></div>'}
            <div class="actions-right">
              ${step.skip ? '<button class="btn btn-ghost" onclick="onboarding.skip()">Skip</button>' : ''}
              <button class="btn btn-accent" onclick="onboarding.next()">${step.buttonText || 'Next'}</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getSteps() {
    return [
      {
        icon: '🔌',
        title: 'Welcome to Projection Mapper',
        description: 'Let\'s get your projector connected and configured. This takes about 2 minutes.',
        content: () => `
          <div class="setup-checklist">
            <div class="check-item" id="check-power">
              <span class="check-icon">⏳</span>
              <span>Is your projector powered on?</span>
            </div>
            <div class="check-item" id="check-cable">
              <span class="check-icon">⏳</span>
              <span>Is it connected via HDMI/USB-C/DisplayPort?</span>
            </div>
            <div class="check-item" id="check-extended">
              <span class="check-icon">⏳</span>
              <span>Is your laptop using "Extend" display mode (not Mirror)?</span>
            </div>
          </div>
        `,
        buttonText: 'Let\'s Check',
        skip: false,
      },
      {
        icon: '🖥',
        title: 'Display Detection',
        description: 'I\'ll check what displays your system sees.',
        content: () => `
          <div id="display-results" class="display-results">
            <div class="loading">Scanning displays...</div>
          </div>
        `,
        buttonText: 'Continue',
        skip: false,
      },
      {
        icon: '📐',
        title: 'Projector Resolution',
        description: 'What\'s your projector\'s native resolution? This ensures pixel-perfect mapping.',
        content: () => `
          <div class="resolution-grid">
            <button class="res-btn" onclick="onboarding.setResolution(1920, 1080)">
              <span class="res-label">1080p</span>
              <span class="res-detail">1920 × 1080</span>
              <span class="res-use">Most common</span>
            </button>
            <button class="res-btn" onclick="onboarding.setResolution(1280, 720)">
              <span class="res-label">720p</span>
              <span class="res-detail">1280 × 720</span>
              <span class="res-use">Budget projectors</span>
            </button>
            <button class="res-btn" onclick="onboarding.setResolution(3840, 2160)">
              <span class="res-label">4K</span>
              <span class="res-detail">3840 × 2160</span>
              <span class="res-use">High-end</span>
            </button>
            <button class="res-btn" onclick="onboarding.setResolution(1024, 768)">
              <span class="res-label">XGA</span>
              <span class="res-detail">1024 × 768</span>
              <span class="res-use">Older projectors</span>
            </button>
          </div>
          <div class="field" style="margin-top:16px">
            <label>Or enter custom resolution</label>
            <div class="field-row">
              <input type="number" id="customW" placeholder="Width" style="width:100px">
              <span>×</span>
              <input type="number" id="customH" placeholder="Height" style="width:100px">
              <button class="btn btn-sm" onclick="onboarding.setCustomResolution()">Set</button>
            </div>
          </div>
        `,
        buttonText: 'Continue',
        skip: false,
      },
      {
        icon: '🎯',
        title: 'Test Pattern',
        description: 'I\'ll project a test pattern. Walk to your projector and check:',
        content: () => `
          <div class="test-guide">
            <div class="test-checklist">
              <label class="check-label">
                <input type="checkbox" id="test-fit"> The pattern fills the entire projection surface
              </label>
              <label class="check-label">
                <input type="checkbox" id="test-focus"> The image is in focus (sharp edges)
              </label>
              <label class="check-label">
                <input type="checkbox" id="test-keystone"> No keystone distortion (sides are parallel)
              </label>
              <label class="check-label">
                <input type="checkbox" id="test-color"> Colors look correct (not washed out)
              </label>
            </div>
            <div class="test-actions">
              <button class="btn" onclick="onboarding.showTestPattern('checker')">Checker Pattern</button>
              <button class="btn" onclick="onboarding.showTestPattern('colorbars')">Color Bars</button>
              <button class="btn" onclick="onboarding.showTestPattern('grid')">Grid with Numbers</button>
            </div>
          </div>
        `,
        buttonText: 'Looks Good',
        skip: true,
      },
      {
        icon: '🔧',
        title: 'Surface Setup',
        description: 'Now we\'ll map your content to the surface. What are you projecting onto?',
        content: () => `
          <div class="surface-type-grid">
            <button class="surface-type-btn" onclick="onboarding.setSurfaceType('flat')">
              <span class="type-icon">⬜</span>
              <span class="type-label">Flat Wall</span>
              <span class="type-desc">Simplest — just a flat surface</span>
            </button>
            <button class="surface-type-btn" onclick="onboarding.setSurfaceType('screen')">
              <span class="type-icon">🎬</span>
              <span class="type-label">Projection Screen</span>
              <span class="type-desc">Standard screen with borders</span>
            </button>
            <button class="surface-type-btn" onclick="onboarding.setSurfaceType('object')">
              <span class="type-icon">📦</span>
              <span class="type-label">3D Object</span>
              <span class="type-desc">Building, box, sculpture</span>
            </button>
            <button class="surface-type-btn" onclick="onboarding.setSurfaceType('multiple')">
              <span class="type-icon">🔲</span>
              <span class="type-label">Multiple Surfaces</span>
              <span class="type-desc">Several areas to map</span>
            </button>
          </div>
        `,
        buttonText: 'Start Mapping',
        skip: false,
      },
      {
        icon: '🚀',
        title: 'You\'re Ready',
        description: 'The app is configured. Here\'s how to use it:',
        content: () => `
          <div class="quick-start">
            <div class="qs-step">
              <span class="qs-num">1</span>
              <div>
                <strong>Drag Control Points</strong>
                <p>Click "Edit Mode" (E) then drag the blue dots to warp the image onto your surface.</p>
              </div>
            </div>
            <div class="qs-step">
              <span class="qs-num">2</span>
              <div>
                <strong>Load Your Content</strong>
                <p>Click "Load Media" to use your own images/videos, or use the built-in test patterns.</p>
              </div>
            </div>
            <div class="qs-step">
              <span class="qs-num">3</span>
              <div>
                <strong>Go Fullscreen</strong>
                <p>Press <kbd>F</kbd> to enter projection mode — all UI disappears, just the warped output.</p>
              </div>
            </div>
            <div class="qs-step">
              <span class="qs-num">4</span>
              <div>
                <strong>Ask the Assistant</strong>
                <p>Click the chat icon (?) anytime for help. I know your setup and can guide you through anything.</p>
              </div>
            </div>
          </div>
        `,
        buttonText: 'Start Using App',
        skip: false,
      },
    ];
  }

  next() {
    const steps = this.getSteps();

    // Save current step data
    this.saveStepData();

    if (this.currentStep < steps.length - 1) {
      this.currentStep++;
      this.render();

      // Run step entry actions
      if (this.currentStep === 1) this.detectDisplays();
      if (this.currentStep === 3) this.showTestPattern('checker');
    } else {
      this.complete();
    }
  }

  prev() {
    if (this.currentStep > 0) {
      this.currentStep--;
      this.render();
    }
  }

  skip() {
    this.complete();
  }

  private saveStepData() {
    switch (this.currentStep) {
      case 2:
        this.answers.resolution = this.answers.resolution || { w: 1920, h: 1080 };
        break;
      case 4:
        this.answers.surfaceType = this.answers.surfaceType || 'flat';
        break;
    }
  }

  private async detectDisplays() {
    const resultsEl = document.getElementById('display-results');
    if (!resultsEl) return;

    const screens = window.screen;

    let html = '';

    // Current screen info
    html += `
      <div class="display-card primary">
        <div class="display-name">Primary Display</div>
        <div class="display-detail">${screens.width} × ${screens.height} @ ${screens.colorDepth}-bit</div>
        <div class="display-label">← This is where the app is showing</div>
      </div>
    `;

    // Check for extended displays via Screen Details API
    try {
      const nav = navigator as any;
      if (nav.getScreenDetails) {
        const details = await nav.getScreenDetails();
        if (details.screens.length > 1) {
          details.screens.forEach((screen: any, i: number) => {
            if (i === 0) return;
            html += `
              <div class="display-card extended">
                <div class="display-name">${screen.label || `Display ${i + 1}`}</div>
                <div class="display-detail">${screen.width} × ${screen.height}</div>
                <div class="display-label">← Drag app window here for projection</div>
              </div>
            `;
          });
          this.answers.multiDisplay = true;
          this.answers.displayCount = details.screens.length;
        }
      }
    } catch (_e) {
      // Multi-screen API not available
    }

    if (!this.answers.multiDisplay) {
      html += `
        <div class="display-card warning">
          <div class="display-name">Single Display Detected</div>
          <div class="display-detail">Only one screen found</div>
          <div class="display-help">
            <p>To use with a projector:</p>
            <ul>
              <li>Connect your projector via HDMI/USB-C</li>
              <li>Set display mode to <strong>"Extend"</strong> (not Mirror)</li>
              <li>Drag this browser window to the projector display</li>
              <li>Then press <kbd>F</kbd> for fullscreen</li>
            </ul>
          </div>
        </div>
      `;
      this.answers.multiDisplay = false;
    }

    resultsEl.innerHTML = html;
  }

  showTestPattern(type: string) {
    // Dispatch custom event for the main app to handle
    window.dispatchEvent(new CustomEvent('onboarding:test-pattern', { detail: { type } }));
  }

  setResolution(w: number, h: number) {
    this.answers.resolution = { w, h };
    document.querySelectorAll('.res-btn').forEach(btn => btn.classList.remove('selected'));
    const target = event?.target as HTMLElement;
    target?.closest?.('.res-btn')?.classList.add('selected');
  }

  setCustomResolution() {
    const w = parseInt((document.getElementById('customW') as HTMLInputElement)?.value || '1920');
    const h = parseInt((document.getElementById('customH') as HTMLInputElement)?.value || '1080');
    this.setResolution(w, h);
  }

  setSurfaceType(type: string) {
    this.answers.surfaceType = type;
    document.querySelectorAll('.surface-type-btn').forEach(btn => btn.classList.remove('selected'));
    const target = event?.target as HTMLElement;
    target?.closest?.('.surface-type-btn')?.classList.add('selected');
  }

  private complete() {
    this.container.remove();
    // Save preferences
    localStorage.setItem('projmapper-onboarding', JSON.stringify(this.answers));
    this.onComplete();
  }

  getAnswers() {
    return this.answers;
  }

  static hasCompleted(): boolean {
    return !!localStorage.getItem('projmapper-onboarding');
  }

  static getSavedAnswers(): Record<string, any> {
    try {
      return JSON.parse(localStorage.getItem('projmapper-onboarding') || '{}');
    } catch {
      return {};
    }
  }
}
