# Windows fallback when the bundled DOCX renderer has no LibreOffice binary.
# Uses an invisible Word instance and bundled Poppler via Python for page QA.
param([string]$ProjectRoot = 'C:\Users\ADMIN\Documents\CNPM')
$ErrorActionPreference = 'Stop'
$qaDir = Join-Path $ProjectRoot '.document-review'
$names = @('SRS_Car_Sharing.docx','Bao_Cao_Convention_Va_Clean_Code_Car_Sharing.docx','Bao_cao_Kiem_thu_Car_Sharing.docx')
foreach ($name in $names) {
    $wordApp = $null
    try {
        $wordApp = New-Object -ComObject Word.Application
        $wordApp.Visible = $false
        $wordApp.DisplayAlerts = 0
        $sourcePath = Join-Path $ProjectRoot $name
        $pdfPath = Join-Path $qaDir ([IO.Path]::GetFileNameWithoutExtension($name) + '.pdf')
        $wordDoc = $null
        try {
            $wordDoc = $wordApp.Documents.Open($sourcePath, $false, $true)
            $wordDoc.Repaginate()
            $wordDoc.ExportAsFixedFormat($pdfPath, 17)
            Write-Output ('RENDERED ' + $name + ' -> ' + $pdfPath)
        } finally {
            if ($wordDoc) {
                try { $wordDoc.Close(0) } catch { Write-Output ('Word cleanup: ' + $_.Exception.Message) }
                [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wordDoc)
            }
        }
    } finally {
        if ($wordApp) {
            try { $wordApp.Quit() } catch { Write-Output ('Word cleanup: ' + $_.Exception.Message) }
            [void][Runtime.InteropServices.Marshal]::ReleaseComObject($wordApp)
        }
    }
}
