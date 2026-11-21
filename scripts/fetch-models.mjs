// Descarga los GLB gratis de Polyfork (CC BY 4.0) y los optimiza a public/models/.
// Uso: node scripts/fetch-models.mjs   (luego commitear public/models y src/data/model-credits.json)
import { execSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';

const list = JSON.parse(readFileSync(new URL('./models.json', import.meta.url)));
mkdirSync('.cache/models', { recursive: true });
mkdirSync('public/models', { recursive: true });
const credits = [];
for (const { id, file } of list) {
  const raw = `.cache/models/${file}.glb`;
  const meta = await (await fetch(`https://polyfork.dev/api/assets/${id}`)).json();
  const a = meta.asset ?? meta;
  if (!existsSync(raw)) {
    const res = await fetch(`https://polyfork.dev/cdn/${id}.glb`);
    if (!res.ok) throw new Error(`${id}: HTTP ${res.status}`);
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
  }
  execSync(`pnpm dlx @gltf-transform/cli optimize ${raw} public/models/${file}.glb --compress meshopt --texture-compress webp --simplify false`, { stdio: 'inherit' });
  credits.push({ file, title: a.title, page: a.page ?? `https://polyfork.dev/asset/${id}` });
}
writeFileSync('src/data/model-credits.json', JSON.stringify(credits, null, 2) + '\n');
console.log(`ok: ${credits.length} modelos`);
