@echo off
cd %~dp0

echo Activating virtual environment...
call .venv\Scripts\activate

echo Changing directory to Django project...
cd backend

echo Starting Django development server...
python manage.py runserver

pause
