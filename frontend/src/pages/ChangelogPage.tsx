import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SEO } from "../components/SEO";

const CHANGELOG_URL =
  "https://raw.githubusercontent.com/Fonira/DeepSight-Main/main/CHANGELOG.md";

export default function ChangelogPage() {
  const [content, setContent] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(CHANGELOG_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <>
      <SEO
        title="Journal des modifications"
        description="Historique des nouveautés, améliorations et corrections de DeepSight."
      />
      <div className="min-h-screen bg-bg-primary p-4 md:p-8">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mx-auto max-w-3xl"
        >
          <header className="mb-8">
            <h1 className="text-4xl font-bold text-text-primary">
              Journal des modifications
            </h1>
            <p className="mt-2 text-text-secondary">
              Ce qui a changé sur DeepSight, par ordre chronologique inverse.
            </p>
          </header>

          {loading && <p className="text-text-secondary">Chargement…</p>}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-900/10 p-4 text-red-300">
              <p className="font-medium">Impossible de charger le changelog.</p>
              <p className="mt-1 text-sm opacity-80">Erreur : {error}</p>
              <a
                href="https://github.com/Fonira/DeepSight-Main/blob/main/CHANGELOG.md"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 inline-block text-sm underline hover:no-underline"
              >
                Voir sur GitHub →
              </a>
            </div>
          )}

          {!loading && !error && (
            <article className="prose prose-invert max-w-none prose-headings:text-text-primary prose-a:text-accent-primary prose-strong:text-text-primary prose-code:text-accent-primary">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
            </article>
          )}
        </motion.div>
      </div>
    </>
  );
}
