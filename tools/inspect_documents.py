"""Rasterize Word-exported PDFs and check document structure/content."""
from pathlib import Path
import json
import re
from zipfile import ZipFile
from docx import Document
from pdf2image import convert_from_path
from pypdf import PdfReader
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
QA=ROOT/'.document-review'
POPPLER=Path(r'C:\Users\ADMIN\.cache\codex-runtimes\codex-primary-runtime\dependencies\native\poppler\Library\bin')

def all_text(doc):
    parts=[p.text for p in doc.paragraphs]
    parts.extend(cell.text for t in doc.tables for row in t.rows for cell in row.cells)
    return '\n'.join(parts)

report={}
for path in ROOT.glob('*.docx'):
    doc=Document(path)
    text=all_text(doc)
    (QA/(path.stem+'.txt')).write_text(text,encoding='utf-8')
    pdf=QA/(path.stem+'.pdf')
    reader=PdfReader(pdf)
    out=QA/path.stem
    out.mkdir(exist_ok=True)
    if not out.resolve().is_relative_to(QA.resolve()):
        raise ValueError('Render output must remain inside the QA directory')
    for previous_page in out.glob('page*.png'):
        previous_page.unlink()
    images=convert_from_path(str(pdf),dpi=115,output_folder=str(out),fmt='png',output_file='page',paths_only=True,poppler_path=str(POPPLER))
    findings=[]
    for phrase in ['FIXME','TODO','bất khả xâm phạm','đạt độ ổn định cao','gian lận thời gian và can thiệp bằng chứng']:
        if phrase.casefold() in text.casefold():findings.append(phrase)
    extracted=[p.extract_text() or '' for p in reader.pages]
    for i,page in enumerate(extracted):
        if len(re.sub(r'\s','',page))<25:
            findings.append(f'Check sparse page {i+1}')
    report[path.name]={'pages':len(reader.pages),'paragraphs':len(doc.paragraphs),'tables':len(doc.tables),'images':len(doc.inline_shapes),'findings':findings,'pngs':images}
    # Contact sheets are navigation aids; inspect individual pages at full size too.
    thumbs=[]
    for i,png in enumerate(images):
        im=Image.open(png).convert('RGB');im.thumbnail((390,550))
        tile=Image.new('RGB',(410,585),'#D8DDE4');tile.paste(im,((410-im.width)//2,20))
        ImageDraw.Draw(tile).text((12,562),f'{path.stem[:22]} / {i+1}',fill='black',font=ImageFont.truetype('C:/Windows/Fonts/arial.ttf',14))
        thumbs.append(tile)
    for start in range(0,len(thumbs),9):
        sheet=Image.new('RGB',(1230,585*((len(thumbs[start:start+9])+2)//3)),'white')
        for j,tile in enumerate(thumbs[start:start+9]):sheet.paste(tile,((j%3)*410,(j//3)*585))
        sheet.save(QA/f'{path.stem}-contact-{start//9+1}.png')
(QA/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
for name,item in report.items():print(name,json.dumps({k:v for k,v in item.items() if k!='pngs'},ensure_ascii=False))
