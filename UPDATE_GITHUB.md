# Atualizar dados e enviar para o GitHub

Este passo a passo mostra como atualizar os dados (Excel -> Parquet) e enviar as mudancas para o GitHub.

## 1) Atualize a planilha
- Coloque o arquivo **Base_Agendas.xlsx** atualizado na raiz acima do projeto:
  - `d:\dasboard-react-agendas\Base_Agendas.xlsx`

## 2) Gere o Parquet e copie para `public/`
No terminal:

```powershell
cd "d:\dasboard-react-agendas\dashboard-react-agendas"
npm run update:data
```

Isso vai:
- Ler o Excel
- Gerar `dados_agendas.parquet`
- Copiar para `public/dados_agendas.parquet`

## 3) Verifique as alteracoes
```powershell
git status -sb
```

Voce deve ver mudancas em:
- `public/dados_agendas.parquet`
- (opcional) `dados_agendas.parquet`

## 4) Commit das mudancas
```powershell
git add .
git commit -m "Atualiza dados de agendas"
```

## 5) Enviar para o GitHub
```powershell
git push
```

## Dica
Se o site estiver conectado ao Vercel, o deploy e automatico apos o push.
