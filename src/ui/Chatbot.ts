interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface KnowledgeBase {
  patterns: { trigger: RegExp; response: string | ((ctx: any) => string); }[];
}

export class Chatbot {
  private container: HTMLElement;
  private messagesEl: HTMLElement | null = null;
  private inputEl: HTMLInputElement | null = null;
  private isOpen = false;
  private messages: ChatMessage[] = [];
  private context: Record<string, any> = {};
  private kb: KnowledgeBase;

  constructor() {
    this.container = document.createElement('div');
    this.container.id = 'chatbot';
    document.body.appendChild(this.container);
    this.kb = this.buildKnowledgeBase();
    this.renderButton();
  }

  setContext(ctx: Record<string, any>) {
    this.context = { ...this.context, ...ctx };
  }

  private renderButton() {
    this.container.innerHTML = `
      <button class="chatbot-btn" onclick="chatbot.toggle()" title="Ask the Assistant">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <span class="chatbot-badge" id="chatBadge" style="display:none">1</span>
      </button>
    `;
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.renderChat();
      this.hideBadge();
    } else {
      this.renderButton();
    }
  }

  private renderChat() {
    this.container.innerHTML = `
      <div class="chatbot-window">
        <div class="chatbot-header">
          <div class="chatbot-title">
            <span class="chatbot-avatar">🎯</span>
            <div>
              <div class="chatbot-name">Projection Assistant</div>
              <div class="chatbot-status">Online — knows your setup</div>
            </div>
          </div>
          <button class="chatbot-close" onclick="chatbot.toggle()">×</button>
        </div>
        <div class="chatbot-messages" id="chatMessages">
          ${this.messages.length === 0 ? this.getWelcomeMessage() : this.renderMessages()}
        </div>
        <div class="chatbot-input-area">
          <input type="text" id="chatInput" placeholder="Ask anything about projection mapping..."
            onkeydown="if(event.key==='Enter')chatbot.send()">
          <button class="chatbot-send" onclick="chatbot.send()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2v7z"/></svg>
          </button>
        </div>
      </div>
    `;

    this.messagesEl = document.getElementById('chatMessages');
    this.inputEl = document.getElementById('chatInput') as HTMLInputElement;
    this.scrollToBottom();
  }

  private getWelcomeMessage(): string {
    const setup = Chatbot.getSetupSummary();
    return `
      <div class="chat-welcome">
        <p>Hey! I'm your projection mapping assistant.</p>
        <p>I know about your setup: ${setup}</p>
        <p>Ask me anything. Here are some things I can help with:</p>
        <div class="quick-actions">
          <button class="quick-btn" onclick="chatbot.ask('How do I connect my projector?')">Connect projector</button>
          <button class="quick-btn" onclick="chatbot.ask('How do I warp the image?')">Warp the image</button>
          <button class="quick-btn" onclick="chatbot.ask('What are edge blends?')">Edge blending</button>
          <button class="quick-btn" onclick="chatbot.ask('How do I use MIDI control?')">MIDI control</button>
          <button class="quick-btn" onclick="chatbot.ask('My projector image is upside down, how do I fix it?')">Image is flipped</button>
          <button class="quick-btn" onclick="chatbot.ask('How do I save my show?')">Save my work</button>
          <button class="quick-btn" onclick="chatbot.ask('What keyboard shortcuts are available?')">Shortcuts</button>
          <button class="quick-btn" onclick="chatbot.ask('How do I do multi-projector edge blending?')">Multi-projector</button>
        </div>
      </div>
    `;
  }

  private renderMessages(): string {
    return this.messages.map(m => `
      <div class="chat-msg ${m.role}">
        <div class="msg-content">${m.content}</div>
      </div>
    `).join('');
  }

  ask(text: string) {
    this.addMessage('user', text);
    const response = this.getResponse(text);
    setTimeout(() => {
      this.addMessage('assistant', response);
    }, 300 + Math.random() * 500);
  }

  send() {
    if (!this.inputEl) return;
    const text = this.inputEl.value.trim();
    if (!text) return;
    this.inputEl.value = '';
    this.ask(text);
  }

  private addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({ role, content, timestamp: Date.now() });
    if (this.messagesEl) {
      this.messagesEl.innerHTML += `
        <div class="chat-msg ${role}">
          <div class="msg-content">${content}</div>
        </div>
      `;
      this.scrollToBottom();
    }
    if (!this.isOpen && role === 'assistant') {
      this.showBadge();
    }
  }

  private scrollToBottom() {
    if (this.messagesEl) {
      this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
    }
  }

  private showBadge() {
    const badge = document.getElementById('chatBadge');
    if (badge) badge.style.display = 'flex';
  }

  private hideBadge() {
    const badge = document.getElementById('chatBadge');
    if (badge) badge.style.display = 'none';
  }

  private getResponse(input: string): string {
    const lower = input.toLowerCase();
    const setup = this.context;

    // Match against knowledge base
    for (const entry of this.kb.patterns) {
      if (entry.trigger.test(lower)) {
        return typeof entry.response === 'function'
          ? entry.response(setup)
          : entry.response;
      }
    }

    // Fallback
    return `I'm not sure about that specific question. Try asking about:
    <ul>
      <li>Connecting your projector</li>
      <li>Warping and mapping surfaces</li>
      <li>Edge blending</li>
      <li>MIDI/OSC control</li>
      <li>Keyboard shortcuts</li>
      <li>Saving and loading shows</li>
    </ul>
    <p>Or describe what you're trying to do and I'll do my best to help.</p>`;
  }

  private buildKnowledgeBase(): KnowledgeBase {
    return {
      patterns: [
        // Connection
        {
          trigger: /connect|hook up|plug in|set up.*projector|how.*projector/i,
          response: (ctx: any) => `
            <strong>Connecting your projector:</strong>
            <ol>
              <li><strong>Physical connection:</strong> Plug HDMI/USB-C from your laptop to the projector</li>
              <li><strong>Power on</strong> the projector and wait for it to warm up (30-60 seconds)</li>
              <li><strong>Display mode:</strong> On your laptop, press <kbd>Win+P</kbd> (Windows) or go to System Preferences > Displays (Mac) and select <strong>"Extend"</strong> — not Mirror</li>
              <li><strong>Drag the app:</strong> Drag this browser window to the projector display</li>
              <li><strong>Fullscreen:</strong> Press <kbd>F</kbd> to go fullscreen on the projector</li>
            </ol>
            ${ctx.multiDisplay ? '<p>✅ I detect you have multiple displays — you\'re likely already connected!</p>' : '<p>⚠️ I only see one display. Make sure your projector is connected and set to Extend mode.</p>'}
          `,
        },
        {
          trigger: /extend|mirror|display mode|second screen/i,
          response: `
            <strong>Extend vs Mirror:</strong>
            <ul>
              <li><strong>Mirror:</strong> Both screens show the same thing. Bad for projection mapping — you'll see the UI on the projector.</li>
              <li><strong>Extend:</strong> Your laptop and projector are separate screens. The app shows on one, your warped output on the other. This is what you want.</li>
            </ul>
            <p><strong>Windows:</strong> <kbd>Win+P</kbd> → Select "Extend"</p>
            <p><strong>Mac:</strong> System Preferences → Displays → Arrangement → Uncheck "Mirror Displays"</p>
          `,
        },
        // Warping
        {
          trigger: /warp|distort|变形|bend|shape|morph|fit.*surface/i,
          response: `
            <strong>Warping your projection:</strong>
            <ol>
              <li>Press <kbd>E</kbd> to enter Edit Mode — blue control points appear</li>
              <li><strong>Drag the corner points</strong> first to match your surface corners</li>
              <li><strong>Drag interior points</strong> to fine-tune the warp</li>
              <li>For curved surfaces, increase mesh density in the Mesh panel (more columns/rows)</li>
              <li>Press <kbd>F</kbd> to see the final result fullscreen</li>
            </ol>
            <p><strong>Pro tip:</strong> Use the test patterns (Checker or Grid) while warping — the straight lines make it easy to see distortion.</p>
            <p><strong>Keyboard:</strong> <kbd>R</kbd> resets the warp, <kbd>Ctrl+Z</kbd> undoes changes.</p>
          `,
        },
        {
          trigger: /mesh|grid.*density|resolution.*mesh|more.*point/i,
          response: `
            <strong>Mesh density:</strong>
            <p>The mesh determines how many control points you have. More points = finer control.</p>
            <ul>
              <li><strong>4×4:</strong> Good for flat surfaces (default)</li>
              <li><strong>6×6 to 8×8:</strong> Curved surfaces, moderate detail</li>
              <li><strong>12×12 to 16×16:</strong> Complex 3D objects, high detail</li>
            </ul>
            <p>Adjust in the <strong>Mesh</strong> panel on the left sidebar. Changes are non-destructive — you can always go back.</p>
          `,
        },
        // Edge blending
        {
          trigger: /edge.?blend|overlap|multi.?projector|two.*projector|blend.*zone/i,
          response: `
            <strong>Edge Blending (Multi-Projector):</strong>
            <p>When two projectors overlap, the overlap area gets too bright. Edge blending fixes this.</p>
            <ol>
              <li>Create a surface for each projector</li>
              <li>Position them so they overlap by 10-20%</li>
            </ol>
            <p>For each surface, in the <strong>Edge Blending</strong> panel:</p>
            <ol>
              <li>Enable edge blending</li>
              <li>Set the <strong>Side</strong> to the overlap direction (left/right/top/bottom)</li>
              <li>Adjust <strong>Width</strong> — how wide the blend zone is (usually 10-20%)</li>
              <li>Adjust <strong>Gamma</strong> — match your projector's gamma (usually 2.2)</li>
            </ol>
            <p>Both projectors need complementary blend settings (one fading out left, other fading out right).</p>
          `,
        },
        // Image flipped
        {
          trigger: /upside.?down|flip|mirror|reverse|inverted|倒/i,
          response: `
            <strong>Image is flipped/upside down:</strong>
            <p>This is common with ceiling-mounted projectors. Two fixes:</p>
            <ol>
              <li><strong>In the app:</strong> Select your surface → Surface Properties → check "Flip V" (vertical) or "Flip H" (horizontal)</li>
              <li><strong>On the projector:</strong> Most projectors have a "Keystone" or "Image" menu with flip options. Check your projector's remote/menu.</li>
            </ol>
            <p>The projector's built-in flip is usually better — it doesn't affect the mapping coordinates.</p>
          `,
        },
        // Keystone
        {
          trigger: /keystone|trapezoid|corners.*not.*square|sides.*not.*parallel/i,
          response: `
            <strong>Keystone correction:</strong>
            <p>Keystone happens when the projector isn't perpendicular to the surface.</p>
            <p><strong>Physical fix (best):</strong> Move the projector so it's directly facing the surface. Center it at the same height as the middle of the projection area.</p>
            <p><strong>Software fix:</strong> Use the warp mesh — drag the corner points until the image looks rectangular. This is what projection mapping is for!</p>
            <p><strong>Projector fix:</strong> Many projectors have auto-keystone or manual keystone correction in their menu. Use this first, then fine-tune with the app.</p>
          `,
        },
        // MIDI
        {
          trigger: /midi|control.*surface|fader|osc|remote/i,
          response: `
            <strong>MIDI/OSC Control:</strong>
            <p>You can control the app from a MIDI controller or OSC app (like TouchOSC, Lemur).</p>
            <p><strong>MIDI setup:</strong></p>
            <ol>
              <li>Connect your MIDI controller</li>
              <li>The app auto-detects MIDI devices</li>
              <li>In MIDI Bindings, map CC numbers to controls</li>
              <li>Available targets: opacity, brightness, contrast, saturation, hue for each surface</li>
            </ol>
            <p><strong>OSC setup:</strong></p>
            <ol>
              <li>Connect to the OSC WebSocket at <code>ws://localhost:8000</code></li>
              <li>Send JSON: <code>{"address": "/surface/1/opacity", "value": 0.5}</code></li>
            </ol>
          `,
        },
        // Keyboard shortcuts
        {
          trigger: /shortcut|hotkey|keyboard|key.*bind|quick.*key/i,
          response: `
            <strong>Keyboard Shortcuts:</strong>
            <table style="width:100%;font-size:12px;border-collapse:collapse">
              <tr><td><kbd>F</kbd></td><td>Fullscreen projection mode</td></tr>
              <tr><td><kbd>E</kbd></td><td>Toggle edit mode (show/hide control points)</td></tr>
              <tr><td><kbd>G</kbd></td><td>Toggle grid overlay</td></tr>
              <tr><td><kbd>S</kbd></td><td>Toggle snap-to-grid</td></tr>
              <tr><td><kbd>R</kbd></td><td>Reset warp to flat</td></tr>
              <tr><td><kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd></td><td>Select / Warp / Pan tools</td></tr>
              <tr><td><kbd>Tab</kbd></td><td>Cycle through surfaces</td></tr>
              <tr><td><kbd>Ctrl+Z</kbd></td><td>Undo</td></tr>
              <tr><td><kbd>Ctrl+S</kbd></td><td>Export show</td></tr>
              <tr><td><kbd>Esc</kbd></td><td>Exit fullscreen</td></tr>
              <tr><td><kbd>+</kbd> <kbd>-</kbd></td><td>Zoom in/out</td></tr>
              <tr><td><kbd>0</kbd></td><td>Reset zoom</td></tr>
            </table>
          `,
        },
        // Save/Export
        {
          trigger: /save|export|download|persist|store/i,
          response: `
            <strong>Saving your work:</strong>
            <ul>
              <li><strong>Auto-save:</strong> The app auto-saves to browser storage every 30 seconds</li>
              <li><strong>Export file:</strong> <kbd>Ctrl+S</kbd> or click "Export Show" — downloads a .json file with all surfaces, warps, and settings</li>
              <li><strong>Import:</strong> Click "Import Show" to load a saved .json file</li>
            </ul>
            <p><strong>Tip:</strong> Always export before closing the browser. Browser storage can be cleared.</p>
            <p>The .json file is human-readable — you can edit it in a text editor if needed.</p>
          `,
        },
        // Test patterns
        {
          trigger: /test.*pattern|checker|color.*bar|grid.*pattern|calibrat/i,
          response: `
            <strong>Test Patterns:</strong>
            <p>Use these for setup and calibration:</p>
            <ul>
              <li><strong>Checker:</strong> Best for warping — the grid lines make distortion obvious</li>
              <li><strong>Color Bars:</strong> Check color accuracy and projector settings</li>
              <li><strong>Grid with Numbers:</strong> Precise alignment — numbers show exact coordinates</li>
              <li><strong>Gradient:</strong> Check for banding and color depth</li>
              <li><strong>Brightness Ramp:</strong> Check black level and contrast range</li>
            </ul>
            <p>Access via the "Test Patterns" dropdown in the toolbar.</p>
          `,
        },
        // Loading content
        {
          trigger: /load.*content|image|video|photo|media|upload|own.*content/i,
          response: `
            <strong>Loading your content:</strong>
            <ol>
              <li>Click <strong>"Load Media"</strong> in the toolbar</li>
              <li>Select image (PNG, JPG, GIF, SVG) or video (MP4, WebM)</li>
              <li>The content loads onto the selected surface</li>
            </ol>
            <p><strong>Or use URL:</strong> Click "URL" and paste a direct link to an image or video.</p>
            <p><strong>Live feeds:</strong> You can also use your webcam as a content source.</p>
            <p><strong>Note:</strong> For best performance, keep images under 4K resolution and videos under 1080p.</p>
          `,
        },
        // Performance
        {
          trigger: /slow|lag|performance|fps|frame.*rate|choppy/i,
          response: `
            <strong>Performance tips:</strong>
            <ul>
              <li><strong>Reduce mesh density:</strong> Fewer control points = faster rendering</li>
              <li><strong>Use smaller images:</strong> Resize to your projector resolution</li>
              <li><strong>Close other tabs:</strong> Browsers share GPU resources</li>
              <li><strong>Use hardware acceleration:</strong> Make sure it's enabled in browser settings</li>
              <li><strong>Check FPS:</strong> The status bar shows current frame rate (target: 60)</li>
            </ul>
            <p>If FPS is low, the app will still work — it just won't be as smooth for video content.</p>
          `,
        },
        // Troubleshooting
        {
          trigger: /not.*work|broken|error|issue|problem|troubleshoot|fix/i,
          response: `
            <strong>Common issues:</strong>
            <ol>
              <li><strong>Black screen on projector:</strong> Make sure you're in Extend mode, not Mirror. Drag the browser window to the projector display.</li>
              <li><strong>Can't see control points:</strong> Press <kbd>E</kbd> to enter Edit Mode</li>
              <li><strong>Image is stretched/distorted:</strong> Press <kbd>R</kbd> to reset the warp</li>
              <li><strong>WebGL error:</strong> Try Chrome or Firefox. Safari has limited WebGL2 support.</li>
              <li><strong>Video won't play:</strong> Some browsers block autoplay. Click the video area first.</li>
            </ol>
            <p>Still stuck? Describe exactly what you're seeing and I'll help debug.</p>
          `,
        },
        // Color/brightness
        {
          trigger: /color.*wrong|washed.*out|too.*bright|too.*dark|contrast|saturation|gamma/i,
          response: `
            <strong>Color adjustment:</strong>
            <p>Select your surface and use the Surface Properties panel:</p>
            <ul>
              <li><strong>Brightness:</strong> Overall light output. Increase if too dark.</li>
              <li><strong>Contrast:</strong> Difference between light and dark. Increase for punchier image.</li>
              <li><strong>Saturation:</strong> Color intensity. Decrease if colors are too vivid.</li>
              <li><strong>Gamma:</strong> Mid-tone brightness. Usually 2.2 for most projectors.</li>
            </ul>
            <p><strong>Projector settings:</strong> Check your projector's picture mode. "Cinema" or "sRGB" modes usually have the most accurate colors.</p>
            <p><strong>Ambient light:</strong> Projectors look washed out in bright rooms. Dim the lights for best results.</p>
          `,
        },
        // General help
        {
          trigger: /^help|what can you do|how.*use|tutorial|guide/i,
          response: `
            <strong>I can help with:</strong>
            <ul>
              <li>🔌 Connecting and configuring your projector</li>
              <li>📐 Warping and mapping surfaces</li>
              <li>🎨 Color correction and calibration</li>
              <li>🔲 Edge blending for multi-projector setups</li>
              <li>🎛 MIDI and OSC remote control</li>
              <li>💾 Saving and loading shows</li>
              <li>⌨️ Keyboard shortcuts</li>
              <li>🔧 Troubleshooting issues</li>
            </ul>
            <p>Just ask a question or describe what you're trying to do!</p>
          `,
        },
      ],
    };
  }

  private static getSetupSummary(): string {
    const answers = Chatbot.getSavedAnswers();
    const parts: string[] = [];

    if (answers.resolution) {
      parts.push(`${answers.resolution.w}×${answers.resolution.h} projector`);
    }
    if (answers.multiDisplay) {
      parts.push(`${answers.displayCount || 2} displays detected`);
    } else {
      parts.push('Single display');
    }
    if (answers.surfaceType) {
      const types: Record<string, string> = {
        flat: 'Flat wall',
        screen: 'Projection screen',
        object: '3D object',
        multiple: 'Multiple surfaces',
      };
      parts.push(types[answers.surfaceType] || answers.surfaceType);
    }

    return parts.length > 0 ? parts.join(' · ') : 'Not configured yet';
  }

  private static getSavedAnswers(): Record<string, any> {
    try {
      return JSON.parse(localStorage.getItem('projmapper-onboarding') || '{}');
    } catch {
      return {};
    }
  }

  destroy() {
    this.container.remove();
  }
}
