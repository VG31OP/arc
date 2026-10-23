@echo off
rem Copies one thing for the Sarvam website to the clipboard.
rem Double-click for a menu, or run "Copy-for-Sarvam.bat 4" to copy item 4 directly.
title Copy for Sarvam
cd /d "%~dp0"
if "%~1"=="" goto menu
call :copy %~1
echo %msg%
exit /b 0

:menu
cls
echo.
echo   COPY FOR SARVAM
echo   Press a number, then Enter. It copies that thing.
echo   Then go to the Sarvam website and press Ctrl+V.
echo.
echo     1  Arc's instructions        (agent: Instructions box)
echo     2  Greeting variable text  (agent: Variables, opening_line)
echo     3  Tool description        (Tools, laptop_action: Description)
echo     4  Tool URL                (Tools, laptop_action: URL)
echo     5  Arc's password          (Tools, laptop_action: Bearer token secret)
echo.
echo     6  Lock Arc to only my phone (do this after your first phone call to Arc works)
echo.
echo     0  Close
echo.
set "pick="
set /p pick="  Your choice: "
if not defined pick exit /b 0
if "%pick%"=="0" exit /b 0
call :copy %pick%
echo.
echo   %msg%
echo.
pause
goto menu

:copy
set "msg=Press a number from the list."
if "%1"=="1" powershell -NoProfile -Command "Get-Content -Raw 'arc-agent\1-instructions-prompt.txt' | Set-Clipboard" & set "msg=Arc's instructions are copied."
if "%1"=="2" powershell -NoProfile -Command "Set-Clipboard -Value \"Hey Boss, it's Arc. What can I do for you?\"" & set "msg=The greeting text is copied."
if "%1"=="3" powershell -NoProfile -Command "Get-Content -Raw 'arc-agent\2-tool-description.txt' | Set-Clipboard" & set "msg=The tool description is copied."
if "%1"=="4" if not exist "server\tunnel-url.txt" set "msg=No tool URL yet. Double-click Start-Arc.bat first and wait until it says Arc is running." & goto :eof
if "%1"=="4" powershell -NoProfile -Command "(Get-Content -Raw 'server\tunnel-url.txt').Trim() | Set-Clipboard" & set "msg=The tool URL is copied."
if "%1"=="5" if not exist "server\.env" set "msg=Arc isn't set up yet. Double-click Start-Arc.bat first." & goto :eof
if "%1"=="5" powershell -NoProfile -Command "((Get-Content 'server\.env' | Where-Object { $_ -match '^(?:ARC_TOKEN|JARVIS_TOKEN)=' }) -replace '^(?:ARC_TOKEN|JARVIS_TOKEN)=','').Trim() | Set-Clipboard" & set "msg=Arc's password is copied. Only paste it into Sarvam, never anywhere else."
if "%1"=="6" if not exist "server\.env" set "msg=Arc isn't set up yet. Double-click Start-Arc.bat first." & goto :eof
if "%1"=="6" powershell -NoProfile -Command "(Get-Content 'server\.env') -replace '^ALLOW_NO_CALLER=.*','ALLOW_NO_CALLER=false' | Set-Content 'server\.env'" & set "msg=Done. Arc now only obeys your phone. (The Test agent button in Sarvam will stop working, that's expected.)"
goto :eof
