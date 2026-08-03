/**
 * PhysicalSetupGuide — Helps users set up their physical projector
 * with placement calculations, throw distance, and interactive walkthrough.
 */

export interface ProjectorSpec {
  name: string;
  throwRatio: number; // distance / width
  brightness: number; // lumens
  resolution: string;
  type: 'short' | 'standard' | 'ultra-short';
}

export const PROJECTOR_DATABASE: ProjectorSpec[] = [
  { name: 'Common Short Throw', throwRatio: 0.5, brightness: 3000, resolution: '1080p', type: 'short' },
  { name: 'Standard Projector', throwRatio: 1.2, brightness: 2500, resolution: '1080p', type: 'standard' },
  { name: 'Long Throw', throwRatio: 2.0, brightness: 3500, resolution: '1080p', type: 'standard' },
  { name: 'Ultra Short Throw', throwRatio: 0.15, brightness: 2500, resolution: '4K', type: 'ultra-short' },
  { name: 'Canon LV-WX300', throwRatio: 1.46, brightness: 3000, resolution: 'WXGA', type: 'standard' },
  { name: 'Epson EB-X51', throwRatio: 1.48, brightness: 3800, resolution: 'XGA', type: 'standard' },
  { name: 'BenQ TH585P', throwRatio: 1.47, brightness: 3500, resolution: '1080p', type: 'standard' },
  { name: 'Optoma GT1080HDR', throwRatio: 0.5, brightness: 3800, resolution: '1080p', type: 'short' },
  { name: 'Samsung The Premiere', throwRatio: 0.15, brightness: 2800, resolution: '4K', type: 'ultra-short' },
];

