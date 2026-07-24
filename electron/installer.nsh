; CHATR Desktop — NSIS Custom Installer Script
; Creates Documents\CHATR\Transcripts and Documents\CHATR\Call Recordings on install

!include "MUI2.nsh"

Section "Create CHATR Workspace Folders" SecFolders
  ; Create in the current user's Documents folder
  SetShellVarContext current
  
  CreateDirectory "$DOCUMENTS\CHATR Workspace"
  CreateDirectory "$DOCUMENTS\CHATR Workspace\Transcripts"
  CreateDirectory "$DOCUMENTS\CHATR Workspace\Call Recordings"
  CreateDirectory "$DOCUMENTS\CHATR Workspace\AI Summaries"
  
  ; Write a README so users know what these folders are for
  FileOpen $0 "$DOCUMENTS\CHATR Workspace\README.txt" w
  FileWrite $0 "CHATR Workspace Folders$\r$\n"
  FileWrite $0 "========================$\r$\n$\r$\n"
  FileWrite $0 "Transcripts\$\r$\n"
  FileWrite $0 "  Live call transcripts are automatically saved here as .txt files.$\r$\n$\r$\n"
  FileWrite $0 "Call Recordings\$\r$\n"
  FileWrite $0 "  Audio/video call recordings are saved here as .webm or .mp4 files.$\r$\n$\r$\n"
  FileWrite $0 "AI Summaries\$\r$\n"
  FileWrite $0 "  AI-generated meeting summaries and action items are saved here.$\r$\n$\r$\n"
  FileWrite $0 "All data stays on your device. Nothing is uploaded to the cloud.$\r$\n"
  FileClose $0

SectionEnd
