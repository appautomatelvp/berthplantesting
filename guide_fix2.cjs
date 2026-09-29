const fs = require('fs');
let p = 'src/features/guide/pages/Guide.jsx';
let s = fs.readFileSync(p, 'utf8');

s = s.replace('export default function Guide({ model }) {', "export default function Guide({ model }) {\n  const [activeSection, setActiveSection] = React.useState('');");
s = s.replace("onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}", 
  "onClick={() => { setActiveSection(id); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}");
s = s.replace(/className="chip"/g, "className={\chip \\}");

s = s.replace(/<section id="guide-defs" className="panel span-12">/g, "<section id=\"guide-defs\" className={\panel span-12 \\}>");
s = s.replace(/<section id="guide-logic" className="panel span-7">/g, "<section id=\"guide-logic\" className={\panel span-7 \\}>");
s = s.replace(/<section id="guide-live" className="panel span-5">/g, "<section id=\"guide-live\" className={\panel span-5 \\}>");

fs.writeFileSync(p, s, 'utf8');
