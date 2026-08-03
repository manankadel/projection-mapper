import type { OSCBinding } from '../types';

export type OSCCallback = (binding: OSCBinding, value: number) => void;

export class OSCController {
  private ws: WebSocket | null = null;
  private bindings: OSCBinding[] = [];
  private callback: OSCCallback | null = null;
  private url = 'ws://localhost:8000';
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  async connect(url?: string): Promise<boolean> {
    if (url) this.url = url;

    return new Promise((resolve) => {
      try {
        this.ws = new WebSocket(this.url);
        this.ws.onopen = () => {
          this.connected = true;
          resolve(true);
        };
        this.ws.onmessage = (event) => this.onMessage(event);
        this.ws.onclose = () => {
          this.connected = false;
          this.scheduleReconnect();
        };
        this.ws.onerror = () => {
          this.connected = false;
          resolve(false);
        };
      } catch (e) {
        resolve(false);
      }
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect();
    }, 5000);
  }

  private onMessage(event: MessageEvent) {
    try {
      const data = JSON.parse(event.data);
      if (data.address && data.value !== undefined) {
        this.findAndTriggerBinding(data.address, data.value);
      }
    } catch (e) {
      // Not JSON, try OSC-like format
    }
  }

  private findAndTriggerBinding(address: string, value: number) {
    for (const binding of this.bindings) {
      if (binding.address === address) {
        const scaledValue = binding.min + (binding.max - binding.min) * value;
        this.callback?.(binding, scaledValue);
      }
    }
  }

  send(address: string, value: number) {
    if (this.ws && this.connected) {
      this.ws.send(JSON.stringify({ address, value }));
    }
  }

  addBinding(binding: OSCBinding) {
    this.bindings.push(binding);
  }

  removeBinding(id: string) {
    this.bindings = this.bindings.filter(b => b.id !== id);
  }

  setBindings(bindings: OSCBinding[]) {
    this.bindings = bindings;
  }

  onMessage2(callback: OSCCallback) {
    this.callback = callback;
  }

  isConnected(): boolean {
    return this.connected;
  }

  disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.ws?.close();
    this.ws = null;
    this.connected = false;
  }

  destroy() {
    this.disconnect();
  }
}
