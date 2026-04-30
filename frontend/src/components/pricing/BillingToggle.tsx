import { motion } from "framer-motion";
import type { BillingCycle } from "../../services/api";

interface BillingToggleProps {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  className?: string;
}

/**
 * Switch mensuel / annuel pour la pricing page v2.
 * Badge "-17 % / 2 mois offerts" affiché à côté du choix annuel.
 */
export function BillingToggle({
  value,
  onChange,
  className = "",
}: BillingToggleProps) {
  return (
    <div className={`inline-flex items-center gap-3 ${className}`}>
      <div
        role="group"
        aria-label="Cycle de facturation"
        className="inline-flex items-center rounded-full bg-white/5 border border-white/10 p-1 backdrop-blur-xl"
      >
        <button
          type="button"
          aria-pressed={value === "monthly"}
          onClick={() => onChange("monthly")}
          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            value === "monthly"
              ? "text-white"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          {value === "monthly" && (
            <motion.span
              layoutId="billing-toggle-active"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <span className="relative z-10">Mensuel</span>
        </button>
        <button
          type="button"
          aria-pressed={value === "yearly"}
          onClick={() => onChange("yearly")}
          className={`relative px-5 py-2 rounded-full text-sm font-medium transition-colors ${
            value === "yearly"
              ? "text-white"
              : "text-white/60 hover:text-white/80"
          }`}
        >
          {value === "yearly" && (
            <motion.span
              layoutId="billing-toggle-active"
              className="absolute inset-0 rounded-full bg-gradient-to-r from-indigo-500 to-violet-500"
              transition={{ type: "spring", stiffness: 350, damping: 30 }}
            />
          )}
          <span className="relative z-10">Annuel</span>
        </button>
      </div>
      <span
        aria-label="Réduction annuelle"
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
      >
        -17 % · 2 mois offerts
      </span>
    </div>
  );
}
