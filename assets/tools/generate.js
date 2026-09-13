/**
 * Generates the committed demo assets:
 *  - QR labels (PNG + SVG) whose payload is the plain material code, e.g. "MAT-1042"
 *  - PNG rasters of the original SVG illustrations for the MDK client
 *
 * Usage: npm install && npm run generate   (from assets/tools)
 */
const { writeFile, mkdir, readFile } = require('node:fs/promises');
const path = require('node:path');
const QRCode = require('qrcode');
const sharp = require('sharp');

const MATERIALS = ['MAT-1042', 'MAT-1010', 'MAT-1156', 'MAT-1287', 'MAT-1330', 'MAT-1099'];
const NAMES = {
  'MAT-1042': 'Precision bearing',
  'MAT-1010': 'Hydraulic pump seal kit',
  'MAT-1156': 'Industrial V-belt B52',
  'MAT-1287': 'Hex bolt M12x50 A2 (box)',
  'MAT-1330': 'Conveyor roller 76 mm',
  'MAT-1099': 'Laser distance sensor',
};

const ROOT = path.resolve(__dirname, '..');
const LABEL_DIR = path.join(ROOT, 'qr-labels');
const IMG_DIR = path.join(ROOT, 'images');
const MDK_IMG_DIR = path.resolve(ROOT, '..', 'mdk', 'Images');

async function main() {
  await mkdir(LABEL_DIR, { recursive: true });
  await mkdir(IMG_DIR, { recursive: true });
  await mkdir(MDK_IMG_DIR, { recursive: true });

  // --- QR labels ---------------------------------------------------------
  for (const code of MATERIALS) {
    const png = await QRCode.toBuffer(code, {
      type: 'png',
      errorCorrectionLevel: 'M',
      width: 480,
      margin: 2,
      color: { dark: '#102335', light: '#FFFFFF' },
    });
    await writeFile(path.join(LABEL_DIR, `${code}.png`), png);
    const svg = await QRCode.toString(code, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: 2,
      color: { dark: '#102335', light: '#FFFFFF' },
    });
    await writeFile(path.join(LABEL_DIR, `${code}.svg`), svg);
    console.log(`QR label: ${code}`);
  }

  // --- printable sheet ----------------------------------------------------
  const cells = MATERIALS.map(
    (code) => `
    <div class="label">
      <img src="${code}.png" alt="QR code for ${code}" />
      <div class="code">${code}</div>
      <div class="name">${NAMES[code]}</div>
    </div>`
  ).join('\n');
  const sheet = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Warehouse Lens - demo QR labels</title>
<style>
  body { font-family: system-ui, sans-serif; background: #F5F7FA; margin: 24px; }
  h1 { color: #102335; font-size: 20px; }
  p  { color: #607185; max-width: 640px; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; max-width: 900px; }
  .label { background: #fff; border: 1px solid #DFE6ED; border-radius: 12px; padding: 16px; text-align: center; }
  .label img { width: 100%; max-width: 220px; }
  .code { font-weight: 700; color: #162536; font-size: 18px; margin-top: 8px; }
  .name { color: #607185; font-size: 13px; }
  @media print { body { background: #fff; } .label { break-inside: avoid; } }
</style></head><body>
<h1>Warehouse Lens - demo QR labels</h1>
<p>Print this sheet and scan the labels with the Warehouse Lens app. Each QR encodes the plain
material code (for example <strong>MAT-1042</strong>) - no URLs, no executable content.</p>
<div class="grid">
${cells}
</div>
</body></html>\n`;
  await writeFile(path.join(LABEL_DIR, 'print-sheet.html'), sheet);
  console.log('QR label print sheet written.');

  // --- illustration rasters ----------------------------------------------
  for (const name of ['mat-1042', 'mat-generic', 'success']) {
    const svg = await readFile(path.join(ROOT, 'src', `${name}.svg`));
    for (const [size, suffix] of [[512, ''], [256, '@2x-small']]) {
      const png = await sharp(svg).resize(size, size).png().toBuffer();
      const out = `${name}${suffix === '' ? '' : suffix}.png`;
      await writeFile(path.join(IMG_DIR, out), png);
      if (suffix === '') {
        await writeFile(path.join(MDK_IMG_DIR, out), png);
      }
      console.log(`Illustration: ${out} (${size}px)`);
    }
  }
  console.log('Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
