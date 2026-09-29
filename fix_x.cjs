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
    } else if (file.endsWith('.js') || file.endsWith('.jsx') || file.endsWith('.css')) {
      results.push(file);
    }
  }
  return results;
}

const files = walk('src');
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  const original = content;

  content = content.replace(/\u00c3\u2014/g, '\u00d7');

  if (content !== original) {
    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed', file);
  }
}
