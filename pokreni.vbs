' Dvoklik na OVAJ fajl pokrece sve - bez ijednog vidljivog prozora.
' Pokrece pokreni.bat skriveno (server + cekanje porta + SEB).
Set fso = CreateObject("Scripting.FileSystemObject")
folder = fso.GetParentFolderName(WScript.ScriptFullName)
Set sh = CreateObject("WScript.Shell")
sh.Run "cmd /c """ & folder & "\pokreni.bat""", 0, False
