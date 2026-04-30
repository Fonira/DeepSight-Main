import { Check, X } from "lucide-react";
import {
  PLAN_LIMITS,
  PLANS_INFO,
  PLAN_HIERARCHY,
  type PlanId,
} from "../../config/planPrivileges";
import type { BillingCycle } from "../../services/api";

interface ComparisonTableProps {
  cycle: BillingCycle;
  className?: string;
}

interface FeatureRow {
  label: string;
  values: Record<PlanId, string | boolean | number>;
}

function formatPriceCents(cents: number): string {
  if (cents === 0) return "0 €";
  const euros = cents / 100;
  return `${euros.toFixed(2).replace(".", ",")} €`;
}

function buildRows(): FeatureRow[] {
  return [
    {
      label: "Analyses / mois",
      values: {
        free: PLAN_LIMITS.free.monthlyAnalyses,
        pro: PLAN_LIMITS.pro.monthlyAnalyses,
        expert: PLAN_LIMITS.expert.monthlyAnalyses,
      },
    },
    {
      label: "Durée vidéo max",
      values: {
        free: `${PLAN_LIMITS.free.maxVideoLengthMin} min`,
        pro: `${PLAN_LIMITS.pro.maxVideoLengthMin} min`,
        expert: `${PLAN_LIMITS.expert.maxVideoLengthMin} min`,
      },
    },
    {
      label: "Chat / vidéo",
      values: {
        free: PLAN_LIMITS.free.chatQuestionsPerVideo,
        pro: PLAN_LIMITS.pro.chatQuestionsPerVideo,
        expert:
          PLAN_LIMITS.expert.chatQuestionsPerVideo === -1
            ? "Illimité"
            : PLAN_LIMITS.expert.chatQuestionsPerVideo,
      },
    },
    {
      label: "Mind maps",
      values: {
        free: PLAN_LIMITS.free.mindmapEnabled,
        pro: PLAN_LIMITS.pro.mindmapEnabled,
        expert: PLAN_LIMITS.expert.mindmapEnabled,
      },
    },
    {
      label: "Recherche web IA",
      values: {
        free: false,
        pro: `${PLAN_LIMITS.pro.webSearchMonthly}/mois`,
        expert: `${PLAN_LIMITS.expert.webSearchMonthly}/mois`,
      },
    },
    {
      label: "Playlists",
      values: {
        free: false,
        pro: false,
        expert: `${PLAN_LIMITS.expert.maxPlaylists} max`,
      },
    },
    {
      label: "Export PDF + Markdown",
      values: {
        free: false,
        pro: PLAN_LIMITS.pro.exportPdf,
        expert: PLAN_LIMITS.expert.exportPdf,
      },
    },
    {
      label: "Chat vocal ElevenLabs",
      values: {
        free: false,
        pro: `${PLAN_LIMITS.pro.voiceChatMonthlyMinutes} min/mois`,
        expert: `${PLAN_LIMITS.expert.voiceChatMonthlyMinutes} min/mois`,
      },
    },
    {
      label: "Deep Research",
      values: {
        free: false,
        pro: false,
        expert: PLAN_LIMITS.expert.deepResearchEnabled,
      },
    },
    {
      label: "File prioritaire",
      values: {
        free: false,
        pro: false,
        expert: PLAN_LIMITS.expert.priorityQueue,
      },
    },
  ];
}

function renderCell(value: string | boolean | number) {
  if (value === true)
    return <Check className="w-5 h-5 text-emerald-400 mx-auto" />;
  if (value === false) return <X className="w-5 h-5 text-white/30 mx-auto" />;
  return <span className="text-white">{value}</span>;
}

export function ComparisonTable({
  cycle,
  className = "",
}: ComparisonTableProps) {
  const rows = buildRows();
  return (
    <div
      className={`overflow-x-auto rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl ${className}`}
    >
      <table className="w-full text-left">
        <thead>
          <tr className="border-b border-white/10">
            <th
              scope="col"
              className="px-5 py-4 text-sm font-semibold text-white/60"
            >
              Fonctionnalité
            </th>
            {PLAN_HIERARCHY.map((plan) => {
              const info = PLANS_INFO[plan];
              const price =
                cycle === "monthly" ? info.priceMonthly : info.priceYearly;
              return (
                <th key={plan} scope="col" className="px-5 py-4 text-center">
                  <div className="flex flex-col items-center gap-1">
                    <span className="text-base font-bold text-white">
                      {info.name}
                    </span>
                    {info.popular && (
                      <span className="inline-block px-2 py-0.5 text-[10px] uppercase tracking-wide rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/30">
                        Populaire
                      </span>
                    )}
                    <span className="text-2xl font-extrabold text-white">
                      {formatPriceCents(price)}
                    </span>
                    <span className="text-xs text-white/50">
                      /{cycle === "monthly" ? "mois" : "an"}
                    </span>
                  </div>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.label}
              className="border-b border-white/5 last:border-b-0"
            >
              <td className="px-5 py-3 text-sm text-white/80">{row.label}</td>
              {PLAN_HIERARCHY.map((plan) => (
                <td key={plan} className="px-5 py-3 text-center text-sm">
                  {renderCell(row.values[plan])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
