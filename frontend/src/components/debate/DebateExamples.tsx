/**
 * Section "Essayer un exemple" sur la page Débat IA.
 * 3 exemples célèbres pré-générés, accessibles sans coût crédits (mode démo).
 *
 * Sprint Débat IA v2 — Wave 4 G.
 * Spec : docs/superpowers/specs/2026-05-04-debate-ia-v2.md §10.
 */

import { motion } from "framer-motion";

type Example = {
  id: string;
  topic: string;
  thesis_a: string;
  channel_a: string;
  thesis_b: string;
  channel_b: string;
  relation: "opposite" | "complement" | "nuance";
  emoji: string;
};

const EXAMPLES: Example[] = [
  {
    id: "demo-semaine-4j",
    topic: "Semaine de 4 jours : révolution productive ou utopie économique ?",
    thesis_a: "La semaine de 4 jours augmente la productivité et le bien-être.",
    channel_a: "Hugo Décrypte",
    thesis_b:
      "Trop coûteuse pour les PME, elle accroît les inégalités sectorielles.",
    channel_b: "Le Figaro Économie",
    relation: "opposite",
    emoji: "💼",
  },
  {
    id: "demo-ia-emplois",
    topic: "L'IA va-t-elle détruire ou créer des emplois ?",
    thesis_a:
      "L'IA automatise les tâches répétitives mais crée de nouveaux métiers à valeur ajoutée.",
    channel_a: "Science4All",
    thesis_b:
      "Sans politiques de transition, 30% des emplois disparaîtront sans remplacement.",
    channel_b: "Thinkerview",
    relation: "nuance",
    emoji: "🤖",
  },
  {
    id: "demo-climat-action",
    topic: "Action individuelle vs collective face au changement climatique",
    thesis_a:
      "Les gestes quotidiens (vélo, alim, tri) sont essentiels pour réduire l'empreinte carbone.",
    channel_a: "Le Réveilleur",
    thesis_b:
      "Sans réformes politiques structurelles, l'action individuelle est marginale (2% de l'impact).",
    channel_b: "Bon Pote",
    relation: "complement",
    emoji: "🌍",
  },
];

const RELATION_LABELS = {
  opposite: {
    label: "Opposition",
    color: "text-red-400 bg-red-500/10 border-red-500/30",
  },
  complement: {
    label: "Complément",
    color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
  },
  nuance: {
    label: "Nuance",
    color: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  },
};

interface Props {
  onSelectExample: (example: Example) => void;
}

export function DebateExamples({ onSelectExample }: Props) {
  return (
    <section className="my-12">
      <div className="text-center mb-6">
        <h2 className="text-xl font-semibold text-white mb-2">
          Essayer un exemple
        </h2>
        <p className="text-sm text-white/60 max-w-xl mx-auto">
          Découvre la fonctionnalité Débat IA sans utiliser de crédits. 3 sujets
          pré-analysés pour explorer les relations entre points de vue.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-5xl mx-auto">
        {EXAMPLES.map((ex, i) => {
          const relation = RELATION_LABELS[ex.relation];
          return (
            <motion.button
              key={ex.id}
              onClick={() => onSelectExample(ex)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              whileHover={{ y: -4, transition: { duration: 0.2 } }}
              className="group text-left rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.03] to-white/[0.01] p-5 hover:border-violet-500/40 hover:shadow-lg hover:shadow-violet-500/10 transition-all"
            >
              <div className="flex items-start justify-between mb-3">
                <span className="text-3xl">{ex.emoji}</span>
                <span
                  className={`text-xs px-2 py-1 rounded-full border ${relation.color}`}
                >
                  {relation.label}
                </span>
              </div>
              <h3 className="text-sm font-semibold text-white/90 mb-3 leading-tight line-clamp-2">
                {ex.topic}
              </h3>
              <div className="space-y-2 text-xs">
                <div className="flex items-start gap-2">
                  <span className="text-violet-400 font-medium shrink-0">
                    A · {ex.channel_a}
                  </span>
                </div>
                <p className="text-white/60 line-clamp-2 leading-relaxed">
                  {ex.thesis_a}
                </p>
                <div className="flex items-start gap-2 mt-3">
                  <span className="text-cyan-400 font-medium shrink-0">
                    B · {ex.channel_b}
                  </span>
                </div>
                <p className="text-white/60 line-clamp-2 leading-relaxed">
                  {ex.thesis_b}
                </p>
              </div>
              <div className="mt-4 text-xs text-violet-400 group-hover:translate-x-1 transition-transform">
                Explorer ce débat →
              </div>
            </motion.button>
          );
        })}
      </div>

      <p className="text-center text-xs text-white/40 mt-6">
        Démo gratuite — l'analyse complète sur tes vidéos consomme 5 crédits (+
        3 par perspective ajoutée).
      </p>
    </section>
  );
}

export type { Example };
