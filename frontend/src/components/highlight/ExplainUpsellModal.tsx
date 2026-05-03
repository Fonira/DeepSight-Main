import React from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, X } from "lucide-react";

interface Props {
  open: boolean;
  passageText: string;
  onClose: () => void;
}

export const ExplainUpsellModal: React.FC<Props> = ({
  open,
  passageText,
  onClose,
}) => {
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="explain-upsell-title"
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-[#12121a] border border-white/10 shadow-2xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-3">
          <h2
            id="explain-upsell-title"
            className="text-base font-semibold text-white flex items-center gap-2"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            Comprendre ce passage avec l'IA
          </h2>
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="p-1 rounded-md hover:bg-white/5"
          >
            <X className="w-4 h-4 text-white/55" />
          </button>
        </div>
        <p className="text-sm text-white/65 mb-3">
          Le tooltip IA est inclus avec Pro et Expert.
        </p>
        <p className="text-sm text-white/85 italic mb-4 line-clamp-3">
          « {passageText} »
        </p>
        <button
          type="button"
          onClick={() => navigate("/upgrade")}
          className="w-full px-4 py-2.5 rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 text-white font-medium hover:opacity-95"
        >
          Essai gratuit 7 jours →
        </button>
      </div>
    </div>
  );
};
