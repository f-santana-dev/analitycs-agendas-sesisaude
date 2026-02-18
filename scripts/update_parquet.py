import argparse
import re
import shutil
from pathlib import Path

import pandas as pd
import pyodbc


def load_env_file(env_path: Path) -> dict[str, str]:
    data: dict[str, str] = {}
    if not env_path.exists():
        return data
    for line in env_path.read_text(encoding="utf-8").splitlines():
        raw = line.strip()
        if not raw or raw.startswith("#") or "=" not in raw:
            continue
        key, value = raw.split("=", 1)
        data[key.strip()] = value.strip().strip('"').strip("'")
    return data


def read_sql_file(sql_path: Path) -> str:
    if not sql_path.exists():
        raise SystemExit(f"Arquivo SQL nao encontrado: {sql_path}")
    try:
        return sql_path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return sql_path.read_text(encoding="latin-1")


def split_batches(sql_text: str) -> list[str]:
    parts = re.split(r"^\s*GO\s*$", sql_text, flags=re.IGNORECASE | re.MULTILINE)
    return [p.strip() for p in parts if p.strip()]


def get_setting(key: str, cli_value: str | None, env: dict[str, str], required: bool = True) -> str:
    value = cli_value or env.get(key)
    if required and not value:
        raise SystemExit(f"Configuracao ausente: {key}")
    return value or ""


def dataframe_from_sql(conn: pyodbc.Connection, sql_text: str) -> pd.DataFrame:
    cur = conn.cursor()
    cur.execute(sql_text)

    while cur.description is None:
        if not cur.nextset():
            raise SystemExit(
                "A consulta nao retornou dataset. Verifique se o SQL finaliza com SELECT."
            )

    columns = [col[0] for col in cur.description]
    rows = cur.fetchall()
    return pd.DataFrame.from_records(rows, columns=columns)


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Atualiza o arquivo Parquet a partir de consulta SQL no SQL Server."
    )
    parser.add_argument(
        "--sql-file",
        default="../Analise_Agendas.sql",
        help="Caminho do arquivo SQL (default: ../Analise_Agendas.sql)",
    )
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Caminho do .env (default: .env)",
    )
    parser.add_argument("--db-server", default=None, help="Servidor SQL (override .env)")
    parser.add_argument("--db-user", default=None, help="Usuario SQL (override .env)")
    parser.add_argument("--db-password", default=None, help="Senha SQL (override .env)")
    parser.add_argument("--db-name", default=None, help="Database SQL (override .env)")
    parser.add_argument("--db-driver", default=None, help="Driver ODBC (override .env)")
    parser.add_argument(
        "--output",
        default="dados_agendas.parquet",
        help="Nome do Parquet gerado (default: dados_agendas.parquet)",
    )
    parser.add_argument(
        "--public-dir",
        default="public",
        help="Pasta public para copiar o Parquet (default: public)",
    )
    parser.add_argument(
        "--allow-empty",
        action="store_true",
        help="Permite gerar parquet vazio (default: false).",
    )
    args = parser.parse_args()

    env = load_env_file(Path(args.env_file))
    db_server = get_setting("DB_SERVER", args.db_server, env)
    db_user = get_setting("DB_USER", args.db_user, env)
    db_password = get_setting("DB_PASSWORD", args.db_password, env)
    db_name = get_setting("DB_NAME", args.db_name, env, required=False)
    db_driver = get_setting(
        "DB_DRIVER",
        args.db_driver,
        env,
        required=False,
    ) or "ODBC Driver 17 for SQL Server"

    sql_path = Path(args.sql_file)
    sql_text = read_sql_file(sql_path)
    batches = split_batches(sql_text)
    if not batches:
        raise SystemExit("Consulta SQL vazia.")

    conn_parts = [
        f"DRIVER={{{db_driver}}}",
        f"SERVER={db_server}",
        f"UID={db_user}",
        f"PWD={db_password}",
        "TrustServerCertificate=yes",
    ]
    if db_name:
        conn_parts.append(f"DATABASE={db_name}")
    conn_str = ";".join(conn_parts) + ";"

    db_label = db_name or "(padrao do login)"
    print(f"Conectando no SQL Server: {db_server} / DB: {db_label}")
    with pyodbc.connect(conn_str, autocommit=True) as conn:
        if len(batches) > 1:
            cur = conn.cursor()
            for i, batch in enumerate(batches[:-1], start=1):
                print(f"Executando lote preparatorio {i}/{len(batches)-1}...")
                cur.execute(batch)
                while cur.nextset():
                    pass
        print("Executando consulta final...")
        df = dataframe_from_sql(conn, batches[-1])

    # Padroniza colunas object para string para evitar falhas de conversao no parquet.
    for col in df.select_dtypes(include=["object"]).columns:
        df[col] = df[col].astype(str)

    if df.empty and not args.allow_empty:
        raise SystemExit(
            "Consulta retornou 0 linhas. Parquet nao foi sobrescrito. "
            "Ajuste a consulta SQL (filtros/datas) ou execute com --allow-empty."
        )

    parquet_path = Path(args.output)
    print(f"Gerando Parquet: {parquet_path}")
    df.to_parquet(parquet_path, engine="pyarrow")

    public_dir = Path(args.public_dir)
    public_dir.mkdir(parents=True, exist_ok=True)
    dest = public_dir / parquet_path.name
    shutil.copy2(parquet_path, dest)
    print(f"Copiado para: {dest}")
    print(f"Total de linhas: {len(df)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