export class PhysicalSetupGuide {
  private container: HTMLElement;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'setup-guide';
  }

  open() {
    if (!document.body.contains(this.container)) {
      document.body.appendChild(this.container);
    }
    this.renderMainView();
  }

  private renderMainView() {
    this.container.innerHTML = `
      <div class="guide-overlay">
        <div class="guide-modal">
          <div class="guide-header">
            <h2>Physical Setup Guide</h2>
            <p>Everything you need to know before you start projecting</p>
            <button class="guide-close" onclick="setupGuide.close()">×</button>
          </div>

          <div class="guide-body">
            <div class="guide-tabs">
              <button class="guide-tab active" onclick="setupGuide.showTab('placement')">Projector Placement</button>
              <button class="guide-tab" onclick="setupGuide.showTab('surfaces')">Surface Prep</button>
              <button class="guide-tab" onclick="setupGuide.showTab('bookshelf')">Bookshelf Setup</button>
              <button class="guide-tab" onclick="setupGuide.showTab('plant')">Plant Setup</button>
              <button class="guide-tab" onclick="setupGuide.showTab('objects')">Custom Objects</button>
            </div>

            <div class="guide-content" id="guideContent"></div>
          </div>
        </div>
      </div>
    `;

    this.showTab('placement');
  }

  showTab(tab: string) {
    document.querySelectorAll('.guide-tab').forEach(t => t.classList.remove('active'));
    document.querySelector(`.guide-tab:nth-child(${['placement', 'surfaces', 'bookshelf', 'plant', 'objects'].indexOf(tab) + 1})`)?.classList.add('active');

    const content = document.getElementById('guideContent')!;
    switch (tab) {
      case 'placement': content.innerHTML = this.getPlacementHTML(); break;
      case 'surfaces': content.innerHTML = this.getSurfacePrepHTML(); break;
      case 'bookshelf': content.innerHTML = this.getBookshelfHTML(); break;
      case 'plant': content.innerHTML = this.getPlantHTML(); break;
      case 'objects': content.innerHTML = this.getObjectsHTML(); break;
    }
  }

  private getPlacementHTML(): string {
    return `
      <div class="guide-section">
        <h3>Projector Throw Distance Calculator</h3>
        <p>Enter your projector model or throw ratio to calculate optimal placement.</p>

        <div class="calc-form">
          <div class="field">
            <label>Select Projector</label>
            <select id="projectorSelect" onchange="setupGuide.onProjectorSelect()">
              <option value="">-- Custom --</option>
              ${PROJECTOR_DATABASE.map((p, i) => `<option value="${i}">${p.name} (${p.throwRatio}:1)</option>`).join('')}
            </select>
          </div>

          <div class="field-row">
            <div class="field">
              <label>Throw Ratio</label>
              <input type="number" id="throwRatio" value="1.2" step="0.01" min="0.1" max="5" onchange="setupGuide.calculate()">
            </div>
            <div class="field">
              <label>Surface Width (cm)</label>
              <input type="number" id="surfaceWidth" value="200" step="10" onchange="setupGuide.calculate()">
            </div>
          </div>

          <div class="calc-result" id="calcResult">
            <div class="result-card">
              <div class="result-label">Optimal Distance</div>
              <div class="result-value" id="optimalDistance">240 cm</div>
              <div class="result-detail">from projector lens to surface</div>
            </div>
            <div class="result-card">
              <div class="result-label">Min Distance</div>
              <div class="result-value" id="minDistance">200 cm</div>
            </div>
            <div class="result-card">
              <div class="result-label">Max Distance</div>
              <div class="result-value" id="maxDistance">280 cm</div>
            </div>
          </div>

          <div class="placement-diagram" id="placementDiagram"></div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Placement Rules</h3>
        <div class="rules-grid">
          <div class="rule">
            <span class="rule-icon">📐</span>
            <div>
              <strong>Perpendicular Angle</strong>
              <p>Project straight onto the surface. Angled projection causes keystone distortion.</p>
            </div>
          </div>
          <div class="rule">
            <span class="rule-icon">🎯</span>
            <div>
              <strong>Center Alignment</strong>
              <p>Center the projector horizontally with the surface center for even brightness.</p>
            </div>
          </div>
          <div class="rule">
            <span class="rule-icon">💡</span>
            <div>
              <strong>Room Darkness</strong>
              <p>Dim lights as much as possible. Projectors look washed out in bright rooms.</p>
            </div>
          </div>
          <div class="rule">
            <span class="rule-icon">📏</span>
            <div>
              <strong>Height Matching</strong>
              <p>Projector lens should be at the vertical center of your projection surface.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Connection Checklist</h3>
        <div class="checklist">
          <label class="check-item"><input type="checkbox"> Projector plugged into power</label>
          <label class="check-item"><input type="checkbox"> HDMI / USB-C cable connected</label>
          <label class="check-item"><input type="checkbox"> Laptop set to "Extend" display mode</label>
          <label class="check-item"><input type="checkbox"> Projector input set to correct HDMI port</label>
          <label class="check-item"><input type="checkbox"> Image is in focus (adjust lens ring)</label>
          <label class="check-item"><input type="checkbox"> No keystone distortion</label>
          <label class="check-item"><input type="checkbox"> Browser window dragged to projector display</label>
        </div>
      </div>
    `;
  }

  private getSurfacePrepHTML(): string {
    return `
      <div class="guide-section">
        <h3>Surface Requirements</h3>
        <div class="surface-types">
          <div class="surface-type-card good">
            <h4>✅ Ideal Surfaces</h4>
            <ul>
              <li>White or light gray matte wall</li>
              <li>Professional projection screen</li>
              <li>White foam board</li>
              <li>Light-colored flat objects</li>
            </ul>
          </div>
          <div class="surface-type-card okay">
            <h4>⚠️ Workable Surfaces</h4>
            <ul>
              <li>Light wood (bookshelf, furniture)</li>
              <li>Light-colored fabric</li>
              <li>Painted drywall (any light color)</li>
              <li>White paper/cardboard</li>
            </ul>
          </div>
          <div class="surface-type-card bad">
            <h4>❌ Avoid</h4>
            <ul>
              <li>Dark or black surfaces (absorbs light)</li>
              <li>Glossy/reflective surfaces (causes glare)</li>
              <li>Highly textured surfaces (distorts image)</li>
              <li>Transparent/glass surfaces</li>
            </ul>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Surface Preparation Tips</h3>
        <div class="tips-list">
          <div class="tip">
            <span class="tip-num">1</span>
            <div>
              <strong>Clean the surface</strong>
              <p>Dust and dirt show up when projected. Wipe down your surface before mapping.</p>
            </div>
          </div>
          <div class="tip">
            <span class="tip-num">2</span>
            <div>
              <strong>Matte finish is best</strong>
              <p>If your surface is glossy, spray it with matte clear coat or cover with matte paper.</p>
            </div>
          </div>
          <div class="tip">
            <span class="tip-num">3</span>
            <div>
              <strong>Uniform color</strong>
              <p>White is ideal. If colored, the projector will mix with the surface color — account for this in color correction.</p>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  private getBookshelfHTML(): string {
    return `
      <div class="guide-section">
        <h3>Bookshelf Projection Mapping</h3>
        <p class="guide-intro">Project animations onto books, shelves, and objects. Here's how to make Mario run across your books.</p>

        <div class="setup-steps">
          <div class="setup-step">
            <div class="step-num">1</div>
            <div>
              <h4>Photograph Your Bookshelf</h4>
              <p>Use the <strong>Surface Scanner</strong> (camera icon) to take a photo of your bookshelf. This becomes your mapping background.</p>
              <button class="btn btn-sm btn-accent" onclick="setupGuide.openScanner()">Open Surface Scanner</button>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">2</div>
            <div>
              <h4>Draw Surfaces on Each Book</h4>
              <p>Click on the photo to trace each book spine, shelf edge, or object. The app will treat each shape as a separate projection surface.</p>
              <div class="tip-box">
                <strong>Pro tip:</strong> You don't need to be pixel-perfect. The warp mesh will handle alignment.
              </div>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">3</div>
            <div>
              <h4>Choose Your Animation</h4>
              <p>Pick a content template that works with your surface layout:</p>
              <div class="template-suggestions">
                <div class="template-card">
                  <span class="template-icon">🍄</span>
                  <strong>Mario Runner</strong>
                  <p>Mario runs and jumps across book spines. Perfect for horizontal shelves.</p>
                </div>
                <div class="template-card">
                  <span class="template-icon">🔥</span>
                  <strong>Fire</strong>
                  <p>Flames climb up the book spines. Looks incredible on dark books.</p>
                </div>
                <div class="template-card">
                  <span class="template-icon">💧</span>
                  <strong>Water Ripples</strong>
                  <p>Water ripples spread across the shelf surface. Calm and mesmerizing.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">4</div>
            <div>
              <h4>Warp to Fit</h4>
              <p>In Edit Mode (press <kbd>E</kbd>), drag the control points to align the animation with your physical books. The mesh warps the content to match the real-world shape.</p>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">5</div>
            <div>
              <h4>Go Fullscreen</h4>
              <p>Press <kbd>F</kbd> — the UI disappears and only the warped animation shows on the projector. Walk over to your bookshelf and enjoy.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Bookshelf Animation Ideas</h3>
        <div class="ideas-grid">
          <div class="idea">
            <span class="idea-icon">🏃</span>
            <strong>Mario Across Books</strong>
            <p>Mario runs along the shelf, jumps between books, hits question blocks.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">🌌</span>
            <strong>Starfield Portal</strong>
            <p>Each book spine becomes a window into a different galaxy.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">🌊</span>
            <strong>Ocean Waves</strong>
            <p>Water flows across the books, with fish swimming between spines.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">⚡</span>
            <strong>Lightning Storm</strong>
            <p>Electricity arcs between book spines. Dramatic effect.</p>
          </div>
        </div>
      </div>
    `;
  }

  private getPlantHTML(): string {
    return `
      <div class="guide-section">
        <h3>Plant Projection Mapping</h3>
        <p class="guide-intro">Project onto leaves, branches, and pots. A ball bouncing on leaves, fire on branches, or water dripping.</p>

        <div class="setup-steps">
          <div class="setup-step">
            <div class="step-num">1</div>
            <div>
              <h4>Photograph Your Plant</h4>
              <p>Take a photo from the projector's perspective. The Surface Scanner will capture the plant's shape.</p>
              <button class="btn btn-sm btn-accent" onclick="setupGuide.openScanner()">Open Surface Scanner</button>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">2</div>
            <div>
              <h4>Trace the Leaves</h4>
              <p>Draw surfaces around individual leaves or leaf clusters. Each traced area becomes a projection surface.</p>
              <div class="tip-box">
                <strong>Challenge:</strong> Plants are 3D and irregular. You may need to project from multiple angles or accept that some areas won't map perfectly.
              </div>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">3</div>
            <div>
              <h4>Pick Your Animation</h4>
              <div class="template-suggestions">
                <div class="template-card">
                  <span class="template-icon">⚽</span>
                  <strong>Bouncing Ball</strong>
                  <p>Balls appear to bounce on individual leaves. Physics-based animation.</p>
                </div>
                <div class="template-card">
                  <span class="template-icon">🌧</span>
                  <strong>Rain</strong>
                  <p>Rain falls on the plant with splash effects on each leaf.</p>
                </div>
                <div class="template-card">
                  <span class="template-icon">✨</span>
                  <strong>Fairy Dust</strong>
                  <p>Sparkles and light particles float around the leaves.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="setup-step">
            <div class="step-num">4</div>
            <div>
              <h4>Fine-Tune the Warp</h4>
              <p>Since leaves are curved, increase mesh density (8x8 or higher) for smoother warping. Use more control points around the edges of each leaf.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Plant Animation Ideas</h3>
        <div class="ideas-grid">
          <div class="idea">
            <span class="idea-icon">⚽</span>
            <strong>Bouncing Balls</strong>
            <p>Balls drop from above, bounce on leaves, roll off edges.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">🌸</span>
            <strong>Cherry Blossoms</strong>
            <p>Petals fall and collect on leaves. Seasonal vibes.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">🦋</span>
            <strong>Butterflies</strong>
            <p>Butterflies land on leaves, open/close wings, fly away.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">💧</span>
            <strong>Water Droplets</strong>
            <p>Dew drops form on leaves, grow, and drip off edges.</p>
          </div>
        </div>
      </div>
    `;
  }

  private getObjectsHTML(): string {
    return `
      <div class="guide-section">
        <h3>Custom Object Mapping</h3>
        <p class="guide-intro">Any object can become a projection surface — boxes, vases, sculptures, furniture, even people.</p>

        <div class="universal-workflow">
          <h4>Universal Workflow</h4>
          <div class="workflow-steps">
            <div class="wf-step">
              <div class="wf-num">1</div>
              <span>Photograph</span>
            </div>
            <div class="wf-arrow">→</div>
            <div class="wf-step">
              <div class="wf-num">2</div>
              <span>Trace Surfaces</span>
            </div>
            <div class="wf-arrow">→</div>
            <div class="wf-step">
              <div class="wf-num">3</div>
              <span>Choose Content</span>
            </div>
            <div class="wf-arrow">→</div>
            <div class="wf-step">
              <div class="wf-num">4</div>
              <span>Warp & Align</span>
            </div>
            <div class="wf-arrow">→</div>
            <div class="wf-step">
              <div class="wf-num">5</div>
              <span>Project</span>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Object-Specific Tips</h3>
        <div class="tips-list">
          <div class="tip">
            <span class="tip-num">📦</span>
            <div>
              <strong>Boxes & Cubes</strong>
              <p>Each face is a separate surface. Map all 4 visible faces. Content wraps around corners.</p>
            </div>
          </div>
          <div class="tip">
            <span class="tip-num">🏺</span>
            <div>
              <strong>Vases & Cylinders</strong>
              <p>Use many vertical strips for smooth warping. Horizontal content (waves, stripes) works best.</p>
            </div>
          </div>
          <div class="tip">
            <span class="tip-num">🪑</span>
            <div>
              <strong>Furniture</strong>
              <p>Map individual surfaces — table top, chair back, drawer fronts. Each gets its own content.</p>
            </div>
          </div>
          <div class="tip">
            <span class="tip-num">🎭</span>
            <div>
              <strong>Sculptures & Masks</strong>
              <p>Use high mesh density (12x12+). Trace around features — eyes, mouth, contours.</p>
            </div>
          </div>
        </div>
      </div>

      <div class="guide-section">
        <h3>Getting Creative</h3>
        <div class="ideas-grid">
          <div class="idea">
            <span class="idea-icon">🎂</span>
            <strong>Cake Mapping</strong>
            <p>Project candles, fireworks, or messages onto a birthday cake.</p>
          </div>
          <div class="idea">
            <span class="idea-icon">🎭</span>
            <strong>Face Mapping</strong>
            <p>Project makeup, masks, or effects onto a face (needs steady subject).</p>
          </div>
          <div class="idea">
            <span class="idea-icon">🏢</span>
            <strong>Building Facades</strong>
            <strong>Architectural projection on building surfaces.</strong>
          </div>
          <div class="idea">
            <span class="idea-icon">🚗</span>
            <strong>Car Projection</strong>
            <p>Map animations onto car body panels for shows/events.</p>
          </div>
        </div>
      </div>
    `;
  }

  onProjectorSelect() {
    const select = document.getElementById('projectorSelect') as HTMLSelectElement;
    const idx = parseInt(select.value);
    if (!isNaN(idx)) {
      const projector = PROJECTOR_DATABASE[idx];
      (document.getElementById('throwRatio') as HTMLInputElement).value = String(projector.throwRatio);
      this.calculate();
    }
  }

  calculate() {
    const throwRatio = parseFloat((document.getElementById('throwRatio') as HTMLInputElement).value) || 1.2;
    const width = parseFloat((document.getElementById('surfaceWidth') as HTMLInputElement).value) || 200;

    const optimal = width * throwRatio;
    const min = width * (throwRatio * 0.85);
    const max = width * (throwRatio * 1.15);

    document.getElementById('optimalDistance')!.textContent = `${Math.round(optimal)} cm`;
    document.getElementById('minDistance')!.textContent = `${Math.round(min)} cm`;
    document.getElementById('maxDistance')!.textContent = `${Math.round(max)} cm`;

    // Update diagram
    this.renderPlacementDiagram(throwRatio, width, optimal);
  }

  private renderPlacementDiagram(_ratio: number, width: number, distance: number) {
    const diagram = document.getElementById('placementDiagram');
    if (!diagram) return;

    const scale = 150 / Math.max(width, distance);
    const w = width * scale;
    const d = distance * scale;

    diagram.innerHTML = `
      <svg width="300" height="200" viewBox="0 0 300 200">
        <!-- Projector -->
        <rect x="20" y="${100 - 15}" width="30" height="30" rx="4" fill="#333" stroke="#666"/>
        <text x="35" y="${100 + 25}" text-anchor="middle" fill="#888" font-size="9">Projector</text>

        <!-- Light cone -->
        <polygon points="50,85 50,115 ${50 + d},${100 - w/2} ${50 + d},${100 + w/2}"
          fill="rgba(0,212,255,0.1)" stroke="rgba(0,212,255,0.3)" stroke-dasharray="4"/>

        <!-- Surface -->
        <rect x="${50 + d - 3}" y="${100 - w/2}" width="6" height="${w}" rx="2" fill="#00d4ff"/>

        <!-- Distance label -->
        <line x1="50" y1="140" x2="${50 + d}" y2="140" stroke="#666" stroke-dasharray="3"/>
        <text x="${50 + d/2}" y="155" text-anchor="middle" fill="#00d4ff" font-size="11" font-weight="bold">
          ${Math.round(distance)} cm
        </text>

        <!-- Width label -->
        <line x1="${50 + d + 20}" y1="${100 - w/2}" x2="${50 + d + 20}" y2="${100 + w/2}" stroke="#666" stroke-dasharray="3"/>
        <text x="${50 + d + 35}" y="104" text-anchor="middle" fill="#888" font-size="10">
          ${width} cm
        </text>
      </svg>
    `;
  }

  openScanner() {
    this.close();
    // @ts-ignore
    window.surfaceScanner?.open();
  }

  close() {
    this.container.remove();
  }
}
