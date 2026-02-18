import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ComposedChart, Line, LabelList, ReferenceLine } from 'recharts';
import { Download } from 'lucide-react';

const formatNumber = (val: number) =>
  Number(val || 0).toLocaleString('pt-BR');

const ExportButton = ({ onClick }: { onClick?: () => void }) => {
  if (!onClick) return null;
  return (
    <button
      type="button"
      onClick={onClick}
      title="Exportar Excel"
      className="ml-auto text-secondary hover:text-white transition-colors"
    >
      <Download className="w-3.5 h-3.5" />
    </button>
  );
};

const StandardTooltip = ({
  active,
  payload,
  label,
  total,
  showTotal = true,
}: {
  active?: boolean;
  payload?: readonly any[];
  label?: string | number;
  total: number;
  showTotal?: boolean;
}) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    const value = Number(data.value || 0);
    const percentage = total > 0 ? ((value / total) * 100).toFixed(1) : '0.0';
    return (
      <div className="bg-card border border-border p-2 rounded shadow-xl text-white text-xs z-50">
        <p className="font-bold mb-1" style={{ color: data.payload?.fill || data.color || '#7CFFB2' }}>
          {label !== undefined ? String(label) : String(data.name)}
        </p>
        <div className="flex flex-col gap-0.5">
          <p>Quantidade: <span className="font-mono font-bold">{formatNumber(value)}</span></p>
          <p className="text-[10px] text-gray-400">Isso representa {percentage}% do total.</p>
          {showTotal && (
            <>
              <hr className="border-border my-1" />
              <p className="text-gray-400">Total: <span className="font-mono">{formatNumber(total)}</span></p>
            </>
          )}
        </div>
      </div>
    );
  }
  return null;
};

// --- Monthly Chart ---
interface MonthlyChartProps {
  data: { name: string; value: number }[];
  onExport?: () => void;
}

export function MonthlyRealizedChart({ data, onExport }: MonthlyChartProps) {
  const total = data.reduce((acc, cur) => acc + (cur.value || 0), 0);
  return (
    <div className="bg-card border border-border rounded-lg p-2 h-full flex flex-col shadow-xl shadow-black/20 fade-slide">
      <h3 className="text-white text-xs font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-3 bg-primary rounded-full"></span>
        AGENDADOS POR MES
        <span className="tooltip text-[10px] text-secondary border border-border rounded-full w-4 h-4 inline-flex items-center justify-center" data-tooltip="Valores representam a quantidade de horarios agendados por mes.">i</span>
        <ExportButton onClick={onExport} />
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 14, right: 10, left: 10, bottom: 0 }}>
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#a0a0a0', fontSize: 10 }} 
              tickLine={false} 
              axisLine={false}
              interval={0}
            />
            <YAxis hide domain={[0, (dataMax: number) => Math.ceil(dataMax * 1.15)]} />
            <Tooltip
              content={({ active, payload, label }) => (
                <StandardTooltip active={active} payload={payload} label={label} total={total} showTotal />
              )}
              cursor={{ fill: '#2d303e', opacity: 0.4 }}
            />
            <Bar dataKey="value" fill="#2b7fff" radius={[2, 2, 0, 0]} label={{ position: 'top', fill: '#fff', fontSize: 9, formatter: (v: any) => formatNumber(Number(v)) }} />
            <Line 
              type="monotone" 
              dataKey="value" 
              stroke="#ffa15a" 
              strokeWidth={2} 
              dot={{ r: 3, fill: '#ffa15a', strokeWidth: 0 }} 
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Daily Chart ---
interface DailyChartProps {
  data: { dateKey: string; label: string; realizados: number; ausentes: number; livres: number; bloqueados: number; justificativasBloqueio?: string[] }[];
  onDayClick?: (dateKey: string) => void;
  onExport?: () => void;
}

