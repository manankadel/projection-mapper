export const PROJECTION_CHANNEL = 'projmapper-link';
export const OUTPUT_WINDOW_NAME = 'projmap-output';

const channel = new BroadcastChannel(PROJECTION_CHANNEL);
const listeners = new Set<(msg: any) => void>();
let lastState: any = null;

channel.addEventListener('message', (e) => {
  const data = (e as MessageEvent).data;
  if (data?.type === 'state') lastState = data;
  for (const cb of listeners) cb(data);
});

export const projectionLink = {
  broadcast(payload: unknown) {
    const data = payload as any;
    if (data?.type === 'state') lastState = data;
    channel.postMessage(payload);
  },
  onMessage(cb: (msg: any) => void) {
    listeners.add(cb);
    // Replay last state immediately for late joiners (output window opened after broadcast)
    if (lastState) setTimeout(() => cb(lastState), 0);
    return () => listeners.delete(cb);
  },
  requestState() {
    channel.postMessage({ type: 'request-state' });
  },
  getLastState() {
    return lastState;
  },
};

export function isOutputWindow(): boolean {
  return window.name === OUTPUT_WINDOW_NAME;
}
