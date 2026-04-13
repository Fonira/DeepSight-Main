/**
 * 📜 LEGAL PAGE — Mentions légales, CGU, Politique de confidentialité
 * ═══════════════════════════════════════════════════════════════════════════════
 * Conforme RGPD et législation française
 * Dernière mise à jour : Janvier 2026
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Scale,
  Shield,
  FileText,
  Mail,
  Phone,
  Building,
  Server,
  Lock,
  Eye,
  Trash2,
  AlertCircle,
  CreditCard,
  RefreshCw,
  Users,
  BookOpen,
} from "lucide-react";
import { Sidebar } from "../components/layout/Sidebar";
import DoodleBackground from "../components/DoodleBackground";
import { SEO } from "../components/SEO";

// ═══════════════════════════════════════════════════════════════════════════════
// 📋 DONNÉES LÉGALES
// ═══════════════════════════════════════════════════════════════════════════════

const LEGAL_INFO = {
  // Éditeur
  company: {
    name: "Maxime Leparc",
    tradeName: "Deep Sight",
    type: "Entrepreneur Individuel",
    siret: "994 558 898 00015",
    activity: "Portails Internet",
    activityCode: "6312Z",
    address: "15 rue Clément Mulat",
    postalCode: "69350",
    city: "La Mulatière",
    country: "France",
  },
  contact: {
    email: "maximeleparc3@gmail.com",
    phone: "06 67 42 57 92",
  },
  publication: {
    director: "Maxime Leparc",
  },
  hosting: {
    frontend: {
      name: "Vercel Inc.",
      address: "340 S Lemon Ave #4133, Walnut, CA 91789, USA",
      website: "https://vercel.com",
    },
    backend: {
      name: "Hetzner Online GmbH",
      address: "Industriestr. 25, 91710 Gunzenhausen, Allemagne",
      website: "https://www.hetzner.com",
    },
  },
  dpo: {
    name: "Maxime Leparc",
    email: "maximeleparc3@gmail.com",
  },
  website: {
    url: "https://www.deepsightsynthesis.com",
    name: "Deep Sight",
  },
  vat: {
    status: "TVA non applicable, article 293 B du CGI",
  },
  lastUpdate: "8 janvier 2026",
};

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 COMPOSANTS
// ═══════════════════════════════════════════════════════════════════════════════

type TabType = "mentions" | "cgu" | "privacy" | "cookies";

interface TabConfig {
  id: TabType;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabConfig[] = [
  {
    id: "mentions",
    label: "Mentions légales",
    icon: <Scale className="w-4 h-4" />,
  },
  { id: "cgu", label: "CGU / CGV", icon: <FileText className="w-4 h-4" /> },
  {
    id: "privacy",
    label: "Confidentialité",
    icon: <Shield className="w-4 h-4" />,
  },
  { id: "cookies", label: "Cookies", icon: <Eye className="w-4 h-4" /> },
];

// ═══════════════════════════════════════════════════════════════════════════════
// 📄 MENTIONS LÉGALES
// ═══════════════════════════════════════════════════════════════════════════════

const MentionsLegales: React.FC = () => (
  <div className="space-y-8">
    <header>
      <h2 className="text-2xl font-bold text-white mb-2">Mentions Légales</h2>
      <p className="text-white/60">
        Conformément à la loi n°2004-575 du 21 juin 2004 pour la confiance dans
        l'économie numérique
      </p>
    </header>

    {/* Éditeur */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Building className="w-5 h-5 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Éditeur du site</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-4 text-white/80">
        <div className="space-y-2">
          <p>
            <span className="text-white/50">Nom commercial :</span>{" "}
            {LEGAL_INFO.company.tradeName}
          </p>
          <p>
            <span className="text-white/50">Exploitant :</span>{" "}
            {LEGAL_INFO.company.name}
          </p>
          <p>
            <span className="text-white/50">Statut :</span>{" "}
            {LEGAL_INFO.company.type}
          </p>
          <p>
            <span className="text-white/50">SIRET :</span>{" "}
            {LEGAL_INFO.company.siret}
          </p>
        </div>
        <div className="space-y-2">
          <p>
            <span className="text-white/50">Activité :</span>{" "}
            {LEGAL_INFO.company.activity} ({LEGAL_INFO.company.activityCode})
          </p>
          <p>
            <span className="text-white/50">Adresse :</span>{" "}
            {LEGAL_INFO.company.address}, {LEGAL_INFO.company.postalCode}{" "}
            {LEGAL_INFO.company.city}
          </p>
          <p>
            <span className="text-white/50">TVA :</span> {LEGAL_INFO.vat.status}
          </p>
        </div>
      </div>
    </section>

    {/* Contact */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Mail className="w-5 h-5 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Contact</h3>
      </div>
      <div className="flex flex-wrap gap-6 text-white/80">
        <a
          href={`mailto:${LEGAL_INFO.contact.email}`}
          className="flex items-center gap-2 hover:text-amber-400 transition-colors"
        >
          <Mail className="w-4 h-4" />
          {LEGAL_INFO.contact.email}
        </a>
        <a
          href={`tel:${LEGAL_INFO.contact.phone.replace(/\s/g, "")}`}
          className="flex items-center gap-2 hover:text-amber-400 transition-colors"
        >
          <Phone className="w-4 h-4" />
          {LEGAL_INFO.contact.phone}
        </a>
      </div>
    </section>

    {/* Directeur de publication */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Users className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">
          Directeur de la publication
        </h3>
      </div>
      <p className="text-white/80">{LEGAL_INFO.publication.director}</p>
    </section>

    {/* Hébergement */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <Server className="w-5 h-5 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Hébergement</h3>
      </div>
      <div className="grid md:grid-cols-2 gap-6">
        <div className="space-y-2 text-white/80">
          <p className="text-white font-medium">Frontend (Site web)</p>
          <p>{LEGAL_INFO.hosting.frontend.name}</p>
          <p className="text-sm text-white/60">
            {LEGAL_INFO.hosting.frontend.address}
          </p>
          <a
            href={LEGAL_INFO.hosting.frontend.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline text-sm"
          >
            {LEGAL_INFO.hosting.frontend.website}
          </a>
        </div>
        <div className="space-y-2 text-white/80">
          <p className="text-white font-medium">Backend (API & données)</p>
          <p>{LEGAL_INFO.hosting.backend.name}</p>
          <p className="text-sm text-white/60">
            {LEGAL_INFO.hosting.backend.address}
          </p>
          <a
            href={LEGAL_INFO.hosting.backend.website}
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline text-sm"
          >
            {LEGAL_INFO.hosting.backend.website}
          </a>
        </div>
      </div>
      <div className="mt-4 p-3 bg-green-500/10 rounded-lg border border-green-500/20">
        <p className="text-green-200 text-sm">
          <Shield className="w-4 h-4 inline mr-2" />
          Le backend et les données utilisateur sont hébergés en Allemagne (UE)
          chez Hetzner. Le frontend est servi depuis le CDN mondial de Vercel.
          Vos données restent en Europe conformément au RGPD.
        </p>
      </div>
    </section>

    {/* Propriété intellectuelle */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-pink-500/20 rounded-lg">
          <BookOpen className="w-5 h-5 text-pink-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">
          Propriété intellectuelle
        </h3>
      </div>
      <div className="text-white/80 space-y-3">
        <p>
          L'ensemble du contenu du site {LEGAL_INFO.website.name} (textes,
          graphismes, logos, icônes, images, logiciels, base de données) est la
          propriété exclusive de {LEGAL_INFO.company.name}, à l'exception des
          contenus appartenant à d'autres partenaires.
        </p>
        <p>
          Toute reproduction, représentation, modification, publication,
          adaptation de tout ou partie des éléments du site, quel que soit le
          moyen ou le procédé utilisé, est interdite sans autorisation écrite
          préalable.
        </p>
        <p>
          Les analyses générées par le service sont la propriété de
          l'utilisateur qui les a commandées.
        </p>
      </div>
    </section>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 📜 CONDITIONS GÉNÉRALES D'UTILISATION ET DE VENTE
// ═══════════════════════════════════════════════════════════════════════════════

const CGU: React.FC = () => (
  <div className="space-y-8">
    <header>
      <h2 className="text-2xl font-bold text-white mb-2">
        Conditions Générales d'Utilisation et de Vente
      </h2>
      <p className="text-white/60">En vigueur au {LEGAL_INFO.lastUpdate}</p>
    </header>

    {/* Article 1 - Objet */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 1 — Objet
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          Les présentes Conditions Générales d'Utilisation et de Vente (ci-après
          « CGU/CGV ») ont pour objet de définir les modalités d'accès et
          d'utilisation du service <strong>{LEGAL_INFO.website.name}</strong>,
          accessible à l'adresse{" "}
          <a
            href={LEGAL_INFO.website.url}
            className="text-amber-400 hover:underline"
          >
            {LEGAL_INFO.website.url}
          </a>
          .
        </p>
        <p>
          {LEGAL_INFO.website.name} est un service d'analyse de vidéos YouTube
          et TikTok utilisant l'intelligence artificielle pour générer des
          synthèses, extraire des informations clés et permettre des
          interactions conversationnelles avec le contenu analysé.
        </p>
      </div>
    </section>

    {/* Article 2 - Acceptation */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 2 — Acceptation des conditions
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          L'utilisation du service implique l'acceptation pleine et entière des
          présentes CGU/CGV. L'utilisateur reconnaît avoir pris connaissance des
          présentes conditions et s'engage à les respecter.
        </p>
        <p>
          {LEGAL_INFO.company.name} se réserve le droit de modifier les
          présentes CGU/CGV à tout moment. Les utilisateurs seront informés de
          ces modifications par email ou notification sur le site.
        </p>
      </div>
    </section>

    {/* Article 3 - Services */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 3 — Description des services
      </h3>
      <div className="text-white/80 space-y-3">
        <p>Le service {LEGAL_INFO.website.name} propose :</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            L'analyse automatisée de vidéos YouTube (transcription, synthèse,
            catégorisation)
          </li>
          <li>
            Un assistant conversationnel (Chat IA) pour interagir avec le
            contenu analysé
          </li>
          <li>L'analyse de playlists et corpus de vidéos (selon abonnement)</li>
          <li>
            L'enrichissement des analyses via recherche web (selon abonnement)
          </li>
          <li>
            L'export des analyses en différents formats (PDF, Markdown, etc.)
          </li>
        </ul>
        <p>
          Le service utilise uniquement les sous-titres publics des vidéos
          YouTube. Aucun téléchargement de contenu audiovisuel n'est effectué.
        </p>
      </div>
    </section>

    {/* Article 4 - Inscription */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 4 — Inscription et compte utilisateur
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          L'accès au service nécessite la création d'un compte utilisateur.
          L'utilisateur peut s'inscrire :
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Via une adresse email et un mot de passe</li>
          <li>Via son compte Google (OAuth)</li>
        </ul>
        <p>
          L'utilisateur s'engage à fournir des informations exactes et à
          maintenir la confidentialité de ses identifiants de connexion. Il est
          responsable de toute activité effectuée depuis son compte.
        </p>
        <p>
          L'utilisateur doit être âgé d'au moins 16 ans pour utiliser le
          service.
        </p>
      </div>
    </section>

    {/* Article 5 - Tarifs */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <CreditCard className="w-5 h-5 text-amber-400" />
        Article 5 — Tarifs et paiement
      </h3>
      <div className="text-white/80 space-y-3">
        <p>Le service propose plusieurs formules d'abonnement :</p>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 my-4">
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <p className="font-bold text-white">Découverte</p>
            <p className="text-2xl font-bold text-amber-400">0€</p>
            <p className="text-sm text-white/60">5 analyses/mois</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <p className="font-bold text-white">Starter</p>
            <p className="text-2xl font-bold text-amber-400">
              4,99€<span className="text-sm">/mois</span>
            </p>
            <p className="text-sm text-white/60">50 analyses/mois</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <p className="font-bold text-white">Pro</p>
            <p className="text-2xl font-bold text-amber-400">
              9,99€<span className="text-sm">/mois</span>
            </p>
            <p className="text-sm text-white/60">200 analyses/mois</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg border border-white/10">
            <p className="font-bold text-white">Expert</p>
            <p className="text-2xl font-bold text-amber-400">
              14,99€<span className="text-sm">/mois</span>
            </p>
            <p className="text-sm text-white/60">Analyses illimitées</p>
          </div>
        </div>
        <p>Les prix sont indiqués en euros TTC ({LEGAL_INFO.vat.status}).</p>
        <p>
          Le paiement est effectué par carte bancaire via la plateforme
          sécurisée Stripe. Les abonnements sont renouvelés automatiquement
          chaque mois.
        </p>
      </div>
    </section>

    {/* Article 6 - Rétractation */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <RefreshCw className="w-5 h-5 text-amber-400" />
        Article 6 — Droit de rétractation
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          Conformément à l'article L221-28 du Code de la consommation, le droit
          de rétractation ne s'applique pas aux contrats de fourniture de
          contenu numérique non fourni sur un support matériel dont l'exécution
          a commencé après accord préalable exprès du consommateur.
        </p>
        <p>
          En souscrivant à un abonnement payant et en utilisant immédiatement le
          service, l'utilisateur reconnaît renoncer expressément à son droit de
          rétractation.
        </p>
        <p>
          <strong>Toutefois</strong>, l'utilisateur peut résilier son abonnement
          à tout moment depuis son espace client. La résiliation prend effet à
          la fin de la période de facturation en cours.
        </p>
      </div>
    </section>

    {/* Article 7 - Utilisation */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 7 — Règles d'utilisation
      </h3>
      <div className="text-white/80 space-y-3">
        <p>L'utilisateur s'engage à :</p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            Utiliser le service de manière loyale et conforme à sa destination
          </li>
          <li>
            Ne pas analyser de contenus illicites, haineux, diffamatoires ou
            portant atteinte aux droits d'autrui
          </li>
          <li>
            Ne pas tenter de contourner les limitations techniques du service
          </li>
          <li>
            Ne pas utiliser de moyens automatisés pour accéder au service (bots,
            scrapers)
          </li>
          <li>Ne pas revendre ou redistribuer le service sans autorisation</li>
        </ul>
        <p>
          Le non-respect de ces règles peut entraîner la suspension ou la
          résiliation du compte sans remboursement ni préavis.
        </p>
      </div>
    </section>

    {/* Article 8 - Responsabilité */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 8 — Limitation de responsabilité
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          {LEGAL_INFO.website.name} est un outil d'assistance basé sur
          l'intelligence artificielle. Les analyses générées sont fournies à
          titre informatif et ne constituent en aucun cas :
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Un avis professionnel (juridique, médical, financier, etc.)</li>
          <li>Une source d'information vérifiée et exhaustive</li>
          <li>Un substitut au visionnage des vidéos originales</li>
        </ul>
        <p>
          {LEGAL_INFO.company.name} ne saurait être tenu responsable des
          décisions prises sur la base des analyses générées par le service.
        </p>
        <p>
          Le service est fourni "en l'état". {LEGAL_INFO.company.name} ne
          garantit pas l'absence d'interruptions ou d'erreurs dans le
          fonctionnement du service.
        </p>
      </div>
    </section>

    {/* Article 9 - Résiliation */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 9 — Résiliation
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          L'utilisateur peut supprimer son compte à tout moment depuis les
          paramètres de son profil ou en contactant le support à l'adresse{" "}
          {LEGAL_INFO.contact.email}.
        </p>
        <p>
          La suppression du compte entraîne la suppression définitive de toutes
          les données associées (analyses, historique, préférences) dans un
          délai de 30 jours.
        </p>
        <p>
          {LEGAL_INFO.company.name} se réserve le droit de suspendre ou résilier
          un compte en cas de violation des présentes CGU/CGV.
        </p>
      </div>
    </section>

    {/* Article 10 - Droit applicable */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Article 10 — Droit applicable et litiges
      </h3>
      <div className="text-white/80 space-y-3">
        <p>Les présentes CGU/CGV sont régies par le droit français.</p>
        <p>
          En cas de litige, les parties s'engagent à rechercher une solution
          amiable avant toute action judiciaire. À défaut d'accord, le litige
          sera porté devant les tribunaux compétents du ressort de Lyon
          (France).
        </p>
        <p>
          Conformément à l'article L612-1 du Code de la consommation, le
          consommateur peut recourir gratuitement à un médiateur de la
          consommation en vue de la résolution amiable du litige.
        </p>
      </div>
    </section>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🔒 POLITIQUE DE CONFIDENTIALITÉ
// ═══════════════════════════════════════════════════════════════════════════════

const PrivacyPolicy: React.FC = () => (
  <div className="space-y-8">
    <header>
      <h2 className="text-2xl font-bold text-white mb-2">
        Politique de Confidentialité
      </h2>
      <p className="text-white/60">
        Conforme au Règlement Général sur la Protection des Données (RGPD) — En
        vigueur au {LEGAL_INFO.lastUpdate}
      </p>
    </header>

    {/* Introduction */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">Introduction</h3>
      <div className="text-white/80 space-y-3">
        <p>
          {LEGAL_INFO.company.name}, exploitant le service{" "}
          {LEGAL_INFO.website.name}, s'engage à protéger la vie privée des
          utilisateurs de son service. La présente politique de confidentialité
          décrit les données collectées, leur utilisation et les droits dont
          vous disposez.
        </p>
        <p>
          <strong>Responsable du traitement :</strong>
          <br />
          {LEGAL_INFO.company.name}
          <br />
          {LEGAL_INFO.company.address}, {LEGAL_INFO.company.postalCode}{" "}
          {LEGAL_INFO.company.city}
          <br />
          Email : {LEGAL_INFO.dpo.email}
        </p>
      </div>
    </section>

    {/* Données collectées */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-blue-500/20 rounded-lg">
          <Eye className="w-5 h-5 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Données collectées</h3>
      </div>
      <div className="text-white/80 space-y-4">
        <div>
          <p className="font-medium text-white mb-2">Données d'inscription :</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Adresse email</li>
            <li>Nom d'utilisateur (optionnel)</li>
            <li>Photo de profil (si connexion Google)</li>
            <li>Mot de passe (hashé, jamais stocké en clair)</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-white mb-2">Données d'utilisation :</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Historique des analyses effectuées</li>
            <li>Conversations avec le Chat IA</li>
            <li>Préférences utilisateur (langue, thème, modèle IA)</li>
            <li>Données de facturation (gérées par Stripe)</li>
          </ul>
        </div>
        <div>
          <p className="font-medium text-white mb-2">Données techniques :</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Adresse IP</li>
            <li>Type de navigateur et appareil</li>
            <li>Pages visitées et actions effectuées</li>
            <li>Cookies techniques (voir section Cookies)</li>
          </ul>
        </div>
      </div>
    </section>

    {/* Finalités */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-green-500/20 rounded-lg">
          <FileText className="w-5 h-5 text-green-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">
          Finalités et bases légales
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-white/80 text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-white">Finalité</th>
              <th className="text-left py-3 px-4 text-white">Base légale</th>
              <th className="text-left py-3 px-4 text-white">Durée</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <tr>
              <td className="py-3 px-4">Gestion du compte utilisateur</td>
              <td className="py-3 px-4">Exécution du contrat</td>
              <td className="py-3 px-4">Durée du compte + 1 an</td>
            </tr>
            <tr>
              <td className="py-3 px-4">Fourniture du service d'analyse</td>
              <td className="py-3 px-4">Exécution du contrat</td>
              <td className="py-3 px-4">Durée du compte</td>
            </tr>
            <tr>
              <td className="py-3 px-4">Facturation et paiement</td>
              <td className="py-3 px-4">Obligation légale</td>
              <td className="py-3 px-4">10 ans (comptabilité)</td>
            </tr>
            <tr>
              <td className="py-3 px-4">Amélioration du service</td>
              <td className="py-3 px-4">Intérêt légitime</td>
              <td className="py-3 px-4">26 mois</td>
            </tr>
            <tr>
              <td className="py-3 px-4">Communications marketing</td>
              <td className="py-3 px-4">Consentement</td>
              <td className="py-3 px-4">Jusqu'au retrait</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    {/* Partage des données */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-purple-500/20 rounded-lg">
          <Users className="w-5 h-5 text-purple-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">
          Partage des données
        </h3>
      </div>
      <div className="text-white/80 space-y-3">
        <p>
          Vos données peuvent être partagées avec les prestataires suivants :
        </p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="bg-white/5 p-4 rounded-lg">
            <p className="font-medium text-white">Stripe (Paiement)</p>
            <p className="text-sm text-white/60">Données bancaires — USA</p>
            <p className="text-xs text-amber-400">
              Clauses contractuelles types
            </p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <p className="font-medium text-white">Mistral AI (Analyse IA)</p>
            <p className="text-sm text-white/60">Contenus analysés — France</p>
            <p className="text-xs text-green-400">Hébergé en UE</p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <p className="font-medium text-white">
              Perplexity (Enrichissement)
            </p>
            <p className="text-sm text-white/60">Requêtes de recherche — USA</p>
            <p className="text-xs text-amber-400">
              Clauses contractuelles types
            </p>
          </div>
          <div className="bg-white/5 p-4 rounded-lg">
            <p className="font-medium text-white">Google (OAuth)</p>
            <p className="text-sm text-white/60">Authentification — USA</p>
            <p className="text-xs text-amber-400">
              Clauses contractuelles types
            </p>
          </div>
        </div>
        <p className="mt-4">
          Nous ne vendons jamais vos données personnelles à des tiers.
        </p>
      </div>
    </section>

    {/* Droits des utilisateurs */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-amber-500/20 rounded-lg">
          <Shield className="w-5 h-5 text-amber-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">Vos droits</h3>
      </div>
      <div className="text-white/80 space-y-3">
        <p>Conformément au RGPD, vous disposez des droits suivants :</p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          <div className="flex items-start gap-3">
            <Eye className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-white">Droit d'accès</p>
              <p className="text-sm">Obtenir une copie de vos données</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <FileText className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-white">Droit de rectification</p>
              <p className="text-sm">Corriger vos données inexactes</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Trash2 className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-white">Droit à l'effacement</p>
              <p className="text-sm">Supprimer vos données</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <Lock className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-white">Droit à la limitation</p>
              <p className="text-sm">Restreindre le traitement</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <RefreshCw className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-white">Droit à la portabilité</p>
              <p className="text-sm">Récupérer vos données</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5" />
            <div>
              <p className="font-medium text-white">Droit d'opposition</p>
              <p className="text-sm">Vous opposer au traitement</p>
            </div>
          </div>
        </div>
        <div className="mt-6 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <p className="text-amber-200">
            <strong>Pour exercer vos droits :</strong> Contactez-nous à{" "}
            <a href={`mailto:${LEGAL_INFO.dpo.email}`} className="underline">
              {LEGAL_INFO.dpo.email}
            </a>{" "}
            en précisant votre demande. Nous répondrons dans un délai d'un mois.
          </p>
        </div>
        <p className="mt-4">
          Vous pouvez également introduire une réclamation auprès de la CNIL :{" "}
          <a
            href="https://www.cnil.fr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-amber-400 hover:underline"
          >
            www.cnil.fr
          </a>
        </p>
      </div>
    </section>

    {/* Sécurité */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <div className="flex items-center gap-3 mb-4">
        <div className="p-2 bg-red-500/20 rounded-lg">
          <Lock className="w-5 h-5 text-red-400" />
        </div>
        <h3 className="text-lg font-semibold text-white">
          Sécurité des données
        </h3>
      </div>
      <div className="text-white/80 space-y-3">
        <p>
          Nous mettons en œuvre les mesures suivantes pour protéger vos données
          :
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Chiffrement des données en transit (HTTPS/TLS)</li>
          <li>Chiffrement des mots de passe (bcrypt)</li>
          <li>Authentification par tokens JWT</li>
          <li>Rate limiting contre les attaques par force brute</li>
          <li>Sauvegardes régulières de la base de données</li>
          <li>Accès restreint aux données (principe du moindre privilège)</li>
        </ul>
      </div>
    </section>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🍪 POLITIQUE DE COOKIES
// ═══════════════════════════════════════════════════════════════════════════════

const CookiesPolicy: React.FC = () => (
  <div className="space-y-8">
    <header>
      <h2 className="text-2xl font-bold text-white mb-2">
        Politique de Cookies
      </h2>
      <p className="text-white/60">En vigueur au {LEGAL_INFO.lastUpdate}</p>
    </header>

    {/* Qu'est-ce qu'un cookie */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Qu'est-ce qu'un cookie ?
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          Un cookie est un petit fichier texte déposé sur votre appareil
          (ordinateur, tablette, smartphone) lors de votre visite sur un site
          web. Il permet au site de mémoriser vos actions et préférences pendant
          une durée déterminée.
        </p>
      </div>
    </section>

    {/* Cookies utilisés */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Cookies utilisés par {LEGAL_INFO.website.name}
      </h3>
      <div className="text-white/80 space-y-4">
        <div className="bg-green-500/10 p-4 rounded-lg border border-green-500/20">
          <p className="font-medium text-green-400 mb-2">
            ✅ Cookies strictement nécessaires (toujours actifs)
          </p>
          <p className="text-sm mb-3">
            Ces cookies sont indispensables au fonctionnement du site.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left py-2 px-3">Nom</th>
                  <th className="text-left py-2 px-3">Finalité</th>
                  <th className="text-left py-2 px-3">Durée</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 px-3 font-mono text-xs">access_token</td>
                  <td className="py-2 px-3">Authentification utilisateur</td>
                  <td className="py-2 px-3">24 heures</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-xs">refresh_token</td>
                  <td className="py-2 px-3">Renouvellement de session</td>
                  <td className="py-2 px-3">7 jours</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-xs">theme</td>
                  <td className="py-2 px-3">Préférence de thème (jour/nuit)</td>
                  <td className="py-2 px-3">1 an</td>
                </tr>
                <tr>
                  <td className="py-2 px-3 font-mono text-xs">lang</td>
                  <td className="py-2 px-3">Préférence de langue</td>
                  <td className="py-2 px-3">1 an</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/20">
          <p className="font-medium text-blue-400 mb-2">
            📊 Cookies analytiques (optionnels)
          </p>
          <p className="text-sm mb-3">
            Ces cookies nous aident à comprendre comment les visiteurs utilisent
            le site.
          </p>
          <p className="text-sm text-white/60">
            Actuellement, {LEGAL_INFO.website.name} n'utilise pas de cookies
            analytiques tiers (Google Analytics, etc.). Si cela change, cette
            politique sera mise à jour.
          </p>
        </div>

        <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/20">
          <p className="font-medium text-purple-400 mb-2">
            🎯 Cookies publicitaires
          </p>
          <p className="text-sm text-white/60">
            {LEGAL_INFO.website.name} n'utilise aucun cookie publicitaire ni de
            tracking marketing.
          </p>
        </div>
      </div>
    </section>

    {/* Gestion des cookies */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Gestion de vos préférences
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          Vous pouvez à tout moment gérer vos préférences en matière de cookies
          :
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>
            <strong>Via votre navigateur :</strong> Chaque navigateur propose
            des options pour accepter, refuser ou supprimer les cookies.
            Consultez l'aide de votre navigateur.
          </li>
          <li>
            <strong>Via les paramètres du site :</strong> Les préférences de
            thème et de langue sont modifiables dans les paramètres de votre
            compte.
          </li>
        </ul>
        <div className="mt-4 p-4 bg-amber-500/10 rounded-lg border border-amber-500/20">
          <p className="text-amber-200">
            <AlertCircle className="w-4 h-4 inline mr-2" />
            <strong>Note :</strong> La suppression des cookies
            d'authentification vous déconnectera du service.
          </p>
        </div>
      </div>
    </section>

    {/* LocalStorage */}
    <section className="bg-white/5 rounded-xl p-6 border border-white/10">
      <h3 className="text-lg font-semibold text-white mb-4">
        Stockage local (LocalStorage)
      </h3>
      <div className="text-white/80 space-y-3">
        <p>
          En plus des cookies, {LEGAL_INFO.website.name} utilise le stockage
          local de votre navigateur (LocalStorage) pour mémoriser :
        </p>
        <ul className="list-disc list-inside space-y-2 ml-4">
          <li>Vos tokens d'authentification</li>
          <li>Vos informations de profil (pour affichage rapide)</li>
          <li>Vos préférences d'interface</li>
        </ul>
        <p>
          Ces données sont stockées uniquement sur votre appareil et ne sont pas
          transmises à des tiers.
        </p>
      </div>
    </section>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════════
// 🎨 PAGE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════════

const LegalPage: React.FC = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<TabType>("mentions");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Gérer le hash dans l'URL pour naviguer directement à une section
  useEffect(() => {
    const hash = location.hash.replace("#", "") as TabType;
    if (hash && ["mentions", "cgu", "privacy", "cookies"].includes(hash)) {
      setActiveTab(hash);
    }
  }, [location.hash]);

  const renderContent = () => {
    switch (activeTab) {
      case "mentions":
        return <MentionsLegales />;
      case "cgu":
        return <CGU />;
      case "privacy":
        return <PrivacyPolicy />;
      case "cookies":
        return <CookiesPolicy />;
      default:
        return <MentionsLegales />;
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary relative">
      <SEO
        title="Mentions légales"
        description="Mentions légales, conditions générales d'utilisation et politique de confidentialité de DeepSight."
        path="/legal"
        keywords="DeepSight, mentions légales, CGU, RGPD, confidentialité, données personnelles"
      />
      <DoodleBackground variant="academic" />
      <Sidebar
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />

      <main
        id="main-content"
        className={`transition-all duration-200 ease-out relative z-10 lg:${sidebarCollapsed ? "ml-[60px]" : "ml-[240px]"}`}
      >
        <div className="min-h-screen pt-14 lg:pt-0 p-4 sm:p-6 lg:p-8 pb-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <header className="mb-6">
              <div className="flex items-center justify-between">
                <h1 className="text-xl sm:text-2xl font-semibold flex items-center gap-3 text-text-primary">
                  <div className="w-10 h-10 rounded-xl bg-accent-primary/10 flex items-center justify-center">
                    <Scale className="w-5 h-5 text-accent-primary" />
                  </div>
                  Mentions légales
                </h1>
                <Link
                  to="/dashboard"
                  className="px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-white font-medium rounded-lg transition-colors text-sm"
                >
                  Retour au Dashboard
                </Link>
              </div>
            </header>

            {/* Navigation tabs */}
            <nav className="mb-6">
              <div className="flex gap-1 overflow-x-auto py-2">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-lg whitespace-nowrap transition-all text-sm ${
                      activeTab === tab.id
                        ? "bg-accent-primary/10 text-accent-primary border border-accent-primary/30"
                        : "text-text-tertiary hover:text-text-primary hover:bg-bg-secondary"
                    }`}
                  >
                    {tab.icon}
                    <span className="font-medium">{tab.label}</span>
                  </button>
                ))}
              </div>
            </nav>

            {/* Content */}
            {renderContent()}

            {/* Footer de la page légale */}
            <footer className="mt-16 pt-8 border-t border-border-subtle text-center text-text-muted text-sm">
              <p>Dernière mise à jour : {LEGAL_INFO.lastUpdate}</p>
              <p className="mt-2">
                Pour toute question, contactez-nous à{" "}
                <a
                  href={`mailto:${LEGAL_INFO.contact.email}`}
                  className="text-accent-primary hover:underline"
                >
                  {LEGAL_INFO.contact.email}
                </a>
              </p>
            </footer>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LegalPage;
