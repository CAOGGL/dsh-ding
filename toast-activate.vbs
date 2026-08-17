' dsh-ding toast activation launcher (no window)
' Runs toast-activate.ps1 fully hidden. Invoked by the dsh-ding:// protocol command.
If WScript.Arguments.Count = 0 Then WScript.Quit
Dim fso, shell, scriptDir, psCmd, arg
Set fso = CreateObject("Scripting.FileSystemObject")
Set shell = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
arg = WScript.Arguments(0)
psCmd = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & scriptDir & "\toast-activate.ps1"" """ & arg & """"
shell.Run psCmd, 0, False
WScript.Quit
