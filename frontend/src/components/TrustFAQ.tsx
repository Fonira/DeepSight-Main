/**
 * TRUST CENTER — FAQ accordion
 * ═══════════════════════════════════════════════════════════════════════════════
 * Composant : <TrustFAQ />
 * URL : /trust (section §10)
 * Audience : DSI, DPO, CISO, Compliance Officer banque/pharma/luxe/énergie EU.
 * Format : 15 Q/R groupées en 4 catégories (RGPD & DPA, Sectoriel, Architecture,
 *          AI Act). Accordion multi-expand (useState<Set<number>>), animation
 *          Framer Motion height auto, JSON-LD FAQPage schema pour SEO.
 * Accessibilité : button[aria-expanded] + region[aria-labelledby], focus visible,
 *                 contenu indexable (rendu côté client mais JSON-LD côté serveur
 *                 via React injection au mount).
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useId, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, FileText, Shield, Server, Scale } from "lucide-react";

// ═══════════════════════════════════════════════════════════════════════════════
// TYPAGE
// ═══════════════════════════════════════════════════════════════════════════════

type FAQCategory =
  | "rgpd-dpa"
  | "sectoriel"
  | "architecture"
  | "ai-act";

interface FAQItem {
  /** Index global (1..15) — utilisé comme clé d'expansion */
  id: number;
  category: FAQCategory;
  question: string;
  /** Réponse au format JSX inline (liens, listes, code). */
  answer: React.ReactNode;
  /** Version texte plat pour le JSON-LD (sans liens HTML). */
  answerText: string;
}

