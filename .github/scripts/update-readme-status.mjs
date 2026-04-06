import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const readmePath = path.resolve(__dirname, '../../README.md');

const now = new Date();
const pad = n => String(n).padStart(2, '0');
const timestamp = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())} ${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())} UTC`;

const badgeLabel = encodeURIComponent('Last Updated');
const badgeValue = encodeURIComponent(timestamp);
const badgeUrl = `https://img.shields.io/badge/${badgeLabel}-${badgeValue}-58a6ff?style=flat-square`;

const block = `<!-- STATUS_START -->
![Last Updated](${badgeUrl})
<!-- STATUS_END -->`;

let readme = fs.readFileSync(readmePath, 'utf8');

if (readme.includes('<!-- STATUS_START -->')) {
  readme = readme.replace(
    /<!-- STATUS_START -->[\s\S]*?<!-- STATUS_END -->/,
    block
  );
} else {
  // Insert before the final footer div if present, else append
  const footerMarker = '<img src="./assets/footer.svg"';
  const idx = readme.indexOf(footerMarker);
  if (idx !== -1) {
    // Find the start of the surrounding <div> before the footer
    const divStart = readme.lastIndexOf('<div', idx);
    readme = readme.slice(0, divStart) + block + '\n\n' + readme.slice(divStart);
  } else {
    readme += '\n\n' + block + '\n';
  }
}

fs.writeFileSync(readmePath, readme, 'utf8');
console.log(`Updated README.md with timestamp: ${timestamp}`);
