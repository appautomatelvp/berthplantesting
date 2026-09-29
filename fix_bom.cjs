const fs = require('fs');
const path = require('path');

function removeBOM(dir) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            removeBOM(fullPath);
        } else if (fullPath.endsWith('.js') || fullPath.endsWith('.jsx') || fullPath.endsWith('.css')) {
            let buffer = fs.readFileSync(fullPath);
            if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
                console.log('Removed BOM from ' + fullPath);
                fs.writeFileSync(fullPath, buffer.slice(3));
            }
            
            // Also replace ?? characters that might have been mangled
            let text = fs.readFileSync(fullPath, 'utf8');
            let original = text;
            text = text.replace(/????????/g, '-');
            text = text.replace(/??/g, ''); // Crude, but let's check what it is
            // Actually, just restoring from git is safer if they were corrupted.
        }
    }
}
removeBOM(path.join(__dirname, 'src'));