export function DailyRealizedChart({ data, onDayClick, onExport }: DailyChartProps) {
  const seriesColors = {
    realizados: '#3b82f6',
    ausentes: '#f59e0b',
    livres: '#22c55e',
    bloqueados: '#ef4444',
  };
  const renderStackLabel = (color: string) => (props: any) => {
    const value = Number(props?.value || 0);
    const x = Number(props?.x || 0);
    const y = Number(props?.y || 0);
    const width = Number(props?.width || 0);
    const height = Number(props?.height || 0);
    if (!value || height < 14 || width < 26) return null;
    const text = formatNumber(value);
    const cx = x + width / 2;
    const cy = y + height / 2;
    return (
      <g>
        <text
          x={cx}
          y={cy + 3}
          textAnchor="middle"
          fill="#ffffff"
          fontSize={9}
          fontWeight={700}
          stroke="rgba(10, 14, 24, 0.55)"
          strokeWidth={1.75}
          paintOrder="stroke"
        >
          {text}
        </text>
      </g>
    );
  };
  const enrichedData = data.map((d) => ({
    ...d,
    totalDia: Number(d.realizados || 0) + Number(d.ausentes || 0) + Number(d.livres || 0) + Number(d.bloqueados || 0),
  }));
  const averageRealizados = enrichedData.length > 0
    ? enrichedData.reduce((acc, cur) => acc + Number(cur.realizados || 0), 0) / enrichedData.length
    : 0;
  const peakDay = enrichedData.reduce<{ label: string; realizados: number } | null>((best, cur) => {
    const realizados = Number(cur.realizados || 0);
    if (!best || realizados > best.realizados) return { label: cur.label, realizados };
    return best;
  }, null);

  return (
    <div className="bg-card border border-border rounded-lg p-1.5 h-full flex flex-col shadow-xl shadow-black/20 fade-slide">
      <h3 className="text-white text-xs font-bold mb-0.5 flex items-center gap-2">
        <span className="w-1 h-3 bg-primary rounded-full"></span>
        OCUPACAO DIARIA DA AGENDA
        <span className="tooltip text-[10px] text-secondary border border-border rounded-full w-4 h-4 inline-flex items-center justify-center" data-tooltip="Mesmo indicador de ocupacao da agenda, detalhado por data.">i</span>
        <ExportButton onClick={onExport} />
      </h3>
      <div className="mb-0.5 flex items-center justify-between gap-2 text-[10px] text-secondary">
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: seriesColors.realizados }}></span>Realizados</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: seriesColors.ausentes }}></span>Ausentes</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: seriesColors.livres }}></span>Livres</span>
          <span className="inline-flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: seriesColors.bloqueados }}></span>Bloqueados</span>
        </div>
        {data.length > 1 && peakDay && (
          <div className="text-[9px] text-secondary whitespace-nowrap">
            Media: <span className="text-cyan-300 font-semibold">{formatNumber(Math.round(averageRealizados))}</span>
            {' '}| Pico: <span className="text-amber-300 font-semibold">{peakDay.label}</span>{' '}
            <span className="text-white/80">({formatNumber(peakDay.realizados)})</span>
          </div>
        )}
      </div>
      <div className="flex-1 min-h-0">
        {data.length === 1 ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={[
                { name: 'Realizados', value: Number(data[0]?.realizados || 0), fill: seriesColors.realizados, dateKey: data[0]?.dateKey, justificativasBloqueio: data[0]?.justificativasBloqueio || [] },
                { name: 'Ausentes', value: Number(data[0]?.ausentes || 0), fill: seriesColors.ausentes, dateKey: data[0]?.dateKey, justificativasBloqueio: data[0]?.justificativasBloqueio || [] },
                { name: 'Livres', value: Number(data[0]?.livres || 0), fill: seriesColors.livres, dateKey: data[0]?.dateKey, justificativasBloqueio: data[0]?.justificativasBloqueio || [] },
                { name: 'Bloqueados', value: Number(data[0]?.bloqueados || 0), fill: seriesColors.bloqueados, dateKey: data[0]?.dateKey, justificativasBloqueio: data[0]?.justificativasBloqueio || [] },
              ]}
              layout="vertical"
              margin={{ top: 8, right: 22, left: 8, bottom: 8 }}
            >
              <XAxis type="number" hide />
              <YAxis
                dataKey="name"
                type="category"
                width={78}
                tick={{ fill: '#e0e0e0', fontSize: 10 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || !payload.length) return null;
                  const p = payload[0] as any;
                  return (
                    <div className="bg-card border border-border p-2 rounded shadow-xl text-white text-xs z-50">
                      <p className="font-bold mb-1">{`Data ${data[0]?.label || ''}`}</p>
                      <p style={{ color: p?.payload?.fill || '#fff' }}>
                        {p?.payload?.name}: <span className="font-mono font-bold">{formatNumber(Number(p?.value || 0))}</span>
                      </p>
                      {String(p?.payload?.name || '').toUpperCase() === 'BLOQUEADOS' && Array.isArray(p?.payload?.justificativasBloqueio) && p.payload.justificativasBloqueio.length > 0 && (
                        <div className="mt-1 border-t border-border pt-1 max-w-[340px]">
                          <p className="text-rose-300 font-semibold mb-0.5">Justificativa(s):</p>
                          {p.payload.justificativasBloqueio.slice(0, 3).map((j: string, idx: number) => (
                            <p key={`${j}-${idx}`} className="text-[10px] text-secondary leading-tight break-words">- {j}</p>
                          ))}
                          {p.payload.justificativasBloqueio.length > 3 && (
                            <p className="text-[10px] text-secondary">+{p.payload.justificativasBloqueio.length - 3} outra(s)</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                }}
                cursor={{ fill: '#2d303e', opacity: 0.4 }}
              />
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                onClick={(e: any) => {
                  const dateKey = e?.payload?.dateKey;
                  if (onDayClick && dateKey) onDayClick(String(dateKey));
                }}
                label={{ position: 'right', fill: '#fff', fontSize: 10, formatter: (v: any) => formatNumber(Number(v)) }}
              >
                {[0, 1, 2, 3].map((idx) => (
                  <Cell
                    key={`daily-single-${idx}`}
                    fill={[seriesColors.realizados, seriesColors.ausentes, seriesColors.livres, seriesColors.bloqueados][idx]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={enrichedData} margin={{ top: 14, right: 10, left: 10, bottom: 0 }}>
            <XAxis 
              dataKey="label"
              tick={{ fill: '#a0a0a0', fontSize: 10 }} 
              tickLine={false} 
              axisLine={false}
            />
            <YAxis hide />
            <ReferenceLine
              y={averageRealizados}
              stroke="#22d3ee"
              strokeDasharray="4 4"
              strokeOpacity={0.9}
              label={{ value: 'Media Realizados', position: 'insideTopRight', fill: '#22d3ee', fontSize: 9 }}
            />
            {peakDay && (
              <ReferenceLine
                x={peakDay.label}
                stroke="#f59e0b"
                strokeOpacity={0.95}
                label={{ value: 'Pico', position: 'top', fill: '#f59e0b', fontSize: 9 }}
              />
            )}
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const row = payload[0]?.payload as any;
                const realizados = Number(row?.realizados || 0);
                const ausentes = Number(row?.ausentes || 0);
                const livres = Number(row?.livres || 0);
                const bloqueados = Number(row?.bloqueados || 0);
                const totalDia = realizados + ausentes + livres + bloqueados;
                const justificativas = Array.isArray(row?.justificativasBloqueio) ? row.justificativasBloqueio as string[] : [];
                return (
                  <div className="bg-card border border-border p-2 rounded shadow-xl text-white text-xs z-50">
                    <p className="font-bold mb-1">{`Data ${label}`}</p>
                    <div className="flex flex-col gap-0.5">
                      <p style={{ color: seriesColors.realizados }}>Realizados: <span className="font-mono font-bold">{formatNumber(realizados)}</span></p>
                      <p style={{ color: seriesColors.ausentes }}>Ausentes: <span className="font-mono font-bold">{formatNumber(ausentes)}</span></p>
                      <p style={{ color: seriesColors.livres }}>Livres: <span className="font-mono font-bold">{formatNumber(livres)}</span></p>
                      <p style={{ color: seriesColors.bloqueados }}>Bloqueados: <span className="font-mono font-bold">{formatNumber(bloqueados)}</span></p>
                      <hr className="border-border my-1" />
                      <p className="text-gray-300">Total dia: <span className="font-mono font-bold">{formatNumber(totalDia)}</span></p>
                      {bloqueados > 0 && justificativas.length > 0 && (
                        <>
                          <hr className="border-border my-1" />
                          <p className="text-rose-300 font-semibold">Justificativa(s) do bloqueio:</p>
                          {justificativas.slice(0, 4).map((j, idx) => (
                            <p key={`${j}-${idx}`} className="text-[10px] text-secondary leading-tight break-words">- {j}</p>
                          ))}
                          {justificativas.length > 4 && (
                            <p className="text-[10px] text-secondary">+{justificativas.length - 4} outra(s)</p>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              }}
              cursor={{ fill: '#2d303e', opacity: 0.4 }}
            />
            <Bar
              dataKey="realizados"
              fill={seriesColors.realizados}
              stackId="a"
              radius={[2, 2, 0, 0]}
              onClick={(e: any) => {
                const dateKey = e?.payload?.dateKey;
                if (onDayClick && dateKey) {
                  onDayClick(String(dateKey));
                }
              }}
            >
              <LabelList dataKey="realizados" content={renderStackLabel(seriesColors.realizados)} />
            </Bar>
            <Bar dataKey="ausentes" stackId="a" fill={seriesColors.ausentes} onClick={(e: any) => {
              const dateKey = e?.payload?.dateKey;
              if (onDayClick && dateKey) onDayClick(String(dateKey));
            }}>
              <LabelList dataKey="ausentes" content={renderStackLabel(seriesColors.ausentes)} />
            </Bar>
            <Bar dataKey="livres" stackId="a" fill={seriesColors.livres} onClick={(e: any) => {
              const dateKey = e?.payload?.dateKey;
              if (onDayClick && dateKey) onDayClick(String(dateKey));
            }}>
              <LabelList dataKey="livres" content={renderStackLabel(seriesColors.livres)} />
            </Bar>
            <Bar dataKey="bloqueados" stackId="a" fill={seriesColors.bloqueados} onClick={(e: any) => {
              const dateKey = e?.payload?.dateKey;
              if (onDayClick && dateKey) onDayClick(String(dateKey));
            }}>
              <LabelList dataKey="bloqueados" content={renderStackLabel(seriesColors.bloqueados)} />
            </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// --- Category Chart (Horizontal Bar) ---
interface CategoryChartProps {
  data: { name: string; quantidade: number }[];
  onBarClick?: (name: string) => void;
  onExport?: () => void;
}

export function CategoryChart({ data, onBarClick, onExport }: CategoryChartProps) {
  const total = data.reduce((acc, cur) => acc + (cur.quantidade || 0), 0);
  return (
    <div className="bg-card border border-border rounded-lg p-2 h-full flex flex-col shadow-xl shadow-black/20 fade-slide">
      <h3 className="text-white text-xs font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-3 bg-primary rounded-full"></span>
        POR ESPECIALIDADE
        <span className="tooltip tooltip-right text-[10px] text-secondary border border-border rounded-full w-4 h-4 inline-flex items-center justify-center" data-tooltip="Valores representam a quantidade de horarios por especialidade.">i</span>
        <ExportButton onClick={onExport} />
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 40, left: 0, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={90}
              tick={{ fill: '#a0a0a0', fontSize: 10 }}
              tickLine={false}
              axisLine={{ stroke: '#2d303e' }}
              interval={0}
            />
            <Tooltip cursor={{ fill: '#2d303e', opacity: 0.4 }} content={({ active, payload, label }) => (
              <StandardTooltip active={active} payload={payload} label={label} total={total} showTotal />
            )} />
            <Bar
              dataKey="quantidade"
              fill="#2b7fff"
              radius={[0, 4, 4, 0]}
              barSize={18}
              label={{ position: 'right', fill: '#fff', fontSize: 9, formatter: (v: any) => formatNumber(Number(v)) }}
              onClick={(e: any) => {
                const name = e?.payload?.name;
                if (name && onBarClick) onBarClick(name);
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Type Bar Chart (Generic Horizontal) ---
interface TypeBarChartProps {
  title: string;
  data: { name: string; quantidade: number }[];
  colors: string[];
  onBarClick?: (name: string) => void;
  tooltipText?: string;
  onExport?: () => void;
}

export function TypeBarChart({ title, data, colors, onBarClick, tooltipText, onExport }: TypeBarChartProps) {
  const total = data.reduce((acc, cur) => acc + (cur.quantidade || 0), 0);
  const isOcupacaoChart = title.toUpperCase().includes('OCUPACAO DA AGENDA');
  const ocupacaoColors = {
    realizado: '#3b82f6',
    ausente: '#f59e0b',
    livre: '#22c55e',
    bloqueado: '#ef4444',
  };
  const getColor = (name: string, index: number) => {
    const normalized = name.toLowerCase();
    if (isOcupacaoChart) {
      if (normalized.includes('realiz')) return ocupacaoColors.realizado;
      if (normalized.includes('ausent')) return ocupacaoColors.ausente;
      if (normalized.includes('livre')) return ocupacaoColors.livre;
      if (normalized.includes('bloque')) return ocupacaoColors.bloqueado;
    }
    if (normalized.includes('bloque')) return ocupacaoColors.bloqueado;
    return colors[index % colors.length];
  };
  return (
    <div className="bg-card border border-border rounded-lg p-2 h-full flex flex-col shadow-xl shadow-black/20 fade-slide">
      <h3 className="text-white text-xs font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-3 bg-orange-500 rounded-full"></span>
        {title}
        <span className="tooltip text-[10px] text-secondary border border-border rounded-full w-4 h-4 inline-flex items-center justify-center" data-tooltip={tooltipText || "Valores representam a quantidade de horarios."}>i</span>
        <ExportButton onClick={onExport} />
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
            <XAxis type="number" hide />
            <YAxis
              dataKey="name"
              type="category"
              width={90}
              tick={{ fill: '#e0e0e0', fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip cursor={{ fill: '#2d303e', opacity: 0.4 }} content={({ active, payload, label }) => (
              <StandardTooltip active={active} payload={payload} label={label} total={total} showTotal />
            )} />
            <Bar
              dataKey="quantidade"
              fill={colors[0]}
              radius={[0, 4, 4, 0]}
              barSize={20}
              label={{ position: 'right', fill: '#fff', fontSize: 9, formatter: (v: any) => formatNumber(Number(v)) }}
              onClick={(e: any) => {
                const name = e?.payload?.name;
                if (name && onBarClick) onBarClick(name);
              }}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getColor(String(entry.name || ''), index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// --- Weekly Range Chart (Stacked Bars) ---
interface WeeklyRangeChartProps {
  data: { label: string; agendados: number; livres: number; bloqueados: number; total: number }[];
}

interface DailyAproveitamentoChartProps {
  data: { label: string; pct: number }[];
}

export function DailyAproveitamentoChart({ data }: DailyAproveitamentoChartProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-2 h-full flex flex-col shadow-xl shadow-black/20 fade-slide">
      <h3 className="text-white text-xs font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-3 bg-cyan-400 rounded-full"></span>
        APROVEITAMENTO DIARIO
        <span className="tooltip text-[10px] text-secondary border border-border rounded-full w-4 h-4 inline-flex items-center justify-center" data-tooltip="Percentual diario: realizados dividido pela capacidade do dia.">i</span>
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 8, left: 8, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: '#a0a0a0', fontSize: 9 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis hide domain={[0, 100]} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const pct = Number(payload[0]?.value || 0);
                return (
                  <div className="bg-card border border-border p-2 rounded shadow-xl text-white text-xs z-50">
                    <p className="font-bold mb-1">{`Data ${label}`}</p>
                    <p className="text-cyan-300">
                      Aproveitamento: <span className="font-mono font-bold">{pct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
                    </p>
                  </div>
                );
              }}
              cursor={{ fill: '#2d303e', opacity: 0.4 }}
            />
            <Bar
              dataKey="pct"
              fill="#22d3ee"
              radius={[2, 2, 0, 0]}
              label={{
                position: 'top',
                fill: '#fff',
                fontSize: 9,
                formatter: (v: any) => `${Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function WeeklyRangeChart({ data }: WeeklyRangeChartProps) {
  return (
    <div className="bg-card border border-border rounded-lg p-2 h-full flex flex-col shadow-xl shadow-black/20 fade-slide">
      <h3 className="text-white text-xs font-bold mb-1 flex items-center gap-2">
        <span className="w-1 h-3 bg-primary rounded-full"></span>
        LINHA DO TEMPO (5 SEMANAS)
        <span className="tooltip text-[10px] text-secondary border border-border rounded-full w-4 h-4 inline-flex items-center justify-center" data-tooltip="Semanas seg-sab, excluindo domingo.">i</span>
      </h3>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 12, right: 10, left: 10, bottom: 0 }}>
            <XAxis
              dataKey="label"
              tick={{ fill: '#a0a0a0', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis hide />
            <Tooltip
              cursor={{ fill: '#2d303e', opacity: 0.4 }}
              content={({ active, payload, label }) => {
                if (!active || !payload || !payload.length) return null;
                const row = payload[0]?.payload as any;
                const total = Number(row?.total || 0);
                const ag = Number(row?.agendados || 0);
                const li = Number(row?.livres || 0);
                const bl = Number(row?.bloqueados || 0);
                return (
                  <div className="bg-card border border-border p-2 rounded shadow-xl text-white text-xs z-50">
                    <p className="font-bold mb-1">{label}</p>
                    <div className="flex flex-col gap-0.5">
                      <p>Agendados: <span className="font-mono font-bold">{formatNumber(ag)}</span></p>
                      <p>Livres: <span className="font-mono font-bold">{formatNumber(li)}</span></p>
                      <p>Bloqueados: <span className="font-mono font-bold">{formatNumber(bl)}</span></p>
                      <hr className="border-border my-1" />
                      <p className="text-gray-400">Total: <span className="font-mono">{formatNumber(total)}</span></p>
                    </div>
                  </div>
                );
              }}
            />
            <Bar dataKey="agendados" stackId="a" fill="#2b7fff" radius={[2, 2, 0, 0]} />
            <Bar dataKey="livres" stackId="a" fill="#00cc96" />
            <Bar dataKey="bloqueados" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
