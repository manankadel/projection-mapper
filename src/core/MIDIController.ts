import type { MIDIBinding } from '../types';

export type MIDICallback = (binding: MIDIBinding, value: number) => void;

export class MIDIController {
  private midiAccess: MIDIAccess | null = null;
  private bindings: MIDIBinding[] = [];
  private callback: MIDICallback | null = null;
  private inputs: MIDIInput[] = [];
  private enabled = false;

  async init(): Promise<boolean> {
    try {
      this.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
      // @ts-ignore - onstatechange is standard MIDIAccess
  this.midiAccess.onstatechange = () => this.onStateChange();
      this.connectInputs();
      this.enabled = true;
      return true;
    } catch (e) {
      console.warn('MIDI not available:', e);
      return false;
    }
  }

  private onStateChange() {
    this.connectInputs();
  }

  private connectInputs() {
    if (!this.midiAccess) return;

    // Disconnect old inputs
    for (const input of this.inputs) {
      input.onmidimessage = null;
    }

    this.inputs = Array.from(this.midiAccess.inputs.values());

    for (const input of this.inputs) {
      input.onmidimessage = (event) => this.onMIDIMessage(event);
    }
  }

  private onMIDIMessage(event: MIDIMessageEvent) {
    if (!event.data || event.data.length < 3) return;

    const status = event.data[0];
    const channel = status & 0x0f;
    const command = (status >> 4) & 0x0f;
    const note = event.data[1];
    const value = event.data[2] / 127;

    // Note On
    if (command === 0x9 && value > 0) {
      this.findAndTriggerBinding(channel, note, value);
    }
    // Control Change
    else if (command === 0xb) {
      this.findAndTriggerBinding(channel, note, value);
    }
  }

  private findAndTriggerBinding(channel: number, note: number, value: number) {
    for (const binding of this.bindings) {
      if (binding.channel === channel && binding.note === note) {
        const scaledValue = binding.min + (binding.max - binding.min) * value;
        this.callback?.(binding, scaledValue);
      }
    }
  }

  addBinding(binding: MIDIBinding) {
    this.bindings.push(binding);
  }

  removeBinding(id: string) {
    this.bindings = this.bindings.filter(b => b.id !== id);
  }

  setBindings(bindings: MIDIBinding[]) {
    this.bindings = bindings;
  }

  onMessage(callback: MIDICallback) {
    this.callback = callback;
  }

  getInputs(): MIDIInput[] {
    return this.inputs;
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  destroy() {
    for (const input of this.inputs) {
      input.onmidimessage = null;
    }
    this.inputs = [];
    if (this.midiAccess) this.midiAccess.onstatechange = null;
  }
}
