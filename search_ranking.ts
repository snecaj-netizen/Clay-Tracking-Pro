import fs from 'fs';
import path from 'path';

function searchInFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('society_ranking') || line.includes('classifica') || line.includes('calcol') || line.includes('societ')) {
      if (line.length < 150) {
        console.log(`${filePath}:${idx+1} - ${line.trim()}`);
      } else {
        console.log(`${filePath}:${idx+1} - (long line) ${line.trim().substring(0, 100)}...`);
      }
    }
  });
}

const files = [
  'components/admin/RegionalChampionships.tsx',
  'server.ts',
  'types.ts'
];

files.forEach(searchInFile);
