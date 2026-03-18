@echo off
cd %~dp0

echo Changing directory to React project...
cd frontend

echo Starting React development server...

npm run dev

pause
