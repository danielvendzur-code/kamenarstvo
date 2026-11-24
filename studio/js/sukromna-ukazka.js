// The key travels in the fragment, which the browser omits from HTTP requests.
export async function openConfig(envelope) {
  if (envelope.format !== 'studio-aes-gcm-v1') return envelope;
  const keyText = new URLSearchParams(location.hash.slice(1)).get('ukazka');
  if (!keyText || !/^[\w-]{43}$/.test(keyText)) throw new Error('private-preview');
  const decode = text => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), c => c.charCodeAt(0));
  try {
    const key = await crypto.subtle.importKey('raw', decode(keyText), 'AES-GCM', false, ['decrypt']);
    const bytes = await crypto.subtle.decrypt({name:'AES-GCM', iv:decode(envelope.iv)}, key, decode(envelope.data));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new Error('private-preview');
  }
}

