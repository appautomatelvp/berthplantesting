const fs = require('fs');
const path = require('path');
function search(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) search(full);
        else if (full.endsWith('.jsx') || full.endsWith('.js') || full.endsWith('.css')) {
            const content = fs.readFileSync(full, 'utf8');
            if (content.includes('?')) console.log(full);
        }
    }
}
search(path.join(__dirname, 'src'));
