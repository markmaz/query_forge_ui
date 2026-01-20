import type { Conversation } from '../model/types';

export function toMarkdown(conv: Conversation): string {
  const lines = [
    `# ${conv.title || 'Conversation'}`,
    '',
    `> Started: ${new Date(conv.createdAt).toLocaleString()}`,
    `> Updated: ${new Date(conv.updatedAt).toLocaleString()}`,
    '',
  ];
  conv.messages.forEach(m => {
    lines.push(m.role === 'user' ? '### You' : '### Assistant');
    lines.push('');
    lines.push(m.content);
    lines.push('');
  });
  return lines.join('\n');
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
