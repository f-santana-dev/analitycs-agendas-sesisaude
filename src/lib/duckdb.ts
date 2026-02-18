import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

const MANUAL_BUNDLES: duckdb.DuckDBBundles = {
    mvp: {
        mainModule: duckdb_wasm,
        mainWorker: mvp_worker,
    },
    eh: {
        mainModule: duckdb_eh,
        mainWorker: eh_worker,
    },
};

let dbInstance: duckdb.AsyncDuckDB | null = null;

export const initDuckDB = async () => {
    if (dbInstance) return dbInstance;

    // Hardcode bundle selection to MVP to avoid selection issues
    const bundle = MANUAL_BUNDLES.mvp;
    
    // Instantiate the asynchronous version of DuckDB-wasm
    const worker = new Worker(bundle.mainWorker);
    const logger = new duckdb.ConsoleLogger();
    const db = new duckdb.AsyncDuckDB(logger, worker);
    await db.instantiate(bundle.mainModule);

    // Register Parquet file
    const res = await fetch('/dados_agendas.parquet');
    const arrayBuffer = await res.arrayBuffer();
    await db.registerFileBuffer('dados_agendas.parquet', new Uint8Array(arrayBuffer));
    
    // Create connection and load table
    const conn = await db.connect();
    
    // Create table directly from parquet file
    // TRY/CATCH block added for debugging sql errors in console
    try {
        await conn.query(`
            CREATE TABLE agendas AS 
            SELECT 
                *
            FROM 'dados_agendas.parquet';
        `);

        // Check if data actually loaded
        const countRes = await conn.query("SELECT COUNT(*) as c FROM agendas");
        const count = Number(countRes.toArray()[0].c);
        console.log("Total rows loaded:", count);

        if (count === 0) {
            console.warn("Table 'agendas' is empty! Check parquet file content.");
        }
    } catch (e) {
        console.error("DuckDB SQL Error:", e);
    }
    
    await conn.close();

    dbInstance = db;
    return db;
};

export const getDb = () => {
    if (!dbInstance) throw new Error("DB not initialized");
    return dbInstance;
};