interface CategoryMeta {
  id: FAQCategory;
  label: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CATÉGORIES
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORIES: ReadonlyArray<CategoryMeta> = [
  {
    id: "rgpd-dpa",
    label: "RGPD & DPA",
    icon: <FileText className="w-4 h-4" aria-hidden="true" />,
    iconBg: "bg-purple-500/20",
    iconColor: "text-purple-300",
  },
  {
    id: "sectoriel",
    label: "Sectoriel (DORA/NIS2)",
    icon: <Shield className="w-4 h-4" aria-hidden="true" />,
    iconBg: "bg-pink-500/20",
    iconColor: "text-pink-300",
  },
  {
    id: "architecture",
    label: "Architecture technique",
    icon: <Server className="w-4 h-4" aria-hidden="true" />,
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-300",
  },
  {
    id: "ai-act",
    label: "AI Act",
    icon: <Scale className="w-4 h-4" aria-hidden="true" />,
    iconBg: "bg-cyan-500/20",
    iconColor: "text-cyan-300",
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// LIENS UTILES (mirroir TrustPage.TRUST_INFO.links — duplication assumée pour
// garder le composant standalone et déplaçable)
// ═══════════════════════════════════════════════════════════════════════════════

const DPO_EMAIL = "dpo@deepsightsynthesis.com";
const SUBPROCESSORS_URL = "/trust/subprocessors";
const STATUS_URL = "https://status.deepsightsynthesis.com";
const ARCHITECTURE_REPO = "https://github.com/Fonira/deepsight-architecture";
const AI_ACT_URL = "https://eur-lex.europa.eu/eli/reg/2024/1689";
const SCC_URL = "https://eur-lex.europa.eu/eli/dec_impl/2021/914";
const DORA_URL = "https://eur-lex.europa.eu/eli/reg/2022/2554";
const NIS2_URL = "https://eur-lex.europa.eu/eli/dir/2022/2555";

// ═══════════════════════════════════════════════════════════════════════════════
// LIEN EXTERNE — helper
// ═══════════════════════════════════════════════════════════════════════════════

const ExtLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="text-accent-primary hover:underline"
  >
    {children}
  </a>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 15 QUESTIONS / RÉPONSES
// ═══════════════════════════════════════════════════════════════════════════════

const FAQ_ITEMS: ReadonlyArray<FAQItem> = [
  // ─── RGPD & DPA ──────────────────────────────────────────────────────────────
  {
    id: 1,
    category: "rgpd-dpa",
    question:
      "Quel est le statut juridique du responsable du traitement, et pourquoi pas une SAS ?",
    answerText:
      "Le responsable du traitement est Maxime Leparc, Entrepreneur Individuel (SIRET 994 558 898 00015), nom commercial Deep Sight, basé à La Mulatière (France). Le statut EI a été retenu pour démarrer rapidement avec une fiscalité simplifiée et sans capital social, en cohérence avec la phase d'amorçage du produit. Une bascule en SAS est planifiée dès qu'un seuil de chiffre d'affaires ou un contrat B2B le justifie (notamment pour faciliter les marchés publics et l'entrée d'investisseurs). Le statut EI n'a aucun impact sur les obligations RGPD : le responsable du traitement reste pleinement engagé sur l'Art 28 (sous-traitance) et sur les SCC 2021/914 modules 2 et 3 pour les transferts hors EEE. La forme juridique de l'éditeur n'apparait pas dans les réquisits banque/pharma classiques (un EI peut signer un DPA aussi formellement qu'une SAS).",
    answer: (
      <>
        <p>
          Le responsable du traitement est <strong>Maxime Leparc</strong>,
          Entrepreneur Individuel (SIRET 994 558 898 00015), nom commercial
          Deep Sight, basé à La Mulatière (France).
        </p>
        <p>
          Le statut EI a été retenu pour démarrer rapidement avec une fiscalité
          simplifiée et sans capital social, en cohérence avec la phase
          d'amorçage du produit. Une bascule en SAS est planifiée dès qu'un
          seuil de chiffre d'affaires ou un contrat B2B le justifie (marchés
          publics, entrée d'investisseurs).
        </p>
        <p>
          Le statut EI n'a <strong>aucun impact</strong> sur les obligations
          RGPD : le responsable du traitement reste pleinement engagé sur l'Art
          28 (sous-traitance) et sur les{" "}
          <ExtLink href={SCC_URL}>SCC 2021/914</ExtLink> modules 2 et 3 pour
          les transferts hors EEE. Un EI peut signer un DPA aussi formellement
          qu'une SAS.
        </p>
      </>
    ),
  },
  {
    id: 2,
    category: "rgpd-dpa",
    question:
      "Avez-vous un DPO désigné, et comment puis-je le contacter pour une demande RGPD ?",
    answerText:
      "Maxime Leparc cumule actuellement les rôles de responsable du traitement et de point de contact data privacy. Cette situation est conforme au RGPD pour une structure de cette taille (le RGPD n'impose un DPO indépendant que dans les cas listés à l'Art 37 — autorité publique, traitement à grande échelle de données sensibles, etc.). À mesure que la base utilisateurs grandit, un DPO indépendant sera désigné formellement (objectif courant 2027). Pour toute demande RGPD (Art 15 accès, Art 16 rectification, Art 17 effacement, Art 20 portabilité, Art 21 opposition), trois canaux sont disponibles : 1) Le formulaire structuré en bas de la page Trust Center (catégorisé par article RGPD, traçabilité automatique), 2) Email direct à dpo@deepsightsynthesis.com, 3) Email administratif fallback à maximeleparc3@gmail.com. SLA de réponse : 5 jours ouvrés en pratique, 1 mois maximum conformément à l'Art 12 RGPD. Aucune authentification supplémentaire n'est requise pour exercer un droit RGPD au-delà de la vérification d'identité standard (token de session ou échange email).",
    answer: (
      <>
        <p>
          Maxime Leparc cumule actuellement les rôles de responsable du
          traitement et de point de contact data privacy. Cette situation est
          conforme au RGPD pour une structure de cette taille — l'Art 37
          n'impose un DPO indépendant que dans des cas spécifiques (autorité
          publique, traitement à grande échelle de données sensibles, etc.). Un
          DPO indépendant sera désigné formellement courant 2027.
        </p>
        <p>Pour toute demande RGPD, trois canaux sont disponibles :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            Formulaire structuré en bas du Trust Center (catégorisé par article
            RGPD)
          </li>
          <li>
            Email direct :{" "}
            <a
              href={`mailto:${DPO_EMAIL}`}
              className="text-accent-primary hover:underline"
            >
              {DPO_EMAIL}
            </a>
          </li>
          <li>Fallback administratif : maximeleparc3@gmail.com</li>
        </ul>
        <p>
          SLA de réponse : <strong>5 jours ouvrés</strong> en pratique, 1 mois
          maximum (Art 12 RGPD).
        </p>
      </>
    ),
  },
  {
    id: 3,
    category: "rgpd-dpa",
    question:
      "Comment se déroule la signature du DPA pour un client B2B, et quel est le délai ?",
    answerText:
      "Le DPA fourni est basé sur les Clauses Contractuelles Types Européennes 2021/914, modules 2 (responsable vers sous-traitant) et 3 (sous-traitant vers sous-sous-traitant), avec annexes pré-remplies. Le processus standard prend 3 à 7 jours ouvrés : 1) Envoyez une demande à dpo@deepsightsynthesis.com avec votre raison sociale, SIRET et le périmètre d'usage prévu (volume estimé, données traitées, durée). 2) Vous recevez sous 24-48h le DPA pré-rempli en PDF avec l'Annexe II sécurité (mesures techniques et organisationnelles : chiffrement TLS 1.3 + LUKS, contrôle d'accès JWT, journalisation, etc.). 3) Vos juristes peuvent retourner des amendements — toute modification raisonnable est négociable (clauses d'audit, durée de rétention spécifique, sous-traitants exclus). 4) Signature électronique acceptée (DocuSign, Adobe Sign, ou simple PDF signé scanné). Aucun frais. Aucun engagement minimum de durée ou de volume. Un DPA exécuté est un prérequis avant toute mise en production B2B impliquant des données personnelles de tiers (employés, clients, etc.) — il n'est pas requis pour un usage strictement individuel.",
    answer: (
      <>
        <p>
          Le DPA est basé sur les{" "}
          <ExtLink href={SCC_URL}>SCC 2021/914</ExtLink> modules 2 et 3, avec
          annexes pré-remplies (Deep Sight comme processeur).
        </p>
        <p>Processus standard, 3 à 7 jours ouvrés :</p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>
            Demande à{" "}
            <a
              href={`mailto:${DPO_EMAIL}`}
              className="text-accent-primary hover:underline"
            >
              {DPO_EMAIL}
            </a>{" "}
            (raison sociale, SIRET, périmètre)
          </li>
          <li>
            Réception sous 24-48h du DPA + Annexe II sécurité (chiffrement,
            contrôle d'accès, journalisation)
          </li>
          <li>Amendements raisonnables négociables (audit, rétention, etc.)</li>
          <li>Signature électronique acceptée (DocuSign, Adobe Sign, PDF)</li>
        </ol>
        <p>
          Aucun frais, aucun engagement minimum. Le DPA est un prérequis avant
          mise en production B2B impliquant des données de tiers.
        </p>
      </>
    ),
  },
  {
    id: 4,
    category: "rgpd-dpa",
    question:
      "Quels sous-traitants ultérieurs sont impliqués, et où est publiée la liste à jour ?",
    answerText:
      "La liste exhaustive et tenue à jour des sous-traitants ultérieurs (article 28.2 RGPD) est publiée à l'URL canonique /trust/subprocessors, accessible publiquement sans authentification. À ce jour, 8 sous-traitants sont engagés : Hetzner Online GmbH (hébergement backend, Allemagne), Mistral AI (LLM, France), Cloudflare R2 (stockage objets, région UE), Resend (email transactionnel, UE), Stripe Payments Europe (paiements, Irlande EEE), Sentry SaaS EU (monitoring erreurs, Frankfurt), Supadata (extraction transcripts YouTube, EU/US selon endpoints — données techniques uniquement), Vercel (hébergement frontend statique, EU edge). Pour chacun : raison sociale complète, juridiction, type de données traitées, base légale du transfert, SCC ou décision d'adéquation invoquée. Tous les sous-traitants impliquant un transfert hors EEE sont couverts par les SCC 2021/914 + DPA bilatéral en notre possession (disponibles sur demande dans le cadre d'une revue compliance client).",
    answer: (
      <>
        <p>
          La liste exhaustive est publiée publiquement à{" "}
          <a
            href={SUBPROCESSORS_URL}
            className="text-accent-primary hover:underline"
          >
            /trust/subprocessors
          </a>
          {" "}(Art 28.2 RGPD).
        </p>
        <p>À ce jour, 8 sous-traitants sont engagés :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Hetzner Online GmbH (backend, Allemagne)</li>
          <li>Mistral AI (LLM, France)</li>
          <li>Cloudflare R2 (stockage objets, région UE)</li>
          <li>Resend (email transactionnel, UE)</li>
          <li>Stripe Payments Europe (paiements, Irlande EEE)</li>
          <li>Sentry SaaS EU (monitoring, Frankfurt)</li>
          <li>Supadata (extraction transcripts YouTube)</li>
          <li>Vercel (frontend statique, EU edge)</li>
        </ul>
        <p>
          Tous les transferts hors EEE sont couverts par les{" "}
          <ExtLink href={SCC_URL}>SCC 2021/914</ExtLink> + DPA bilatéral (sur
          demande).
        </p>
      </>
    ),
  },
  {
    id: 5,
    category: "rgpd-dpa",
    question:
      "Comment serai-je notifié d'un changement ou ajout de sous-traitant ultérieur ?",
    answerText:
      "Tout ajout ou remplacement de sous-traitant ultérieur déclenche une notification 30 jours calendaires avant l'activation effective, avec droit d'objection contractuel pour les clients sur plan Expert (et au-delà, par DPA personnalisé pour les contrats B2B). Le mécanisme : 1) La page /trust/subprocessors est mise à jour avec un changelog daté visible. 2) Un email automatisé est envoyé à l'adresse de contact compliance enregistrée pour chaque client B2B ayant signé un DPA. 3) Si vous formulez une objection raisonnable et motivée dans la fenêtre de 30 jours (incompatibilité réglementaire sectorielle, par exemple), nous nous engageons à proposer une alternative ou à débuter un processus de résiliation prorata-temporis sans pénalité. Pour les utilisateurs sur plans gratuits ou particuliers (B2C), le changelog public sert de notification — le droit d'objection ne s'applique pas formellement (pas de DPA bilatéral signé) mais le droit RGPD de retrait du consentement reste pleinement applicable (Art 7.3). Aucun ajout silencieux : la transparence subprocessors est non négociable.",
    answer: (
      <>
        <p>
          Tout ajout ou remplacement déclenche une notification{" "}
          <strong>30 jours calendaires avant activation</strong>, avec droit
          d'objection contractuel pour les clients Expert et B2B sous DPA.
        </p>
        <p>Mécanisme :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Mise à jour de /trust/subprocessors avec changelog daté</li>
          <li>Email automatique aux contacts compliance B2B (DPA signés)</li>
          <li>
            Objection motivée → alternative proposée ou résiliation
            prorata-temporis sans pénalité
          </li>
        </ul>
        <p>
          Pour les utilisateurs B2C, le changelog public sert de notification ;
          le droit RGPD de retrait du consentement reste applicable (Art 7.3).
          Aucun ajout silencieux.
        </p>
      </>
    ),
  },

  // ─── SECTORIEL (DORA/NIS2) ──────────────────────────────────────────────────
  {
    id: 6,
    category: "sectoriel",
    question:
      "Êtes-vous conformes DORA pour les institutions financières EU régulées ?",
    answerText:
      "DORA (Règlement UE 2022/2554) impose aux institutions financières EU des exigences strictes sur leurs prestataires TIC tiers (third-party ICT risk management). Le produit n'est pas formellement certifié DORA — aucune certification publique DORA n'existe encore (le règlement est applicable depuis le 17 janvier 2025 et l'écosystème de certification est en construction). Cependant, les exigences clés sont substantiellement satisfaites : 1) Hébergement EU exclusif (Hetzner Allemagne) → conformité substance économique. 2) Registre des prestataires tenu à jour (page subprocessors). 3) Plan de continuité documenté avec RTO 4h et RPO 24h. 4) Capacité à fournir les artefacts d'un audit (logs, traces, accès) sur demande contractuelle. 5) Notification d'incident sous 4h ouvrées (Art 19 DORA exige sous-jacents proportionnés). Un questionnaire ICT third-party risk management (TPRM) standardisé est en préparation pour Q3 2026 — il sera proposable en réponse aux RFP banque/assurance. Pour les RFP en cours, le DPO peut fournir une réponse personnalisée au questionnaire interne du client sous 5 jours ouvrés. Limitation : si vous êtes classé entité critique sous DORA Art 28, l'usage du produit doit faire l'objet d'une analyse d'impact spécifique de votre côté — il ne se substitue pas à votre propre due diligence.",
    answer: (
      <>
        <p>
          <ExtLink href={DORA_URL}>DORA (Règlement UE 2022/2554)</ExtLink>{" "}
          impose aux institutions financières EU des exigences sur leurs
          prestataires TIC tiers. Le produit n'est{" "}
          <strong>pas formellement certifié DORA</strong> — aucune certification
          publique DORA n'existe encore (règlement applicable depuis le 17
          janvier 2025).
        </p>
        <p>Exigences clés substantiellement satisfaites :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Hébergement EU exclusif (Hetzner Allemagne)</li>
          <li>Registre prestataires tenu à jour (subprocessors)</li>
          <li>Plan de continuité documenté (RTO 4h, RPO 24h)</li>
          <li>Artefacts d'audit fournissables sur demande</li>
          <li>Notification d'incident sous 4h ouvrées</li>
        </ul>
        <p>
          Un questionnaire ICT third-party risk management standardisé sera
          publié Q3 2026. Pour les RFP en cours, réponse personnalisée sous 5
          jours ouvrés via{" "}
          <a
            href={`mailto:${DPO_EMAIL}`}
            className="text-accent-primary hover:underline"
          >
            {DPO_EMAIL}
          </a>
          .
        </p>
        <p>
          <strong>Limitation :</strong> si vous êtes entité critique sous DORA
          Art 28, l'usage doit faire l'objet d'une analyse d'impact spécifique
          de votre côté — le produit ne se substitue pas à votre due diligence.
        </p>
      </>
    ),
  },
  {
    id: 7,
    category: "sectoriel",
    question:
      "Êtes-vous conformes NIS2 pour les opérateurs critiques (énergie, santé, infrastructure) ?",
    answerText:
      "NIS2 (Directive UE 2022/2555) durcit les exigences de cybersécurité pour les entités essentielles et importantes. Le produit n'est pas une entité régulée NIS2 par lui-même (taille de l'éditeur sous les seuils, pas dans les secteurs listés à l'Annexe I/II). En tant que prestataire d'une entité régulée NIS2, deux situations : 1) Si vous nous classez comme prestataire de services TIC critique pour votre activité, vous devez nous référencer dans votre registre prestataires NIS2 et nous demander un attestation de mesures de sécurité. Nous fournissons l'Annexe II sécurité du DPA qui couvre l'essentiel des exigences NIS2 Art 21 (chiffrement, gestion d'accès, gestion d'incidents, sauvegardes, formation). 2) Pour la notification d'incident NIS2 (24h pré-alerte, 72h notification, 30 jours rapport final), le SLA de notification produit est aligné : pré-alerte sous 4h ouvrées, notification structurée sous 72h, post-mortem public sous 30 jours pour les incidents majeurs. Limitations : pas de certification ISO 27001 actuellement (audit visé Q4 2026), donc pour les opérateurs énergie/santé exigeant ISO 27001 ou équivalent, nous ne sommes pas immédiatement éligibles. Sur les autres secteurs (numérique, recherche, administration publique), une analyse au cas par cas est possible.",
    answer: (
      <>
        <p>
          <ExtLink href={NIS2_URL}>NIS2 (Directive UE 2022/2555)</ExtLink>{" "}
          durcit les exigences de cybersécurité pour les entités essentielles
          et importantes. Le produit n'est pas une entité régulée NIS2 par
          lui-même (taille sous seuils, pas dans Annexe I/II).
        </p>
        <p>
          En tant que <strong>prestataire d'une entité régulée NIS2</strong> :
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            L'Annexe II sécurité du DPA couvre l'essentiel des exigences NIS2
            Art 21 (chiffrement, accès, incidents, sauvegardes)
          </li>
          <li>
            SLA notification d'incident aligné : pré-alerte 4h, notification
            structurée 72h, post-mortem public 30 jours
          </li>
        </ul>
        <p>
          <strong>Limitation :</strong> pas de certification ISO 27001
          actuellement (audit visé Q4 2026). Les opérateurs énergie/santé
          exigeant ISO 27001 ne sont pas immédiatement éligibles. Analyse au
          cas par cas pour les autres secteurs (numérique, recherche, admin
          publique).
        </p>
      </>
    ),
  },
  {
    id: 8,
    category: "sectoriel",
    question:
      "Quels sont vos engagements RTO et RPO en cas d'incident majeur ?",
    answerText:
      "RTO (Recovery Time Objective) cible : 4 heures ouvrées pour la restauration du service en cas d'incident majeur. RPO (Recovery Point Objective) cible : 24 heures de perte de données maximum acceptable. Ces cibles s'appuient sur l'architecture suivante : 1) Sauvegardes PostgreSQL automatiques quotidiennes vers Cloudflare R2 (région UE), retention 30 jours, vérification d'intégrité hebdomadaire. 2) Stack Docker reproductible (Hetzner) — un redéploiement complet from scratch prend environ 15 minutes hors restauration DB. 3) DNS et frontend statique sur Vercel/Cloudflare (multi-région edge) — non impactés en cas de panne backend. 4) Configuration Caddy reverse proxy avec TLS auto-renew, pas de single point of failure côté entrée. 5) Pas de réplication DB synchrone à ce jour (cible roadmap H1 2027) — c'est la limitation principale du RPO 24h vs un RPO 1h+. Limitations honnêtes : ces cibles sont contractuelles best-effort, pas un SLA financier remboursable. Pour un SLA contractuel garanti (avec pénalités), un contrat enterprise sur mesure est nécessaire (contact dpo@deepsightsynthesis.com). Pour la transparence : l'historique d'uptime et incidents passés est publié sur status.deepsightsynthesis.com (en cours d'activation publique).",
    answer: (
      <>
        <p>
          <strong>RTO (Recovery Time Objective)</strong> : 4 heures ouvrées —
          restauration du service.
          <br />
          <strong>RPO (Recovery Point Objective)</strong> : 24 heures de perte
          de données maximum.
        </p>
        <p>Architecture supportant ces cibles :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            Sauvegardes PostgreSQL quotidiennes vers Cloudflare R2 (UE),
            retention 30 jours
          </li>
          <li>Stack Docker reproductible — redéploiement ~15 min</li>
          <li>Frontend Vercel multi-région edge (non impacté)</li>
          <li>
            Pas de réplication DB synchrone à ce jour (roadmap H1 2027) —
            limitation principale du RPO 24h
          </li>
        </ul>
        <p>
          <strong>Limitation :</strong> ces cibles sont contractuelles
          best-effort, pas un SLA financier remboursable. Pour un SLA garanti
          avec pénalités, contrat enterprise sur mesure (
          <a
            href={`mailto:${DPO_EMAIL}`}
            className="text-accent-primary hover:underline"
          >
            {DPO_EMAIL}
          </a>
          ). Historique uptime publié sur{" "}
          <ExtLink href={STATUS_URL}>status.deepsightsynthesis.com</ExtLink>.
        </p>
      </>
    ),
  },
  {
    id: 9,
    category: "sectoriel",
    question:
      "Comment gérez-vous une demande d'audit (banque, assureur, auditeur tiers) ?",
    answerText:
      "Trois niveaux de réponse selon le type d'audit demandé : 1) Audit documentaire — réponse à un questionnaire ICT/TPRM (typique RFP banque/assurance) : SLA 5 jours ouvrés à réception, sans frais. 2) Audit sur pièces — fourniture des artefacts spécifiques (extraits de logs, configurations, captures d'évidence, attestation conformité interne) : SLA 10 jours ouvrés, sans frais pour les clients sous DPA. 3) Audit sur site / pentest white-box — accès aux systèmes pour audit indépendant : possible sur contrat, frais répercutés au client (temps homme de coordination + éventuels coûts d'isolation environnement test), préavis 30 jours, NDA bilatéral préalable. La liste des artefacts disponibles inclut : registre des traitements (Art 30 RGPD), DPIA si pertinent, registre sous-traitants, journal d'incidents 24 derniers mois, configuration TLS et Caddy, schéma réseau, politique gestion des accès, plan de continuité. Pour les clients particulièrement régulés (banque catégorie systémique, assurance vie, opérateur énergie), une clause d'audit standardisée peut être ajoutée au DPA — précisant nombre maximum d'audits par an (typiquement 1), périmètre (sécurité technique, conformité RGPD, ou les deux), confidentialité, partage des conclusions. Limitation : aucun audit ISO 27001 ou SOC 2 indépendant disponible à ce jour (audit ISO 27001 visé Q4 2026, SOC 2 Type II visé Q2 2027).",
    answer: (
      <>
        <p>Trois niveaux de réponse selon le type d'audit :</p>
        <ol className="list-decimal list-inside ml-2 space-y-1">
          <li>
            <strong>Audit documentaire</strong> (questionnaire ICT/TPRM) — SLA
            5 jours ouvrés, sans frais
          </li>
          <li>
            <strong>Audit sur pièces</strong> (logs, configs, attestations) —
            SLA 10 jours ouvrés, sans frais pour clients sous DPA
          </li>
          <li>
            <strong>Audit sur site / pentest white-box</strong> — sur contrat,
            frais coordination répercutés, préavis 30 jours, NDA bilatéral
          </li>
        </ol>
        <p>Artefacts disponibles :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Registre des traitements (Art 30 RGPD), DPIA si pertinent</li>
          <li>Registre sous-traitants, journal d'incidents 24 mois</li>
          <li>Configuration TLS/Caddy, schéma réseau, gestion des accès</li>
          <li>Plan de continuité</li>
        </ul>
        <p>
          Clause d'audit standardisée disponible au DPA pour clients fortement
          régulés (1 audit/an, périmètre, confidentialité). Audit ISO 27001
          visé Q4 2026, SOC 2 Type II visé Q2 2027.
        </p>
      </>
    ),
  },

  // ─── ARCHITECTURE TECHNIQUE ─────────────────────────────────────────────────
  {
    id: 10,
    category: "architecture",
    question:
      "Où sont stockées exactement mes données, et qui peut y accéder physiquement ?",
    answerText:
      "Localisation physique précise : datacenter Hetzner Falkenstein, Saxe (Allemagne). C'est l'un des datacenters européens majeurs, certifié ISO 27001 par Hetzner Online GmbH (vous pouvez consulter leur certificat sur hetzner.com/legal). Toutes les données utilisateur identifiables (comptes, analyses, historique chat, messages débats) résident dans PostgreSQL 17 et Redis 7 hébergés dans ce datacenter. Aucune donnée ne traverse la frontière EEE pour le stockage primaire. Trois exceptions techniques : 1) Les transcripts vidéo extraits via Supadata transitent brièvement par leur infrastructure (EU et US selon endpoints) puis sont retournés vers Hetzner — aucune persistance Supadata côté nominatif (vidéo publique YouTube/TikTok uniquement, pas de PII utilisateur). 2) Les paiements transitent par Stripe Payments Europe (Irlande, EEE) — données carte tokenisées, jamais reçues côté backend. 3) Les exports compressés (PDF, archives DOCX) sont stockés temporairement sur Cloudflare R2 (région UE) avec TTL 24h. Accès physique : seul le personnel Hetzner habilité ISO 27001 a accès physique aux serveurs. Aucun accès direct disque par Maxime Leparc (administration via SSH chiffré uniquement, jamais accès console hardware). Les disques sont chiffrés au repos via LUKS — un disque exfiltré sans la clé est inutilisable.",
    answer: (
      <>
        <p>
          <strong>Localisation physique précise :</strong> datacenter Hetzner
          Falkenstein, Saxe (Allemagne). Hetzner Online GmbH est certifié ISO
          27001.
        </p>
        <p>Données primaires (PostgreSQL 17 + Redis 7) :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Comptes, analyses, historique chat, messages débats</li>
          <li>Aucune donnée ne traverse la frontière EEE</li>
        </ul>
        <p>Exceptions techniques :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            Transcripts vidéo via Supadata (EU/US selon endpoints) — pas de
            persistance, vidéo publique uniquement
          </li>
          <li>Stripe Payments Europe (Irlande, EEE) — cartes tokenisées</li>
          <li>Exports temporaires Cloudflare R2 (UE) — TTL 24h</li>
        </ul>
        <p>
          <strong>Accès physique :</strong> seul personnel Hetzner habilité ISO
          27001. Administration via SSH chiffré uniquement, jamais console
          hardware. Disques chiffrés LUKS au repos — disque exfiltré sans clé
          inutilisable.
        </p>
      </>
    ),
  },
  {
    id: 11,
    category: "architecture",
    question:
      "Quel chiffrement est appliqué aux données, en transit et au repos ?",
    answerText:
      "Chiffrement en transit : TLS 1.3 exclusif sur tous les endpoints publics. Implémentation via Caddy reverse proxy avec auto-SSL Let's Encrypt (renouvellement automatique 60 jours). HSTS strict avec preload activé, max-age 1 an. Pas de support TLS 1.0/1.1 (déprécié). Cipher suites modernes uniquement : ChaCha20-Poly1305, AES-256-GCM, AES-128-GCM. Pour les communications interservices (backend ↔ Postgres ↔ Redis), réseau Docker isolé `repo_deepsight` non exposé publiquement — chiffrement interne non requis car pas de surface attaque réseau (mais activable sur demande contractuelle). Chiffrement au repos : 1) PostgreSQL 17 stocké sur disque chiffré LUKS (full disk encryption Hetzner). 2) Backups PostgreSQL exportés chiffrés AES-256 avant upload vers Cloudflare R2. 3) Transcripts vidéo cachés en base sont en clair en DB (donnée publique YouTube de toute façon) mais sur disque chiffré. 4) Tokens JWT et secrets API ne sont jamais stockés en clair en DB — hashés avec Argon2id pour les mots de passe utilisateur, en mémoire uniquement pour les tokens éphémères. Limitations honnêtes : pas de chiffrement applicatif end-to-end (les analyses ne sont pas E2E encrypted entre l'utilisateur et l'IA, car l'IA doit lire le contenu pour le traiter — c'est une contrainte intrinsèque à toute analyse IA). Pour des cas d'usage exigeant le E2E (données ultra-sensibles), Deep Sight n'est pas la solution adaptée.",
    answer: (
      <>
        <p>
          <strong>En transit :</strong> TLS 1.3 exclusif (Caddy + auto-SSL
          Let's Encrypt). HSTS preload, max-age 1 an. Cipher suites modernes
          uniquement (ChaCha20-Poly1305, AES-256-GCM, AES-128-GCM).
        </p>
        <p>
          <strong>Inter-services :</strong> réseau Docker isolé{" "}
          <code className="text-xs bg-white/10 px-1 rounded">
            repo_deepsight
          </code>{" "}
          non exposé. Chiffrement interne activable sur demande contractuelle.
        </p>
        <p>
          <strong>Au repos :</strong>
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>PostgreSQL 17 sur LUKS full disk encryption</li>
          <li>Backups chiffrés AES-256 avant upload Cloudflare R2</li>
          <li>Mots de passe hashés Argon2id, jamais en clair</li>
          <li>Secrets API en mémoire uniquement pour tokens éphémères</li>
        </ul>
        <p>
          <strong>Limitation :</strong> pas de chiffrement applicatif
          end-to-end — l'IA doit lire le contenu pour le traiter (contrainte
          intrinsèque à toute analyse IA). Pour des cas exigeant E2E, le
          produit n'est pas adapté.
        </p>
      </>
    ),
  },
  {
    id: 12,
    category: "architecture",
    question:
      "Que se passe-t-il exactement si je supprime mon compte ? Quelles données restent ?",
    answerText:
      "La suppression de compte (déclenchée depuis le portail utilisateur ou par email à dpo@deepsightsynthesis.com) déclenche une suppression hard sous 30 jours conformément à l'Art 17 RGPD. Le détail technique : 1) Suppression immédiate (T+0) : votre profil est désactivé, sessions invalidées, accès API révoqué. Vous ne pouvez plus vous connecter. 2) Suppression différée (T+30 jours) : un job nightly purge définitivement votre user record, vos analyses, historique chat, débats, messages, flashcards, quotas, transactions Stripe (anonymisation). Cette fenêtre 30 jours permet : récupération en cas de demande accidentelle (Art 17.3 RGPD permet exceptions), audit-trail compliance, finalisation paiements en cours. 3) Données qui restent au-delà : a) Logs serveur 30 jours (rotation automatique), b) Transactions Stripe pour obligations comptables 10 ans (juridiction française, mais sans PII identifiables — facture anonymisée), c) Backups DB jusqu'à 30 jours (rotation automatique). 4) Sous-traitants notifiés : Resend (suppression contact email), Stripe (anonymisation client), Sentry (purge stack traces où applicable). Une attestation de suppression est envoyée par email à confirmation. Pour la portabilité préalable (Art 20), un export complet de vos données en JSON est fournissable sous 5 jours ouvrés sur simple demande avant la suppression.",
    answer: (
      <>
        <p>
          Suppression hard sous <strong>30 jours</strong> conformément à l'Art
          17 RGPD.
        </p>
        <p>Détail technique :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            <strong>T+0</strong> : profil désactivé, sessions invalidées, accès
            API révoqué
          </li>
          <li>
            <strong>T+30 jours</strong> : purge définitive (user, analyses,
            chat, débats, flashcards, quotas)
          </li>
          <li>
            Fenêtre 30 jours = récupération si demande accidentelle (Art 17.3),
            audit-trail, finalisation paiements
          </li>
        </ul>
        <p>Données qui restent au-delà :</p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Logs serveur 30 jours (rotation auto)</li>
          <li>
            Factures Stripe anonymisées 10 ans (obligation comptable française)
          </li>
          <li>Backups DB jusqu'à 30 jours</li>
        </ul>
        <p>
          Sous-traitants notifiés (Resend, Stripe, Sentry). Attestation de
          suppression envoyée par email. Export portabilité (Art 20) fournissable
          sous 5 jours ouvrés avant suppression.
        </p>
      </>
    ),
  },
  {
    id: 13,
    category: "architecture",
    question:
      "Comment sont organisés les backups et quelle est la politique de rétention ?",
    answerText:
      "Stratégie 3-2-1 partielle adaptée au volume actuel : 1) Backup primaire : dump PostgreSQL nightly (cron 03h UTC), uploadé vers Cloudflare R2 bucket dédié région UE, chiffré AES-256 avant upload, retention 30 jours rolling avec rotation automatique. Vérification d'intégrité : restore-test hebdomadaire vers une instance temporaire qui valide cohérence schema + comptage de tables. 2) Backup secondaire : snapshots Hetzner du volume disque hebdomadaire, retention 7 jours, hébergés dans le même datacenter (résilience hardware mais pas désastre site). 3) Pas de réplication temps-réel ni de standby chaud actuellement (limite RPO 24h documentée, roadmap H1 2027 pour standby PostgreSQL streaming). Procédure de restore documentée dans le runbook interne docs/RUNBOOK.md (privé) : RTO cible 4h, RPO cible 24h. Test de restore complet à blanc effectué tous les trimestres pour valider la procédure. Limitations : 1) Pas de backup geo-redundant hors EEE (par choix de souveraineté — un backup vers une autre région EEE serait possible sur demande contractuelle). 2) Pas de versioning long-terme (au-delà de 30 jours, point-in-time recovery impossible). 3) Pas de chiffrement par-tenant (les backups sont chiffrés globalement, pas par utilisateur — pas de risque mais à mentionner). Sur demande contractuelle B2B, retention étendue (90 jours, 1 an) et backup secondaire geo-redundant EEE peuvent être ajoutés en option payante.",
    answer: (
      <>
        <p>
          Stratégie 3-2-1 partielle adaptée au volume actuel :
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            <strong>Primaire</strong> : dump PostgreSQL nightly (03h UTC) →
            Cloudflare R2 UE, AES-256, retention 30 jours rolling
          </li>
          <li>
            <strong>Secondaire</strong> : snapshots Hetzner hebdomadaires,
            retention 7 jours
          </li>
          <li>
            Vérification : restore-test hebdomadaire (schema + comptage tables)
          </li>
          <li>Test restore complet à blanc trimestriel</li>
        </ul>
        <p>
          <strong>Limitations honnêtes :</strong>
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>
            Pas de backup geo-redundant hors EEE (souveraineté assumée)
          </li>
          <li>Pas de point-in-time recovery au-delà de 30 jours</li>
          <li>
            Pas de réplication temps-réel (RPO 24h documenté, roadmap H1 2027)
          </li>
        </ul>
        <p>
          Sur demande B2B : retention étendue (90 jours, 1 an) + backup
          geo-redundant EEE en option contractuelle.
        </p>
      </>
    ),
  },

  // ─── AI ACT ─────────────────────────────────────────────────────────────────
  {
    id: 14,
    category: "ai-act",
    question:
      "Êtes-vous classé système d'IA à haut risque selon l'Annexe III du AI Act ?",
    answerText:
      "Non. Le produit n'est pas un système d'IA à haut risque au sens de l'Annexe III du Règlement (UE) 2024/1689 (AI Act). Justification détaillée : l'Annexe III liste 8 catégories de systèmes haut risque — biométrie, infrastructures critiques, éducation/formation professionnelle (admission/évaluation), emploi (recrutement/évaluation), accès aux services essentiels (crédit, prestations sociales), forces de l'ordre, gestion migration/asile/contrôle frontières, administration justice/processus démocratiques. L'usage produit (analyse et synthèse de contenus vidéo publics YouTube/TikTok pour comprendre, étudier, débattre) ne tombe dans aucune de ces catégories. Le produit est donc classé Système d'IA à risque limité (Art 50 AI Act) — obligations applicables : 1) Transparence : indiquer clairement que le contenu est généré par IA. 2) Marquage : badge Analyse IA visible sur chaque sortie générée (analyse, synthèse, chat, débat). 3) Information utilisateur : modèles utilisés (Mistral small/medium/large) documentés publiquement. Important : si vous-même utilisez le produit dans un contexte qui le rendrait haut risque (ex : sélection automatique de candidats sur la base d'analyses de leurs vidéos publiques sans intervention humaine effective), c'est votre usage qui devient haut risque, pas le produit en tant qu'outil — vous devenez le déployeur Art 26 AI Act et vos obligations sont alors significatives. Pour ces cas d'usage, contacter dpo@deepsightsynthesis.com — un cas d'usage à haut risque peut nécessiter une analyse d'impact, une supervision humaine documentée et une notice transparence renforcée de votre côté.",
    answer: (
      <>
        <p>
          <strong>Non.</strong> Le produit n'est pas un système d'IA à haut
          risque au sens de l'Annexe III du{" "}
          <ExtLink href={AI_ACT_URL}>Règlement (UE) 2024/1689</ExtLink>.
        </p>
        <p>
          L'Annexe III liste 8 catégories haut risque (biométrie,
          infrastructures critiques, éducation, emploi, services essentiels,
          forces de l'ordre, migration, justice). L'analyse de vidéos publiques
          YouTube/TikTok ne tombe dans aucune.
        </p>
        <p>
          Classement réel :{" "}
          <strong>Système d'IA à risque limité (Art 50)</strong>. Obligations
          applicables :
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Indication claire de génération par IA</li>
          <li>Badge Analyse IA visible sur chaque sortie générée</li>
          <li>Modèles utilisés documentés publiquement (Mistral)</li>
        </ul>
        <p>
          <strong>Important :</strong> si <em>vous-même</em> utilisez le produit
          dans un contexte qui le rendrait haut risque (sélection automatique
          de candidats, scoring sans intervention humaine, etc.), votre usage
          devient haut risque (déployeur Art 26). Contactez{" "}
          <a
            href={`mailto:${DPO_EMAIL}`}
            className="text-accent-primary hover:underline"
          >
            {DPO_EMAIL}
          </a>{" "}
          pour analyser ce cas d'usage.
        </p>
      </>
    ),
  },
  {
    id: 15,
    category: "ai-act",
    question:
      "Quelle est la gouvernance des datasets utilisés pour le fine-tuning des modèles ?",
    answerText:
      "Le produit n'effectue aucun fine-tuning de modèles d'IA. Les modèles utilisés (Mistral small / medium / large via API officielle Mistral AI) sont des modèles pré-entraînés fournis par Mistral AI, hébergés en France région EU-West, opérés sous DPA Mistral signé. La gouvernance des datasets de pré-entraînement est sous la responsabilité de Mistral AI et documentée publiquement dans leurs cartes modèle (mistral.ai/news, papers techniques). Position contractuelle Mistral DPA invoquée : aucune utilisation des prompts ni des outputs envoyés via leur API pour le ré-entraînement de leurs modèles. Cette clause est cruciale et documentée par Mistral. Concrètement : vos analyses, chats et débats ne contribuent à aucun corpus d'entraînement, ni Mistral ni Deep Sight ni aucun tiers. Si vous demandez la portabilité (Art 20) ou l'effacement (Art 17) de vos données, l'effacement de votre côté Deep Sight est total — il n'y a aucun effet de mémorisation dans un modèle quelque part car aucun fine-tuning n'a eu lieu. À l'avenir, si un fine-tuning custom devait être proposé (par exemple, modèle fine-tuné spécifique à un secteur métier), il serait optionnel et explicitement contractualisé : 1) Datasets utilisés explicitement listés dans un DPA spécifique. 2) Consentement explicite Art 7 RGPD pour toute donnée personnelle. 3) Droit à l'oubli applicatif documenté (procédure de suppression d'instances individuelles d'un dataset, via reentrainement partiel ou unlearning). 4) Notice transparence Art 13 RGPD sur les datasets et leurs sources. À ce jour, aucun de ces sujets ne s'applique car aucun fine-tuning n'est effectué.",
    answer: (
      <>
        <p>
          <strong>Aucun fine-tuning.</strong> Le produit n'effectue aucun
          fine-tuning de modèles d'IA. Les modèles utilisés (Mistral small /
          medium / large) sont des modèles pré-entraînés fournis par Mistral
          AI, hébergés en France région EU-West, opérés sous DPA Mistral signé.
        </p>
        <p>
          <strong>Clause Mistral DPA invoquée :</strong> aucune utilisation des
          prompts ni des outputs envoyés via leur API pour le ré-entraînement
          de leurs modèles.
        </p>
        <p>
          Concrètement : vos analyses, chats et débats ne contribuent à aucun
          corpus d'entraînement, ni Mistral ni le produit ni aucun tiers. Une
          demande Art 17 RGPD résulte en effacement total — aucun effet de
          mémorisation dans un modèle.
        </p>
        <p>
          Si un fine-tuning custom était proposé à l'avenir, il serait
          optionnel, contractualisé et incluait :
        </p>
        <ul className="list-disc list-inside ml-2 space-y-1">
          <li>Datasets listés dans un DPA spécifique</li>
          <li>Consentement explicite Art 7 RGPD</li>
          <li>Droit à l'oubli applicatif documenté</li>
          <li>Notice transparence Art 13 RGPD sur sources datasets</li>
        </ul>
        <p>
          Architecture technique détaillée :{" "}
          <ExtLink href={ARCHITECTURE_REPO}>repo GitHub public</ExtLink>.
        </p>
      </>
    ),
  },
] as const;

// ═══════════════════════════════════════════════════════════════════════════════
// COMPOSANT
// ═══════════════════════════════════════════════════════════════════════════════

const TrustFAQ: React.FC = () => {
  const [expanded, setExpanded] = useState<Set<number>>(() => new Set());
  const headingPrefixId = useId();

  const toggle = (id: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const expandAll = () => setExpanded(new Set(FAQ_ITEMS.map((i) => i.id)));
  const collapseAll = () => setExpanded(new Set());

  // JSON-LD FAQPage schema (SEO + indexable même si l'accordion est replié)
  const jsonLd = useMemo(() => {
    return {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: FAQ_ITEMS.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answerText,
        },
      })),
    };
  }, []);

  // Groupement par catégorie pour le rendu
  const itemsByCategory = useMemo(() => {
    const map = new Map<FAQCategory, FAQItem[]>();
    for (const cat of CATEGORIES) {
      map.set(cat.id, FAQ_ITEMS.filter((it) => it.category === cat.id));
    }
    return map;
  }, []);

  return (
    <div>
      {/* JSON-LD pour SEO — indexable hors accordion */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Toolbar expand/collapse */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <p className="text-text-secondary text-sm max-w-2xl">
          Questions fréquentes des décideurs B2B (DSI, DPO, CISO, Compliance
          Officer) en environnement régulé. Pour toute question non couverte,
          contactez{" "}
          <a
            href={`mailto:${DPO_EMAIL}`}
            className="text-accent-primary hover:underline"
          >
            {DPO_EMAIL}
          </a>
          .
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={expandAll}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-primary border border-white/10 rounded text-xs font-medium transition-colors"
          >
            Tout déplier
          </button>
          <button
            type="button"
            onClick={collapseAll}
            disabled={expanded.size === 0}
            className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-text-primary border border-white/10 rounded text-xs font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Tout replier
          </button>
        </div>
      </div>

      {/* Sections par catégorie */}
      <div className="space-y-8">
        {CATEGORIES.map((cat) => {
          const items = itemsByCategory.get(cat.id) ?? [];
          if (items.length === 0) return null;
          const catHeadingId = `${headingPrefixId}-cat-${cat.id}`;

          return (
            <section key={cat.id} aria-labelledby={catHeadingId}>
              <header className="flex items-center gap-2 mb-3">
                <span
                  className={`p-1.5 ${cat.iconBg} rounded`}
                  aria-hidden="true"
                >
                  <span className={cat.iconColor}>{cat.icon}</span>
                </span>
                <h3
                  id={catHeadingId}
                  className="text-sm font-medium uppercase tracking-wider text-text-secondary"
                >
                  {cat.label}
                </h3>
                <span className="text-xs text-text-muted ml-1">
                  ({items.length})
                </span>
              </header>

              <div className="space-y-2">
                {items.map((item) => {
                  const isOpen = expanded.has(item.id);
                  const buttonId = `${headingPrefixId}-q-${item.id}`;
                  const panelId = `${headingPrefixId}-p-${item.id}`;

                  return (
                    <div
                      key={item.id}
                      className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/20"
                    >
                      <h4>
                        <button
                          type="button"
                          id={buttonId}
                          aria-expanded={isOpen}
                          aria-controls={panelId}
                          onClick={() => toggle(item.id)}
                          className="w-full flex items-start justify-between gap-4 text-left px-5 py-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg-primary"
                        >
                          <span className="flex items-baseline gap-3 flex-1 min-w-0">
                            <span className="text-text-muted text-xs font-mono flex-shrink-0">
                              {item.id.toString().padStart(2, "0")}
                            </span>
                            <span className="text-white font-medium text-sm sm:text-base leading-snug">
                              {item.question}
                            </span>
                          </span>
                          <motion.span
                            animate={{ rotate: isOpen ? 180 : 0 }}
                            transition={{
                              duration: 0.2,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                            className="text-text-muted flex-shrink-0 mt-0.5"
                            aria-hidden="true"
                          >
                            <ChevronDown className="w-5 h-5" />
                          </motion.span>
                        </button>
                      </h4>

                      <AnimatePresence initial={false}>
                        {isOpen && (
                          <motion.div
                            id={panelId}
                            role="region"
                            aria-labelledby={buttonId}
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{
                              duration: 0.25,
                              ease: [0.4, 0, 0.2, 1],
                            }}
                            className="overflow-hidden"
                          >
                            <div className="px-5 pb-5 pt-1 border-t border-white/5">
                              <div className="text-sm text-text-secondary leading-relaxed space-y-3 [&_p]:m-0 [&_ul]:m-0 [&_ol]:m-0">
                                {item.answer}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

export default TrustFAQ;
