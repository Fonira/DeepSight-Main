/**
 * POLITIQUE DE CONFIDENTIALITE — Deep Sight
 * Page dédiée conforme RGPD + Chrome Web Store requirement
 * Derniere mise a jour : Mars 2026
 */

import React from "react";
import { Link } from "react-router-dom";
import { Shield, ArrowLeft } from "lucide-react";
import DoodleBackground from "../components/DoodleBackground";

const LEGAL_INFO = {
  company: {
    name: "Maxime Leparc",
    tradeName: "Deep Sight",
    type: "Entrepreneur Individuel",
    siret: "994 558 898 00015",
    address: "15 rue Clement Mulat",
    postalCode: "69350",
    city: "La Mulatiere",
    country: "France",
  },
  contact: {
    email: "maximeleparc3@gmail.com",
  },
  website: {
    url: "https://www.deepsightsynthesis.com",
    name: "Deep Sight",
  },
  lastUpdate: "2 mars 2026",
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <section className="mb-8">
    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
      <div className="w-1.5 h-6 bg-blue-500 rounded-full" />
      {title}
    </h2>
    <div className="text-slate-300 leading-relaxed space-y-3">{children}</div>
  </section>
);

const PrivacyPolicy: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <DoodleBackground variant="academic" />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link
              to="/"
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <img
                  src="/deepsight-logo-cosmic.png"
                  alt="Deep Sight"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xl font-bold text-white">
                {LEGAL_INFO.website.name}
              </span>
            </Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 relative z-10">
        {/* Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-3 px-5 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-full mb-6">
            <Shield className="w-5 h-5 text-blue-400" />
            <span className="text-blue-300 font-medium">Conforme RGPD</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            Politique de Confidentialité
          </h1>
          <p className="text-slate-400">
            Derniere mise a jour : {LEGAL_INFO.lastUpdate}
          </p>
        </div>

        <div className="bg-slate-800/40 backdrop-blur-sm border border-white/10 rounded-2xl p-6 sm:p-10">
          <Section title="1. Responsable du traitement">
            <p>
              Le responsable du traitement des données personnelles est{" "}
              <strong className="text-white">{LEGAL_INFO.company.name}</strong>,{" "}
              {LEGAL_INFO.company.type}, SIRET {LEGAL_INFO.company.siret}, dont
              le siege social est situe au {LEGAL_INFO.company.address},{" "}
              {LEGAL_INFO.company.postalCode} {LEGAL_INFO.company.city},{" "}
              {LEGAL_INFO.company.country}.
            </p>
            <p>
              Contact DPO :{" "}
              <a
                href={`mailto:${LEGAL_INFO.contact.email}`}
                className="text-blue-400 hover:underline"
              >
                {LEGAL_INFO.contact.email}
              </a>
            </p>
          </Section>

          <Section title="2. Données collectees">
            <p>Deep Sight collecte les données suivantes :</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-white">Données d'inscription</strong> :
                adresse email, nom (optionnel), mot de passe (hashe)
              </li>
              <li>
                <strong className="text-white">
                  Données d'authentification Google
                </strong>{" "}
                : email, nom, photo de profil (via OAuth 2.0)
              </li>
              <li>
                <strong className="text-white">Données d'utilisation</strong> :
                URLs YouTube et TikTok analysées, historique d'analyses,
                messages de chat
              </li>
              <li>
                <strong className="text-white">Données de paiement</strong> :
                gerees exclusivement par Stripe Inc. (nous ne stockons pas vos
                informations bancaires)
              </li>
              <li>
                <strong className="text-white">Données techniques</strong> :
                adresse IP (anonymisee), type de navigateur, plateforme
                (web/mobile/extension)
              </li>
            </ul>
          </Section>

          <Section title="3. Finalites du traitement">
            <p>Vos données sont traitees pour les finalites suivantes :</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                Fournir le service d'analyse vidéo IA (base legale : exécution
                du contrat)
              </li>
              <li>
                Gerer votre compte et votre abonnement (base legale : exécution
                du contrat)
              </li>
              <li>
                Ameliorer le service via des statistiques anonymisees (base
                legale : interet legitime)
              </li>
              <li>
                Envoyer des communications liees au service (base legale :
                exécution du contrat)
              </li>
              <li>
                Prevenir les abus et assurer la sécurité (base legale : interet
                legitime)
              </li>
            </ul>
          </Section>

          <Section title="4. Extension Chrome — Données spécifiques">
            <p>
              L'extension Chrome Deep Sight accède aux données suivantes sur les
              pages YouTube :
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-white">URL de la vidéo YouTube</strong>{" "}
                : uniquement lorsque vous lancez explicitement une analyse
              </li>
              <li>
                <strong className="text-white">Titre de la vidéo</strong> : pour
                l'affichage dans l'interface
              </li>
              <li>
                <strong className="text-white">Token d'authentification</strong>{" "}
                : stocke localement (chrome.storage.local) pour identifier votre
                session
              </li>
            </ul>
            <p className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-300">
              L'extension ne collecte AUCUNE donnee de navigation en dehors de
              YouTube. Elle ne lit pas vos onglets, vos favoris, ni votre
              historique de navigation. Elle ne s'active que sur les pages
              youtube.com et uniquement a votre initiative.
            </p>
          </Section>

          <Section title="5. Partage des données">
            <p>
              Vos données sont partagees avec les prestataires techniques
              suivants, tous situes dans l'UE ou soumis a des garanties
              adequates :
            </p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-white">Mistral AI</strong> (France) :
                traitement IA des analyses et du chat
              </li>
              <li>
                <strong className="text-white">Stripe Inc.</strong> (USA,
                certifie Privacy Shield) : traitement des paiements
              </li>
              <li>
                <strong className="text-white">Vercel Inc.</strong> (USA) :
                hebergement frontend
              </li>
              <li>
                <strong className="text-white">Railway Corp.</strong> (USA) :
                hebergement backend et base de données
              </li>
              <li>
                <strong className="text-white">Resend</strong> : envoi d'emails
                transactionnels
              </li>
              <li>
                <strong className="text-white">Sentry</strong> : monitoring
                d'erreurs (données anonymisees)
              </li>
            </ul>
            <p className="mt-3">
              Nous ne vendons ni ne louons vos données personnelles a des tiers.
            </p>
          </Section>

          <Section title="6. Durée de conservation">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                Données de compte : conservees tant que le compte est actif,
                supprimees 30 jours apres demande de suppression
              </li>
              <li>
                Historique d'analyses : selon votre plan (60 jours gratuit,
                illimité pour les plans payants)
              </li>
              <li>Logs techniques : 90 jours</li>
              <li>
                Données de facturation : 10 ans (obligation legale française)
              </li>
            </ul>
          </Section>

          <Section title="7. Vos droits (RGPD)">
            <p>Conformement au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-white">Droit d'acces</strong> : obtenir
                une copie de vos données
              </li>
              <li>
                <strong className="text-white">Droit de rectification</strong> :
                corriger vos données inexactes
              </li>
              <li>
                <strong className="text-white">Droit a l'effacement</strong> :
                demander la suppression de vos données
              </li>
              <li>
                <strong className="text-white">Droit a la portabilite</strong> :
                recevoir vos données dans un format structure
              </li>
              <li>
                <strong className="text-white">Droit d'opposition</strong> :
                vous opposer au traitement pour motifs legitimes
              </li>
              <li>
                <strong className="text-white">Droit a la limitation</strong> :
                restreindre le traitement de vos données
              </li>
            </ul>
            <p className="mt-3">
              Pour exercer ces droits, contactez-nous a{" "}
              <a
                href={`mailto:${LEGAL_INFO.contact.email}`}
                className="text-blue-400 hover:underline"
              >
                {LEGAL_INFO.contact.email}
              </a>
              . Nous repondrons dans un délai de 30 jours.
            </p>
            <p className="mt-2">
              Vous pouvez egalement deposer une reclamation aupres de la CNIL
              (Commission Nationale de l'Informatique et des Libertes) :&nbsp;
              <a
                href="https://www.cnil.fr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:underline"
              >
                www.cnil.fr
              </a>
            </p>
          </Section>

          <Section title="8. Sécurité des données">
            <ul className="list-disc pl-6 space-y-1.5">
              <li>Chiffrement HTTPS/TLS sur toutes les communications</li>
              <li>Mots de passe hashes avec bcrypt (salt unique)</li>
              <li>
                Tokens JWT avec expiration courte (15 minutes) et refresh tokens
              </li>
              <li>Base de données PostgreSQL avec acces restreint</li>
              <li>
                Aucune donnee bancaire stockee (delegation totale a Stripe)
              </li>
            </ul>
          </Section>

          <Section title="9. Cookies et traceurs">
            <p>Deep Sight utilise les cookies suivants :</p>
            <ul className="list-disc pl-6 space-y-1.5">
              <li>
                <strong className="text-white">Cookies essentiels</strong> :
                authentification JWT, preferences de theme — nécessaires au
                fonctionnement
              </li>
              <li>
                <strong className="text-white">Cookies analytiques</strong>{" "}
                (optionnels) : PostHog (auto-heberge) pour les statistiques
                d'usage anonymisees, soumis a votre consentement
              </li>
            </ul>
            <p className="mt-2">
              Vous pouvez gerer vos preferences de cookies à tout moment via le
              bandeau cookies ou les parametres de votre navigateur.
            </p>
          </Section>

          <Section title="10. Modifications">
            <p>
              Nous nous reservons le droit de modifier cette politique de
              confidentialité. En cas de modification substantielle, nous vous
              informerons par email ou notification dans l'application. La date
              de derniere mise a jour est indiquee en haut de cette page.
            </p>
          </Section>
        </div>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap gap-4 justify-center text-sm text-slate-400">
          <Link to="/legal" className="hover:text-white transition-colors">
            Mentions legales
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/legal/cgu" className="hover:text-white transition-colors">
            CGU
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/legal/cgv" className="hover:text-white transition-colors">
            CGV
          </Link>
          <span className="text-slate-600">|</span>
          <Link to="/contact" className="hover:text-white transition-colors">
            Contact
          </Link>
        </div>
      </main>
    </div>
  );
};

export default PrivacyPolicy;
