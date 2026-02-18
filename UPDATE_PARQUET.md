# Atualizar o Parquet via SQL Server

Este projeto gera `public/dados_agendas.parquet` executando a consulta em `../unificada2_otimizada.sql` no SQL Server.

## Configuracao
Crie/edite o arquivo `.env` na raiz do projeto:

```env
DB_SERVER=HOMEPC\MSSQLSERVER1
DB_USER=sa
DB_PASSWORD=sua_senha
DB_NAME=Genesis
DB_DRIVER=ODBC Driver 17 for SQL Server
```

## Comando
```bash
npm run update:data
```

Ou execute:

```bat
update_parquet.bat
```

## O que o comando faz
1. Le o SQL em `../unificada2_otimizada.sql`.
2. Conecta no SQL Server com as credenciais do `.env`.
3. Executa os lotes SQL (incluindo blocos separados por `GO`).
4. Gera `dados_agendas.parquet`.
5. Copia para `public/dados_agendas.parquet`.

## Importante
Por seguranca, se a consulta retornar 0 linhas o script interrompe e nao sobrescreve o parquet.
Use `--allow-empty` somente se quiser gravar parquet vazio de forma intencional.
