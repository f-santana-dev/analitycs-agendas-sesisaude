import { useEffect, useRef, useState } from 'react';
import { initDuckDB } from './lib/duckdb';
import { Sidebar } from './components/Sidebar';
import ExcelJS from 'exceljs';
import { Download } from 'lucide-react';
import {
  DailyRealizedChart,
  TypeBarChart,
} from './components/Charts';

interface PerformanceRow {
  name: string;
  specialty?: string;
  total: number;
  bloqueados: number;
  realizados: number;
  ausentes: number;
  disponiveis: number;
  aproveitamentoPct: number;
  ausenciaPct: number;
  bloqueioPct: number;
}

interface DashboardData {
  totalHorarios: number;
  horariosDisponiveis: number;
  horariosAgendados: number;
  horariosRealizados: number;
  horariosAusentes: number;
  horariosBloqueados: number;
  taxaOcupacao: number;
  taxaAusencia: number;
  indiceBloqueio: number;
  monthlyData: { name: string; value: number }[];
  dailyData: { dateKey: string; label: string; realizados: number; ausentes: number; livres: number; bloqueados: number; justificativasBloqueio?: string[] }[];
  especialidadeData: { name: string; quantidade: number }[];
  profissionalData: { name: string; quantidade: number }[];
  situacaoData: { name: string; quantidade: number }[];
  ocupacaoData: { name: string; quantidade: number }[];
  performanceByProfessional: PerformanceRow[];
  performanceBySpecialty: PerformanceRow[];
  bloqueioTopProfData: {
    name: string;
    quantidadeBloqueios: number;
    diasComBloqueios: number;
    percentualSobreTotal: number;
    datasComBloqueios: string;
    datasDetalhe: { data: string; quantidade: number; justificativas: string[] }[];
  }[];
  bloqueioGlobalData: {
    profissional: string;
    unidade: string;
    especialidade: string;
    data: string;
    quantidade: number;
    justificativas: string[];
  }[];
  weeklyRangeData: { label: string; agendados: number; livres: number; bloqueados: number; total: number }[];
  weeklyCards: { label: string; total: number; agendados: number; bloqueados: number; ocupacaoPct: number; ausenciaPct: number; bloqueioPct: number; livres: number }[];
}

interface Filters {
  units: string[];
  categories: string[];
  specialties: string[];
  professionals: string[];
}

function MiniKPI({ label, value, tooltip, tone }: { label: string; value: string; tooltip?: string; tone?: 'danger' | 'default' }) {
  const valueClass = tone === 'danger' ? 'text-rose-400' : 'text-white';
  const borderClass = tone === 'danger' ? 'border-rose-500/40' : 'border-border';
  return (
    <div className={`bg-card border ${borderClass} rounded-md px-2.5 py-2 flex items-center justify-between gap-2 tooltip shadow-lg shadow-black/20 fade-slide`} data-tooltip={tooltip || ''}>
      <div className="flex flex-col min-w-0">
        <span className="text-[10px] text-secondary uppercase leading-none mb-1 truncate">{label}</span>
        <span className={`text-sm font-bold leading-none truncate ${valueClass}`}>{value}</span>
      </div>
    </div>
  );
}

