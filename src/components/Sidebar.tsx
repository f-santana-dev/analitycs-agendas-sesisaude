import { Filter } from 'lucide-react';

interface SidebarProps {
  weekRanges: { label: string; start: Date; end: Date }[];
  selectedWeekIndexes: number[];
  onWeekChange: (indexes: number[]) => void;
  units: string[];
  selectedUnits: string[];
  onUnitsChange: (units: string[]) => void;
  categories: string[];
  selectedCategories: string[];
  onCategoriesChange: (categories: string[]) => void;
  specialties: string[];
  selectedSpecialties: string[];
  onSpecialtiesChange: (specialties: string[]) => void;
  professionals: string[];
  selectedProfessionals: string[];
  onProfessionalsChange: (professionals: string[]) => void;
  onClearAll?: () => void;
}

export function Sidebar({
  weekRanges,
  selectedWeekIndexes,
  onWeekChange,
  units, selectedUnits, onUnitsChange,
  categories, selectedCategories, onCategoriesChange,
  specialties, selectedSpecialties, onSpecialtiesChange,
  professionals, selectedProfessionals, onProfessionalsChange,
  onClearAll
}: SidebarProps) {
  const sectionTitleClass = "text-[11px] font-semibold uppercase tracking-[0.08em] text-sky-300/90";

  const toggleSelection = (item: string | number, current: Array<string | number>, onChange: (items: any[]) => void) => {
    if (current.includes(item)) {
      onChange(current.filter((i) => i !== item));
      return;
    }
    onChange([...current, item]);
  };

  const clearAll = () => {
    onWeekChange([]);
    onUnitsChange([]);
    onCategoriesChange([]);
    onSpecialtiesChange([]);
    onProfessionalsChange([]);
    onClearAll?.();
  };

  return (
    <div className="w-56 bg-sidebar border-r border-border h-screen overflow-hidden p-3 flex flex-col gap-3 fixed left-0 top-0 z-20">
      <div className="shrink-0 flex items-center gap-3 text-[#F39C45] pb-2 border-b border-border">
        <div className="p-2 bg-[#F39C45]/10 rounded-lg border border-[#F39C45]/20">
          <img src="/favicon_page.svg" alt="" className="w-6 h-6" />
        </div>
        <div>
          <div className="text-sm font-bold tracking-tight text-white leading-none">Gestao de Agendas</div>
          <div className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Analytics Pro</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-hidden pr-1 flex flex-col">
        <div className="flex items-center gap-2 mb-1">
          <Filter className="w-4 h-4 text-primary" />
          <h2 className="text-base font-bold text-white">Filtros</h2>
          <button
            type="button"
            onClick={clearAll}
            className="ml-auto text-[10px] px-2 py-1 rounded-md border border-border bg-card text-secondary hover:text-white hover:border-primary"
            title="Limpar filtros"
          >
            Limpar
          </button>
        </div>

        <div className="flex flex-col gap-2 border-b border-border pb-2">
          <div className={`flex items-center gap-2 ${sectionTitleClass}`}>
            <span>Periodo de analise</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => onWeekChange([])}
              className={`text-[10px] px-2 py-1 rounded-md border ${selectedWeekIndexes.length === 0 ? 'bg-amber-500 text-black border-amber-500' : 'bg-card text-secondary border-border'}`}
            >
              Todas
            </button>
            {weekRanges.map((w, idx) => (
              <button
                key={w.label}
                type="button"
                onClick={() => {
                  if (selectedWeekIndexes.includes(idx)) {
                    onWeekChange(selectedWeekIndexes.filter((i) => i !== idx));
                    return;
                  }
                  onWeekChange([...selectedWeekIndexes, idx]);
                }}
                className={`text-[9px] leading-tight px-2 py-1 rounded-md border ${selectedWeekIndexes.includes(idx) ? 'bg-amber-500 text-black border-amber-500' : 'bg-card text-secondary border-border'}`}
                title={w.label}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1 mt-3">
          <label className={sectionTitleClass}>Unidade</label>
          <div className="grid grid-cols-1 gap-2">
            {units.map(u => (
              <button
                key={u}
                type="button"
                onClick={() => toggleSelection(u, selectedUnits, onUnitsChange)}
                className={`text-[10px] px-2 py-1 rounded-md border text-left ${selectedUnits.includes(u) ? 'bg-amber-500 text-black border-amber-500' : 'bg-card text-secondary border-border'}`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {selectedUnits.length > 0 && (
          <div className="flex flex-col gap-1 mt-3">
            <label className={sectionTitleClass}>Categoria</label>
            <div className="grid grid-cols-1 gap-2">
              {categories.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    if (selectedCategories.includes(c)) {
                      onCategoriesChange([]);
                      return;
                    }
                    onCategoriesChange([c]);
                  }}
                  className={`text-[10px] px-2 py-1 rounded-md border text-left ${selectedCategories.includes(c) ? 'bg-amber-500 text-black border-amber-500' : 'bg-card text-secondary border-border'}`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCategories.length > 0 && (
          <div className="flex flex-col gap-1 mt-3">
            <label className={sectionTitleClass}>Especialidade</label>
            <div className="grid grid-cols-1 auto-rows-min content-start gap-1 h-[236px] min-h-[236px] overflow-y-auto glass-scrollbar pr-1 pb-1">
              {specialties.length === 0 && (
                <div className="text-[10px] text-secondary px-1 py-1">Carregando especialidades...</div>
              )}
              {specialties.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    if (selectedSpecialties.includes(s)) {
                      onSpecialtiesChange([]);
                      return;
                    }
                    onSpecialtiesChange([s]);
                  }}
                  className={`text-[10px] h-[26px] min-h-[26px] px-2 rounded-md border text-left whitespace-nowrap overflow-hidden text-ellipsis ${selectedSpecialties.includes(s) ? 'bg-amber-500 text-black border-amber-500' : 'bg-card text-secondary border-border'}`}
                  title={s}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {selectedCategories.length > 0 && professionals.length > 0 && (
          <div className="flex flex-col gap-1 mt-3 pb-2">
            <label className={sectionTitleClass}>Profissional</label>
            <div className="grid grid-cols-1 auto-rows-min content-start gap-1 h-[236px] min-h-[236px] overflow-y-auto glass-scrollbar pr-1 pb-1">
              {professionals.map(p => (
                <button
                  key={p}
                  type="button"
                  onClick={() => toggleSelection(p, selectedProfessionals, onProfessionalsChange)}
                  className={`text-[10px] h-[26px] min-h-[26px] px-2 rounded-md border text-left whitespace-nowrap overflow-hidden text-ellipsis ${selectedProfessionals.includes(p) ? 'bg-amber-500 text-black border-amber-500' : 'bg-card text-secondary border-border'}`}
                  title={p}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
