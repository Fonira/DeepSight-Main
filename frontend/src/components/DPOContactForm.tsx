import React, { useState, useId } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { request } from "../services/api";

const RGPD_SUBJECTS = [
  { value: "art_15_access", label: "Art. 15 — Droit d'accès" },
  { value: "art_16_rectification", label: "Art. 16 — Droit de rectification" },
  { value: "art_17_erasure", label: "Art. 17 — Droit à l'effacement" },
  { value: "art_18_restriction", label: "Art. 18 — Limitation du traitement" },
  { value: "art_20_portability", label: "Art. 20 — Portabilité des données" },
  { value: "art_21_objection", label: "Art. 21 — Droit d'opposition" },
  { value: "other", label: "Autre demande compliance / DPO" },
] as const;

type Subject = (typeof RGPD_SUBJECTS)[number]["value"];

interface DPOContactFormProps {
  onSuccess?: () => void;
}

interface FormState {
  email: string;
  subject: Subject | "";
  message: string;
  website: string;
}

interface FieldErrors {
  email?: string;
  subject?: string;
  message?: string;
}

type SubmitStatus = "idle" | "submitting" | "success" | "error";

const MESSAGE_MAX = 5000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const DPOContactForm: React.FC<DPOContactFormProps> = ({ onSuccess }) => {
  const formId = useId();
  const [form, setForm] = useState<FormState>({
    email: "",
    subject: "",
    message: "",
    website: "",
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!form.email.trim()) next.email = "Email requis";
    else if (!EMAIL_RE.test(form.email.trim())) next.email = "Format email invalide";
    if (!form.subject) next.subject = "Sélectionnez un objet";
    if (!form.message.trim()) next.message = "Message requis";
    else if (form.message.length > MESSAGE_MAX) next.message = `Maximum ${MESSAGE_MAX} caractères`;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (status === "submitting") return;
    if (!validate()) return;

    setStatus("submitting");
    setErrorMsg("");

    try {
      await request<{ success: boolean; message: string }>("/api/contact/dpo", {
        method: "POST",
        body: {
          email: form.email.trim(),
          subject: form.subject,
          message: form.message.trim(),
          website: form.website,
        },
        skipAuth: true,
      });
      setStatus("success");
      setForm({ email: "", subject: "", message: "", website: "" });
      onSuccess?.();
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error ? err.message : "Erreur réseau inconnue";
      if (message.includes("429") || message.toLowerCase().includes("rate")) {
        setErrorMsg("Trop de demandes. Veuillez réessayer dans 10 minutes.");
      } else {
        setErrorMsg("Une erreur est survenue. Réessayez ou écrivez à dpo@deepsightsynthesis.com.");
      }
    }
  };

  if (status === "success") {
    return (
      <motion.div
        role="status"
        aria-live="polite"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 backdrop-blur-xl"
      >
        <div className="flex gap-3">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-emerald-300 font-semibold mb-1">Demande reçue</h3>
            <p className="text-sm text-emerald-100/80">
              Réponse sous 30 jours max (RGPD Art. 12.3). Un accusé de réception vous sera envoyé sous 72 h.
            </p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-3 text-xs text-emerald-300 hover:text-emerald-200 underline"
            >
              Envoyer une nouvelle demande
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      aria-labelledby={`${formId}-title`}
      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-6 space-y-5"
    >
      <div>
        <h3 id={`${formId}-title`} className="text-lg font-semibold text-white mb-1">
          Contacter le DPO
        </h3>
        <p className="text-sm text-white/60">
          Exercer un droit RGPD ou poser une question compliance. Réponse sous 30 jours (Art. 12.3).
        </p>
      </div>

      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "-9999px",
          width: "1px",
          height: "1px",
          overflow: "hidden",
        }}
      >
        <label htmlFor={`${formId}-website`}>Website (laissez vide)</label>
        <input
          id={`${formId}-website`}
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={form.website}
          onChange={(e) => setForm({ ...form, website: e.target.value })}
        />
      </div>

      <div>
        <label
          htmlFor={`${formId}-email`}
          className="block text-xs uppercase tracking-wider text-white/60 mb-1.5"
        >
          Votre email <span className="text-red-400">*</span>
        </label>
        <input
          id={`${formId}-email`}
          type="email"
          required
          autoComplete="email"
          aria-invalid={Boolean(errors.email)}
          aria-describedby={errors.email ? `${formId}-email-err` : undefined}
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition"
          placeholder="vous@example.com"
        />
        {errors.email && (
          <p
            id={`${formId}-email-err`}
            role="alert"
            className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" /> {errors.email}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${formId}-subject`}
          className="block text-xs uppercase tracking-wider text-white/60 mb-1.5"
        >
          Objet de la demande <span className="text-red-400">*</span>
        </label>
        <select
          id={`${formId}-subject`}
          required
          aria-invalid={Boolean(errors.subject)}
          aria-describedby={errors.subject ? `${formId}-subject-err` : undefined}
          value={form.subject}
          onChange={(e) => setForm({ ...form, subject: e.target.value as Subject })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition"
        >
          <option value="" disabled className="bg-[#12121a]">
            — Sélectionner un article RGPD —
          </option>
          {RGPD_SUBJECTS.map((s) => (
            <option key={s.value} value={s.value} className="bg-[#12121a]">
              {s.label}
            </option>
          ))}
        </select>
        {errors.subject && (
          <p
            id={`${formId}-subject-err`}
            role="alert"
            className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" /> {errors.subject}
          </p>
        )}
      </div>

      <div>
        <label
          htmlFor={`${formId}-message`}
          className="flex items-center justify-between text-xs uppercase tracking-wider text-white/60 mb-1.5"
        >
          <span>
            Message <span className="text-red-400">*</span>
          </span>
          <span className={form.message.length > MESSAGE_MAX ? "text-red-400" : "text-white/40"}>
            {form.message.length}/{MESSAGE_MAX}
          </span>
        </label>
        <textarea
          id={`${formId}-message`}
          required
          rows={6}
          maxLength={MESSAGE_MAX}
          aria-invalid={Boolean(errors.message)}
          aria-describedby={errors.message ? `${formId}-message-err` : undefined}
          value={form.message}
          onChange={(e) => setForm({ ...form, message: e.target.value })}
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder:text-white/30 focus:outline-none focus:border-indigo-500/50 focus:bg-white/10 transition resize-y"
          placeholder="Décrivez votre demande, en précisant si nécessaire votre identifiant utilisateur ou la nature exacte des données concernées."
        />
        {errors.message && (
          <p
            id={`${formId}-message-err`}
            role="alert"
            className="mt-1.5 text-xs text-red-400 flex items-center gap-1"
          >
            <AlertCircle className="w-3 h-3" /> {errors.message}
          </p>
        )}
      </div>

      <AnimatePresence>
        {status === "error" && (
          <motion.div
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 flex gap-2"
          >
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{errorMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="submit"
        disabled={status === "submitting"}
        className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 disabled:cursor-not-allowed text-white font-medium rounded-lg px-4 py-2.5 transition flex items-center justify-center gap-2"
      >
        {status === "submitting" ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Envoi en cours…
          </>
        ) : (
          <>
            <Send className="w-4 h-4" /> Envoyer la demande
          </>
        )}
      </button>

      <p className="text-xs text-white/40 text-center">
        Vos données sont traitées par DeepSight (Maxime Leparc EI, SIRET 994 558 898 00015) uniquement pour
        répondre à votre demande. Conservation 3 ans.
      </p>
    </form>
  );
};

export default DPOContactForm;
