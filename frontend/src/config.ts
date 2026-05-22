export const API_URL = import.meta.env.VITE_API_URL;

function buildWebSocketUrl(apiUrl: string): string {
  const parsed = new URL(apiUrl);
  const protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${parsed.host}/ws`;
}

export const WS_URL = buildWebSocketUrl(API_URL);
