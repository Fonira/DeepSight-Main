/**
 * CONDITIONS GENERALES DE VENTE — Deep Sight
 * Page dediee CGV conforme a la legislation francaise
 * Derniere mise a jour : Fevrier 2026
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { CreditCard, ArrowLeft } from 'lucide-react';
import DoodleBackground from '../components/DoodleBackground';

const LEGAL_INFO = {
  company: {
    name: "Maxime Leparc",
    tradeName: "Deep Sight",
    type: "Entrepreneur Individuel",
    siret: "994 558 898 00015",
    rcs: "994 558 898 Lyon",
    activity: "Portails Internet",
    activityCode: "6312Z",
    address: "15 rue Clement Mulat",
    postalCode: "69350",
    city: "La Mulatiere",
    country: "France",
  },
  contact: {
    email: "maximeleparc3@gmail.com",
    phone: "06 67 42 57 92",
  },
  website: {
    url: "https://www.deepsightsynthesis.com",
    name: "Deep Sight",
  },
  vat: {
    status: "TVA non applicable, article 293 B du CGI",
  },
  lastUpdate: "13 fevrier 2026",
};

const PLANS = [
  { name: "Gratuit", price: "0", period: "", analyses: "3", credits: "150", features: "10 min max, 3 jours d'historique" },
  { name: "Etudiant", price: "2,99", period: "/mois", analyses: "40", credits: "2 000", features: "Flashcards, cartes conceptuelles" },
  { name: "Starter", price: "5,99", period: "/mois", analyses: "60", credits: "3 000", features: "2h max, exports, 60 jours d'historique" },
  { name: "Pro", price: "12,99", period: "/mois", analyses: "300", credits: "15 000", features: "Playlists, chat illimite, synthese vocale" },
  { name: "Equipe", price: "29,99", period: "/mois", analyses: "1 000", credits: "50 000", features: "Acces API, 5 utilisateurs" },
];

const LegalCGV: React.FC = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 relative">
      <DoodleBackground variant="academic" />

      {/* Header */}
      <header className="border-b border-white/10 bg-slate-900/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-xl overflow-hidden">
                <img src="/deepsight-logo-cosmic.png" alt="Deep Sight" className="w-full h-full object-contain" />
              </div>
              <span className="text-xl font-bold text-white">{LEGAL_INFO.website.name}</span>
            </Link>
            <Link
              to="/dashboard"
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-black font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour au Dashboard
            </Link>
          </div>
        </div>
      </header>

      {/* Title banner */}
      <div className="border-b border-white/10 bg-slate-900/30">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-500/20 rounded-lg">
              <CreditCard className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Conditions Generales de Vente</h1>
              <p className="text-white/60 text-sm">En vigueur au {LEGAL_INFO.lastUpdate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8 relative z-10">

        {/* Article 1 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 1 -- Objet</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Les presentes Conditions Generales de Vente (ci-apres "CGV") ont pour objet de definir les conditions
              dans lesquelles {LEGAL_INFO.company.name}, {LEGAL_INFO.company.type}, SIRET {LEGAL_INFO.company.siret},
              RCS {LEGAL_INFO.company.rcs} (ci-apres "le Vendeur" ou "l'Editeur"), commercialise ses offres
              d'abonnement au service <strong>{LEGAL_INFO.website.name}</strong> (ci-apres "le Service") aupres
              des utilisateurs (ci-apres "le Client" ou "l'Utilisateur").
            </p>
            <p>
              Les presentes CGV s'appliquent a toute souscription d'abonnement payant au Service, a l'exclusion
              de l'offre gratuite qui est regie uniquement par les{' '}
              <Link to="/legal/cgu" className="text-amber-400 hover:underline">
                Conditions Generales d'Utilisation
              </Link>.
            </p>
            <p>
              Toute souscription a un abonnement implique l'acceptation sans reserve des presentes CGV, ainsi que
              des{' '}
              <Link to="/legal/cgu" className="text-amber-400 hover:underline">
                Conditions Generales d'Utilisation
              </Link>{' '}
              du Service.
            </p>
          </div>
        </section>

        {/* Article 2 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 2 -- Offres et tarifs</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Le Service {LEGAL_INFO.website.name} propose les formules d'abonnement suivantes :
            </p>

            {/* Pricing table */}
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-3 px-4 text-white font-semibold">Plan</th>
                    <th className="text-left py-3 px-4 text-white font-semibold">Prix</th>
                    <th className="text-left py-3 px-4 text-white font-semibold">Analyses/mois</th>
                    <th className="text-left py-3 px-4 text-white font-semibold">Credits</th>
                    <th className="text-left py-3 px-4 text-white font-semibold">Fonctionnalites cles</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {PLANS.map((plan) => (
                    <tr key={plan.name}>
                      <td className="py-3 px-4 font-medium text-white">{plan.name}</td>
                      <td className="py-3 px-4">
                        <span className="text-amber-400 font-bold">{plan.price}&euro;</span>
                        <span className="text-white/50">{plan.period}</span>
                      </td>
                      <td className="py-3 px-4">{plan.analyses}</td>
                      <td className="py-3 px-4">{plan.credits}</td>
                      <td className="py-3 px-4 text-white/60 text-xs">{plan.features}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p>
              Les prix sont indiques en euros TTC ({LEGAL_INFO.vat.status}). L'Editeur se reserve le droit de
              modifier ses tarifs a tout moment. Toute modification tarifaire sera communiquee aux Utilisateurs
              au moins 30 jours avant son entree en vigueur. Les tarifs applicables sont ceux en vigueur au
              moment de la souscription ou du renouvellement de l'abonnement.
            </p>
            <p>
              Les credits representent une unite de consommation interne au Service. Chaque operation (analyse,
              question au chat, etc.) consomme un nombre de credits variable selon sa complexite. Les credits
              non utilises a la fin du mois ne sont pas reportes sur le mois suivant.
            </p>
          </div>
        </section>

        {/* Article 3 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 3 -- Commande et souscription</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>3.1 -- Processus de souscription.</strong> Pour souscrire a un abonnement payant,
              l'Utilisateur doit :
            </p>
            <ol className="list-decimal list-inside space-y-2 ml-4">
              <li>Disposer d'un compte utilisateur actif sur le Service</li>
              <li>Choisir la formule d'abonnement souhaitee depuis la page de tarification ou les parametres du compte</li>
              <li>Etre redirige vers la plateforme de paiement securisee Stripe pour completer le paiement</li>
              <li>Confirmer le paiement par carte bancaire</li>
            </ol>
            <p>
              <strong>3.2 -- Confirmation.</strong> Apres validation du paiement, l'Utilisateur recoit un email
              de confirmation de souscription a l'adresse associee a son compte. L'abonnement prend effet
              immediatement apres la validation du paiement.
            </p>
            <p>
              <strong>3.3 -- Acces immediat.</strong> Les fonctionnalites de l'abonnement souscrit sont
              accessibles immediatement apres la confirmation du paiement.
            </p>
          </div>
        </section>

        {/* Article 4 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 4 -- Modalites de paiement</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>4.1 -- Moyen de paiement.</strong> Le paiement s'effectue exclusivement par carte bancaire
              (Visa, Mastercard, American Express et autres cartes acceptees par Stripe) via la plateforme de
              paiement securisee{' '}
              <a href="https://stripe.com" target="_blank" rel="noopener noreferrer" className="text-amber-400 hover:underline">
                Stripe
              </a>.
              L'Editeur ne collecte ni ne stocke directement les donnees bancaires de l'Utilisateur.
            </p>
            <p>
              <strong>4.2 -- Renouvellement automatique.</strong> Les abonnements sont souscrits sur une base
              mensuelle et se renouvellent automatiquement a chaque date anniversaire de souscription, sauf
              resiliation par l'Utilisateur avant la date de renouvellement. Le montant de l'abonnement est
              preleve automatiquement sur la carte bancaire enregistree.
            </p>
            <p>
              <strong>4.3 -- Echec de paiement.</strong> En cas d'echec du prelevement automatique (carte expiree,
              fonds insuffisants, etc.), l'Editeur notifie l'Utilisateur par email. L'Utilisateur dispose d'un
              delai de 7 jours pour mettre a jour ses informations de paiement. A defaut, l'abonnement sera
              suspendu et l'Utilisateur sera retrocede au plan gratuit.
            </p>
            <p>
              <strong>4.4 -- Facturation.</strong> {LEGAL_INFO.vat.status}. Un recu de paiement est disponible
              apres chaque transaction via le portail de gestion Stripe accessible depuis les parametres du compte.
            </p>
          </div>
        </section>

        {/* Article 5 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 5 -- Droit de retractation</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>5.1 -- Principe.</strong> Conformement a l'article L221-28, 13&deg; du Code de la consommation,
              le droit de retractation ne peut etre exerce pour les contrats de fourniture d'un contenu numerique
              non fourni sur un support materiel dont l'execution a commence apres accord prealable expres du
              consommateur et renoncement expres a son droit de retractation.
            </p>
            <p>
              <strong>5.2 -- Application.</strong> En souscrivant a un abonnement payant et en accedant
              immediatement aux fonctionnalites premium du Service, l'Utilisateur :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Reconnait que l'execution du contrat commence immediatement apres la validation du paiement</li>
              <li>Renonce expressement a son droit de retractation de 14 jours prevu a l'article L221-18 du Code de la consommation</li>
            </ul>
            <p>
              <strong>5.3 -- Alternative.</strong> Toutefois, l'Utilisateur peut a tout moment resilier son
              abonnement. La resiliation prend effet a la fin de la periode de facturation en cours, et
              l'Utilisateur conserve l'acces aux fonctionnalites premium jusqu'a cette date. Aucun remboursement
              prorata temporis n'est effectue.
            </p>
          </div>
        </section>

        {/* Article 6 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 6 -- Duree et resiliation</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>6.1 -- Duree.</strong> Les abonnements sont souscrits pour une duree d'un mois, renouvelable
              automatiquement par tacite reconduction. Il n'y a aucun engagement de duree minimale au-dela du mois
              en cours.
            </p>
            <p>
              <strong>6.2 -- Resiliation par l'Utilisateur.</strong> L'Utilisateur peut resilier son abonnement a
              tout moment, sans frais ni penalite, par l'un des moyens suivants :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Depuis les parametres de son compte sur le Service (rubrique "Mon abonnement")</li>
              <li>Via le portail de gestion Stripe</li>
              <li>En contactant le support a l'adresse{' '}
                <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
                  {LEGAL_INFO.contact.email}
                </a>
              </li>
            </ul>
            <p>
              La resiliation prend effet a la fin de la periode de facturation en cours. L'Utilisateur conserve
              l'acces aux fonctionnalites de son abonnement jusqu'a cette date, puis son compte est automatiquement
              retrocede au plan gratuit.
            </p>
            <p>
              <strong>6.3 -- Resiliation par l'Editeur.</strong> L'Editeur se reserve le droit de resilier
              l'abonnement d'un Utilisateur en cas de violation des{' '}
              <Link to="/legal/cgu" className="text-amber-400 hover:underline">CGU</Link>
              {' '}ou des presentes CGV, sans preavis ni remboursement.
            </p>
          </div>
        </section>

        {/* Article 7 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 7 -- Garanties et limites</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>7.1 -- Service en l'etat.</strong> Le Service est fourni "en l'etat" ("as is"). L'Editeur
              s'engage a mettre en oeuvre les moyens raisonnables pour assurer le bon fonctionnement et la disponibilite
              du Service, mais ne garantit pas une disponibilite de 100%, ni l'absence d'erreurs, de bugs ou
              d'interruptions.
            </p>
            <p>
              <strong>7.2 -- Limites de l'IA.</strong> Les contenus generes par le Service sont produits par des
              modeles d'intelligence artificielle et sont fournis a titre informatif uniquement. L'Editeur ne
              garantit pas l'exactitude, l'exhaustivite ou la fiabilite des analyses generees.
            </p>
            <p>
              <strong>7.3 -- Garantie legale de conformite.</strong> Conformement aux articles L217-3 et suivants
              du Code de la consommation, l'Editeur est tenu de la garantie legale de conformite pour les contenus
              et services numeriques. En cas de defaut de conformite, l'Utilisateur peut demander la mise en
              conformite du Service ou, a defaut, obtenir une reduction du prix ou la resolution du contrat dans
              les conditions prevues par la loi.
            </p>
            <p>
              <strong>7.4 -- Limitation de responsabilite.</strong> La responsabilite totale de l'Editeur au titre
              des presentes CGV est limitee au montant total des sommes effectivement versees par l'Utilisateur au
              cours des 12 mois precedant le fait generateur de responsabilite.
            </p>
          </div>
        </section>

        {/* Article 8 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 8 -- Reclamations et service apres-vente</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Pour toute reclamation relative a un abonnement ou a un paiement, l'Utilisateur peut contacter
              le service client par les moyens suivants :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>
                Par email :{' '}
                <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
                  {LEGAL_INFO.contact.email}
                </a>
              </li>
              <li>
                Par telephone :{' '}
                <a href={`tel:${LEGAL_INFO.contact.phone.replace(/\s/g, '')}`} className="text-amber-400 hover:underline">
                  {LEGAL_INFO.contact.phone}
                </a>
              </li>
              <li>Via le chat integre au Service (widget Crisp)</li>
            </ul>
            <p>
              L'Editeur s'engage a accuser reception de toute reclamation dans un delai de 48 heures ouvrees et
              a y apporter une reponse dans un delai maximum de 30 jours.
            </p>
          </div>
        </section>

        {/* Article 9 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 9 -- Donnees personnelles</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Dans le cadre de la souscription et de la gestion des abonnements, l'Editeur collecte et traite
              des donnees personnelles (adresse email, donnees de facturation via Stripe) conformement au
              Reglement General sur la Protection des Donnees (RGPD).
            </p>
            <p>
              Les donnees bancaires sont collectees et traitees exclusivement par Stripe, prestataire de paiement
              certifie PCI DSS niveau 1. L'Editeur n'a pas acces aux numeros de carte bancaire complets.
            </p>
            <p>
              Pour plus d'informations sur le traitement de vos donnees personnelles, consultez la{' '}
              <Link to="/legal#privacy" className="text-amber-400 hover:underline">
                Politique de Confidentialite
              </Link>.
            </p>
          </div>
        </section>

        {/* Article 10 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 10 -- Droit applicable et litiges</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>10.1 -- Droit applicable.</strong> Les presentes CGV sont regies par le droit francais.
            </p>
            <p>
              <strong>10.2 -- Resolution amiable.</strong> En cas de litige relatif a l'interpretation ou a
              l'execution des presentes CGV, les parties s'engagent a rechercher une solution amiable prealablement
              a toute action judiciaire.
            </p>
            <p>
              <strong>10.3 -- Mediation.</strong> Conformement aux articles L611-1 et suivants du Code de la
              consommation, en cas de litige non resolu par voie amiable, le consommateur peut recourir
              gratuitement a un mediateur de la consommation. Le consommateur peut egalement utiliser la plateforme
              europeenne de reglement en ligne des litiges :{' '}
              <a
                href="https://ec.europa.eu/consumers/odr"
                target="_blank"
                rel="noopener noreferrer"
                className="text-amber-400 hover:underline"
              >
                https://ec.europa.eu/consumers/odr
              </a>.
            </p>
            <p>
              <strong>10.4 -- Juridiction.</strong> A defaut de resolution amiable ou de mediation, le litige
              sera porte devant les tribunaux competents du ressort de Lyon (France), sous reserve des regles
              imperatives de competence applicables aux consommateurs.
            </p>
          </div>
        </section>

        {/* Informations vendeur */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Informations sur le vendeur</h2>
          <div className="text-white/80 space-y-2">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <p><span className="text-white/50">Nom commercial :</span> {LEGAL_INFO.company.tradeName}</p>
                <p><span className="text-white/50">Exploitant :</span> {LEGAL_INFO.company.name}</p>
                <p><span className="text-white/50">Statut :</span> {LEGAL_INFO.company.type}</p>
                <p><span className="text-white/50">SIRET :</span> {LEGAL_INFO.company.siret}</p>
                <p><span className="text-white/50">RCS :</span> {LEGAL_INFO.company.rcs}</p>
              </div>
              <div className="space-y-2">
                <p><span className="text-white/50">Activite :</span> {LEGAL_INFO.company.activity} ({LEGAL_INFO.company.activityCode})</p>
                <p><span className="text-white/50">Adresse :</span> {LEGAL_INFO.company.address}, {LEGAL_INFO.company.postalCode} {LEGAL_INFO.company.city}</p>
                <p><span className="text-white/50">TVA :</span> {LEGAL_INFO.vat.status}</p>
                <p><span className="text-white/50">Email :</span>{' '}
                  <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">{LEGAL_INFO.contact.email}</a>
                </p>
                <p><span className="text-white/50">Telephone :</span>{' '}
                  <a href={`tel:${LEGAL_INFO.contact.phone.replace(/\s/g, '')}`} className="text-amber-400 hover:underline">{LEGAL_INFO.contact.phone}</a>
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="mt-16 pt-8 border-t border-white/10 text-center text-white/40 text-sm">
          <p>Derniere mise a jour : {LEGAL_INFO.lastUpdate}</p>
          <p className="mt-2">
            Pour toute question, contactez-nous a{' '}
            <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
              {LEGAL_INFO.contact.email}
            </a>
          </p>
          <div className="mt-4 flex items-center justify-center gap-4 text-white/40">
            <Link to="/legal" className="hover:text-white/60 transition-colors">Mentions legales</Link>
            <span>|</span>
            <Link to="/legal/cgu" className="hover:text-white/60 transition-colors">CGU</Link>
            <span>|</span>
            <Link to="/legal#privacy" className="hover:text-white/60 transition-colors">Confidentialite</Link>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default LegalCGV;
