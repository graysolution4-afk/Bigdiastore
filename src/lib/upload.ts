export async function uploadImageAsset(
  file: File,
  purpose: 'catalog' | 'banner' | 'logo' | 'payment_proof',
  bearerToken?: string | null
): Promise<string> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Only JPEG, PNG, and WebP images are supported.');
  }
  if (file.size > 4 * 1024 * 1024) {
    throw new Error('Image size must be 4MB or smaller.');
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (bearerToken) {
    headers.Authorization = `Bearer ${bearerToken}`;
  }

  const resp = await fetch('/api/upload', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      dataUrl,
      filename: file.name,
      purpose,
    }),
  });
  const json = await resp.json().catch(() => ({}));
  if (!resp.ok || !json?.url) {
    throw new Error(json?.error || 'Image upload failed.');
  }
  return json.url;
}
