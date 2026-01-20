import type { Message } from './types';

export async function askAnalysis(messages: Message[]): Promise<string> {
  const res = await fetch('/api/analysis/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: messages.map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!res.ok) throw new Error(`Ask failed: ${res.status}`);
  const data = await res.json();
  return String(data.content ?? '');
}
