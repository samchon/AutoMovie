# Publish one coherent preview only after export, render and comparison succeed.
# Rendering does not create or renew any visual-review evidence comments.
$ErrorActionPreference = "Stop"
$portraitWorkspace = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "../../..")).Path
$captureRoot = [System.IO.Path]::GetFullPath((Join-Path $portraitWorkspace ".shots/face-experiment"))
$previewPath = Join-Path $captureRoot "preview"
$pendingPath = Join-Path $captureRoot "preview-pending"
$previousPath = Join-Path $captureRoot "preview-previous"
Add-Type -AssemblyName Microsoft.VisualBasic
$captureLock = $null

function Assert-CapturePath([string] $targetPath) {
  $absolutePath = [System.IO.Path]::GetFullPath($targetPath)
  if (-not [System.String]::Equals([System.IO.Path]::GetDirectoryName($absolutePath), $captureRoot, [System.StringComparison]::OrdinalIgnoreCase)) { throw "Preview path escaped its capture directory." }
  if ([System.IO.Path]::GetFileName($absolutePath) -notin @("preview", "preview-pending", "preview-previous")) { throw "Unexpected preview directory identity." }
  if (Test-Path -LiteralPath $absolutePath) {
    $items = @((Get-Item -LiteralPath $absolutePath); (Get-ChildItem -LiteralPath $absolutePath -Recurse -Force))
    if (@($items | Where-Object { ($_.Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0 }).Count -ne 0) { throw "Linked preview content is not eligible for replacement." }
  }
}
function Recycle-Capture([string] $targetPath) {
  Assert-CapturePath $targetPath
  if (Test-Path -LiteralPath $targetPath) {
    [Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory($targetPath, [Microsoft.VisualBasic.FileIO.UIOption]::OnlyErrorDialogs, [Microsoft.VisualBasic.FileIO.RecycleOption]::SendToRecycleBin, [Microsoft.VisualBasic.FileIO.UICancelOption]::ThrowException)
  }
}

Push-Location $portraitWorkspace
try {
  foreach ($parentPath in @($portraitWorkspace, (Join-Path $portraitWorkspace ".shots"), $captureRoot)) {
    if ((Test-Path -LiteralPath $parentPath) -and (((Get-Item -LiteralPath $parentPath).Attributes -band [System.IO.FileAttributes]::ReparsePoint) -ne 0)) { throw "Preview roots must be real workspace directories." }
  }
  New-Item -ItemType Directory -Path $captureRoot -Force | Out-Null
  # Publishers and diagnostic writers share an exclusive-create lease. CreateNew
  # also refuses a Node diagnostic's existing lock, even after its handle closes
  # and before it unlinks the file. Never steal an interrupted owner's lease.
  # The operating system removes this publisher's lease when its handle closes.
  $captureLock = [System.IO.FileStream]::new((Join-Path $captureRoot 'preview.lock'), [System.IO.FileMode]::CreateNew, [System.IO.FileAccess]::ReadWrite, [System.IO.FileShare]::None, 1, [System.IO.FileOptions]::DeleteOnClose)
  Recycle-Capture $pendingPath
  Recycle-Capture $previousPath
  Assert-CapturePath $previewPath
  $ErrorActionPreference = "Continue"
  & (Join-Path $portraitWorkspace "test/node_modules/.bin/tsx.cmd") (Join-Path $PSScriptRoot "export.ts") *> (Join-Path $captureRoot "preview.log")
  $exportExit = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($exportExit -ne 0) { throw "Portrait export failed. The previous preview remains available." }
  $ErrorActionPreference = "Continue"
  & "C:/Program Files/Blender Foundation/Blender 5.1/blender.exe" --background --factory-startup --python-exit-code 1 --python (Join-Path $PSScriptRoot "render-blender.py") -- $captureRoot $pendingPath *>> (Join-Path $captureRoot "preview.log")
  $renderExit = $LASTEXITCODE
  $ErrorActionPreference = "Stop"
  if ($renderExit -ne 0) { throw "Portrait rendering failed. The previous preview remains available." }
  & node (Join-Path $PSScriptRoot "comparison.mjs") $pendingPath
  if ($LASTEXITCODE -ne 0) { throw "Comparison verification failed. The previous preview remains available." }
  foreach ($targetPath in @($pendingPath, $previewPath, $previousPath)) { Assert-CapturePath $targetPath }
  if (Test-Path -LiteralPath $previewPath) { Move-Item -LiteralPath $previewPath -Destination $previousPath }
  try { Move-Item -LiteralPath $pendingPath -Destination $previewPath }
  catch {
    if (-not (Test-Path -LiteralPath $previewPath) -and (Test-Path -LiteralPath $previousPath)) { Move-Item -LiteralPath $previousPath -Destination $previewPath }
    throw
  }
  Recycle-Capture $previousPath
  Write-Output ("Published complete preview: " + $previewPath)
} catch {
  $previewFailure = $_
  if ($null -ne $captureLock) { Recycle-Capture $pendingPath }
  throw $previewFailure
} finally {
  if ($null -ne $captureLock) { $captureLock.Dispose() }
  Pop-Location
}
