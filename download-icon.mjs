import fs from 'node:fs';

const url = 'https://github.com/user-attachments/assets/ec67e5e3-a060-405d-b229-1fe2badcf8ad';
const dest = 'public/catalog/falkordb/icon.png';

try {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const arr = await res.arrayBuffer();
  fs.writeFileSync(dest, Buffer.from(arr));
  console.log('written', arr.byteLength, 'bytes');
} catch (e) {
  console.error('Failed:', e.message);
}