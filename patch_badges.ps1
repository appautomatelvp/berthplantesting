$file = 'd:\CMIT-PROJECT\operationoverview\public\operation.html'
$lines = Get-Content $file -Encoding UTF8

# Fix line 5762 (index 5761): change "remaining < row.contCount)" to "remaining > 0 && row.remaining < row.contCount)"
$lines[5761] = $lines[5761] -replace 'row\.contCount > 0 && row\.remaining < row\.contCount\)', 'row.contCount > 0 && row.remaining > 0 && row.remaining < row.contCount)'

# Insert DONE badge after line 5764 (index 5763)
$newLines = [System.Collections.Generic.List[string]]::new()
for ($i = 0; $i -lt $lines.Count; $i++) {
    $newLines.Add($lines[$i])
    if ($i -eq 5763) {
        $newLines.Add('                         if (typeof row.remaining === ''number'' && row.remaining === 0 && row.contCount > 0) {')
        $newLines.Add('                             cellContent += ` <span class="ml-2 px-2 py-0.5 text-xs font-semibold text-white bg-gray-600 rounded-full">DONE</span>`;')
        $newLines.Add('                         }')
    }
}

Set-Content $file $newLines -Encoding UTF8
Write-Host "Done. Total lines: $($newLines.Count)"
