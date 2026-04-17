/**
 * ShareButton — Facade module.
 *
 * Re-exports the canonical modal-based ShareButton from `./analysis/ShareButton`.
 * Do NOT add logic here — edit `components/analysis/ShareButton.tsx` instead.
 *
 * Historical note: a simpler Web Share API / clipboard variant used to live here,
 * but it had zero importers in the codebase. Consolidated on the richer modal
 * component to avoid API drift between duplicate ShareButton implementations.
 */

export { ShareButton } from "./analysis/ShareButton";
