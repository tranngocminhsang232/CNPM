"""Update the three project reports from the agreed 1.1 specification."""
from pathlib import Path
import re
import shutil
import textwrap

from docx import Document
from docx.shared import Inches, Pt, RGBColor, Cm
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
QA = ROOT / '.document-review'
QA.mkdir(exist_ok=True)
BACKUP = ROOT / 'backups' / '2026-10-27-originals'
BACKUP.mkdir(parents=True, exist_ok=True)
FILES = ['SRS_Car_Sharing.docx', 'Bao_Cao_Convention_Va_Clean_Code_Car_Sharing.docx', 'Bao_cao_Kiem_thu_Car_Sharing.docx']
for name in FILES:
    if not (BACKUP / name).exists():
        shutil.copy2(ROOT / name, BACKUP / name)

def paragraphs(doc):
    yield from doc.paragraphs
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                yield from cell.paragraphs

def remove_decorations(p):
    pr = p._p.pPr
    if pr is not None:
        for tag in ('pBdr', 'shd'):
            for node in list(pr.findall(qn('w:' + tag))):
                pr.remove(node)

def set_font(run, name='Arial', size=10.5):
    run.font.name = name
    run.font.size = Pt(size)
    run.font.color.rgb = RGBColor(0, 0, 0)
    if run._element.rPr is not None:
        fonts = run._element.rPr.rFonts
        if fonts is not None:
            for key in ('ascii','hAnsi','eastAsia','cs'):
                fonts.set(qn('w:'+key), name)

def normalize(doc):
    for sec in doc.sections:
        sec.page_width, sec.page_height = Cm(21), Cm(29.7)
        sec.top_margin = sec.bottom_margin = Cm(2)
        sec.left_margin = sec.right_margin = Cm(2)
    for name in ('Normal','Title','Subtitle','Heading 1','Heading 2','Heading 3'):
        st = doc.styles[name]
        st.font.name = 'Arial'
        st.font.color.rgb = RGBColor(0,0,0)
        st.font.size = Pt({'Title':23,'Subtitle':12,'Heading 1':15,'Heading 2':12,'Heading 3':11}.get(name,10.5))
        st.paragraph_format.space_after = Pt(6)
        if name.startswith('Heading'):
            st.paragraph_format.keep_with_next = True
        if st.element.pPr is not None:
            for node in list(st.element.pPr.findall(qn('w:pBdr'))):
                st.element.pPr.remove(node)
    for p in paragraphs(doc):
        if not p._p.xpath('.//w:drawing'):
            cleaned=p.text
            for token in ('💻','🌟','⚠️'):
                cleaned=cleaned.replace(token,'')
            if cleaned!=p.text:p.text=cleaned.strip()
        remove_decorations(p)
        p.paragraph_format.line_spacing = 1.12
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.widow_control = True
        if p.text.startswith('Bảng ') or p.text.startswith('4.2 Checklist 10'):
            p.paragraph_format.keep_with_next = True
        is_code = p.style.name == 'Code'
        is_head = p.style.name.startswith('Heading') or p.style.name in ('Title','Subtitle')
        for run in p.runs:
            # Preserve drawings and their relations; normalize text only.
            if run.text:
                set_font(run, 'Consolas' if is_code else 'Arial', 9 if is_code else 10.5)
                if is_head:
                    run.font.size = doc.styles[p.style.name].font.size
        if is_code:
            p.paragraph_format.line_spacing = 1.0
            p.paragraph_format.space_after = Pt(0)
            p.paragraph_format.keep_together = False
    for table in doc.tables:
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False
        n = len(table.columns)
        # Repeated records use deliberate proportions, with compact ID columns.
        ratios = {2:[.31,.69],3:[.23,.33,.44],4:[.18,.24,.29,.29],5:[.44,.14,.14,.14,.14]}.get(n,[1/n]*n)
        for row_i,row in enumerate(table.rows):
            trpr = row._tr.get_or_add_trPr()
            for h in list(trpr.findall(qn('w:trHeight'))):
                trpr.remove(h)
            # Let long narrative cells split rather than pushing a whole page.
            for node in list(trpr.findall(qn('w:cantSplit'))):
                trpr.remove(node)
            if max((len(cell.text) for cell in row.cells),default=0)<500:
                trpr.append(OxmlElement('w:cantSplit'))
            if row_i == 0 and not trpr.findall(qn('w:tblHeader')):
                trpr.append(OxmlElement('w:tblHeader'))
            for j,cell in enumerate(row.cells):
                cell.width = Cm(17*ratios[min(j,len(ratios)-1)])
                cell.vertical_alignment = WD_CELL_VERTICAL_ALIGNMENT.CENTER
                tcpr = cell._tc.get_or_add_tcPr()
                for tag in ('shd','tcBorders','tcMar'):
                    for node in list(tcpr.findall(qn('w:'+tag))):
                        tcpr.remove(node)
                shd = OxmlElement('w:shd')
                shd.set(qn('w:fill'), 'E7EDF3' if row_i==0 else ('F6F8FA' if row_i%2==0 else 'FFFFFF'))
                tcpr.append(shd)
                borders=OxmlElement('w:tcBorders')
                for edge in ('top','left','bottom','right'):
                    e=OxmlElement('w:'+edge); e.set(qn('w:val'),'single');e.set(qn('w:sz'),'4');e.set(qn('w:color'),'D9D9D9');borders.append(e)
                tcpr.append(borders)
                margins=OxmlElement('w:tcMar')
                for edge in ('top','left','bottom','right'):
                    e=OxmlElement('w:'+edge);e.set(qn('w:w'),'85');e.set(qn('w:type'),'dxa');margins.append(e)
                tcpr.append(margins)
                for p in cell.paragraphs:
                    p.paragraph_format.space_after = Pt(3)
                    p.paragraph_format.keep_with_next = row_i == 0
                    for run in p.runs:
                        set_font(run,size=9)
                        if row_i==0: run.bold=True
    for shape in doc.inline_shapes:
        scale=min(1, Cm(16.7)/shape.width, Cm(20)/shape.height)
        if scale<1:
            shape.width=int(shape.width*scale);shape.height=int(shape.height*scale)

