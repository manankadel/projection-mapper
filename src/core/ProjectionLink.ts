export const PROJECTION_CHANNEL = 'projmapper-link';
export const OUTPUT_WINDOW_NAME = 'projmap-output';

const channel = new BroadcastChannel(PROJECTION_CHANNEL);

export const projectionLink = {
  broadcast(payload: unknown) {
    channel.postMessage(payload);
  },
  onMessage(cb: (msg: any) => void) {
    channel.onmessage = (e) => cb(e.data);
  },
};

export function isOutputWindow(): boolean {
  return window.name === OUTPUT_WINDOW_NAME;
}
