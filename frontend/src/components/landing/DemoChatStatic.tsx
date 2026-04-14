/**
 * DemoChatStatic — Mini chat interactif avec reponses pre-scriptees.
 * Aucun appel API. Simule le chat contextuel DeepSight sur la video de demo.
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Bot, User, Sparkles } from "lucide-react";

// ─── Reponses pre-scriptees ───

interface ScriptedResponse {
  keywords: string[];
  answer: string;
  answerEn: string;
}

const SCRIPTED_RESPONSES: ScriptedResponse[] = [
  {
    keywords: ["principal", "point", "resume", "main", "summary", "essentiel"],
    answer:
      "Le point principal de la video est que l'IA transforme la recherche scientifique sur trois axes : **acceleration de la revue de litterature** (jusqu'a 40% plus rapide), **assistance a la formulation d'hypotheses**, et **automatisation partielle de l'analyse de donnees**. L'intervenant insiste sur le fait que l'IA reste un outil d'augmentation, pas de remplacement du chercheur.\n\n[Timecode: 2:15 - 4:30]",
    answerEn:
      "The main point of the video is that AI transforms scientific research on three axes: **literature review acceleration** (up to 40% faster), **hypothesis formulation assistance**, and **partial automation of data analysis**. The speaker emphasizes that AI remains an augmentation tool, not a replacement for researchers.\n\n[Timecode: 2:15 - 4:30]",
  },
  {
    keywords: ["argument", "these", "thesis", "position", "defendre"],
    answer:
      "L'intervenant defend trois arguments principaux :\n\n1. **L'IA accelere la decouverte** — les meta-analyses qui prenaient des mois peuvent etre realisees en semaines\n2. **La qualite est preservee** — les modeles sont utilises pour la recherche preliminaire, pas pour les conclusions finales\n3. **L'ethique doit suivre** — il appelle a des cadres reglementaires adaptes (AI Act europeen)\n\nIl nuance en reconnaissant que les biais algorithmiques restent un defi majeur.\n\n[Timecode: 5:00 - 12:30]",
    answerEn:
      "The speaker defends three main arguments:\n\n1. **AI accelerates discovery** — meta-analyses that took months can be done in weeks\n2. **Quality is preserved** — models are used for preliminary research, not final conclusions\n3. **Ethics must follow** — they call for adapted regulatory frameworks (European AI Act)\n\nThey nuance by acknowledging that algorithmic biases remain a major challenge.\n\n[Timecode: 5:00 - 12:30]",
  },
  {
    keywords: ["source", "reference", "cite", "bibliographie", "paper"],
    answer:
      "La video cite plusieurs sources :\n\n- **Nature Reviews Methods Primers** (2025) — sur les capacites des LLM en analyse d'articles\n- **The Lancet Digital Health** — etude sur la reduction du temps de meta-analyse\n- **AI Act europeen** — cadre reglementaire pour l'IA en recherche\n- **AlphaFold** (DeepMind) — mentionne comme exemple de reussite IA en biologie\n\nDeepSight a croise ces references avec des sources web. La reference au Lancet indique 25-50% de reduction (l'intervenant cite 40%, ce qui est dans la fourchette).\n\n[Timecode: 7:20, 11:45, 15:00]",
    answerEn:
      "The video cites several sources:\n\n- **Nature Reviews Methods Primers** (2025) — on LLM capabilities in article analysis\n- **The Lancet Digital Health** — study on meta-analysis time reduction\n- **European AI Act** — regulatory framework for AI in research\n- **AlphaFold** (DeepMind) — mentioned as a success example in biology\n\nDeepSight cross-referenced these with web sources. The Lancet reference indicates 25-50% reduction (the speaker cites 40%, which is within range).\n\n[Timecode: 7:20, 11:45, 15:00]",
  },
  {
    keywords: [
      "fiable",
      "reliable",
      "confiance",
      "trust",
      "verifier",
      "verify",
      "biais",
      "bias",
    ],
    answer:
      "Le score de fiabilite est de **78/100**. Voici le detail :\n\n- **Solide (1/4)** : L'affirmation sur les LLM et l'analyse d'articles est bien documentee\n- **Plausible (1/4)** : Le chiffre de 40% est dans la fourchette mais imprecis\n- **Incertain (1/4)** : La prediction sur 2028 est speculative\n- **A verifier (1/4)** : L'affirmation sur les biais \"completement maitrises\" est exageree\n\nLe contenu est globalement fiable mais contient des projections optimistes non etayees.",
    answerEn:
      'The reliability score is **78/100**. Here\'s the breakdown:\n\n- **Solid (1/4)**: The claim about LLMs and article analysis is well documented\n- **Plausible (1/4)**: The 40% figure is within range but imprecise\n- **Uncertain (1/4)**: The 2028 prediction is speculative\n- **Needs verification (1/4)**: The claim about biases being "completely controlled" is exaggerated\n\nThe content is generally reliable but contains unsupported optimistic projections.',
  },
  {
    keywords: ["flashcard", "quiz", "reviser", "study", "etudier", "apprendre"],
    answer:
      "Les flashcards et quiz sont disponibles apres l'analyse complete. Pour cette video, DeepSight genererait des questions comme :\n\n- *Q: Quel pourcentage de reduction du temps de meta-analyse l'IA permet-elle ?*\n  R: Entre 25% et 50% selon The Lancet Digital Health\n\n- *Q: Quel est le principal risque mentionne concernant l'IA en recherche ?*\n  R: Les biais algorithmiques et les questions d'attribution intellectuelle\n\nCreez un compte gratuit pour acceder aux outils d'etude complets.",
    answerEn:
      "Flashcards and quizzes are available after the full analysis. For this video, DeepSight would generate questions like:\n\n- *Q: What percentage reduction in meta-analysis time does AI enable?*\n  A: Between 25% and 50% according to The Lancet Digital Health\n\n- *Q: What is the main risk mentioned regarding AI in research?*\n  A: Algorithmic biases and intellectual attribution questions\n\nCreate a free account to access the full study tools.",
  },
];

const DEFAULT_RESPONSE = {
  fr: "C'est une excellente question. D'apres l'analyse de la video, l'intervenant aborde principalement l'impact de l'IA sur la recherche scientifique. Les points cles sont la reduction du temps de revue de litterature, l'amelioration de la formulation d'hypotheses et les defis ethiques. Voulez-vous que je detaille un aspect en particulier ?\n\n[Basé sur la transcription complete]",
  en: "That's an excellent question. Based on the video analysis, the speaker mainly addresses AI's impact on scientific research. Key points include the reduction in literature review time, improved hypothesis formulation, and ethical challenges. Would you like me to elaborate on a specific aspect?\n\n[Based on the full transcript]",
};

const SUGGESTIONS = {
  fr: [
    "Quel est le point principal ?",
    "Quels arguments sont avances ?",
    "Les sources sont-elles fiables ?",
  ],
  en: [
    "What is the main point?",
    "What arguments are made?",
    "Are the sources reliable?",
  ],
};

// ─── Composant principal ───

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface DemoChatStaticProps {
  language: string;
}

export default function DemoChatStatic({ language }: DemoChatStaticProps) {
  const lang = language === "fr" ? "fr" : "en";
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const findResponse = (question: string): string => {
    const normalizedQ = question
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    for (const scripted of SCRIPTED_RESPONSES) {
      if (scripted.keywords.some((kw) => normalizedQ.includes(kw))) {
        return lang === "fr" ? scripted.answer : scripted.answerEn;
      }
    }

    return DEFAULT_RESPONSE[lang];
  };

  const sendMessage = (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: ChatMessage = { role: "user", content: text.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setShowSuggestions(false);
    setIsTyping(true);

    // Simuler un delai de "reflexion" de l'IA
    const delay = 800 + Math.random() * 1200;
    setTimeout(() => {
      const response = findResponse(text);
      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: response,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsTyping(false);
    }, delay);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Formatter le contenu avec bold markdown basique
  const formatContent = (content: string) => {
    const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*|\n)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="text-white/90 font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <em key={i} className="text-white/60 italic">
            {part.slice(1, -1)}
          </em>
        );
      }
      if (part === "\n") {
        return <br key={i} />;
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay: 0.2 }}
      className="max-w-3xl mx-auto mt-8"
    >
      {/* Titre */}
      <div className="text-center mb-6">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 mb-4">
          <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
          <span className="text-xs text-cyan-400 font-medium">
            {lang === "fr" ? "Chat interactif" : "Interactive Chat"}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mb-2">
          {lang === "fr"
            ? "Posez vos questions a l'IA"
            : "Ask the AI your questions"}
        </h3>
        <p className="text-text-secondary text-sm max-w-md mx-auto">
          {lang === "fr"
            ? "Testez le chat contextuel — l'IA repond en se basant sur la transcription de la video."
            : "Test the contextual chat — AI answers based on the video transcript."}
        </p>
      </div>

      {/* Chat container */}
      <div className="relative rounded-2xl border border-border-subtle bg-white/[0.03] backdrop-blur-xl overflow-hidden">
        {/* Glow */}
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 via-transparent to-indigo-500/5 pointer-events-none" />

        {/* Header */}
        <div className="relative flex items-center justify-between px-5 py-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-white/70 text-xs font-medium">
              {lang === "fr"
                ? "Chat DeepSight — Demo"
                : "DeepSight Chat — Demo"}
            </span>
          </div>
          <span className="text-white/30 text-[10px]">Mistral AI</span>
        </div>

        {/* Messages */}
        <div className="relative h-80 overflow-y-auto px-5 py-4 space-y-3 scrollbar-thin scrollbar-thumb-white/10">
          {/* Empty state */}
          {messages.length === 0 && !isTyping && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-500/10 to-indigo-500/10 border border-white/5 flex items-center justify-center mb-3">
                <Bot className="w-6 h-6 text-cyan-400/60" />
              </div>
              <p className="text-white/40 text-sm mb-1">
                {lang === "fr"
                  ? "Interrogez la video analysee"
                  : "Ask about the analyzed video"}
              </p>
              <p className="text-white/20 text-xs mb-5 max-w-xs">
                {lang === "fr"
                  ? "L'IA repond avec des timecodes et des references precises."
                  : "AI responds with timecodes and precise references."}
              </p>

              {/* Suggestions */}
              {showSuggestions && (
                <div className="flex flex-wrap gap-2 justify-center">
                  {SUGGESTIONS[lang].map((suggestion, index) => (
                    <motion.button
                      key={index}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3 + index * 0.1 }}
                      onClick={() => sendMessage(suggestion)}
                      className="px-3 py-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/10
                                 hover:border-cyan-500/30 rounded-full text-xs text-white/60 hover:text-white/80
                                 transition-all duration-200 cursor-pointer"
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Messages list */}
          <AnimatePresence>
            {messages.map((msg, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex gap-2.5 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {/* Avatar */}
                <div
                  className={`flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center
                  ${
                    msg.role === "user"
                      ? "bg-indigo-500/15 border border-indigo-500/20"
                      : "bg-cyan-500/15 border border-cyan-500/20"
                  }`}
                >
                  {msg.role === "user" ? (
                    <User className="w-3.5 h-3.5 text-indigo-400" />
                  ) : (
                    <Bot className="w-3.5 h-3.5 text-cyan-400" />
                  )}
                </div>

                {/* Bubble */}
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed
                    ${
                      msg.role === "user"
                        ? "bg-indigo-500/15 border border-indigo-500/20 text-white/90 rounded-tr-md"
                        : "bg-white/[0.04] border border-white/[0.06] text-white/75 rounded-tl-md"
                    }`}
                >
                  {msg.role === "assistant"
                    ? formatContent(msg.content)
                    : msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex gap-2.5"
            >
              <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="px-4 py-3 rounded-2xl rounded-tl-md bg-white/[0.04] border border-white/[0.06]">
                <div className="flex gap-1.5">
                  <span
                    className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"
                    style={{ animationDelay: "0ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"
                    style={{ animationDelay: "150ms" }}
                  />
                  <span
                    className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce"
                    style={{ animationDelay: "300ms" }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="relative border-t border-white/5 px-4 py-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                lang === "fr"
                  ? "Posez votre question..."
                  : "Ask your question..."
              }
              disabled={isTyping}
              className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-xl px-4 py-2.5 text-sm text-white/90
                         placeholder-white/20 outline-none focus:border-cyan-500/30 focus:bg-white/[0.05]
                         transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="flex-shrink-0 w-10 h-10 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/20
                         flex items-center justify-center transition-all duration-200
                         disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4 text-cyan-300" />
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}
