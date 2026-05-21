!macro NSIS_HOOK_PREINSTALL
  ; Kill the haulpave-bridge sidecar process before files are copied
  ; so the NSIS installer can overwrite haulpave-bridge.exe.
  DetailPrint "Stopping haulpave-bridge sidecar..."
  nsExec::ExecToLog '"taskkill" /F /IM haulpave-bridge.exe /T'
  Sleep 500
!macroend
