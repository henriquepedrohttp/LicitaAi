"""Gera o PDF do edital fictício da demo a partir de src/app/demo/edital.json (mesmo texto exibido na Análise).
Uso: python3 frontend/scripts/gerar-edital-demo.py"""
import json, textwrap
from pathlib import Path

root = Path(__file__).resolve().parents[1]
data = json.loads((root / 'src/app/demo/edital.json').read_text(encoding='utf-8'))

def esc(s):
    return s.replace('\\', '\\\\').replace('(', '\\(').replace(')', '\\)').encode('cp1252')

def page_stream(paragraphs, number):
    out = [b'BT /F2 9 Tf 50 810 Td (' + esc(data['aviso']) + b') Tj ET']
    y = 770
    for i, para in enumerate(paragraphs):
        bold = i == 0 or para.isupper()
        for line in textwrap.wrap(para, 88 if not bold else 80):
            out.append(b'BT /%s %d Tf 50 %d Td (' % (b'F2' if bold else b'F1', 11, y) + esc(line) + b') Tj ET')
            y -= 16
        y -= 10
    out.append(b'BT /F1 9 Tf 270 30 Td (' + esc(f'Página {number} de {len(data["paginas"])}') + b') Tj ET')
    return b'\n'.join(out)

objs = [b'<</Type/Catalog/Pages 2 0 R>>', None,
        b'<</Type/Font/Subtype/Type1/BaseFont/Helvetica/Encoding/WinAnsiEncoding>>',
        b'<</Type/Font/Subtype/Type1/BaseFont/Helvetica-Bold/Encoding/WinAnsiEncoding>>']
kids = []
for n, paragraphs in enumerate(data['paginas'], 1):
    stream = page_stream(paragraphs, n)
    objs.append(b'<</Length %d>>stream\n' % len(stream) + stream + b'\nendstream')
    objs.append(b'<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 3 0 R/F2 4 0 R>>>>/Contents %d 0 R>>' % len(objs))
    kids.append(len(objs))
objs[1] = b'<</Type/Pages/Kids[' + b' '.join(b'%d 0 R' % k for k in kids) + b']/Count %d>>' % len(kids)
pdf, offsets = b'%PDF-1.4\n', []
for i, obj in enumerate(objs, 1):
    offsets.append(len(pdf)); pdf += b'%d 0 obj\n' % i + obj + b'\nendobj\n'
xref = len(pdf)
pdf += b'xref\n0 %d\n0000000000 65535 f \n' % (len(objs) + 1) + b''.join(b'%010d 00000 n \n' % o for o in offsets)
pdf += b'trailer<</Size %d/Root 1 0 R>>\nstartxref\n%d\n%%%%EOF\n' % (len(objs) + 1, xref)
target = root / 'public' / data['pdf'].lstrip('/')
target.write_bytes(pdf)
print(f'{target} ({len(pdf)} bytes, {len(kids)} páginas)')
