import React from "react";
import type { SearchFilters } from "../../services/api";

interface Props {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
}

export const SearchAdvancedFilters: React.FC<Props> = ({
  filters,
  onChange,
}) => {
  return (
    <div className="w-full max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl bg-white/5 border border-white/10 backdrop-blur-xl">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Plateforme</span>
        <select
          value={filters.platform ?? ""}
          onChange={(e) =>
            onChange({
              ...filters,
              platform: (e.target.value ||
                undefined) as SearchFilters["platform"],
            })
          }
          className="bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
        >
          <option value="">Toutes</option>
          <option value="youtube">YouTube</option>
          <option value="tiktok">TikTok</option>
          <option value="text">Texte</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Langue</span>
        <select
          value={filters.lang ?? ""}
          onChange={(e) =>
            onChange({ ...filters, lang: e.target.value || undefined })
          }
          className="bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
        >
          <option value="">Toutes</option>
          <option value="fr">Français</option>
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Catégorie</span>
        <input
          type="text"
          value={filters.category ?? ""}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value || undefined })
          }
          placeholder="ex: science, politique…"
          className="bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
        />
      </label>

      <div className="flex flex-col gap-1 text-sm">
        <span className="text-white/65">Période</span>
        <div className="flex gap-2">
          <input
            type="date"
            value={filters.date_from ?? ""}
            onChange={(e) =>
              onChange({ ...filters, date_from: e.target.value || undefined })
            }
            className="flex-1 bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
          />
          <input
            type="date"
            value={filters.date_to ?? ""}
            onChange={(e) =>
              onChange({ ...filters, date_to: e.target.value || undefined })
            }
            className="flex-1 bg-[#12121a] border border-white/10 rounded-md px-2 py-1.5 text-white"
          />
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={!!filters.favorites_only}
          onChange={(e) =>
            onChange({
              ...filters,
              favorites_only: e.target.checked || undefined,
            })
          }
        />
        <span className="text-white/85">Favoris uniquement</span>
      </label>
    </div>
  );
};
