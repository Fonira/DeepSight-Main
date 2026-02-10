/**
 * Contact Page — Contact form + FAQ accordion
 * Standalone layout (no sidebar), matches LegalPage pattern.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Mail, Send, User, MessageSquare, ChevronDown, ChevronUp,
  ArrowLeft, HelpCircle, CreditCard, Shield, Zap, BookOpen, Users,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import DoodleBackground from '../components/DoodleBackground';
import { contactApi } from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ DATA
// ═══════════════════════════════════════════════════════════════════════════════

interface FaqItem {
  question: string;
  answer: string;
  icon: React.ElementType;
}

const FAQ_ITEMS: FaqItem[] = [
  {
    question: "Comment fonctionne l'analyse de vidéos YouTube ?",
    answer: "DeepSight utilise l'intelligence artificielle pour extraire la transcription de la vidéo, puis génère un résumé structuré avec des marqueurs épistémiques (Solide, Plausible, Incertain, À Vérifier). L'analyse inclut les concepts clés, un fact-checking et un chat contextuel pour poser des questions.",
    icon: Zap,
  },
  {
    question: "Quels sont les différents plans disponibles ?",
    answer: "Nous proposons un plan Gratuit (3 analyses/mois), Student (2.99€, 40 analyses), Starter (5.99€, 60 analyses), Pro (12.99€, 300 analyses avec playlists et TTS) et Team (29.99€, 1000 analyses). Chaque plan offre des fonctionnalités progressives.",
    icon: CreditCard,
  },
  {
    question: "Mes données sont-elles protégées ?",
    answer: "Oui, DeepSight est conforme au RGPD. Vos données sont chiffrées, stockées sur des serveurs sécurisés (Railway + Vercel), et ne sont jamais partagées avec des tiers. Vous pouvez supprimer votre compte et toutes vos données à tout moment.",
    icon: Shield,
  },
  {
    question: "Comment fonctionne le chat IA contextuel ?",
    answer: "Après l'analyse d'une vidéo, vous pouvez poser des questions dans le chat. L'IA utilise le contenu de la vidéo comme contexte pour fournir des réponses précises et sourcées, avec la possibilité d'activer la recherche web pour enrichir les réponses.",
    icon: MessageSquare,
  },
  {
    question: "Puis-je utiliser DeepSight pour mes études ?",
    answer: "Absolument ! DeepSight propose des outils d'étude dédiés : quiz interactifs, cartes mentales, flashcards et export PDF/Markdown. Le plan Student est conçu spécifiquement pour les étudiants avec un tarif réduit.",
    icon: BookOpen,
  },
  {
    question: "Comment contacter le support ?",
    answer: "Vous pouvez utiliser le formulaire ci-dessous, nous envoyer un email à maxime@deepsightsynthesis.com, ou utiliser le chat en bas à droite de l'écran. Nous répondons généralement sous 24 heures.",
    icon: Users,
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// FAQ ACCORDION ITEM
// ═══════════════════════════════════════════════════════════════════════════════

const FaqAccordionItem: React.FC<{
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}> = ({ item, isOpen, onToggle }) => {
  const Icon = item.icon;
  return (
    <div className="border border-white/10 rounded-xl overflow-hidden bg-white/5 hover:bg-white/[0.07] transition-colors">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center flex-shrink-0">
          <Icon className="w-4 h-4 text-blue-400" />
        </div>
        <span className="flex-1 font-medium text-text-primary text-sm">{item.question}</span>
        {isOpen
          ? <ChevronUp className="w-4 h-4 text-text-tertiary flex-shrink-0" />
          : <ChevronDown className="w-4 h-4 text-text-tertiary flex-shrink-0" />}
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <p className="px-4 pb-4 pl-16 text-sm text-text-secondary leading-relaxed">
              {item.answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════════════════════
// CONTACT PAGE
// ═══════════════════════════════════════════════════════════════════════════════

const ContactPage: React.FC = () => {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSending(true);
    try {
      await contactApi.submit(form);
      setSent(true);
      setForm({ name: '', email: '', subject: '', message: '' });
    } catch (err: any) {
      setError(err?.detail || err?.message || "Une erreur est survenue. Veuillez réessayer.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <DoodleBackground />

      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-xl bg-bg-primary/80 border-b border-white/5">
        <div className="max-w-4xl mx-auto flex items-center justify-between px-6 py-4">
          <Link to="/" className="flex items-center gap-3 group">
            <img src="/logo.png" alt="DeepSight" className="w-8 h-8" />
            <span className="text-lg font-bold text-text-primary">Deep Sight</span>
          </Link>
          <Link
            to="/dashboard"
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-sm text-text-secondary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Retour
          </Link>
        </div>
      </header>

      <main className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
            <Mail className="w-7 h-7 text-blue-400" />
          </div>
          <h1 className="text-3xl font-bold text-text-primary mb-3">Contactez-nous</h1>
          <p className="text-text-secondary max-w-lg mx-auto">
            Une question, une suggestion ou un problème ? Nous sommes là pour vous aider.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Contact Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-text-primary mb-5 flex items-center gap-2">
                <Send className="w-5 h-5 text-blue-400" />
                Envoyer un message
              </h2>

              {sent ? (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto mb-4">
                    <Mail className="w-6 h-6 text-emerald-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-text-primary mb-2">Message envoyé !</h3>
                  <p className="text-sm text-text-secondary mb-4">
                    Nous vous répondrons sous 24 heures.
                  </p>
                  <button
                    onClick={() => setSent(false)}
                    className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Envoyer un autre message
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Nom</label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={100}
                        value={form.name}
                        onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                        placeholder="Votre nom"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        type="email"
                        required
                        value={form.email}
                        onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                        placeholder="votre@email.com"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Sujet</label>
                    <div className="relative">
                      <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-tertiary" />
                      <input
                        type="text"
                        required
                        minLength={2}
                        maxLength={200}
                        value={form.subject}
                        onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                        placeholder="Sujet de votre message"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-text-secondary mb-1.5">Message</label>
                    <textarea
                      required
                      minLength={10}
                      maxLength={5000}
                      rows={5}
                      value={form.message}
                      onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                      placeholder="Décrivez votre demande..."
                      className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-text-primary placeholder:text-text-tertiary text-sm focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-colors resize-none"
                    />
                  </div>

                  {error && (
                    <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors flex items-center justify-center gap-2"
                  >
                    {sending ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Envoi en cours...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Envoyer
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </motion.div>

          {/* FAQ */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="space-y-3">
              <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-violet-400" />
                Questions fréquentes
              </h2>
              {FAQ_ITEMS.map((item, i) => (
                <FaqAccordionItem
                  key={i}
                  item={item}
                  isOpen={openFaq === i}
                  onToggle={() => setOpenFaq(openFaq === i ? null : i)}
                />
              ))}
            </div>
          </motion.div>
        </div>

        {/* Footer info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 text-center text-sm text-text-tertiary"
        >
          <p>Vous pouvez aussi nous écrire à{' '}
            <a href="mailto:maxime@deepsightsynthesis.com" className="text-blue-400 hover:text-blue-300 transition-colors">
              maxime@deepsightsynthesis.com
            </a>
          </p>
        </motion.div>
      </main>
    </div>
  );
};

export default ContactPage;
