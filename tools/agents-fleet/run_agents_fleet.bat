@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion
title Autonomous AI Multi-Agent Fleet - Executive Console
cd /d "%~dp0"

set "PY="
where python >nul 2>&1 && set "PY=python"
if not defined PY (
    py -3 -c "import sys" >nul 2>&1 && set "PY=py -3"
)
if not defined PY (
    echo [!] Python is not on PATH.
    pause
    exit /b 1
)

:MENU
cls
echo ==============================================================================
echo       أسطول الوكلاء الذاتي الموحد (Autonomous Multi-Agent Fleet Console)
echo          Planner, Multi-Coder Fleet, BugBot Reviewer, Sandbox Runner
echo ==============================================================================
echo.
echo [1] تشغيل أسطول الوكلاء المتكامل في بايثون (Run Full Python Agents Fleet)
echo [2] إطلاق وكيل التخطيط المسبق (Run Planner Agent - Spec Mode)
echo [3] إطلاق أسطول البرمجة المتوازي لتعديل الملفات (Run Autonomous Coders Fleet)
echo [4] تشغيل وكيل فحص وتدقيق الأمان والثغرات (Run BugBot Security Review)
echo [5] تشغيل اختبارات الساندبوكس (Run Sandbox Tests)
echo [6] تثبيت وتحديث مكتبات ومحركات الوكلاء (Check Environment)
echo [7] الخروج (Exit)
echo ==============================================================================
set /p OPT="[?] اختر الإجراء المطلوب (1-7): "

if "%OPT%"=="1" goto RUN_PY_FLEET
if "%OPT%"=="2" goto RUN_PLANNER
if "%OPT%"=="3" goto RUN_CODERS
if "%OPT%"=="4" goto RUN_REVIEWER
if "%OPT%"=="5" goto RUN_SANDBOX
if "%OPT%"=="6" goto SETUP_ENV
if "%OPT%"=="7" exit /b 0

echo [!] خيار غير صالح.
timeout /t 2 > nul
goto MENU

:RUN_PY_FLEET
cls
echo [*] جاري تشغيل المحرك الرئيسي لأسطول الوكلاء...
set /p P_GOAL="[?] الهدف (Enter للمهمة الافتراضية): "
if "%P_GOAL%"=="" (
    %PY% agents_fleet_engine.py --mode fleet
) else (
    %PY% agents_fleet_engine.py --mode fleet --mission "%P_GOAL%"
)
echo.
pause
goto MENU

:RUN_PLANNER
cls
echo ==============================================================================
echo                 [2] إطلاق وكيل التخطيط المعماري (Planner Agent)
echo ==============================================================================
set /p P_GOAL="[?] أدخل الهدف المعماري للتخطيط: "
if "%P_GOAL%"=="" set "P_GOAL=بناء معمارية مصادقة سحابية مع عزل كامل للبيانات وتدقيق أمني تلقائي"
echo [*] جاري صياغة خطة العمل دون تعديل الملفات...
%PY% agents_fleet_engine.py --mode planner --mission "%P_GOAL%"
echo.
pause
goto MENU

:RUN_CODERS
cls
echo ==============================================================================
echo             [3] إطلاق أسطول البرمجة المتوازي (Autonomous Coders)
echo ==============================================================================
set /p C_PROMPT="[?] أدخل متطلب التطوير: "
if "%C_PROMPT%"=="" set "C_PROMPT=بناء معمارية مصادقة سحابية مع عزل كامل للبيانات وتدقيق أمني تلقائي"
echo [*] الكتابة مقيّدة داخل workspace\ فقط.
%PY% agents_fleet_engine.py --mode coders --mission "%C_PROMPT%"
echo.
pause
goto MENU

:RUN_REVIEWER
cls
echo ==============================================================================
echo               [4] فحص التعديلات ومراجعة الثغرات البرمجية (Reviewer)
echo ==============================================================================
echo [*] توليد الفوارق وفحص eval/exec والأسرار والمسارات...
%PY% agents_fleet_engine.py --mode reviewer
echo.
pause
goto MENU

:RUN_SANDBOX
cls
echo ==============================================================================
echo             [5] تشغيل اختبارات الوحدة داخل workspace
echo ==============================================================================
%PY% agents_fleet_engine.py --mode sandbox
echo.
pause
goto MENU

:SETUP_ENV
cls
echo [*] فحص توفر بايثون و Git...
%PY% --version
git --version
echo [*] لا توجد اعتماديات خارج المكتبة القياسية.
echo.
pause
goto MENU