def style_code(doc):
    if 'Code' not in doc.styles:
        from docx.enum.style import WD_STYLE_TYPE
        doc.styles.add_style('Code', WD_STYLE_TYPE.PARAGRAPH)
    doc.styles['Code'].font.name='Consolas'
    doc.styles['Code'].font.size=Pt(9)

def markdown(doc, text, heading_offset=0):
    lines=text.splitlines(); i=0; in_code=False
    while i<len(lines):
        line=lines[i].rstrip()
        if line.startswith('```'):
            in_code=not in_code; i+=1;continue
        if in_code:
            doc.add_paragraph(line,style='Code');i+=1;continue
        if not line:
            i+=1;continue
        if line.startswith('|') and i+1<len(lines) and re.match(r'^\|[\s:|\-]+\|$',lines[i+1]):
            block=[]
            while i<len(lines) and lines[i].startswith('|'):
                if not re.match(r'^\|[\s:|\-]+\|$',lines[i]):
                    block.append([c.strip().replace('`','') for c in lines[i].strip('|').split('|')])
                i+=1
            t=doc.add_table(rows=0,cols=len(block[0]))
            for cells in block:
                row=t.add_row()
                for cell,value in zip(row.cells,cells):cell.text=value
            doc.add_paragraph()
            continue
        m=re.match(r'^(#{1,3})\s+(.*)$',line)
        if m:
            level=len(m.group(1))+heading_offset
            title=m.group(2).replace('`','')
            title=re.sub(r'[#:|/()&–—.,]',' ',title)
            title=re.sub(r'\s+',' ',title).strip()
            if level==1 and len(doc.paragraphs)==0:
                doc.add_paragraph(title,style='Title')
            else:
                doc.add_heading(title,level=min(max(level-1,1),3))
        elif re.match(r'^- \[[ x]\]',line):
            doc.add_paragraph(line[2:].replace('[x]','Đã xong:').replace('[ ]','Chưa xong:'),style='List Bullet')
        elif line.startswith('- '):
            doc.add_paragraph(line[2:].replace('`',''),style='List Bullet')
        else:
            doc.add_paragraph(line.replace('`','').replace('**',''))
        i+=1

def add_footer(doc):
    for sec in doc.sections:
        sec.different_first_page_header_footer=False
        for region in (sec.header,sec.first_page_header,sec.even_page_header,sec.footer,sec.first_page_footer,sec.even_page_footer):
            for child in list(region._element):region._element.remove(child)
            region.add_paragraph()
        footer=sec.footer.paragraphs[0]
        footer.alignment=2
        footer.text=''
        run=footer.add_run('Nhóm 7 | Phiên bản 1.1 | ')
        set_font(run,size=8)
        field=OxmlElement('w:fldSimple');field.set(qn('w:instr'),'PAGE');footer._p.append(field)

def font(size,bold=False):
    return ImageFont.truetype(str(Path('C:/Windows/Fonts')/('arialbd.ttf' if bold else 'arial.ttf')),size)