function App() {
  const [loading, setLoading] = useState(true);
  const hasLoadedOnceRef = useRef(false);
  const [data, setData] = useState<DashboardData>({
    totalHorarios: 0,
    horariosDisponiveis: 0,
    horariosAgendados: 0,
    horariosRealizados: 0,
    horariosAusentes: 0,
    horariosBloqueados: 0,
    taxaOcupacao: 0,
    taxaAusencia: 0,
    indiceBloqueio: 0,
    monthlyData: [],
    dailyData: [],
    especialidadeData: [],
    profissionalData: [],
    situacaoData: [],
    ocupacaoData: [],
    performanceByProfessional: [],
    performanceBySpecialty: [],
    bloqueioTopProfData: [],
    bloqueioGlobalData: [],
    weeklyRangeData: [],
    weeklyCards: [],
  });

  const [filters, setFilters] = useState<Filters>({
    units: [],
    categories: [],
    specialties: [],
    professionals: [],
  });

  // Selected Filter States
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [selectedProfessionals, setSelectedProfessionals] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [selectedSituations, setSelectedSituations] = useState<string[]>([]);
  const [selectedOccupations, setSelectedOccupations] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const [weekRanges, setWeekRanges] = useState<{ label: string; start: Date; end: Date }[]>([]);
  const [selectedWeekIndexes, setSelectedWeekIndexes] = useState<number[]>([]);
  const [rankingView, setRankingView] = useState<'profissional' | 'especialidade'>('profissional');
  const [rankingModalOpen, setRankingModalOpen] = useState(false);
  const [rankingSortKey, setRankingSortKey] = useState<'aproveitamento' | 'ausencia' | 'bloqueios' | 'nome'>('aproveitamento');
  const [rankingSortDir, setRankingSortDir] = useState<'desc' | 'asc'>('desc');
  const [bloqueiosModal, setBloqueiosModal] = useState<{ open: boolean; profissional: string; datas: { data: string; quantidade: number; justificativas: string[] }[] }>({
    open: false,
    profissional: '',
    datas: [],
  });
  const [bloqueiosGlobalModalOpen, setBloqueiosGlobalModalOpen] = useState(false);
  const [bloqueiosGlobalBusca, setBloqueiosGlobalBusca] = useState('');
  const [bloqueiosGlobalSort, setBloqueiosGlobalSort] = useState<'qtd' | 'data'>('qtd');
  const fetchSeqRef = useRef(0);

  const formatNumber = (val: number | undefined | null) =>
    (val || 0).toLocaleString('pt-BR');

  const formatPercent = (val: number | undefined | null) =>
    `${(val || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  const formatDateFromSqlKey = (dateKey: string) => {
    const [y, m, d] = dateKey.split('-');
    if (!y || !m || !d) return dateKey;
    return `${d}/${m}/${y}`;
  };
  const getWeekStage = (index: number, total: number): 'past' | 'current' | 'future' => {
    const currentIndex = Math.floor(total / 2);
    if (index < currentIndex) return 'past';
    if (index === currentIndex) return 'current';
    return 'future';
  };
  const getWeekStageStyle = (stage: 'past' | 'current' | 'future') => {
    if (stage === 'past') {
      return {
        cardClass: 'border-amber-500/35',
        chipClass: 'bg-amber-500/15 text-amber-300 border border-amber-500/35',
        chipLabel: 'PASSADA',
      };
    }
    if (stage === 'current') {
      return {
        cardClass: 'border-cyan-400/45 shadow-[0_0_0_1px_rgba(34,211,238,0.15)]',
        chipClass: 'bg-cyan-400/15 text-cyan-300 border border-cyan-400/40',
        chipLabel: 'ATUAL',
      };
    }
    return {
      cardClass: 'border-emerald-500/35',
      chipClass: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35',
      chipLabel: 'FUTURA',
    };
  };

  const activeWeekRanges = selectedWeekIndexes
    .map((idx) => weekRanges[idx])
    .filter((w): w is { label: string; start: Date; end: Date } => Boolean(w));
  const activeWeekLabel = activeWeekRanges.length
    ? activeWeekRanges.map((w) => w.label).join(' | ')
    : 'todas as 5 semanas';
  const summarizeFilter = (values: string[], emptyLabel: string) => {
    if (values.length === 0) return emptyLabel;
    if (values.length === 1) return values[0];
    return `${values[0]} +${values.length - 1}`;
  };
  const contextWeek = activeWeekRanges.length ? activeWeekLabel : 'todas as 5 semanas';
  const contextUnits = summarizeFilter(selectedUnits, 'todas');
  const contextCategories = summarizeFilter(selectedCategories, 'todas');
  const contextSpecialties = summarizeFilter(selectedSpecialties, 'todas');
  const contextProfessionals = summarizeFilter(selectedProfessionals, 'todos');
  const selectedDateIsValid = Boolean(selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate));
  const capacidadeInstalada = data.totalHorarios;
  const aproveitamentoCapacidade = capacidadeInstalada > 0 ? (data.horariosRealizados / capacidadeInstalada) * 100 : 0;
  const diasComBloqueio = data.dailyData.filter((d) => Number(d.bloqueados || 0) > 0).length;
  const performanceRows = rankingView === 'profissional' ? data.performanceByProfessional : data.performanceBySpecialty;
  const sortedPerformanceRows = [...performanceRows].sort((a, b) => {
    const dir = rankingSortDir === 'desc' ? -1 : 1;
    if (rankingSortKey === 'nome') return a.name.localeCompare(b.name) * dir;
    if (rankingSortKey === 'aproveitamento') return (a.aproveitamentoPct - b.aproveitamentoPct) * dir;
    if (rankingSortKey === 'ausencia') return (a.ausenciaPct - b.ausenciaPct) * dir;
    return (a.bloqueioPct - b.bloqueioPct) * dir;
  });
  const topPerformanceRows = sortedPerformanceRows.slice(0, 5);
  const bloqueiosGlobalRows = [...data.bloqueioGlobalData]
    .filter((row) => {
      const term = bloqueiosGlobalBusca.trim().toLowerCase();
      if (!term) return true;
      return (
        row.profissional.toLowerCase().includes(term) ||
        row.unidade.toLowerCase().includes(term) ||
        row.especialidade.toLowerCase().includes(term) ||
        row.data.toLowerCase().includes(term) ||
        row.justificativas.join(' | ').toLowerCase().includes(term)
      );
    })
    .sort((a, b) => {
      if (bloqueiosGlobalSort === 'qtd') return b.quantidade - a.quantidade;
      const [da, ma, ya] = a.data.split('/');
      const [db, mb, yb] = b.data.split('/');
      const va = `${ya}${ma}${da}`;
      const vb = `${yb}${mb}${db}`;
      return vb.localeCompare(va);
    });

  const makeFilename = (base: string) => {
    const stamp = new Date().toISOString().slice(0, 10);
    return `${base}_${stamp}.xlsx`;
  };

  const getLogoBase64 = async () => {
    try {
      const response = await fetch('/logo.png');
      if (!response.ok) return null;
      const blob = await response.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error('logo read failed'));
        reader.readAsDataURL(blob);
      });
      return dataUrl.split(',')[1];
    } catch {
      return null;
    }
  };

  const exportWorkbook = async (sheets: { name: string; title: string; rows: Record<string, any>[] }[], filename: string) => {
    const wb = new ExcelJS.Workbook();
    const logoBase64 = await getLogoBase64();

    const filtrosResumo = [
      `Periodo semanal: ${activeWeekLabel}`,
      selectedUnits.length ? `Unidades: ${selectedUnits.join(', ')}` : 'Unidades: Todas',
      selectedSpecialties.length ? `Especialidades: ${selectedSpecialties.join(', ')}` : 'Especialidades: Todas',
      selectedProfessionals.length ? `Profissionais: ${selectedProfessionals.join(', ')}` : 'Profissionais: Todos',
      selectedSituations.length ? `Situacoes: ${selectedSituations.join(', ')}` : 'Situacoes: Todas',
      selectedOccupations.length ? `Ocupacao: ${selectedOccupations.join(', ')}` : 'Ocupacao: Todas',
    ].join(' | ');

    sheets.forEach((sheet) => {
      const ws = wb.addWorksheet(sheet.name);
      const headers = sheet.rows.length ? Object.keys(sheet.rows[0]) : [];
      const totalCols = Math.max(headers.length, 6);

      if (logoBase64) {
        const imageId = wb.addImage({ base64: logoBase64, extension: 'png' });
        ws.addImage(imageId, {
          tl: { col: 0, row: 0 },
          ext: { width: 220, height: 80 },
        });
      }

      ws.mergeCells(1, 3, 1, totalCols);
      ws.getCell(1, 3).value = sheet.title;
      ws.getCell(1, 3).font = { bold: true, size: 14 };

      ws.mergeCells(2, 3, 2, totalCols);
      ws.getCell(2, 3).value = `Data: ${new Date().toLocaleDateString()}`;
      ws.getCell(2, 3).font = { size: 10, color: { argb: 'FF6B7280' } };

      ws.mergeCells(3, 3, 3, totalCols);
      ws.getCell(3, 3).value = filtrosResumo;
      ws.getCell(3, 3).font = { size: 9, color: { argb: 'FF6B7280' } };

      if (headers.length) {
        ws.getRow(5).values = [null, ...headers];
        ws.getRow(5).font = { bold: true };
      }

      sheet.rows.forEach((row, index) => {
        const rowValues = headers.map((h) => row[h]);
        ws.getRow(6 + index).values = [null, ...rowValues];
      });

      const fixedWidths = [25.14, 21, 12, 12, 12];
      ws.columns = headers.map((h, idx) => {
        if (idx < fixedWidths.length) {
          return { key: h, width: fixedWidths[idx] };
        }
        return { key: h, width: Math.max(12, h.length + 4) };
      });
    });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportSingle = async (name: string, title: string, rows: Record<string, any>[]) => {
    await exportWorkbook([{ name, title, rows }], makeFilename(name.replace(/\s+/g, '_')));
  };

  const exportAll = async () => {
    const resumoRows = [
      { Indicador: 'Total Horarios', Valor: formatNumber(data.totalHorarios) },
      { Indicador: 'Horarios Disponiveis', Valor: formatNumber(data.horariosDisponiveis) },
      { Indicador: 'Horarios Agendados', Valor: formatNumber(data.horariosAgendados) },
      { Indicador: 'Horarios Realizados', Valor: formatNumber(data.horariosRealizados) },
      { Indicador: 'Horarios Ausentes', Valor: formatNumber(data.horariosAusentes) },
      { Indicador: 'Horarios Bloqueados', Valor: formatNumber(data.horariosBloqueados) },
      { Indicador: 'Taxa de Ocupacao', Valor: formatPercent(data.taxaOcupacao) },
      { Indicador: 'Taxa de Ausencia', Valor: formatPercent(data.taxaAusencia) },
      { Indicador: 'Indice de Bloqueios', Valor: formatPercent(data.indiceBloqueio) },
    ];

    const filtrosRows = [
      { Filtro: 'Janela semanal', Valor: activeWeekLabel },
      { Filtro: 'Unidades', Valor: selectedUnits.length ? selectedUnits.join(', ') : 'Todas' },
      { Filtro: 'Especialidades', Valor: selectedSpecialties.length ? selectedSpecialties.join(', ') : 'Todas' },
      { Filtro: 'Profissionais', Valor: selectedProfessionals.length ? selectedProfessionals.join(', ') : 'Todos' },
    ];

    const especialidadeRows = data.especialidadeData.map(row => ({ Especialidade: row.name, Quantidade: formatNumber(row.quantidade) }));
    const profissionalRows = data.profissionalData.map(row => ({ Profissional: row.name, Quantidade: formatNumber(row.quantidade) }));
    const situacaoRows = data.situacaoData.map(row => ({ Situacao: row.name, Quantidade: formatNumber(row.quantidade) }));
    const ocupacaoRows = data.ocupacaoData.map(row => ({ Ocupacao: row.name, Quantidade: formatNumber(row.quantidade) }));

    const mensalRows = data.monthlyData.map(row => ({ Periodo: row.name, Quantidade: formatNumber(row.value) }));
    const diarioRows = data.dailyData.map(row => ({
      Data: row.label,
      Realizados: formatNumber(row.realizados),
      Ausentes: formatNumber(row.ausentes),
      Livres: formatNumber(row.livres),
      Bloqueados: formatNumber(row.bloqueados),
    }));

    await exportWorkbook(
      [
        { name: 'Resumo', title: 'Resumo do Periodo', rows: resumoRows },
        { name: 'Filtros', title: 'Filtros Aplicados', rows: filtrosRows },
        { name: 'Especialidade', title: 'Agendamentos por Especialidade', rows: especialidadeRows },
        { name: 'Profissional', title: 'Agendamentos por Profissional', rows: profissionalRows },
        { name: 'Situacao', title: 'Situacao do Horario', rows: situacaoRows },
        { name: 'Ocupacao', title: 'Ocupacao da Agenda', rows: ocupacaoRows },
        { name: 'Agendados_Mes', title: 'Agendados por Mes', rows: mensalRows },
        { name: 'Agendados_Dia', title: 'Agendados por Dia', rows: diarioRows },
      ],
      makeFilename('export_geral')
    );
  };

  const exportEspecialidade = () => { void exportSingle('Especialidade', 'Agendamentos por Especialidade', data.especialidadeData.map(row => ({ Especialidade: row.name, Quantidade: formatNumber(row.quantidade) }))); };
  const exportProfissional = () => { void exportSingle('Profissional', 'Agendamentos por Profissional', data.profissionalData.map(row => ({ Profissional: row.name, Quantidade: formatNumber(row.quantidade) }))); };
  const exportSituacao = () => { void exportSingle('Situacao', 'Situacao do Horario', data.situacaoData.map(row => ({ Situacao: row.name, Quantidade: formatNumber(row.quantidade) }))); };
  const exportOcupacao = () => { void exportSingle('Ocupacao', 'Ocupacao da Agenda', data.ocupacaoData.map(row => ({ Ocupacao: row.name, Quantidade: formatNumber(row.quantidade) }))); };
  const exportAgendadoMes = () => { void exportSingle('Agendados_Mes', 'Agendados por Mes', data.monthlyData.map(row => ({ Periodo: row.name, Quantidade: formatNumber(row.value) }))); };
  const exportAgendadoDia = () => {
    void exportSingle(
      'Agendados_Dia',
      'Agendados por Dia',
      data.dailyData.map(row => ({
        Data: row.label,
        Realizados: formatNumber(row.realizados),
        Ausentes: formatNumber(row.ausentes),
        Livres: formatNumber(row.livres),
        Bloqueados: formatNumber(row.bloqueados),
      }))
    );
  };

  const sqlEscape = (val: string) => val.replace(/'/g, "''");
  const inClause = (values: string[]) => values.map(v => `'${sqlEscape(v)}'`).join(',');
  const inClauseNormalized = (values: string[]) => values.map(v => `'${sqlEscape(v.trim().toUpperCase())}'`).join(',');
  const normalizeSqlDate = (v: any): string | null => {
    if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return null;
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, '0');
    const day = String(d.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const buildFilter = (opts?: {
    skipUnits?: boolean;
    skipCategories?: boolean;
    skipSpecialties?: boolean;
    skipProfessionals?: boolean;
    skipWeek?: boolean;
    skipDay?: boolean;
  }) => {
    const clauses: string[] = ['1=1'];
    if (!opts?.skipDay && selectedDateIsValid) clauses.push(`CAST(DataQuadro AS DATE) = DATE '${selectedDate}'`);
    const rangesForFilter = activeWeekRanges.length > 0 ? activeWeekRanges : weekRanges;
    if (!opts?.skipWeek && rangesForFilter.length > 0) {
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const periods = rangesForFilter.map(
        (ws) => `CAST(DataQuadro AS DATE) BETWEEN DATE '${fmt(ws.start)}' AND DATE '${fmt(ws.end)}'`
      );
      clauses.push(`(${periods.join(' OR ')})`);
    }
    if (!opts?.skipUnits && selectedUnits.length > 0) clauses.push(`Unidade IN (${inClause(selectedUnits)})`);
    if (!opts?.skipCategories && selectedCategories.length > 0) clauses.push(`CategoriaEspecialidade IN (${inClause(selectedCategories)})`);
    if (!opts?.skipSpecialties && selectedSpecialties.length > 0) clauses.push(`Especialidade IN (${inClause(selectedSpecialties)})`);
    if (!opts?.skipProfessionals && selectedProfessionals.length > 0) clauses.push(`Profissional IN (${inClause(selectedProfessionals)})`);
    if (selectedSituations.length > 0) clauses.push(`UPPER(TRIM(Situacao_Horario)) IN (${inClauseNormalized(selectedSituations)})`);
    if (selectedOccupations.length > 0) clauses.push(`UPPER(TRIM(ocupacao_agenda)) IN (${inClauseNormalized(selectedOccupations)})`);
    return clauses.join(' AND ');
  };

  const handleWeekChange = (indexes: number[]) => {
    setSelectedWeekIndexes(indexes);
    setSelectedDate(null);
  };

  const handleWeeklyCardClick = (idx: number) => {
    setSelectedWeekIndexes((prev) => (
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    ));
    setSelectedDate(null);
  };

  const handleUnitsChange = (units: string[]) => {
    setSelectedUnits(units);
    // Mudanca manual de unidade invalida dependencias abaixo.
    setSelectedCategories([]);
    setSelectedSpecialties([]);
    setSelectedProfessionals([]);
  };

  const handleClearAll = () => {
    setSelectedSituations([]);
    setSelectedOccupations([]);
    setSelectedDate(null);
  };

  const toggleSelection = (value: string, current: string[], setter: (next: string[]) => void) => {
    if (current.includes(value)) {
      setter(current.filter(v => v !== value));
    } else {
      setter([...current, value]);
    }
  };

  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const db = await initDuckDB();
        const conn = await db.connect();

        const unitsRes = await conn.query("SELECT DISTINCT Unidade FROM agendas WHERE Unidade IS NOT NULL ORDER BY Unidade");
        const units = unitsRes.toArray().map(r => r.Unidade);

        // Regras de negocio: abaixo de Unidade inicia vazio.
        setFilters({ units, categories: [], specialties: [], professionals: [] });

        await conn.close();
      } catch (error) {
        console.error("Error loading initial data", error);
      }
    };

    void loadInitialData();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      const fetchSeq = ++fetchSeqRef.current;
      const isStale = () => fetchSeq !== fetchSeqRef.current;
      try {
        if (!hasLoadedOnceRef.current) {
          setLoading(true);
        }
        const db = await initDuckDB();
        const conn = await db.connect();

        const baseFilter = buildFilter();
        const filterForUnits = buildFilter({ skipUnits: true });
        const filterForCategories = buildFilter({ skipCategories: true, skipSpecialties: true, skipProfessionals: true });
        const filterForSpecialties = buildFilter({ skipSpecialties: true });
        const filterForProfessionals = buildFilter({ skipProfessionals: true });
        const filterForWeekRange = buildFilter({ skipWeek: true, skipDay: true });

        // Carrega filtros dependentes primeiro para melhorar percepcao de resposta na UI.
        const unitsRes = await conn.query(`
          SELECT DISTINCT Unidade as value
          FROM agendas
          WHERE ${filterForUnits} AND Unidade IS NOT NULL
          ORDER BY Unidade
        `);
        const nextUnits = unitsRes.toArray().map(r => r.value);

        let nextCategories: string[] = [];
        if (selectedUnits.length > 0) {
          const categoriesRes = await conn.query(`
            SELECT DISTINCT CategoriaEspecialidade as value
            FROM agendas
            WHERE ${filterForCategories} AND CategoriaEspecialidade IS NOT NULL
            ORDER BY CategoriaEspecialidade
          `);
          nextCategories = categoriesRes.toArray().map(r => r.value);
        }

        let nextSpecialties: string[] = [];
        let nextProfessionals: string[] = [];
        if (selectedCategories.length > 0) {
          const specialtiesRes = await conn.query(`
            SELECT DISTINCT Especialidade as value
            FROM agendas
            WHERE ${filterForSpecialties} AND Especialidade IS NOT NULL
            ORDER BY Especialidade
          `);
          nextSpecialties = specialtiesRes.toArray().map(r => r.value);

          // Atualiza especialidades antes de carregar profissionais para efeito progressivo.
          setFilters(prev => ({
            ...prev,
            units: nextUnits,
            categories: nextCategories,
            specialties: nextSpecialties,
            professionals: [],
          }));

          const professionalsRes = await conn.query(`
            SELECT DISTINCT Profissional as value
            FROM agendas
            WHERE ${filterForProfessionals} AND Profissional IS NOT NULL
            ORDER BY Profissional
          `);
          nextProfessionals = professionalsRes.toArray().map(r => r.value);
        }

        setFilters(prev => ({
          ...prev,
          units: nextUnits,
          categories: nextCategories,
          specialties: nextSpecialties,
          professionals: nextProfessionals,
        }));

        // Remove unidades que nao combinam com a categoria selecionada.
        if (selectedCategories.length > 0) {
          const validUnits = new Set(nextUnits);
          setSelectedUnits((prev) => {
            const pruned = prev.filter((u) => validUnits.has(u));
            return pruned.length === prev.length ? prev : pruned;
          });
        }
        if (isStale()) {
          await conn.close();
          return;
        }

        const kpiRes = await conn.query(`
          SELECT
            COUNT(*) as total,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'LIVRE' THEN 1 ELSE 0 END) as livres,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'AGENDADO' THEN 1 ELSE 0 END) as agendados,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO' THEN 1 ELSE 0 END) as bloqueados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'REALIZADO' THEN 1 ELSE 0 END) as realizados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'AUSENTE' THEN 1 ELSE 0 END) as ausentes
          FROM agendas
          WHERE ${baseFilter}
        `);
        const kpi = kpiRes.toArray()[0] || {};
        const totalHorarios = Number(kpi.total || 0);
        const horariosDisponiveis = Number(kpi.livres || 0);
        const horariosAgendados = Number(kpi.agendados || 0);
        const horariosBloqueados = Number(kpi.bloqueados || 0);
        const horariosRealizados = Number(kpi.realizados || 0);
        const horariosAusentes = Number(kpi.ausentes || 0);
        const ocupacaoDen = Math.max(totalHorarios - horariosBloqueados, 0);
        const ausenciaDen = Math.max(horariosRealizados + horariosAusentes, 0);
        const taxaOcupacao = ocupacaoDen > 0 ? (horariosAgendados / ocupacaoDen) * 100 : 0;
        const taxaAusencia = ausenciaDen > 0 ? (horariosAusentes / ausenciaDen) * 100 : 0;
        const indiceBloqueio = totalHorarios > 0 ? (horariosBloqueados / totalHorarios) * 100 : 0;

        const monthlyRes = await conn.query(`
          SELECT CAST(Ano AS VARCHAR) || ' ' || NomeMes as name, Ano, MesNum, COUNT(*) as value
          FROM agendas
          WHERE ${baseFilter} AND UPPER(TRIM(Situacao_Horario)) = 'AGENDADO'
          GROUP BY name, Ano, MesNum
          ORDER BY Ano, MesNum
        `);

        const dailyRes = await conn.query(`
          SELECT
            CAST(DataQuadro AS DATE) as date_key,
            strftime(CAST(DataQuadro AS DATE), '%d/%m') as label,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'REALIZADO' THEN 1 ELSE 0 END) as realizados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'AUSENTE' THEN 1 ELSE 0 END) as ausentes,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'LIVRE' THEN 1 ELSE 0 END) as livres,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'BLOQUEADO' THEN 1 ELSE 0 END) as bloqueados
          FROM agendas
          WHERE ${baseFilter}
          GROUP BY CAST(DataQuadro AS DATE), strftime(CAST(DataQuadro AS DATE), '%d/%m')
          ORDER BY CAST(DataQuadro AS DATE)
        `);

        const schemaRes = await conn.query(`
          SELECT lower(column_name) as name
          FROM information_schema.columns
          WHERE lower(table_name) = 'agendas'
        `);
        const hasJustificativaBloqueio = new Set(schemaRes.toArray().map((r: any) => String(r.name))).has('justificativabloqueio');
        const justificativasPorDia = new Map<string, string[]>();
        if (hasJustificativaBloqueio) {
          const justRes = await conn.query(`
            SELECT
              CAST(DataQuadro AS DATE) as date_key,
              TRIM(CAST(JustificativaBloqueio AS VARCHAR)) as justificativa
            FROM agendas
            WHERE ${baseFilter}
              AND UPPER(TRIM(ocupacao_agenda)) = 'BLOQUEADO'
              AND JustificativaBloqueio IS NOT NULL
              AND TRIM(CAST(JustificativaBloqueio AS VARCHAR)) <> ''
            GROUP BY CAST(DataQuadro AS DATE), TRIM(CAST(JustificativaBloqueio AS VARCHAR))
            ORDER BY CAST(DataQuadro AS DATE), justificativa
          `);
          justRes.toArray().forEach((r: any) => {
            const dateKey = normalizeSqlDate(r.date_key);
            const justificativa = String(r.justificativa || '').trim();
            if (!dateKey || !justificativa) return;
            if (!justificativasPorDia.has(dateKey)) justificativasPorDia.set(dateKey, []);
            justificativasPorDia.get(dateKey)!.push(justificativa);
          });
        }

        const especialidadeRes = await conn.query(`
          SELECT Especialidade as name, COUNT(*) as quantidade
          FROM agendas
          WHERE ${baseFilter} AND Especialidade IS NOT NULL
          GROUP BY Especialidade
          ORDER BY quantidade DESC
          LIMIT 10
        `);

        const profissionalRes = await conn.query(`
          SELECT Profissional as name, COUNT(*) as quantidade
          FROM agendas
          WHERE ${baseFilter} AND Profissional IS NOT NULL
          GROUP BY Profissional
          ORDER BY quantidade DESC
          LIMIT 10
        `);

        const situacaoRes = await conn.query(`
          SELECT
            CASE UPPER(TRIM(Situacao_Horario))
              WHEN 'AGENDADO' THEN 'Agendado'
              WHEN 'LIVRE' THEN 'Livre'
              WHEN 'BLOQUEADO' THEN 'Bloqueado'
              ELSE 'Outros'
            END as name,
            COUNT(*) as quantidade
          FROM agendas
          WHERE ${baseFilter} AND Situacao_Horario IS NOT NULL
          GROUP BY 1
          ORDER BY quantidade DESC
        `);

        const ocupacaoRes = await conn.query(`
          SELECT
            CASE UPPER(TRIM(ocupacao_agenda))
              WHEN 'REALIZADO' THEN 'Realizado'
              WHEN 'AUSENTE' THEN 'Ausente'
              WHEN 'LIVRE' THEN 'Livre'
              WHEN 'BLOQUEADO' THEN 'Bloqueado'
              ELSE 'Outros'
            END as name,
            COUNT(*) as quantidade
          FROM agendas
          WHERE ${baseFilter} AND ocupacao_agenda IS NOT NULL
          GROUP BY 1
          ORDER BY quantidade DESC
        `);
        const performanceProfRes = await conn.query(`
          WITH prof_esp AS (
            SELECT
              Profissional as prof,
              Especialidade as specialty,
              COUNT(*) as cnt
            FROM agendas
            WHERE ${baseFilter}
              AND Profissional IS NOT NULL
              AND Especialidade IS NOT NULL
            GROUP BY Profissional, Especialidade
          ),
          top_esp AS (
            SELECT prof, specialty
            FROM (
              SELECT
                prof,
                specialty,
                cnt,
                ROW_NUMBER() OVER (PARTITION BY prof ORDER BY cnt DESC, specialty ASC) as rn
              FROM prof_esp
            ) ranked
            WHERE rn = 1
          )
          SELECT
            a.Profissional as name,
            COALESCE(t.specialty, '-') as specialty,
            COUNT(*) as total,
            SUM(CASE WHEN UPPER(TRIM(a.Situacao_Horario)) = 'BLOQUEADO' THEN 1 ELSE 0 END) as bloqueados,
            SUM(CASE WHEN UPPER(TRIM(a.ocupacao_agenda)) = 'REALIZADO' THEN 1 ELSE 0 END) as realizados,
            SUM(CASE WHEN UPPER(TRIM(a.ocupacao_agenda)) = 'AUSENTE' THEN 1 ELSE 0 END) as ausentes
          FROM agendas a
          LEFT JOIN top_esp t ON t.prof = a.Profissional
          WHERE ${baseFilter} AND a.Profissional IS NOT NULL
          GROUP BY a.Profissional, t.specialty
        `);
        const performanceSpecRes = await conn.query(`
          SELECT
            Especialidade as name,
            COUNT(*) as total,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO' THEN 1 ELSE 0 END) as bloqueados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'REALIZADO' THEN 1 ELSE 0 END) as realizados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'AUSENTE' THEN 1 ELSE 0 END) as ausentes
          FROM agendas
          WHERE ${baseFilter} AND Especialidade IS NOT NULL
          GROUP BY Especialidade
        `);
        const bloqueioProfDiaRes = await conn.query(`
          SELECT
            Profissional as name,
            CAST(DataQuadro AS DATE) as day_key,
            COUNT(*) as quantidade
          FROM agendas
          WHERE ${baseFilter}
            AND UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO'
            AND Profissional IS NOT NULL
          GROUP BY Profissional, CAST(DataQuadro AS DATE)
        `);
        const bloqueioGlobalRes = hasJustificativaBloqueio
          ? await conn.query(`
              SELECT
                Profissional as profissional,
                COALESCE(Unidade, '-') as unidade,
                COALESCE(Especialidade, '-') as especialidade,
                CAST(DataQuadro AS DATE) as day_key,
                COUNT(*) as quantidade,
                string_agg(
                  DISTINCT TRIM(CAST(JustificativaBloqueio AS VARCHAR)),
                  ' || '
                ) FILTER (
                  WHERE JustificativaBloqueio IS NOT NULL
                    AND TRIM(CAST(JustificativaBloqueio AS VARCHAR)) <> ''
                ) as justificativas_raw
              FROM agendas
              WHERE ${baseFilter}
                AND UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO'
                AND Profissional IS NOT NULL
              GROUP BY Profissional, COALESCE(Unidade, '-'), COALESCE(Especialidade, '-'), CAST(DataQuadro AS DATE)
            `)
          : await conn.query(`
              SELECT
                Profissional as profissional,
                COALESCE(Unidade, '-') as unidade,
                COALESCE(Especialidade, '-') as especialidade,
                CAST(DataQuadro AS DATE) as day_key,
                COUNT(*) as quantidade,
                NULL as justificativas_raw
              FROM agendas
              WHERE ${baseFilter}
                AND UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO'
                AND Profissional IS NOT NULL
              GROUP BY Profissional, COALESCE(Unidade, '-'), COALESCE(Especialidade, '-'), CAST(DataQuadro AS DATE)
            `);
        const bloqueioMotivoMap = new Map<string, string[]>();
        if (hasJustificativaBloqueio) {
          const bloqueioMotivoRes = await conn.query(`
            SELECT
              Profissional as name,
              CAST(DataQuadro AS DATE) as day_key,
              TRIM(CAST(JustificativaBloqueio AS VARCHAR)) as justificativa
            FROM agendas
            WHERE ${baseFilter}
              AND UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO'
              AND Profissional IS NOT NULL
              AND JustificativaBloqueio IS NOT NULL
              AND TRIM(CAST(JustificativaBloqueio AS VARCHAR)) <> ''
            GROUP BY Profissional, CAST(DataQuadro AS DATE), TRIM(CAST(JustificativaBloqueio AS VARCHAR))
          `);
          bloqueioMotivoRes.toArray().forEach((r: any) => {
            const prof = String(r.name || '').trim();
            const day = normalizeSqlDate(r.day_key);
            const justificativa = String(r.justificativa || '').trim();
            if (!prof || !day || !justificativa) return;
            const key = `${prof}|||${day}`;
            if (!bloqueioMotivoMap.has(key)) bloqueioMotivoMap.set(key, []);
            bloqueioMotivoMap.get(key)!.push(justificativa);
          });
        }

        const refRes = await conn.query(`
          SELECT
            MIN(CAST(DataQuadro AS DATE)) as min_date,
            MAX(CAST(DataQuadro AS DATE)) as max_date
          FROM agendas
          WHERE ${filterForWeekRange}
        `);
        const refMinVal = refRes.toArray()[0]?.min_date;
        const refMaxVal = refRes.toArray()[0]?.max_date;
        const refMinDate = refMinVal ? new Date(refMinVal) : new Date();
        const refMaxDate = refMaxVal ? new Date(refMaxVal) : new Date();
        const toDateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const getMonday = (d: Date) => {
          const day = d.getDay();
          const diff = (day + 6) % 7;
          const base = new Date(d.getFullYear(), d.getMonth(), d.getDate() - diff);
          return toDateOnly(base);
        };
        const addDays = (d: Date, days: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + days);
        const formatRange = (start: Date) => {
          const end = addDays(start, 5);
          const fmt = (x: Date) => x.toLocaleDateString('pt-BR');
          return `${fmt(start)} - ${fmt(end)}`;
        };
        const firstMonday = getMonday(refMinDate);
        const lastMonday = getMonday(refMaxDate);
        const weekStartsAll: Date[] = [];
        for (let current = firstMonday; current <= lastMonday; current = addDays(current, 7)) {
          weekStartsAll.push(current);
        }
        const weekStarts = weekStartsAll.slice(-5);
        const fmtSql = (d: Date) => d.toISOString().slice(0, 10);
        const dateKey = (v: any) => {
          if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
          const d = new Date(v);
          const y = d.getUTCFullYear();
          const m = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          return `${y}-${m}-${day}`;
        };

        const weeklyRowsRes = await conn.query(`
          SELECT
            CAST(date_trunc('week', CAST(DataQuadro AS DATE)) AS DATE) as week_start,
            COUNT(*) as total,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'LIVRE' THEN 1 ELSE 0 END) as livres,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'AGENDADO' THEN 1 ELSE 0 END) as agendados,
            SUM(CASE WHEN UPPER(TRIM(Situacao_Horario)) = 'BLOQUEADO' THEN 1 ELSE 0 END) as bloqueados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'REALIZADO' THEN 1 ELSE 0 END) as realizados,
            SUM(CASE WHEN UPPER(TRIM(ocupacao_agenda)) = 'AUSENTE' THEN 1 ELSE 0 END) as ausentes
          FROM agendas
          WHERE ${baseFilter}
          GROUP BY week_start
        `);
        const weeklyMap = new Map<string, any>();
        weekStarts.forEach((ws) => {
          weeklyMap.set(fmtSql(ws), {
            weekStart: ws,
            label: formatRange(ws),
            total: 0,
            livres: 0,
            agendados: 0,
            bloqueados: 0,
            realizados: 0,
            ausentes: 0,
          });
        });
        weeklyRowsRes.toArray().forEach((r: any) => {
          const ws = dateKey(r.week_start);
          const bucket = weeklyMap.get(ws);
          if (!bucket) return;
          bucket.total = Number(r.total || 0);
          bucket.livres = Number(r.livres || 0);
          bucket.agendados = Number(r.agendados || 0);
          bucket.bloqueados = Number(r.bloqueados || 0);
          bucket.realizados = Number(r.realizados || 0);
          bucket.ausentes = Number(r.ausentes || 0);
        });
        const weeklyRangeData = Array.from(weeklyMap.values()).map((w: any) => ({
          label: w.label,
          agendados: w.agendados,
          livres: w.livres,
          bloqueados: w.bloqueados,
          total: w.total,
        }));
        const weeklyCards = Array.from(weeklyMap.values()).map((w: any) => {
          const ocupacaoDen = Math.max(w.total - w.bloqueados, 0);
          const ausenciaDen = Math.max(w.realizados + w.ausentes, 0);
          return {
            label: w.label,
            total: w.total,
            agendados: w.agendados,
            bloqueados: w.bloqueados,
            livres: w.livres,
            ocupacaoPct: ocupacaoDen > 0 ? (w.agendados / ocupacaoDen) * 100 : 0,
            ausenciaPct: ausenciaDen > 0 ? (w.ausentes / ausenciaDen) * 100 : 0,
            bloqueioPct: w.total > 0 ? (w.bloqueados / w.total) * 100 : 0,
          };
        });
        const nextWeekRanges = weekStarts.map((ws) => ({
          label: formatRange(ws),
          start: ws,
          end: addDays(ws, 5),
        }));
        const rangesChanged =
          nextWeekRanges.length !== weekRanges.length ||
          nextWeekRanges.some((r, idx) => {
            const prev = weekRanges[idx];
            if (!prev) return true;
            return (
              r.label !== prev.label ||
              r.start.getTime() !== prev.start.getTime() ||
              r.end.getTime() !== prev.end.getTime()
            );
          });
        if (rangesChanged) {
          setWeekRanges(nextWeekRanges);
        }
        const validIndexes = selectedWeekIndexes.filter((idx) => idx >= 0 && idx < nextWeekRanges.length);
        if (validIndexes.length !== selectedWeekIndexes.length) {
          setSelectedWeekIndexes(validIndexes);
        }

        const totalPorProfissional = new Map<string, number>();
        performanceProfRes.toArray().forEach((r: any) => {
          const prof = String(r.name || '').trim();
          if (!prof) return;
          totalPorProfissional.set(prof, Number(r.total || 0));
        });
        const bloqueioTopMap = new Map<string, { total: number; days: Set<string>; dayCounts: Map<string, number> }>();
        bloqueioProfDiaRes.toArray().forEach((r: any) => {
          const prof = String(r.name || '').trim();
          const day = normalizeSqlDate(r.day_key);
          if (!prof || !day) return;
          const qtd = Number(r.quantidade || 0);
          const current = bloqueioTopMap.get(prof) || { total: 0, days: new Set<string>(), dayCounts: new Map<string, number>() };
          current.total += qtd;
          current.days.add(day);
          current.dayCounts.set(day, (current.dayCounts.get(day) || 0) + qtd);
          bloqueioTopMap.set(prof, current);
        });
        const bloqueioTopProfData = Array.from(bloqueioTopMap.entries())
          .map(([name, v]) => {
            const orderedDays = Array.from(v.days).sort((a, b) => a.localeCompare(b));
            const datasComBloqueios = orderedDays.map(formatDateFromSqlKey).join(', ');
            const datasDetalhe = orderedDays.map((day) => ({
              data: formatDateFromSqlKey(day),
              quantidade: Number(v.dayCounts.get(day) || 0),
              justificativas: bloqueioMotivoMap.get(`${name}|||${day}`) || [],
            }));
            return {
              name,
              quantidadeBloqueios: v.total,
              diasComBloqueios: v.days.size,
              percentualSobreTotal: totalPorProfissional.get(name) ? (v.total / Number(totalPorProfissional.get(name))) * 100 : 0,
              datasComBloqueios: datasComBloqueios.length > 120 ? `${datasComBloqueios.slice(0, 117)}...` : datasComBloqueios,
              datasDetalhe,
            };
          })
          .sort((a, b) => b.quantidadeBloqueios - a.quantidadeBloqueios)
          .slice(0, 5);
        const bloqueioGlobalData = bloqueioGlobalRes.toArray().map((r: any) => {
          const parsedDate = normalizeSqlDate(r.day_key);
          const raw = String(r.justificativas_raw || '').trim();
          return {
            profissional: String(r.profissional || '-'),
            unidade: String(r.unidade || '-'),
            especialidade: String(r.especialidade || '-'),
            data: parsedDate ? formatDateFromSqlKey(parsedDate) : '-',
            quantidade: Number(r.quantidade || 0),
            justificativas: raw ? raw.split(' || ').map((j) => j.trim()).filter(Boolean) : [],
          };
        });
        const mapPerformanceRows = (rows: any[]): PerformanceRow[] =>
          rows
            .map((r) => {
              const total = Number(r.total || 0);
              const bloqueados = Number(r.bloqueados || 0);
              const realizados = Number(r.realizados || 0);
              const ausentes = Number(r.ausentes || 0);
              const disponiveis = Math.max(total - bloqueados, 0);
              const aproveitamentoPct = disponiveis > 0 ? (realizados / disponiveis) * 100 : 0;
              const ausenciaDen = Math.max(realizados + ausentes, 0);
              const ausenciaPct = ausenciaDen > 0 ? (ausentes / ausenciaDen) * 100 : 0;
              const bloqueioPct = total > 0 ? (bloqueados / total) * 100 : 0;
              return {
                name: String(r.name || ''),
                specialty: String(r.specialty || ''),
                total,
                bloqueados,
                realizados,
                ausentes,
                disponiveis,
                aproveitamentoPct,
                ausenciaPct,
                bloqueioPct,
              };
            })
            .filter((r) => r.name.trim().length > 0);

        if (isStale()) {
          await conn.close();
          return;
        }
        setData({
          totalHorarios,
          horariosDisponiveis,
          horariosAgendados,
          horariosRealizados,
          horariosAusentes,
          horariosBloqueados,
          taxaOcupacao,
          taxaAusencia,
          indiceBloqueio,
          monthlyData: monthlyRes.toArray().map(r => ({ name: r.name, value: Number(r.value) })),
          dailyData: dailyRes.toArray().map(r => {
            const parsedDate = normalizeSqlDate(r.date_key);
            return {
              dateKey: parsedDate || '',
              label: String(r.label),
              realizados: Number(r.realizados || 0),
              ausentes: Number(r.ausentes || 0),
              livres: Number(r.livres || 0),
              bloqueados: Number(r.bloqueados || 0),
              justificativasBloqueio: parsedDate ? (justificativasPorDia.get(parsedDate) || []) : [],
            };
          }).filter((r) => r.dateKey !== ''),
          especialidadeData: especialidadeRes.toArray().map(r => ({ name: r.name, quantidade: Number(r.quantidade) })),
          profissionalData: profissionalRes.toArray().map(r => ({ name: r.name, quantidade: Number(r.quantidade) })),
          situacaoData: situacaoRes.toArray().map(r => ({ name: r.name, quantidade: Number(r.quantidade) })),
          ocupacaoData: ocupacaoRes.toArray().map(r => ({ name: r.name, quantidade: Number(r.quantidade) })),
          performanceByProfessional: mapPerformanceRows(performanceProfRes.toArray()),
          performanceBySpecialty: mapPerformanceRows(performanceSpecRes.toArray()),
          bloqueioTopProfData,
          bloqueioGlobalData,
          weeklyRangeData,
          weeklyCards,
        });

        await conn.close();
      } catch (error) {
        console.error("Error fetching dashboard data", error);
      } finally {
        if (!isStale()) {
          setLoading(false);
          if (!hasLoadedOnceRef.current) {
            hasLoadedOnceRef.current = true;
          }
        }
      }
    };

    void fetchData();
  }, [
    selectedUnits,
    selectedCategories,
    selectedSpecialties,
    selectedProfessionals,
    selectedSituations,
    selectedOccupations,
    selectedDate,
    selectedWeekIndexes,
    weekRanges
  ]);

  useEffect(() => {
    setSelectedSpecialties([]);
    setSelectedProfessionals([]);
  }, [selectedCategories]);

  useEffect(() => {
    if (selectedDate && !selectedDateIsValid) {
      setSelectedDate(null);
    }
  }, [selectedDate, selectedDateIsValid]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-secondary text-sm">Carregando dados...</div>
    );
  }

  return (
    <div className="flex bg-background h-screen w-screen overflow-hidden font-sans text-text">
      <Sidebar 
        weekRanges={weekRanges}
        selectedWeekIndexes={selectedWeekIndexes}
        onWeekChange={handleWeekChange}
        units={filters.units}
        selectedUnits={selectedUnits}
        onUnitsChange={handleUnitsChange}
        categories={filters.categories}
        selectedCategories={selectedCategories}
        onCategoriesChange={setSelectedCategories}
        specialties={filters.specialties}
        selectedSpecialties={selectedSpecialties}
        onSpecialtiesChange={setSelectedSpecialties}
        professionals={filters.professionals}
        selectedProfessionals={selectedProfessionals}
        onProfessionalsChange={setSelectedProfessionals}
        onClearAll={handleClearAll}
      />

      <div className="flex-1 ml-56 p-4 flex flex-col h-screen overflow-hidden">
        <div className="flex justify-between items-center mb-2 shrink-0 border-b border-border pb-1">
          <div>
            <h1 className="text-2xl font-bold text-white leading-tight">Visao Geral</h1>
            <div className="mt-0.5 flex items-center gap-1 text-[9px] text-secondary overflow-x-auto no-scrollbar whitespace-nowrap max-w-[62vw]">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="text-white/90">Contexto:</span>
              <span className="px-1.5 py-0.5 rounded-full border border-cyan-400/35 bg-cyan-400/10 text-cyan-300">
                Semana: {contextWeek}
              </span>
              <span className="px-1.5 py-0.5 rounded-full border border-amber-400/35 bg-amber-400/10 text-amber-300">
                Unidade: {contextUnits}
              </span>
              <span className="px-1.5 py-0.5 rounded-full border border-emerald-400/35 bg-emerald-400/10 text-emerald-300">
                Categoria: {contextCategories}
              </span>
              <span className="px-1.5 py-0.5 rounded-full border border-indigo-400/35 bg-indigo-400/10 text-indigo-300">
                Especialidade: {contextSpecialties}
              </span>
              <span className="px-1.5 py-0.5 rounded-full border border-fuchsia-400/35 bg-fuchsia-400/10 text-fuchsia-300">
                Profissional: {contextProfessionals}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-secondary text-[10px]">Dados atualizados em: {new Date().toLocaleDateString()}</div>
            <div className="flex items-center justify-end gap-2 mt-1">
              <button onClick={() => { void exportAll(); }} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border border-border bg-card text-secondary hover:text-white hover:border-primary transition-colors">
                <Download className="w-3 h-3" />
                Exportar Excel
              </button>
              <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold border border-white/20 bg-white/10 backdrop-blur-sm shadow-sm">FS</div>
            </div>
          </div>
        </div>

        <div className="mb-1 text-[11px] text-secondary uppercase tracking-wide">Resumo do periodo</div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-1.5 mb-2">
          <MiniKPI label="Total Horarios" value={formatNumber(data.totalHorarios)} tooltip="Quantidade total de horarios no periodo." />
          <MiniKPI label="Horarios Disponiveis" value={formatNumber(data.horariosDisponiveis)} tooltip="Horarios livres no periodo." />
          <MiniKPI label="Horarios Agendados" value={formatNumber(data.horariosAgendados)} tooltip="Horarios com agendamento ativo." />
          <MiniKPI label="Horarios Realizados" value={formatNumber(data.horariosRealizados)} tooltip="Agendamentos realizados." />
          <MiniKPI label="Horarios Ausentes" value={formatNumber(data.horariosAusentes)} tooltip="Agendamentos sem comparecimento." />
          <MiniKPI label="Horarios Bloqueados" value={formatNumber(data.horariosBloqueados)} tooltip="Horarios indisponiveis por bloqueio." tone="danger" />
          <MiniKPI label="Taxa de Ocupacao" value={formatPercent(data.taxaOcupacao)} tooltip="Agendados dividido pelos horarios disponiveis." />
          <MiniKPI label="Taxa de Ausencia" value={formatPercent(data.taxaAusencia)} tooltip="Ausentes dividido por (realizados + ausentes)." />
          <MiniKPI label="Indice de Bloqueios" value={formatPercent(data.indiceBloqueio)} tooltip="Bloqueados dividido pelo total de horarios." tone="danger" />
          <MiniKPI label="Aproveitamento da Capacidade" value={formatPercent(aproveitamentoCapacidade)} tooltip="Realizados dividido pela capacidade instalada total." />
          <MiniKPI label="Dias com Bloqueios" value={formatNumber(diasComBloqueio)} tooltip="Quantidade de datas com pelo menos 1 horario bloqueado no periodo filtrado." />
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="min-h-full flex flex-col gap-1.5">
          <div className="bg-card border border-border rounded-lg p-1.5 shadow-xl shadow-black/20 fade-slide">
            <h3 className="text-white text-xs font-bold mb-2 flex items-center gap-2">
              <span className="w-1 h-3 bg-primary rounded-full"></span>
              VISÃO SEMANAL (2 PASSADAS, ATUAL, 2 FUTURAS)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
              {data.weeklyCards.map((w, idx) => {
                const stage = getWeekStage(idx, data.weeklyCards.length);
                const style = getWeekStageStyle(stage);
                const hasManualSelection = selectedWeekIndexes.length > 0;
                const isSelected = selectedWeekIndexes.includes(idx);
                const isCurrentInAllMode = !hasManualSelection && stage === 'current';
                const emphasisClass = hasManualSelection
                  ? (isSelected
                      ? 'bg-amber-500/10 border-amber-400/70 shadow-[0_0_0_1px_rgba(245,158,11,0.28)]'
                      : 'opacity-70')
                  : (isCurrentInAllMode
                      ? 'bg-cyan-500/10 border-cyan-300/70 shadow-[0_0_0_1px_rgba(34,211,238,0.22)]'
                      : 'opacity-90');
                const topLineClass = hasManualSelection
                  ? (isSelected ? 'bg-amber-400/90' : 'bg-transparent')
                  : (isCurrentInAllMode ? 'bg-cyan-300/90' : 'bg-transparent');
                const chipClass = hasManualSelection && isSelected
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-400/45'
                  : style.chipClass;
                const chipLabel = hasManualSelection && isSelected ? 'SELECIONADA' : style.chipLabel;
                return (
                <button
                  key={w.label}
                  type="button"
                  onClick={() => handleWeeklyCardClick(idx)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleWeeklyCardClick(idx);
                    }
                  }}
                  className={`relative overflow-hidden border rounded-md p-2 bg-background/40 transition-all duration-200 text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/60 ${style.cardClass} ${emphasisClass}`}
                  title="Clique para aplicar/remover filtro desta semana"
                >
                  <div className={`absolute left-0 top-0 h-[2px] w-full ${topLineClass}`}></div>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <div className="text-[10px] text-secondary">{w.label}</div>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded ${chipClass}`}>{chipLabel}</span>
                  </div>
                  <div className="text-xs text-white font-bold mb-1">Total: {formatNumber(w.total)}</div>
                  <div className="text-[10px] text-secondary">
                    Agendados: {formatNumber(w.agendados)} <span className="text-white/80">| {formatPercent(w.ocupacaoPct)}</span>
                  </div>
                  <div className="text-[10px] text-rose-400">
                    Bloqueados: {formatNumber(w.bloqueados)} <span className="text-white/80">| {formatPercent(w.bloqueioPct)}</span>
                  </div>
                  <div className="text-[10px] text-secondary">
                    Livres: {formatNumber(w.livres)} <span className="text-white/80">| {formatPercent(w.total > 0 ? (w.livres / w.total) * 100 : 0)}</span>
                  </div>
                  <div className="text-[10px] text-secondary">
                    Ausência: <span className="text-white/80">{formatPercent(w.ausenciaPct)}</span>
                  </div>
                </button>
              )})}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-4 gap-1.5 items-stretch">
            <div className="lg:col-span-2 h-[158px] bg-card border border-border rounded-lg p-2 shadow-xl shadow-black/20 fade-slide flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <span className="w-1 h-3 bg-primary rounded-full"></span>
                <h3 className="text-white text-xs font-bold">RANKING DE PERFORMANCE</h3>
                <div className="ml-2 inline-flex rounded-md border border-border overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setRankingView('profissional')}
                    className={`text-[10px] px-2 py-1 ${rankingView === 'profissional' ? 'bg-amber-500 text-black' : 'bg-card text-secondary'}`}
                  >
                    Profissional
                  </button>
                  <button
                    type="button"
                    onClick={() => setRankingView('especialidade')}
                    className={`text-[10px] px-2 py-1 border-l border-border ${rankingView === 'especialidade' ? 'bg-amber-500 text-black' : 'bg-card text-secondary'}`}
                  >
                    Especialidade
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setRankingModalOpen(true)}
                  className="ml-auto text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
                >
                  Ver tudo
                </button>
              </div>

              {rankingView === 'profissional' ? (
                <div className="grid grid-cols-12 text-[9px] text-secondary uppercase tracking-wide border-b border-border pb-1 mb-1">
                  <div className="col-span-4">Nome</div>
                  <div className="col-span-2">Especialidade</div>
                  <div className="col-span-2 text-right">Aproveitamento</div>
                  <div className="col-span-2 text-right">Indice Ausencia</div>
                  <div className="col-span-2 text-right">Bloqueios</div>
                </div>
              ) : (
                <div className="grid grid-cols-12 text-[9px] text-secondary uppercase tracking-wide border-b border-border pb-1 mb-1">
                  <div className="col-span-5">Nome</div>
                  <div className="col-span-2 text-right">Aproveitamento</div>
                  <div className="col-span-2 text-right">Indice Ausencia</div>
                  <div className="col-span-3 text-right">Bloqueios</div>
                </div>
              )}

              <div className="space-y-1 overflow-y-auto pr-1 flex-1 min-h-0">
                {topPerformanceRows.length === 0 && (
                  <div className="text-[10px] text-secondary">Sem dados para os filtros atuais.</div>
                )}
                {topPerformanceRows.map((row) => (
                  rankingView === 'profissional' ? (
                    <div key={row.name} className="grid grid-cols-12 items-center text-[10px]">
                      <div className="col-span-4 text-white font-semibold truncate pr-2" title={row.name}>{row.name}</div>
                      <div className="col-span-2 text-secondary truncate pr-2" title={row.specialty || '-'}>{row.specialty || '-'}</div>
                      <div className="col-span-2 text-right text-cyan-300 font-bold">{formatPercent(row.aproveitamentoPct)}</div>
                      <div className="col-span-2 text-right text-amber-300">{formatPercent(row.ausenciaPct)}</div>
                      <div className="col-span-2 text-right text-rose-300">
                        {formatNumber(row.bloqueados)} <span className="text-white/70">| {formatPercent(row.bloqueioPct)}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={row.name} className="grid grid-cols-12 items-center text-[10px]">
                      <div className="col-span-5 text-white font-semibold truncate pr-2" title={row.name}>{row.name}</div>
                      <div className="col-span-2 text-right text-cyan-300 font-bold">{formatPercent(row.aproveitamentoPct)}</div>
                      <div className="col-span-2 text-right text-amber-300">{formatPercent(row.ausenciaPct)}</div>
                      <div className="col-span-3 text-right text-rose-300">
                        {formatNumber(row.bloqueados)} <span className="text-white/70">| {formatPercent(row.bloqueioPct)}</span>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
            <div className="lg:col-span-1 h-[158px]">
              <TypeBarChart
                title="SITUACAO DO HORARIO"
                data={data.situacaoData}
                colors={['#ffa15a', '#636efa', '#00cc96', '#2b7fff']}
                onBarClick={(name) => toggleSelection(name, selectedSituations, setSelectedSituations)}
                tooltipText="Valores representam a situacao do horario."
                onExport={exportSituacao}
              />
            </div>
            <div className="lg:col-span-1 h-[158px]">
              <TypeBarChart
                title="OCUPACAO DA AGENDA"
                data={data.ocupacaoData}
                colors={['#3b82f6', '#f59e0b', '#22c55e', '#ef4444']}
                onBarClick={(name) => toggleSelection(name, selectedOccupations, setSelectedOccupations)}
                tooltipText="Valores representam a ocupacao da agenda."
                onExport={exportOcupacao}
              />
            </div>
          </div>

          <div className="flex-none flex flex-col gap-1.5">
            <div className="h-[221px] shrink-0">
              <DailyRealizedChart
                data={data.dailyData}
                onDayClick={(dateKey) => setSelectedDate(prev => (prev === dateKey ? null : dateKey))}
                onExport={exportAgendadoDia}
              />
            </div>

            <div className="bg-card border border-border rounded-lg p-1 shadow-xl shadow-black/20 fade-slide h-[159px] shrink-0 flex flex-col">
              <h3 className="text-white text-xs font-bold mb-0.5 flex items-center gap-2 shrink-0">
                <span className="w-1 h-3 bg-rose-400 rounded-full"></span>
                TOP 5 PROFISSIONAIS COM MAIS BLOQUEIOS
                <button
                  type="button"
                  onClick={() => setBloqueiosGlobalModalOpen(true)}
                  className="ml-auto text-[9px] px-1.5 py-0.5 rounded border border-border bg-card text-secondary hover:text-white hover:border-primary"
                >
                  Ver todos
                </button>
              </h3>
              <div className="grid grid-cols-12 text-[9px] text-secondary uppercase tracking-wide border-b border-border pb-0.5 mb-0.5 shrink-0">
                <div className="col-span-3">Profissional</div>
                <div className="col-span-2 text-right">Quantidade bloqueios</div>
                <div className="col-span-2 text-right">Dias com bloqueios</div>
                <div className="col-span-2 text-right">% sobre total</div>
                <div className="col-span-2 pl-2">Datas com bloqueios</div>
                <div className="col-span-1 text-right">Acao</div>
              </div>
              <div className="space-y-0 overflow-hidden pr-1 flex-1 min-h-0">
                {data.bloqueioTopProfData.length === 0 && (
                  <div className="text-[10px] text-secondary">Nenhum bloqueio para os filtros atuais.</div>
                )}
                {data.bloqueioTopProfData.map((row) => (
                  <div key={row.name} className="grid grid-cols-12 items-center text-[9px] leading-4">
                    <div className="col-span-3 text-white font-semibold truncate pr-2">{row.name}</div>
                    <div className="col-span-2 text-right text-rose-300 font-bold">{formatNumber(row.quantidadeBloqueios)}</div>
                    <div className="col-span-2 text-right text-white/90">{formatNumber(row.diasComBloqueios)}</div>
                    <div className="col-span-2 text-right text-amber-300">{formatPercent(row.percentualSobreTotal)}</div>
                    <div className="col-span-2 pl-2 text-secondary truncate">
                      {row.datasDetalhe.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => setBloqueiosModal({ open: true, profissional: row.name, datas: row.datasDetalhe })}
                          className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-card text-secondary hover:text-white hover:border-primary"
                          title="Ver todas as datas de bloqueio"
                        >
                          Ver datas ({row.datasDetalhe.length})
                        </button>
                      ) : (
                        '-'
                      )}
                    </div>
                    <div className="col-span-1 text-right">
                      {(() => {
                        const isFiltered = selectedProfessionals.length === 1 && selectedProfessionals[0] === row.name;
                        return (
                      <button
                        type="button"
                        onClick={() => setSelectedProfessionals(isFiltered ? [] : [row.name])}
                        className="text-[9px] px-1.5 py-0.5 rounded border border-border bg-card text-secondary hover:text-white hover:border-primary"
                        title={isFiltered ? "Remover filtro deste profissional" : "Filtrar este profissional"}
                      >
                        {isFiltered ? 'Remover filtro' : 'Filtrar'}
                      </button>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          </div>
        </div>
      </div>

      {rankingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[86vh] bg-card border border-border rounded-lg shadow-2xl shadow-black/50 flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <h3 className="text-white text-sm font-bold">RANKING COMPLETO</h3>
              <div className="ml-2 inline-flex rounded-md border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setRankingView('profissional')}
                  className={`text-[10px] px-2 py-1 ${rankingView === 'profissional' ? 'bg-amber-500 text-black' : 'bg-card text-secondary'}`}
                >
                  Profissional
                </button>
                <button
                  type="button"
                  onClick={() => setRankingView('especialidade')}
                  className={`text-[10px] px-2 py-1 border-l border-border ${rankingView === 'especialidade' ? 'bg-amber-500 text-black' : 'bg-card text-secondary'}`}
                >
                  Especialidade
                </button>
              </div>
              <button
                type="button"
                onClick={() => setRankingSortDir((prev) => (prev === 'desc' ? 'asc' : 'desc'))}
                className="ml-auto text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
              >
                Ordem: {rankingSortDir === 'desc' ? 'Maior -> Menor' : 'Menor -> Maior'}
              </button>
              <button
                type="button"
                onClick={() => setRankingModalOpen(false)}
                className="text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
              >
                Fechar
              </button>
            </div>

            <div className="p-3 overflow-y-auto">
              {rankingView === 'profissional' ? (
                <div className="grid grid-cols-12 text-[10px] text-secondary uppercase tracking-wide border-b border-border pb-1 mb-1">
                  <button type="button" onClick={() => setRankingSortKey('nome')} className="col-span-4 text-left hover:text-white">Nome</button>
                  <div className="col-span-2 text-left">Especialidade</div>
                  <button type="button" onClick={() => setRankingSortKey('aproveitamento')} className="col-span-2 text-right hover:text-white">Aproveitamento</button>
                  <button type="button" onClick={() => setRankingSortKey('ausencia')} className="col-span-2 text-right hover:text-white">Indice Ausencia</button>
                  <button type="button" onClick={() => setRankingSortKey('bloqueios')} className="col-span-2 text-right hover:text-white">Bloqueios</button>
                </div>
              ) : (
                <div className="grid grid-cols-12 text-[10px] text-secondary uppercase tracking-wide border-b border-border pb-1 mb-1">
                  <button type="button" onClick={() => setRankingSortKey('nome')} className="col-span-5 text-left hover:text-white">Nome</button>
                  <button type="button" onClick={() => setRankingSortKey('aproveitamento')} className="col-span-2 text-right hover:text-white">Aproveitamento</button>
                  <button type="button" onClick={() => setRankingSortKey('ausencia')} className="col-span-2 text-right hover:text-white">Indice Ausencia</button>
                  <button type="button" onClick={() => setRankingSortKey('bloqueios')} className="col-span-3 text-right hover:text-white">Bloqueios</button>
                </div>
              )}

              <div className="space-y-1">
                {sortedPerformanceRows.length === 0 && (
                  <div className="text-[11px] text-secondary">Sem dados para os filtros atuais.</div>
                )}
                {sortedPerformanceRows.map((row) => (
                  rankingView === 'profissional' ? (
                    <div key={row.name} className="grid grid-cols-12 items-center text-[11px]">
                      <div className="col-span-4 text-white font-semibold truncate pr-2" title={row.name}>{row.name}</div>
                      <div className="col-span-2 text-secondary truncate pr-2" title={row.specialty || '-'}>{row.specialty || '-'}</div>
                      <div className="col-span-2 text-right text-cyan-300 font-bold">{formatPercent(row.aproveitamentoPct)}</div>
                      <div className="col-span-2 text-right text-amber-300">{formatPercent(row.ausenciaPct)}</div>
                      <div className="col-span-2 text-right text-rose-300">
                        {formatNumber(row.bloqueados)} <span className="text-white/70">| {formatPercent(row.bloqueioPct)}</span>
                      </div>
                    </div>
                  ) : (
                    <div key={row.name} className="grid grid-cols-12 items-center text-[11px]">
                      <div className="col-span-5 text-white font-semibold truncate pr-2" title={row.name}>{row.name}</div>
                      <div className="col-span-2 text-right text-cyan-300 font-bold">{formatPercent(row.aproveitamentoPct)}</div>
                      <div className="col-span-2 text-right text-amber-300">{formatPercent(row.ausenciaPct)}</div>
                      <div className="col-span-3 text-right text-rose-300">
                        {formatNumber(row.bloqueados)} <span className="text-white/70">| {formatPercent(row.bloqueioPct)}</span>
                      </div>
                    </div>
                  )
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {bloqueiosModal.open && (
        <div className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[84vh] bg-card border border-border rounded-lg shadow-2xl shadow-black/50 flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <h3 className="text-white text-sm font-bold">DATAS COM BLOQUEIOS</h3>
              <div className="text-[11px] text-secondary truncate">
                Profissional: <span className="text-white">{bloqueiosModal.profissional}</span>
              </div>
              <button
                type="button"
                onClick={() => setBloqueiosModal({ open: false, profissional: '', datas: [] })}
                className="ml-auto text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
              >
                Fechar
              </button>
            </div>
            <div className="p-3 overflow-y-auto">
              <div className="grid grid-cols-12 text-[10px] text-secondary uppercase tracking-wide border-b border-border pb-1 mb-1">
                <div className="col-span-3">Data</div>
                <div className="col-span-2 text-right">Qtd. bloqueios</div>
                <div className="col-span-7 pl-2">Motivo(s)</div>
              </div>
              <div className="space-y-1">
                {bloqueiosModal.datas.length === 0 && (
                  <div className="text-[11px] text-secondary">Sem datas de bloqueio para este profissional.</div>
                )}
                {bloqueiosModal.datas.map((item) => (
                  <div key={`${bloqueiosModal.profissional}-${item.data}`} className="grid grid-cols-12 items-start text-[11px]">
                    <div className="col-span-3 text-white">{item.data}</div>
                    <div className="col-span-2 text-right text-rose-300 font-bold">{formatNumber(item.quantidade)}</div>
                    <div className="col-span-7 pl-2 text-secondary">
                      {item.justificativas.length > 0 ? (
                        item.justificativas.map((j, idx) => (
                          <div key={`${item.data}-${idx}`} className="leading-tight break-words">- {j}</div>
                        ))
                      ) : (
                        <span className="text-white/60">Sem justificativa</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {bloqueiosGlobalModalOpen && (
        <div className="fixed inset-0 z-[65] bg-black/70 backdrop-blur-[1px] flex items-center justify-center p-4">
          <div className="w-full max-w-6xl max-h-[86vh] bg-card border border-border rounded-lg shadow-2xl shadow-black/50 flex flex-col">
            <div className="flex items-center gap-2 p-3 border-b border-border">
              <h3 className="text-white text-sm font-bold">TODOS OS BLOQUEIOS</h3>
              <input
                value={bloqueiosGlobalBusca}
                onChange={(e) => setBloqueiosGlobalBusca(e.target.value)}
                placeholder="Buscar profissional, unidade, especialidade, data ou motivo"
                className="ml-2 flex-1 min-w-0 text-[11px] px-2 py-1 rounded border border-border bg-background text-white placeholder:text-secondary"
              />
              <button
                type="button"
                onClick={() => setBloqueiosGlobalSort((prev) => (prev === 'qtd' ? 'data' : 'qtd'))}
                className="text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
              >
                Ordenar: {bloqueiosGlobalSort === 'qtd' ? 'Qtd.' : 'Data'}
              </button>
              <button
                type="button"
                onClick={() => setBloqueiosGlobalModalOpen(false)}
                className="text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
              >
                Fechar
              </button>
            </div>
            <div className="p-3 overflow-y-auto">
              <div className="grid grid-cols-12 text-[10px] text-secondary uppercase tracking-wide border-b border-border pb-1 mb-1">
                <div className="col-span-2">Profissional</div>
                <div className="col-span-2">Unidade</div>
                <div className="col-span-2">Especialidade</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-1 text-right">Qtd.</div>
                <div className="col-span-3 pl-2">Motivo(s)</div>
              </div>
              <div className="space-y-1">
                {bloqueiosGlobalRows.length === 0 && (
                  <div className="text-[11px] text-secondary">Sem bloqueios para os filtros atuais.</div>
                )}
                {bloqueiosGlobalRows.map((row, idx) => (
                  <div key={`${row.profissional}-${row.data}-${idx}`} className="grid grid-cols-12 items-start text-[11px]">
                    <div className="col-span-2 text-white truncate pr-2" title={row.profissional}>{row.profissional}</div>
                    <div className="col-span-2 text-secondary truncate pr-2" title={row.unidade}>{row.unidade}</div>
                    <div className="col-span-2 text-secondary truncate pr-2" title={row.especialidade}>{row.especialidade}</div>
                    <div className="col-span-2 text-white/90">{row.data}</div>
                    <div className="col-span-1 text-right text-rose-300 font-bold">{formatNumber(row.quantidade)}</div>
                    <div className="col-span-3 pl-2 text-secondary">
                      {row.justificativas.length > 0 ? (
                        row.justificativas.slice(0, 3).map((j, jdx) => (
                          <div key={`${idx}-${jdx}`} className="leading-tight break-words">- {j}</div>
                        ))
                      ) : (
                        <span className="text-white/60">Sem justificativa</span>
                      )}
                      {row.justificativas.length > 3 && (
                        <div className="text-white/60">+{row.justificativas.length - 3} outra(s)</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
