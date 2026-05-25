; Keep in sync with src-tauri/tauri.conf.json → bundle → externalBin
!macro NSIS_HOOK_PREINSTALL
  ; Runs before file copy on first install AND on in-place upgrade (tauri updater).
  ; Kill the haulpave-bridge sidecar process before files are copied
  ; so the NSIS installer can overwrite haulpave-bridge.exe.
  DetailPrint "Stopping haulpave-bridge sidecar..."
  nsExec::ExecToLog '"taskkill" /F /IM haulpave-bridge.exe /T'
  Sleep 1000
!macroend

!macro NSIS_HOOK_PREUNINSTALL
  ; Ensure the sidecar is killed before uninstall removes files.
  DetailPrint "Stopping haulpave-bridge sidecar..."
  nsExec::ExecToLog '"taskkill" /F /IM haulpave-bridge.exe /T'
  Sleep 1000
!macroend
