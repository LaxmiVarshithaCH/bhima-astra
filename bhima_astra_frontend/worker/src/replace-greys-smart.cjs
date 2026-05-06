const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  try {
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
  } catch(e){}
  return results;
}

const files = walk('src');

// Comprehensive list of greys to override. 
// "Override all grey shades (light, medium, dark grey)"
// Including tailwind standard greys, commonly seen variants.
const targetGreys = new Set([
  '#f3f4f6', '#e5e7eb', // very light greys
  '#d1d5db', '#9ca3af', // light / solid greys 
  '#6b7280', '#4b5563', '#374151', '#1f2937', // medium / dark greys
  '#a1a1aa', '#52525b', '#3f3f46', '#27272a', '#71717a', // zinc equivalents
  '#737373', '#525252', '#404040', '#262626', '#a3a3a3', // neutral equivalents
  '#a8a29e', '#78716c', '#57534e', '#44403c', '#292524', // stone equivalents
  '#8c8c8c', '#808080', '#4a4a4a', '#7a7a7a', '#999999', '#666666', '#444444', '#cccccc', '#dddddd', '#eeeeee'
].map(g => g.toLowerCase()));

// We also accept anything where diff between R,G,B <= 15 (except pure white/black)
function isGrey(hex) {
  let lowerHex = hex.toLowerCase();
  
  if (lowerHex.length === 4) { // e.g. #ccc
    lowerHex = '#' + lowerHex[1]+lowerHex[1] + lowerHex[2]+lowerHex[2] + lowerHex[3]+lowerHex[3];
  }
  
  if (targetGreys.has(lowerHex)) return true;
  
  if (lowerHex.length === 7) {
    const r = parseInt(lowerHex.slice(1,3), 16);
    const g = parseInt(lowerHex.slice(3,5), 16);
    const b = parseInt(lowerHex.slice(5,7), 16);
    
    // Ignore pure black & very near black (these are fine)
    if (r < 10 && g < 10 && b < 10) return false;
    // Ignore pure white
    if (r > 245 && g > 245 && b > 245) return false;

    // Check if it's a shade of grey (R, G, and B are within 15 units of each other)
    if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
      const maxDiff = Math.max(Math.abs(r-g), Math.abs(g-b), Math.abs(r-b));
      if (maxDiff <= 18) {
         return true;
      }
    }
  }
  return false;
}

let totalReplaced = 0;

for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  let original = content;
  
  // Find all hex codes
  const hexRegex = /(#[0-9a-fA-F]{3,6})\b/g;
  let result;
  const replacements = [];
  
  while ((result = hexRegex.exec(content)) !== null) {
    const hex = result[1];
    const index = result.index;
    
    if (isGrey(hex)) {
      // Look back up to 100 characters to determine the CSS property / context
      const lookback = content.substring(Math.max(0, index - 100), index);
      
      // Match property names or CSS variables right before it
      const propMatches = [...lookback.matchAll(/(color|border[-a-zA-Z]*|background[-a-zA-Z]*|stroke|fill|box-shadow|--[a-zA-Z0-9-]+)\s*[:=]/gi)];
      
      let isText = false;
      
      if (propMatches.length > 0) {
        const lastPropMatch = propMatches[propMatches.length - 1];
        const propName = lastPropMatch[1].toLowerCase();
        
        if (propName === 'color' || propName.includes('--text')) {
           isText = true;
        }
      } else {
        // If no property found, maybe it's in a string array or something, but usually there's a property.
        // Let's check for '--text' mapping in index.css
        if (lookback.includes('--text')) {
           isText = true;
        }
      }
      
      if (isText) {
        replacements.push({
          start: index,
          end: index + hex.length,
          replacement: '#111827'
        });
      }
    }
  }
  
  // Apply replacements from right to left so indices don't shift
  for (let i = replacements.length - 1; i >= 0; i--) {
    const r = replacements[i];
    content = content.substring(0, r.start) + r.replacement + content.substring(r.end);
  }
  
  // Also fix CSS text variables in :root or anywhere that was missed due to variable assignment
  // e.g. --text-secondary: #A1A1AA;
  // This will be caught by the above lookback correctly because the propName would be '--text-secondary' which includes '--text'!
  
  // Also we should check inline conditionally assigned styles like: ev.color which is mapped later.
  // Wait, if ev.color is mapped to `color: ev.color`, the grey is found with `color: '#...'` in the array.
  // What if an object has:
  // { color: '#6b7280' }
  // The lookback will find `color :` or `color:` ! So it will replace it.
  
  // What if `fill: '#...'` for svg? "Replace all grey-colored text". SVG text or icons? usually icons. The user asked for "grey-colored text".
  // If we only match 'color' and '--text', we're very safe.
  
  if (original !== content) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Updated:', file);
    totalReplaced++;
  }
}

console.log('Total files updated:', totalReplaced);
