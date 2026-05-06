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

// Common tailwind text greys found in codebase + any other standard greys used for text:
// gray-300: #d1d5db
// gray-400: #9ca3af
// gray-500: #6b7280
// gray-600: #4b5563
// gray-700: #374151
// gray-800: #1f2937 (this is almost #111827, but let's include it)
// Let's match color: '#... '
const regexInline = /color:\s*(['"])(#([dD]1[dD]5[dD][bB]|9[cC][aA]3[aA][fF]|6[bB]7280|4[bB]5563|374151|1[fF]2937|[aA]1[aA]1[aA][aA]|52525[bB]|[89a-fA-F][0-9a-fA-F]{5}))\1/g;

let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Replace inline colors (only if they are greyish and we are sure they are text)
  // "Only replace grey text colors with #111827"
  // Let's replace ONLY specific known greys we found previously:
  // #6b7280, #9ca3af, #4b5563, #374151, #d1d5db
  const targetGreys = ['#6b7280', '#9ca3af', '#4b5563', '#374151', '#d1d5db', '#A1A1AA', '#52525B', '#8c8c8c', '#808080', '#4A4A4A', '#7A7A7A'];
  
  content = content.replace(/(color:\s*['"]?)(#[0-9a-fA-F]{3,6})(['"]?)/g, (match, prefix, hex, suffix) => {
    let lowerHex = hex.toLowerCase();
    
    // Check if it's one of the target greys
    if (targetGreys.includes(lowerHex)) {
      return prefix + '#111827' + suffix;
    }
    
    // Also intelligently detect ANY shade of grey (r≈g≈b and not too dark or light)
    if (lowerHex.length === 7) {
      const r = parseInt(lowerHex.slice(1,3), 16);
      const g = parseInt(lowerHex.slice(3,5), 16);
      const b = parseInt(lowerHex.slice(5,7), 16);
      
      // If it's a grey tone (max diff between rgb <= 15) and not pure black/white
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
