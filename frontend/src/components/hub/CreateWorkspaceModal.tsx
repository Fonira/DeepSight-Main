/**
 * CreateWorkspaceModal — modal de création d'un Hub Workspace Miro à partir
 * d'une sélection de 2..20 analyses.
 *
 * Sprint Hub Miro Workspace MVP — Wave 2b Agent C.
 * Backend : POST /api/hub/workspaces (PR #335).
 * Store   : useHubWorkspacesStore (PR #337, Wave 2a Agent B).
 *
 * Comportement :
 *   - Champ `name` (max 200 chars, required, non-vide après trim).
 *   - Affiche le compteur "${initialSummaryIds.length} analyses sélectionnées".
 *   - Au submit : appelle store.createWorkspace(payload). Le store push déjà
 *     le workspace en tête de liste sur succès.
 *   - Sur succès : appelle onCreated(workspace.id) puis onClose().
 *   - Sur erreur : message friendly du store + cas spéciaux :
 *       * isQuotaError (429) → message rouge + lien "Voir mes workspaces"
 *         qui ferme le modal et redirige /hub/workspaces.
 *       * isGatingError (403) → message + CTA "Mettre à niveau" → /upgrade
 *         (defense in depth — bouton parent est déjà gated par plan).
 *       * Autre → message générique du store.
 *   - Loading : spinner inline + boutons disabled + click backdrop bloqué.
 *   - A11y : role="dialog", aria-modal, escape pour fermer, focus auto sur input.
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2, AlertCircle, ExternalLink, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useHubWorkspacesStore } from "../../store/useHubWorkspacesStore";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  /** Garanti 2..20 par l'appelant (cap appliqué côté ConversationsDrawer). */
  initialSummaryIds: number[];
  /** Callback optionnel post-création (ex. navigation vers /hub/workspaces/:id). */
  onCreated?: (workspaceId: number) => void;
}

const NAME_MAX_LEN = 200;

export const CreateWorkspaceModal: React.FC<Props> = ({
  isOpen,
  onClose,
  initialSummaryIds,
  onCreated,
}) => {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState("");
  const isCreating = useHubWorkspacesStore((s) => s.isCreating);
  const createError = useHubWorkspacesStore((s) => s.createError);
  const createWorkspace = useHubWorkspacesStore((s) => s.createWorkspace);
  const clearErrors = useHubWorkspacesStore((s) => s.clearErrors);

  // Reset state lorsque le modal se ferme.
  useEffect(() => {
    if (!isOpen) {
      setName("");
      clearErrors();
    }
  }, [isOpen, clearErrors]);

  // Focus auto sur l'input à l'ouverture.
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Escape pour fermer (mais pas pendant le loading).
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isCreating) {
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, isCreating, onClose]);

  const handleSubmit = useCallback(
    async (e?: React.FormEvent) => {
      e?.preventDefault();
      const trimmed = name.trim();
      if (!trimmed || isCreating) return;
      try {
        const ws = await createWorkspace({
          name: trimmed,
          summary_ids: initialSummaryIds,
        });
        // Wave 2c — preserve onCreated callback for parent cleanup (e.g. exit
        // select mode dans ConversationsDrawer), puis navigate vers le détail
        // AVANT onClose() pour que la redirection se déclenche même si le parent
        // démonte le modal sur close.
        onCreated?.(ws.id);
        navigate(`/hub/workspaces/${ws.id}`);
        onClose();
      } catch {
        // L'erreur est déjà capturée dans le store (createError).
        // On ne ferme PAS le modal : l'utilisateur voit le message friendly.
      }
    },
    [
      name,
      isCreating,
      createWorkspace,
      initialSummaryIds,
      onCreated,
      onClose,
      navigate,
    ],
  );

  const handleQuotaRedirect = useCallback(() => {
    onClose();
    navigate("/hub/workspaces");
  }, [onClose, navigate]);

  const handleUpgradeRedirect = useCallback(() => {
    onClose();
    navigate("/upgrade");
  }, [onClose, navigate]);

  if (!isOpen) return null;

  const trimmedName = name.trim();
  const submitDisabled = isCreating || trimmedName.length === 0;
  const count = initialSummaryIds.length;

  return (
    <AnimatePresence>
      <motion.div
        key="create-workspace-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-50"
        onClick={isCreating ? undefined : onClose}
      />
      <motion.div
        key="create-workspace-modal"
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[min(540px,90vw)] bg-[#0c0c14] border border-white/10 rounded-2xl shadow-[0_24px_64px_rgba(0,0,0,.6)]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
      >
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <h2
                id="create-workspace-title"
                className="text-sm font-medium text-white"
              >
                Créer un workspace Hub
              </h2>
            </div>
            <button
              type="button"
              aria-label="Fermer"
              onClick={onClose}
              disabled={isCreating}
              className="w-7 h-7 grid place-items-center rounded-lg hover:bg-white/[0.06] text-white/55 disabled:opacity-30"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="px-5 py-4 flex flex-col gap-3">
            <p className="text-[13px] text-white/60 leading-relaxed">
              Donnez un nom à votre workspace. Un board Miro sera généré
              automatiquement à partir des analyses sélectionnées.
            </p>

            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/25">
              <span className="text-[12px] text-indigo-200 font-mono">
                {count}{" "}
                {count > 1 ? "analyses sélectionnées" : "analyse sélectionnée"}
              </span>
            </div>

            <div className="flex flex-col gap-1">
              <label
                htmlFor="workspace-name"
                className="text-[11px] text-white/50 font-medium uppercase tracking-wider"
              >
                Nom du workspace
              </label>
              <input
                ref={inputRef}
                id="workspace-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={isCreating}
                maxLength={NAME_MAX_LEN}
                placeholder="Ex. Conscience & cognition — avril 2026"
                className="w-full bg-white/[0.04] border border-white/10 rounded-lg px-3 py-2.5 text-[13px] text-white placeholder-white/30 outline-none focus:border-indigo-500/40 disabled:opacity-50"
              />
              <p className="text-[10px] text-white/35 px-1">
                {name.length}/{NAME_MAX_LEN}
              </p>
            </div>

            {createError && (
              <div className="flex flex-col gap-2 px-3 py-2.5 rounded-lg bg-red-500/10 border border-red-500/25">
                <div className="flex items-start gap-2 text-[12px] text-red-300">
                  <AlertCircle className="w-3.5 h-3.5 mt-px flex-shrink-0" />
                  <span>{createError.message}</span>
                </div>
                {createError.isQuotaError && (
                  <button
                    type="button"
                    onClick={handleQuotaRedirect}
                    className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-[11px] text-red-200 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Voir mes workspaces
                  </button>
                )}
                {createError.isGatingError && (
                  <button
                    type="button"
                    onClick={handleUpgradeRedirect}
                    className="self-start flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/30 text-[11px] text-amber-200 transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    Passer au plan Expert
                  </button>
                )}
              </div>
            )}

            {isCreating && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-300" />
                <span className="text-[12px] text-indigo-200">
                  Création du workspace…
                </span>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-white/10 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isCreating}
              className="px-3.5 py-1.5 rounded-lg text-[13px] text-white/65 hover:bg-white/[0.04] disabled:opacity-30"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={submitDisabled}
              className="px-4 py-1.5 rounded-lg bg-indigo-500 text-white text-[13px] font-medium hover:bg-indigo-400 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {isCreating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Création…
                </>
              ) : (
                "Créer"
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </AnimatePresence>
  );
};