def flow_picture(name, title, rows, footer=''):
    W=1500; pad=55; row_h=118; top=110; H=top+len(rows)*row_h+90
    im=Image.new('RGB',(W,H),'white'); d=ImageDraw.Draw(im)
    d.text((W//2,38),title,font=font(32,True),fill='#15243B',anchor='mm')
    for i,text in enumerate(rows):
        y=top+i*row_h
        d.rounded_rectangle((pad,y,W-pad,y+85),radius=12,fill=('#EEF4FA' if i%2==0 else '#F4F8F5'),outline='#A7B7C8',width=2)
        chunks=text.split('\n')
        for j,line in enumerate(chunks):
            d.text((W//2,y+42+(j-(len(chunks)-1)/2)*33),line,font=font(30,True if i==0 else False),fill='#18283D',anchor='mm')
        if i<len(rows)-1:
            x=W//2; d.line((x,y+88,x,y+112),fill='#4E6379',width=3)
            d.polygon([(x,y+116),(x-8,y+106),(x+8,y+106)],fill='#4E6379')
    if footer:d.text((W//2,H-30),footer,font=font(25),fill='#43566D',anchor='mm')
    out=QA/(name+'.png');im.save(out);return out

FIGURES=[
('roles','Vai trò và chức năng',[
 'Tài khoản có thể dùng giao diện Owner và Renter',
 'Owner: đăng xe, ảnh, lịch bận và duyệt yêu cầu',
 'Renter: tìm xe, xem chi tiết, báo giá và đặt xe',
 'Hai bên: quản lý đơn, checklist và bàn giao',
 'Hai bên: đánh giá sau chuyến | Owner: doanh thu dự kiến'
 ],'Quyền sở hữu và tư cách tham gia được kiểm tra trên server'),
('booking','Luồng tạo và duyệt booking',[
 'Quote không giữ lịch | Tạo booking cần Idempotency-Key',
 'Khóa vehicle, xử lý hold hết hạn và kiểm tra khả dụng',
 'Một transaction: REQUESTED + snapshot + calendar + key + audit',
 'REQUESTED giữ lịch tới min(createdAt + 24 giờ, startAt)',
 'APPROVED: tiếp tục giữ lịch | REJECTED / EXPIRED: giải phóng'
 ],'Cùng key và nội dung: replay | Khác nội dung hoặc trùng lịch: 409'),
('calendar','Quy tắc lịch thống nhất',[
 'Khoảng [startAt, endAt): tiếp giáp được phép',
 'REQUESTED / APPROVED / IN_PROGRESS giữ lịch',
 'OWNER_BLOCK dùng chung calendar và constraint chống giao nhau',
 'Khóa vehicle trước mọi thay đổi calendar',
 'Xe trả muộn: ẩn search, chặn đơn mới và nhận chuyến kế tiếp'
 ],'PostgreSQL exclusion constraint bảo vệ calendar active'),
('keyless','Checklist và Keyless',[
 'Server kiểm tra quyền, trạng thái, checklist và thời gian',
 'START: BEFORE finalized | COMPLETE: AFTER finalized',
 'Ghi PENDING rồi gọi simulator ngoài transaction',
 'Có xác nhận: SUCCEEDED và chuyển trạng thái một lần',
 'Lỗi / timeout: FAILED hoặc UNKNOWN, booking giữ nguyên',
 'Manual: owner + renter xác nhận, ghi lý do và audit'
 ],'Timeout không đồng nghĩa thiết bị chưa thực hiện lệnh'),
('state','Vòng đời booking',[
 'REQUESTED giữ lịch ngay khi tạo',
 'Owner duyệt → APPROVED | Từ chối → REJECTED',
 'Hết hạn duyệt → EXPIRED | Hủy hợp lệ → CANCELLED',
 'APPROVED + BEFORE + START được xác nhận → IN_PROGRESS',
 'IN_PROGRESS + AFTER + COMPLETE được xác nhận → COMPLETED',
 'REJECTED / EXPIRED / CANCELLED / COMPLETED: giải phóng lịch'
 ],'Không hủy khi có operation PENDING / UNKNOWN'),
('sequence','Thứ tự thao tác Keyless',[
 'Web → API: yêu cầu START / COMPLETE và key',
 'API → DB: kiểm tra điều kiện, ghi PENDING, commit operationId',
 'API → Web: 202 | Worker → Simulator: command(operationId)',
 'Simulator xác nhận → transaction cập nhật operation và booking',
 'Timeout → UNKNOWN | Web đọc kết quả qua API',
 'Reconcile dùng cùng operationId; manual cần hai xác nhận'
 ],'Không giữ transaction DB khi chờ thiết bị'),
('data','Mô hình dữ liệu chính',[
 'User → Vehicle → Booking → PricingSnapshot',
 'Vehicle → Calendar: booking và owner block',
 'Booking → IdempotencyRecord và BookingEvent',
 'Booking → Inspection → InspectionPhoto → MediaObject',
 'Booking → KeylessOperation → ManualHandover',
 'Booking → Review: unique theo booking và author'
 ],'Mô hình bảng đầy đủ: docs/DATABASE_DESIGN.md')
]

def build_srs():
    doc=Document();style_code(doc)
    markdown(doc,(ROOT/'docs/SRS.md').read_text(encoding='utf-8'))
    doc.add_page_break();doc.add_heading('9 Sơ đồ luồng triển khai',level=1)
    doc.add_paragraph('Các sơ đồ được đồng bộ với phiên bản 1.1. Mỗi hình tóm tắt một luồng; bảng trạng thái và quy tắc nghiệp vụ trong phần trước quy định các điều kiện chi tiết.')
    for i,(name,title,rows,foot) in enumerate(FIGURES):
        if i and i%2==0:doc.add_page_break()
        doc.add_heading(f'Hình {i+1} {title}',level=2)
        path=flow_picture(name,title,rows,foot)
        doc.add_picture(str(path),width=Cm(16.7))
    doc.add_page_break();doc.add_heading('10 Tóm tắt dữ liệu và API',level=1)
    for file in ('DATABASE_DESIGN.md','API_CONTRACT.md'):
        text=(ROOT/'docs'/file).read_text(encoding='utf-8')
        title='Danh mục bảng và constraint' if file.startswith('DATABASE') else 'Danh mục endpoint'
        doc.add_heading(title,level=2)
        # Include comparable records in Word; detailed field/behavior contracts remain in Markdown.
        blocks=re.findall(r'(?m)^\|[^\n]+\n\|[\s:|\-]+\|\n(?:\|[^\n]+\n?)+',text)
        for block in blocks:markdown(doc,block)
    normalize(doc);add_footer(doc)
    doc.core_properties.title='Đặc tả yêu cầu hệ thống Car Sharing phiên bản 1.1'
    doc.core_properties.author='Nhóm 7'
    doc.save(ROOT/FILES[0])

PRICE_CODE='''// Pure domain TypeScript. Chính sách MVP: phí và cọc bằng 0.
const MS_PER_DAY = 86_400_000;
const MIN_RENTAL_MS = 3_600_000;
const MAX_RENTAL_MS = 30 * MS_PER_DAY;
const MAX_DAILY_PRICE_VND = 100_000_000;

export interface RentalPriceBreakdown {
  readonly rentalDays: number;
  readonly pricePerDayVnd: number;
  readonly subtotalVnd: number;
  readonly serviceFeeVnd: number;
  readonly depositVnd: number;
  readonly totalVnd: number;
}

export function calculateBreakdown(
  pricePerDayVnd: number, start: Date, end: Date,
): RentalPriceBreakdown {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const duration = endMs - startMs;
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)
      || duration < MIN_RENTAL_MS || duration > MAX_RENTAL_MS) {
    throw new Error('INVALID_RENTAL_PERIOD');
  }
  if (!Number.isSafeInteger(pricePerDayVnd)
      || pricePerDayVnd <= 0 || pricePerDayVnd > MAX_DAILY_PRICE_VND) {
    throw new Error('INVALID_DAILY_PRICE');
  }
  const rentalDays = Math.ceil(duration / MS_PER_DAY);
  const subtotalVnd = rentalDays * pricePerDayVnd;
  if (!Number.isSafeInteger(subtotalVnd)) {
    throw new Error('PRICE_OVERFLOW');
  }
  return {
    rentalDays, pricePerDayVnd, subtotalVnd,
    serviceFeeVnd: 0, depositVnd: 0, totalVnd: subtotalVnd,
  };
}'''

BOOKING_CODE='''THUẬT TOÁN ĐIỀU PHỐI — không phải mã đã triển khai
1. Chuẩn hóa DTO, key và requestHash; tra replay theo actor/scope/key.
2. Mở transaction; khóa vehicle bằng SELECT ... FOR UPDATE.
3. Tra replay lại; xử lý hold REQUESTED hết hạn.
4. Kiểm tra xe, người thuê, calendar, chuyến đang trả muộn.
5. Gọi calculator thuần; đối chiếu expectedTotalVnd/pricingVersion.
6. Ghi booking + snapshot + calendar + key + event + notification.
7. Commit; nếu unique key tranh chấp, rollback rồi đọc để replay.
8. Exclusion violation → 409; deadlock retry có giới hạn.
Calendar dùng exclusion constraint cho cả BOOKING và OWNER_BLOCK.
Không gọi HTTP, storage hoặc thiết bị trong transaction này.'''

HTTP_CODE='''// Adapter HTTP cho giai đoạn thiết bị thật; MVP dùng simulator.
// Module cần imports: [HttpModule] và đăng ký provider này.
@Injectable()
export class KeylessHttpAdapter {
  constructor(
    private readonly httpService: HttpService,
    private readonly config: KeylessConfig,
  ) {}

  public async send(command: KeylessCommand): Promise<KeylessResult> {
    // Dùng service credential, không chuyển JWT của renter.
    // KeylessCommand có operationId để thiết bị xử lý idempotent.
    const response = await firstValueFrom(
      this.httpService.post<unknown>(
        this.config.commandUrl, command,
        { timeout: this.config.timeoutMs,
          headers: { Authorization: `Bearer ${this.config.serviceToken}` } },
      ),
    );
    // Schema kiểm tra operationId, action, trạng thái và kiểu dữ liệu.
    return parseHardwareResult(response.data);
  }
}
// Lớp orchestration phân biệt FAILED/UNKNOWN; timeout không báo thành công.
// KeylessCommand, KeylessConfig và parser được triển khai ở G4.'''

def replace_table(table,text):
    table.cell(0,0).text=text

def unwrap_single_cells(doc):
    for table in list(doc.tables):
        if len(table.rows)!=1 or len(table.columns)!=1:continue
        text=table.cell(0,0).text
        is_code=any(s in text for s in ('export class','export function','@Injectable','package main','type SecureInspectionPayload','"singleQuote"','THUẬT TOÁN ĐIỀU PHỐI','src/common/constants'))
        for line in text.splitlines():
            p=OxmlElement('w:p');table._tbl.addprevious(p)
            from docx.text.paragraph import Paragraph
            para=Paragraph(p,doc._body)
            para.text=line
            if is_code:para.style=doc.styles['Code']
        table._tbl.getparent().remove(table._tbl)

def build_clean_code():
    doc=Document(BACKUP/FILES[1]);style_code(doc)
    tables=doc.tables
    replace_table(tables[9],PRICE_CODE)
    replace_table(tables[10],BOOKING_CODE)
    replace_table(tables[13],'''// src/common/constants/rental-pricing.constants.ts
export const RENTAL_POLICY = {
  MS_PER_DAY: 86_400_000,
  MIN_RENTAL_MS: 3_600_000,
  MAX_RENTAL_DAYS: 30,
  MAX_DAILY_PRICE_VND: 100_000_000,
  PLATFORM_FEE_VND: 0,
  SECURITY_DEPOSIT_VND: 0,
  REQUEST_HOLD_MS: 24 * 3_600_000,
  PRICING_VERSION: 'daily-v1',
} as const;
export const MEDIA_POLICY = {
  MAX_IMAGE_BYTES: 5 * 1024 * 1024,
  SIGNED_URL_TTL_SECONDS: 300,
} as const;
export const KEYLESS_POLICY = { TIMEOUT_MS: 3_000 } as const;''')
    replace_table(tables[14],HTTP_CODE)
    replace_table(tables[15],'''Defensive copying bảo vệ trạng thái mutable trong cùng tiến trình.
Constructor sao chép Date và mảng đầu vào; getter trả bản sao.
readonly kiểm tra ở compile time; Object.freeze là shallow.
Với cấu trúc lồng nhau cần clone sâu hoặc mô hình bất biến phù hợp.
Biên HTTP serialize dữ liệu: client không giữ tham chiếu RAM của server.
Phân quyền, validation, immutable evidence và audit vẫn bắt buộc.''')
    replace_table(tables[16],'''Ví dụ 1 về lỗi tham chiếu trong cùng tiến trình
Một service giữ Date đầu vào mà caller vẫn có thể thay đổi bằng setDate().
Caller nội bộ có thể làm entity khác với dữ liệu đã tính giá.
Sao chép Date ở inbound/outbound ngăn lỗi chia sẻ tham chiếu này.
Không suy ra người dùng trình duyệt có thể sửa Date trên server qua getter.
API nhận dữ liệu mới phải kiểm tra quyền và tính lại điều kiện server-side.''')
    replace_table(tables[17],'''Ví dụ 2 về mảng ảnh và bằng chứng
Getter trả mảng nội bộ khiến caller cùng tiến trình có thể splice/pop.
Với string[]: clone mảng bảo vệ danh sách; với object[] phải xử lý phần tử.
Ảnh checklist cần thêm quyền booking, trạng thái finalized, checksum,
staging/final key tách biệt và lịch sử điều chỉnh. Copy mảng đơn lẻ
không chứng minh ảnh không bị sửa trong storage hoặc dữ liệu đã xác thực.''')
    # Complete the optional Go example; it is not an MVP service requirement.
    go=tables[20].cell(0,0).text
    if not go.rstrip().endswith('}'):go+='\n}'
    replace_table(tables[20],'// Ví dụ Go tham khảo cho giai đoạn mở rộng; không thuộc MVP.\n'+go)
    replace_table(tables[23],'''Kết quả của báo cáo là bộ quy chuẩn và hướng dẫn triển khai.
SRP tách domain calculation khỏi I/O nhưng cho phép application service
điều phối nhiều bước của cùng một use case. No Magic Numbers tập trung
các tham số chính sách có ý nghĩa; defensive copying hạn chế mutable alias.
Độ đúng của lịch và chất lượng vận hành phải được xác nhận bằng migration,
test PostgreSQL đồng thời và log thực thi. Chưa có căn cứ tuyên bố
Production Ready, thời gian test hoặc tỷ lệ chống đặt trùng đã đo.''')
    replacements={
        'BÁO CÁO QUY CHUẨN LẬP TRÌNH VÀỨNG DỤNG 3 NGUYÊN LÝ CLEAN CODE CỐT LÕI':'Quy chuẩn lập trình và ba nguyên lý Clean Code cho Car Sharing',
        'Golang được sử dụng riêng cho microservice xử lý luồng stream ảnh Digital Checklist và upload S3 tốc độ cao (Listing 3 từ SRS). Mã nguồn Go phải tuân thủ nghiêm ngặt tài liệu chuẩn \'Effective Go\' và các nguyên tắc idiomatic:':'MVP dùng NestJS và S3-compatible storage cho media; không cần Go microservice. Các quy chuẩn Go dưới đây chỉ áp dụng nếu nhóm bổ sung dịch vụ Go ở giai đoạn mở rộng.',
        "ít nhất 2 approvals":"ít nhất 1 approval ngoài tác giả; auth/transaction cần reviewer có chuyên môn",
        'Không thành viên nào được tự ý phê duyệt và merge PR của chính mình.':'Tác giả không tự approve; merge chỉ sau review độc lập và CI đạt.',
        'Mỗi PR không được vượt quá 400 dòng thay đổi (lines of code diff). PR quá lớn phải chia nhỏ thành các sub-tasks.':'Mục tiêu PR dưới 400 dòng thay đổi có ý nghĩa; file sinh và lockfile được xét riêng. Chia nhỏ khi cần để reviewer đánh giá được.',
        'SRS Gốc':'ví dụ trước chuẩn hóa', 'SRS GỐC':'ví dụ trước chuẩn hóa', 'SRS gốc':'ví dụ trước chuẩn hóa',
        'Sẵn sàng cho sản xuất (Production-Ready)':'Điều kiện sẵn sàng triển khai',
        'BẢO MẬT TUYỆT ĐỐI':'bảo vệ tham chiếu nội bộ',
        'Defensive Copying Hoàn hảo':'Defensive Copying cho Date và string[]',
        '100% SRP':'tách domain và I/O', '100% SRP TUYỆT ĐỐI':'tách domain và I/O',
        'toàn diện 2 chiều':'ở hai chiều',
        'Kiểm thử Unit Test 100% trong 0.1ms.':'Có thể kiểm thử độc lập; thời gian và coverage cần đo thực tế.',
        'kiểm thử được 100% trong vài micro-giây':'có thể kiểm thử độc lập; không mặc định kết quả hoặc thời gian thực thi',
        'Tỷ lệ phí dịch vụ hoa hồng nền tảng (10%)':'Ví dụ chính sách mở rộng; MVP phí bằng 0',
        '0.10':'0.00',
        'loại trừ hoàn toàn các lỗi tiềm ẩn':'giảm lỗi tiềm ẩn',
        'Golang (Stream Microservice)':'Golang tham khảo cho giai đoạn mở rộng',
        'kiến trúc Golang':'kiến trúc tham khảo Golang',
        'thay thế 100% số trần trụi':'tập trung các tham số chính sách',
        'hai kịch bản tấn công khai thác tham chiếu (Reference Mutation Exploits) cực kỳ nghiêm trọng sẽ diễn ra':'các lỗi chia sẻ tham chiếu có thể xuất hiện trong cùng tiến trình',
        'BCRYPT_SALT_ROUNDS':'ARGON2_CONFIG',
        'MAX_RETRIES':'MAX_RECONCILE_ATTEMPTS',
    }
    for p in paragraphs(doc):
        text=p.text;new=text
        for old,value in replacements.items():new=new.replace(old,value)
        if 'Dưới sự chủ trì của QA Lead' in text:
            new='Chiến lược kiểm thử ưu tiên nhiều unit tests cho domain, integration tests cho DB/storage và ít ca UI xuyên suốt. Không ấn định tỷ lệ 70/20/10. Domain cần coverage >= 80% lines và branches. Concurrency cần PostgreSQL thật; E2E API dùng Supertest, E2E web dùng Playwright. Kết quả simulator không chứng minh thiết bị thật đã hoạt động.'
        if 'Quy tắc Two-Person Approval' in text:
            new='1. Review độc lập: Mỗi PR cần ít nhất một approval ngoài tác giả. Thay đổi auth hoặc transaction phải được Trí hoặc Việt review chuyên môn; reviewer chuyên môn có thể là chính reviewer độc lập đó.'
        if 'Unique Index' in text and 'idempotency_key' in text:
            new='Tên bảng/cột SQL dùng snake_case, Prisma map sang camelCase. Khóa chính UUID, FK lịch sử dùng onDelete RESTRICT. Idempotency unique theo (actor_id, operation, key), kèm request_hash. Calendar có exclusion constraint theo vehicle và khoảng [start_at,end_at), áp dụng cả booking và owner block. Mọi thao tác ghi lịch khóa hàng vehicle trước, cập nhật trạng thái và calendar cùng transaction. Chỉ mục và thời gian truy vấn phải được đo trên dữ liệu/tải đã xác định; không mặc định một index bảo đảm dưới 50 ms.'
        if 'Phương thức \'createIdempotentBooking\' đang ôm đồm' in text:
            new='Ví dụ ban đầu đặt calculation cùng lớp với Prisma, làm khó việc kiểm thử và thay đổi công thức độc lập. Application service được phép điều phối transaction, kiểm tra lịch và gọi calculator cho một use case; số bước orchestration không tự động là vi phạm SRP. Tách pure calculator và các adapter giúp quản lý các lý do thay đổi rõ hơn.'
        if 'chỉ thực hiện ĐÚNG MỘT VIỆC' in text:
            new=new.replace('Một hàm/lớp chỉ thực hiện ĐÚNG MỘT VIỆC duy nhất (Một lý do duy nhất để thay đổi).','Một module/lớp có một nhóm trách nhiệm gắn với một lý do thay đổi; không đồng nhất SRP với số dòng hay số lời gọi.')
        if new!=text and not p._p.xpath('.//w:drawing'):p.text=new
    # Fix table entries whose old limits/claims do not follow the MVP policy.
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if 'Kiểm tra kích thước hàm <= 30 dòng' in cell.text:
                    cell.text='Review trách nhiệm và lý do thay đổi; số dòng là dấu hiệu, không phải định nghĩa SRP.'
                if 'Grep search mã nguồn: 0 con số vô danh' in cell.text:
                    cell.text='Review hằng số chính sách; cho phép giá trị hiển nhiên trong ngữ cảnh.'
    unwrap_single_cells(doc)
    if doc.inline_shapes:
        pic=flow_picture('clean-principles','Ba nguyên lý Clean Code',[
            'SRP: tách domain calculation và các adapter I/O',
            'No Magic Numbers: đặt tên cho các tham số chính sách',
            'Defensive Copying: hạn chế mutable alias trong cùng tiến trình',
        ],'Các nguyên lý không thay thế phân quyền, validation và kiểm thử')
        shape=doc.inline_shapes[0]
        rid=shape._inline.graphic.graphicData.pic.blipFill.blip.embed
        doc.part.related_parts[rid]._blob=pic.read_bytes()
        with Image.open(pic) as im:
            shape.width=Cm(16.7);shape.height=int(shape.width*im.height/im.width)
    doc.paragraphs[0].text='Quy chuẩn lập trình và ba nguyên lý Clean Code cho Car Sharing'
    doc.paragraphs[0].style=doc.styles['Title']
    # Introduce the current policy immediately after the title.
    intro=doc.paragraphs[1].insert_paragraph_before('Phiên bản 1.1 ngày 27/10/2026. Quy chuẩn áp dụng cùng SRS 1.1: REQUESTED giữ lịch, khoảng [start,end), giá VND không phụ phí/cọc trong MVP, NestJS modular monolith và Keyless simulator.')
    doc.paragraphs[2].insert_paragraph_before('Các listing trước chuẩn hóa là ví dụ lịch sử lưu trong bản gốc tại backups/2026-10-27-originals. Hợp đồng triển khai hiện hành nằm trong SRS 1.1 và bộ tài liệu docs; các ví dụ rút gọn không thay thế code/migration đã kiểm thử.')
    doc.add_page_break();doc.add_heading('Phụ lục Quy tắc triển khai bắt buộc',level=1)
    markdown(doc,'''- Khóa vehicle trước khi sửa calendar; có exclusion constraint cho booking và owner block.
- Ghi booking, snapshot, calendar, idempotency và audit cùng transaction.
- Hash idempotency có cả actor/scope và payload chuẩn hóa; không trả kết quả chéo người dùng.
- Không dùng JWT người thuê làm credential thiết bị. HttpService phải inject và đăng ký HttpModule.
- Upload staging, verify rồi copy final key; không đọc file theo key/đường dẫn tùy ý.
- Keyless timeout là UNKNOWN, không tự chuyển trạng thái booking thành công.
- Một review cho mỗi booking/author; tổng dashboard không phụ thuộc review.
- Chi tiết hợp đồng nằm trong docs/SRS.md, API_CONTRACT.md và DATABASE_DESIGN.md.''')
    normalize(doc);add_footer(doc);doc.save(ROOT/FILES[1])

def build_testing():
    doc=Document(BACKUP/FILES[2]);style_code(doc)
    for p in paragraphs(doc):
        text=p.text;new=text
        if 'Nền tảng sử dụng Next.js/TypeScript' in text:
            new='Hệ thống gồm xác thực, quản lý xe, tìm kiếm, tính giá, booking, checklist, Keyless, review và doanh thu dự kiến. MVP dùng Next.js/TypeScript, NestJS modular monolith, Prisma/PostgreSQL, private S3-compatible storage và Keyless simulator. Báo cáo trình bày thiết kế kiểm thử; chưa phải log đã chạy. SRS 1.1 quy định đơn giá nguyên VND, phí/cọc bằng 0, thời lượng 1 giờ đến 30 ngày.'
        if 'hasTimeOverlap() nhận thêm touchingConflicts' in text:
            new='findBookingByKey() chỉ trả kết quả sau khi kiểm tra actor/scope/key và payload hash. hasTimeOverlap() dùng duy nhất a.start < b.end && a.end > b.start theo khoảng [start,end); hai khoảng tiếp giáp không xung đột. Search và create booking phải dùng cùng quy tắc, REQUESTED còn hạn giữ lịch ngay.'
        if text.startswith('validateRentalPeriod() kiểm tra ngày hợp lệ'):
            new='validateRentalPeriod() kiểm tra ngày hợp lệ, end > start và thời lượng 1 giờ đến 30 ngày. calculateRentalDays() làm tròn lên theo 24 giờ. calculateRentalPrice() dùng đơn giá nguyên dương VND không vượt 100 triệu/ngày; calculateBreakdown() bổ sung các trường phí/cọc bằng 0 trong MVP. Các ca biên xác minh đúng hợp đồng của từng hàm.'
        new=new.replace('hasTimeOverlap(a: TimeRange, b: TimeRange, touchingConflicts: boolean)','hasTimeOverlap(a: TimeRange, b: TimeRange)')
        new=new.replace("sendLockCommand(vehicleId: string, command: 'UNLOCK' | 'LOCK', token: string): Promise<KeylessResult>","sendLockCommand(command: KeylessCommand): Promise<KeylessResult>")
        new=new.replace('startRental(bookingId: string, actorId: string): Promise<Booking>','startRental(bookingId: string, actorId: string): Promise<KeylessOperation>')
        new=new.replace('completeRental(bookingId: string, actorId: string): Promise<Booking>','completeRental(bookingId: string, actorId: string): Promise<KeylessOperation>')
        new=new.replace('success = false, fallbackMode = true; có log.','Operation FAILED hoặc UNKNOWN; booking giữ nguyên; có log và quy trình manual.')
        if 'phải được thống nhất' in text and 'trạng thái nào giữ chỗ' in text:
            new='REQUESTED còn hạn, APPROVED và IN_PROGRESS giữ calendar. REJECTED, CANCELLED, EXPIRED và COMPLETED giải phóng lịch cùng transaction. Review transitionBooking() phải đối chiếu đúng bảng trạng thái SRS 1.1, thời hạn duyệt và quyền tài nguyên.'
        if 'mục tiêu phản hồi tìm xe P95' in text:
            new='Đo theo NFR SRS 1.1: staging API 2 vCPU/4 GiB, DB 2 vCPU/4 GiB, 1.000 xe, 10.000 booking; 20 user đồng thời, warm-up 1 phút, đo 5 phút. Search P95 <= 2 giây, create booking P95 <= 500 ms. Keyless simulator timeout 3.000 ms được đo riêng. Chưa có log đo thì ghi chưa thực hiện.'
        if 'startRental() kiểm tra điều kiện qua canUnlockBooking(), lưu checklist' in text:
            new='Luồng kiểm thử: tìm xe → quote → tạo REQUESTED và snapshot/calendar → owner duyệt → renter finalize BEFORE → tạo START operation → simulator xác nhận → IN_PROGRESS → finalize AFTER → COMPLETE operation → COMPLETED. Timeout giữ trạng thái cũ và ghi UNKNOWN; bàn giao thủ công cần hai xác nhận.'
        if 'saveChecklist() lưu ảnh và xác nhận kiểm tra xe.' in text:
            new='saveChecklist() lưu draft, finalize kiểm tra đủ ảnh và dữ liệu. startRental()/completeRental() tạo KeylessOperation và trả 202 qua controller; chưa đồng nghĩa booking đổi trạng thái ngay. Worker dùng service credential gọi simulator ngoài transaction; chỉ cập nhật booking khi thiết bị xác nhận hoặc manual có đủ xác nhận. Timeout ghi UNKNOWN và giữ trạng thái cũ; COMPLETE vẫn cho phép trả muộn.'
        new=new.replace('PHÂN TÍCH KIỂM THỬ TĨNHVÀ KIỂM THỬ ĐỘNG','Phân tích kiểm thử tĩnh và kiểm thử động')
        if new!=text and not p._p.xpath('.//w:drawing'):p.text=new
    # Existing expected-result tables remain expected results, with precise scopes.
    for table in doc.tables:
        for row in table.rows:
            for cell in row.cells:
                if cell.text=='Một booking; yêu cầu cạnh tranh nhận 409.':
                    cell.text='Một booking và snapshot/calendar tương ứng; yêu cầu cạnh tranh nhận 409.'
    # The original report forced nearly every subsection onto a new page.
    # Keep its cover break; let the rest flow naturally for readable page density.
    break_seen=False
    for p in doc.paragraphs:
        p.paragraph_format.page_break_before=False
        for br in list(p._p.xpath('.//w:br[@w:type="page"]')):
            if not break_seen:break_seen=True
            else:br.getparent().remove(br)
    if len(doc.inline_shapes)>8:
        shape=doc.inline_shapes[8]
        rid=shape._inline.graphic.graphicData.pic.blipFill.blip.embed
        part=doc.part.related_parts[rid]
        part._blob=(QA/'sequence.png').read_bytes()
        with Image.open(QA/'sequence.png') as im:
            shape.width=Cm(16.7);shape.height=int(shape.width*im.height/im.width)
    doc.add_page_break();doc.add_heading('Phụ lục Nghiệm thu theo SRS phiên bản 1 1',level=1)
    doc.add_paragraph('Các ca dưới đây là kế hoạch, trạng thái hiện tại CHƯA CHẠY do chưa có source và môi trường ứng dụng. Expected không phải kết quả quan sát. Khi thực thi phải ghi commit, cấu hình, lệnh, thời gian, log và kết quả thực tế.')
    tests=[
      ('AT01','Giá và thời gian','1 giờ, 24 giờ ±1 ms, 30 ngày, dưới min/trên max, invalid date, giá sai; phí/cọc=0; expected độc lập.'),
      ('AT02','Khoảng tiếp giáp','[10,11) và [11,12) được phép; giao nhau 1 ms bị chặn; search và booking nhất quán.'),
      ('AT03','20 booking cạnh tranh','PostgreSQL thật; 20 key khác nhau: 1 thành công, 19 lỗi 409; đúng 1 snapshot/calendar active.'),
      ('AT04','Idempotency','Cùng key/body replay cùng booking; khác body 409; khác actor không lộ đơn; thử gửi đồng thời.'),
      ('AT05','Snapshot và rollback','Gây lỗi trước commit: không có booking/snapshot/calendar/key mồ côi; đổi giá xe không đổi snapshot cũ.'),
      ('AT06','Hold và expiry','REQUESTED giữ lịch; expiresAt=min(+24h,start); worker và lazy cleanup giải phóng; approve-vs-expire chỉ một kết quả hợp lệ.'),
      ('AT07','Owner block cạnh tranh','Block-vs-booking dưới khóa vehicle; chỉ một khoảng active; gọi DB trực tiếp vẫn bị exclusion chặn.'),
      ('AT08','Auth và quyền','Google callback thật, state/nonce sai, refresh reuse, CSRF, truy cập chéo xe/đơn/media, không lộ hash/token.'),
      ('AT09','Ảnh và finalization','5 MiB được chấp nhận; +1 byte/sai signature bị chặn; staging chưa verify không attach; URL upload cũ không đổi final.'),
      ('AT10','Checklist','Thiếu từng góc, ảnh khác booking, odo sau < trước, sửa finalized: từ chối trực tiếp API và UI.'),
      ('AT11','Keyless timeout và retry','Timeout sau khi simulator có thể thực hiện: UNKNOWN; booking giữ nguyên; reconcile cùng operationId; không gửi command mới tùy ý.'),
      ('AT12','Bàn giao thủ công','Một bên xác nhận chưa chuyển trạng thái; đủ owner+renter và điều kiện đạt thì chuyển một lần, provider MANUAL có audit.'),
      ('AT13','Review hai chiều','Owner và renter mỗi người một review; lần hai cùng author 409; người ngoài/đơn chưa COMPLETED bị chặn.'),
      ('AT14','Dashboard','Tổng snapshot subtotal theo completedAt [from,to); không review vẫn có tổng; không cộng đơn chưa hoàn tất hoặc đếm retry hai lần.'),
      ('AT15','Xe trả muộn','Vẫn cho COMPLETE sau endAt; ẩn search/chặn đơn mới; START kế tiếp bị chặn khi còn IN_PROGRESS khác.'),
      ('AT16','NFR và luồng web','Đo theo cấu hình SRS; Playwright owner/renter trọn luồng ở 360/768/desktop; lưu trace/log và giới hạn simulator.'),
    ]
    table=doc.add_table(rows=1,cols=3)
    for cell,value in zip(table.rows[0].cells,['Mã','Phạm vi','Kết quả mong đợi']):cell.text=value
    for code,area,expected in tests:
        for cell,value in zip(table.add_row().cells,[code,area,expected]):cell.text=value
    doc.add_paragraph('Hợp đồng triển khai chi tiết: docs/SRS.md, docs/API_CONTRACT.md và docs/DATABASE_DESIGN.md. Danh sách lệnh CI được tạo ở G0; không ghi tên lệnh dự kiến như bằng chứng đã chạy.')
    normalize(doc);add_footer(doc);doc.save(ROOT/FILES[2])

if __name__=='__main__':
    build_srs();build_clean_code();build_testing()
    for name in FILES:print('UPDATED',name)
