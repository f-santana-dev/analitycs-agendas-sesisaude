@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo Atualizacao de dados do Dashboard
echo ==========================================
echo.

if not exist ".env" (
  echo [ERRO] Arquivo .env nao encontrado na raiz do projeto.
  echo Crie o .env e tente novamente.
  echo.
  echo Pressione qualquer tecla para encerrar...
  pause >nul
  exit /b 1
)

echo [1/3] Executando consulta SQL e gerando Parquet...
echo.
python -u scripts/update_parquet.py --sql-file ..\Analise_Agendas.sql
if errorlevel 1 (
  echo.
  echo [ERRO] Falha ao atualizar dados. Verifique as mensagens acima.
  echo.
  echo Pressione qualquer tecla para encerrar...
  pause >nul
  exit /b 1
)

echo.
echo [2/3] Parquet gerado e copiado para public/.
echo [3/3] Dashboard pronto para carregar os dados atualizados.
echo.
echo [OK] Atualizacao concluida com sucesso!
echo.
echo Pressione qualquer tecla para encerrar...
pause >nul
exit /b 0
