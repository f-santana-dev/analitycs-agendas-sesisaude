@echo off
setlocal
cd /d "%~dp0"
python scripts/update_parquet.py --sql-file ..\Analise_Agendas.sql
echo.
echo Finalizado. Pressione qualquer tecla para sair.
pause >nul
