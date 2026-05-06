const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  for (let file of list) {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.css')) {
         results.push(file);
      }
    }
  }
  return results;
}

const files = walk('src');

let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  const targetGreys = ['#6b7280', '#9ca3af', '#4b5563', '#374151', '#d1d5db', '#a1a1aa', '#52525b', '#8c8c8c', '#808080', '#4a4a4a', '#7a7a7a'];
  
  content = content.replace(/(color:\s*['"]?)(#[0-9a-fA-F]{3,6})(['"]?)/g, (match, prefix, hex, suffix) => {
    let lowerHex = hex.toLowerCase();
    
    if (targetGreys.includes(lowerHex)) {
      return prefix + '#111827' + suffix;
    }
    
    if (lowerHex.length === 7) {
      const r = parseInt(lowerHex.slice(1,3), 16);
      const g = parseInt(lowerHex.slice(3,5), 16);
      const b = parseInt(lowerHex.slice(5,7), 16);
      
      const maxDiff = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
      if (maxDiff <= 15 && r > 20 && r < 235) {
         return prefix + '#111827' + suffix;
      }
    }
    
    return match;
  });
  
  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
    totalReplaced++;
  }
}

console.log('Total files updated:', totalReplaced);
