import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { SEO } from "../components/SEO";
// Intégré au build : le fetch vers raw.githubusercontent.com était bloqué par
// la CSP (connect-src) et le dépôt est privé.
import changelog from "../../../CHANGELOG.md?raw";

export default function ChangelogPage() {
  const content = changelog;

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

          {content && (
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
