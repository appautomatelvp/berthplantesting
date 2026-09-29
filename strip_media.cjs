const fs = require('fs');
let css = fs.readFileSync('src/index.css', 'utf8');

// Regex to match @media blocks
// This can be tricky with nested braces. Let's do a simple brace counter.
function stripMedia(text) {
  let result = '';
  let inMedia = false;
  let braceCount = 0;
  
  for (let i = 0; i < text.length; i++) {
    if (!inMedia) {
      if (text.startsWith('@media', i)) {
        inMedia = true;
        braceCount = 0;
        // fast forward to the first '{'
        while (text[i] !== '{' && i < text.length) i++;
        braceCount = 1;
      } else {
        result += text[i];
      }
    } else {
      if (text[i] === '{') braceCount++;
      if (text[i] === '}') braceCount--;
      if (braceCount === 0) {
        inMedia = false;
      }
    }
  }
  return result;
}

const stripped = stripMedia(css);
// Also remove the comment before the media query
const cleaned = stripped.replace(/\/\* Landscape desktop: chart stays wide; portrait phone: stack chrome, scroll plan \*\//g, '');
fs.writeFileSync('src/index.css', cleaned);
console.log('Done stripping @media queries.');
