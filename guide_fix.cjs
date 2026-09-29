const fs = require('fs');
let p = 'src/features/guide/pages/Guide.jsx';
let s = fs.readFileSync(p, 'utf8');

// Add state
s = s.replace("export default function Guide() {", "export default function Guide() {\n  const [activeSection, setActiveSection] = React.useState('');");

// Update onClick
s = s.replace("onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}", 
  "onClick={() => { setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}");

// Update className for chip
s = s.replace(/className="chip"/g, "className={\chip \\}");

// Update className for section
s = s.replace(/className="panel span-12"/g, "className={\panel span-12 \\}");
s = s.replace(/className="panel span-7"/g, "className={\panel span-7 \\}");
s = s.replace(/className="panel span-5"/g, "className={\panel span-5 \\}");

fs.writeFileSync(p, s, 'utf8');
