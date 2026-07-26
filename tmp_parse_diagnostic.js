const ts = require('typescript');
const fs = require('fs');
const path = 'components/admin/admin-panel.tsx';
const text = fs.readFileSync(path, 'utf8');
const src = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
if (src.parseDiagnostics.length === 0) {
  console.log('ok');
  process.exit(0);
}
for (const d of src.parseDiagnostics) {
  const msg = ts.flattenDiagnosticMessageText(d.messageText, '\n');
  const pos = d.start || 0;
  const { line, character } = src.getLineAndCharacterOfPosition(pos);
  console.log(`${msg} at ${line + 1}:${character + 1}`);
}
