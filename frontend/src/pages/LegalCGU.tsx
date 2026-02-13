/**
 * CONDITIONS GENERALES D'UTILISATION — Deep Sight
 * Page dediee CGU conforme a la legislation francaise
 * Derniere mise a jour : Fevrier 2026
 */

import React from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowLeft } from 'lucide-react';
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

const LegalCGU: React.FC = () => {
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
              <FileText className="w-6 h-6 text-amber-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Conditions Generales d'Utilisation</h1>
              <p className="text-white/60 text-sm">En vigueur au {LEGAL_INFO.lastUpdate}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8 relative z-10">

        {/* Article 1 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 1 -- Objet et acceptation</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Les presentes Conditions Generales d'Utilisation (ci-apres "CGU") ont pour objet de definir les conditions
              dans lesquelles les utilisateurs (ci-apres "l'Utilisateur" ou "les Utilisateurs") peuvent acceder et
              utiliser le service <strong>{LEGAL_INFO.website.name}</strong> (ci-apres "le Service"), accessible a
              l'adresse{' '}
              <a href={LEGAL_INFO.website.url} className="text-amber-400 hover:underline">
                {LEGAL_INFO.website.url}
              </a>
              , ainsi que via les applications mobiles et l'extension de navigateur associees.
            </p>
            <p>
              Le Service est edite par {LEGAL_INFO.company.name}, {LEGAL_INFO.company.type}, immatricule sous le
              numero SIRET {LEGAL_INFO.company.siret}, RCS {LEGAL_INFO.company.rcs}, dont le siege social est situe
              au {LEGAL_INFO.company.address}, {LEGAL_INFO.company.postalCode} {LEGAL_INFO.company.city},{' '}
              {LEGAL_INFO.company.country} (ci-apres "l'Editeur").
            </p>
            <p>
              L'utilisation du Service implique l'acceptation pleine et entiere des presentes CGU. En accedant au Service
              ou en creant un compte, l'Utilisateur reconnait avoir lu, compris et accepte l'integralite des presentes
              conditions. En cas de desaccord avec l'une quelconque des dispositions des presentes CGU, l'Utilisateur
              est invite a ne pas utiliser le Service.
            </p>
          </div>
        </section>

        {/* Article 2 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 2 -- Description du Service</h2>
          <div className="text-white/80 space-y-3">
            <p>
              {LEGAL_INFO.website.name} est une plateforme SaaS (Software as a Service) d'analyse de videos YouTube
              utilisant l'intelligence artificielle et l'epistemologie bayesienne. Le Service propose notamment :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>L'analyse automatisee de videos YouTube (transcription, synthese structuree, categorisation epistemique)</li>
              <li>La verification factuelle (fact-checking) des affirmations contenues dans les videos</li>
              <li>Un assistant conversationnel (Chat IA) permettant d'interagir avec le contenu analyse</li>
              <li>Des outils d'etude : flashcards, cartes conceptuelles, quiz</li>
              <li>L'analyse de playlists et corpus de videos (selon l'abonnement souscrit)</li>
              <li>L'export des analyses en differents formats (PDF, DOCX, Markdown)</li>
              <li>La lecture audio des analyses (synthese vocale, selon l'abonnement)</li>
            </ul>
            <p>
              Le Service utilise exclusivement les sous-titres publiquement accessibles des videos YouTube.
              Aucun telechargement de contenu audiovisuel n'est effectue. Les analyses sont generees par des
              modeles d'intelligence artificielle et sont fournies a titre informatif uniquement.
            </p>
          </div>
        </section>

        {/* Article 3 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 3 -- Inscription et compte utilisateur</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>3.1 -- Creation de compte.</strong> L'acces au Service necessite la creation d'un compte
              utilisateur. L'Utilisateur peut s'inscrire :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Via une adresse email et un mot de passe (avec verification de l'adresse email)</li>
              <li>Via son compte Google (authentification OAuth 2.0)</li>
            </ul>
            <p>
              <strong>3.2 -- Age minimum.</strong> L'Utilisateur doit etre age d'au moins 16 ans pour creer un compte
              et utiliser le Service. En s'inscrivant, l'Utilisateur certifie remplir cette condition d'age. Pour les
              mineurs de 16 a 18 ans, l'inscription est reputee avoir ete effectuee avec l'accord du representant
              legal.
            </p>
            <p>
              <strong>3.3 -- Exactitude des informations.</strong> L'Utilisateur s'engage a fournir des informations
              exactes, completes et a jour lors de son inscription, et a les maintenir a jour tout au long de
              l'utilisation du Service.
            </p>
            <p>
              <strong>3.4 -- Securite du compte.</strong> L'Utilisateur est seul responsable de la confidentialite de
              ses identifiants de connexion (email, mot de passe). Toute activite effectuee depuis son compte est
              presumee avoir ete realisee par l'Utilisateur. En cas d'utilisation non autorisee de son compte,
              l'Utilisateur doit en informer immediatement l'Editeur a l'adresse{' '}
              <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
                {LEGAL_INFO.contact.email}
              </a>.
            </p>
            <p>
              <strong>3.5 -- Unicite du compte.</strong> Chaque Utilisateur ne peut creer qu'un seul compte, sauf
              autorisation expresse de l'Editeur. La creation de comptes multiples dans le but de contourner les
              limitations du Service est interdite.
            </p>
          </div>
        </section>

        {/* Article 4 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 4 -- Conditions d'acces et disponibilite</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>4.1 -- Acces au Service.</strong> Le Service est accessible 24 heures sur 24, 7 jours sur 7,
              sous reserve des periodes de maintenance programmee ou d'incidents techniques.
            </p>
            <p>
              <strong>4.2 -- Disponibilite.</strong> L'Editeur met en oeuvre les moyens raisonnables pour assurer la
              disponibilite du Service, mais ne garantit pas une disponibilite continue et ininterrompue. L'Editeur
              ne saurait etre tenu responsable des interruptions de Service dues a des cas de force majeure, a des
              dysfonctionnements des reseaux de telecommunications, ou a des operations de maintenance necessaires
              au bon fonctionnement du Service.
            </p>
            <p>
              <strong>4.3 -- Configuration requise.</strong> L'Utilisateur doit disposer d'un navigateur web recent
              (Chrome, Firefox, Safari, Edge dans leurs versions les plus recentes), d'une connexion internet active
              et d'un appareil compatible pour acceder au Service.
            </p>
            <p>
              <strong>4.4 -- Suspension et limitation.</strong> L'Editeur se reserve le droit de suspendre ou limiter
              l'acces au Service, sans preavis ni indemnite, en cas de violation des presentes CGU par l'Utilisateur,
              ou pour des raisons techniques ou de securite.
            </p>
          </div>
        </section>

        {/* Article 5 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 5 -- Propriete intellectuelle</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>5.1 -- Droits de l'Editeur.</strong> L'ensemble des elements composant le Service (textes,
              graphismes, logos, icones, images, logiciels, bases de donnees, algorithmes, architecture technique,
              interface utilisateur) est la propriete exclusive de l'Editeur ou fait l'objet d'une autorisation
              d'utilisation. Ces elements sont proteges par les lois francaises et internationales relatives a la
              propriete intellectuelle.
            </p>
            <p>
              <strong>5.2 -- Licence d'utilisation.</strong> L'Editeur accorde a l'Utilisateur une licence
              personnelle, non exclusive, non cessible et non transferable d'utilisation du Service, pour la duree
              de son inscription et dans le cadre des presentes CGU.
            </p>
            <p>
              <strong>5.3 -- Contenu genere.</strong> Les analyses, syntheses et autres contenus generes par le
              Service a la demande de l'Utilisateur sont la propriete de l'Utilisateur qui les a commandees.
              L'Utilisateur est libre de les utiliser, partager ou publier comme il l'entend, sous sa propre
              responsabilite.
            </p>
            <p>
              <strong>5.4 -- Interdictions.</strong> Toute reproduction, representation, modification, publication,
              transmission, denaturation, totale ou partielle du Service ou de ses elements, par quelque procede
              que ce soit, sans l'autorisation ecrite prealable de l'Editeur, est interdite et constitue une
              contrefacon sanctionnee par les articles L.335-2 et suivants du Code de la propriete intellectuelle.
            </p>
          </div>
        </section>

        {/* Article 6 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 6 -- Responsabilite de l'Utilisateur</h2>
          <div className="text-white/80 space-y-3">
            <p>L'Utilisateur s'engage a :</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Utiliser le Service de maniere loyale, conforme a sa destination et dans le respect des presentes CGU</li>
              <li>Ne pas analyser de contenus illicites, haineux, diffamatoires, discriminatoires ou portant atteinte aux droits d'autrui</li>
              <li>Ne pas utiliser le Service a des fins illegales, frauduleuses ou portant atteinte aux droits de tiers</li>
              <li>Ne pas tenter de contourner les limitations techniques du Service (quotas, restrictions de plan)</li>
              <li>Ne pas utiliser de moyens automatises (bots, scrapers, scripts) pour acceder au Service ou en extraire des donnees</li>
              <li>Ne pas revendre, redistribuer ou sous-licencier le Service ou l'acces au Service sans autorisation ecrite de l'Editeur</li>
              <li>Ne pas perturber le fonctionnement du Service ou tenter de compromettre sa securite</li>
              <li>Ne pas usurper l'identite d'un tiers ou creer de faux comptes</li>
            </ul>
            <p>
              Le non-respect de ces engagements peut entrainer la suspension ou la resiliation immediate du compte
              de l'Utilisateur, sans preavis ni remboursement, et sans prejudice de toute action en reparation du
              dommage subi par l'Editeur.
            </p>
          </div>
        </section>

        {/* Article 7 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 7 -- Limitation de responsabilite</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>7.1 -- Nature informationnelle.</strong> {LEGAL_INFO.website.name} est un outil d'assistance
              base sur l'intelligence artificielle. Les analyses, syntheses, verifications factuelles et autres
              contenus generes par le Service sont fournis a titre informatif uniquement et ne constituent en
              aucun cas :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Un avis professionnel (juridique, medical, financier, comptable, scientifique ou autre)</li>
              <li>Une source d'information verifiee, exhaustive ou infaillible</li>
              <li>Un substitut au visionnage des videos originales</li>
              <li>Une garantie de l'exactitude ou de la fiabilite du contenu source</li>
            </ul>
            <p>
              <strong>7.2 -- Limites de l'IA.</strong> L'Utilisateur reconnait et accepte que les modeles
              d'intelligence artificielle utilises par le Service peuvent produire des resultats inexacts,
              incomplets ou biaises. L'Utilisateur est invite a verifier les informations generees par le
              Service aupres de sources primaires.
            </p>
            <p>
              <strong>7.3 -- Exclusion de responsabilite.</strong> L'Editeur ne saurait etre tenu responsable :
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Des decisions prises par l'Utilisateur sur la base des analyses generees</li>
              <li>De l'indisponibilite temporaire du Service</li>
              <li>De la perte de donnees resultant d'un cas de force majeure</li>
              <li>Du contenu des videos YouTube analysees par l'Utilisateur</li>
              <li>Des dommages indirects (perte de profit, perte de chance, prejudice commercial) resultant de l'utilisation ou de l'impossibilite d'utiliser le Service</li>
            </ul>
            <p>
              <strong>7.4 -- Service en l'etat.</strong> Le Service est fourni "en l'etat" ("as is"). L'Editeur ne
              garantit pas que le Service sera exempt d'erreurs, de bugs ou de vulnerabilites, ni que les defauts
              seront corriges dans un delai determine.
            </p>
          </div>
        </section>

        {/* Article 8 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 8 -- Donnees personnelles</h2>
          <div className="text-white/80 space-y-3">
            <p>
              L'Editeur collecte et traite des donnees personnelles dans le cadre de la fourniture du Service,
              conformement au Reglement General sur la Protection des Donnees (RGPD) et a la loi Informatique et
              Libertes du 6 janvier 1978 modifiee.
            </p>
            <p>
              Les modalites de collecte, de traitement et de protection des donnees personnelles sont detaillees
              dans la{' '}
              <Link to="/legal#privacy" className="text-amber-400 hover:underline">
                Politique de Confidentialite
              </Link>
              , qui fait partie integrante des presentes CGU.
            </p>
            <p>
              L'Utilisateur dispose de droits d'acces, de rectification, d'effacement, de limitation, de portabilite
              et d'opposition sur ses donnees, qu'il peut exercer en contactant l'Editeur a l'adresse{' '}
              <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
                {LEGAL_INFO.contact.email}
              </a>.
            </p>
          </div>
        </section>

        {/* Article 9 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 9 -- Modification des CGU</h2>
          <div className="text-white/80 space-y-3">
            <p>
              L'Editeur se reserve le droit de modifier les presentes CGU a tout moment, notamment pour les adapter
              aux evolutions legislatives, reglementaires ou techniques, ou pour prendre en compte de nouvelles
              fonctionnalites du Service.
            </p>
            <p>
              Les Utilisateurs seront informes des modifications substantielles par email et/ou par notification
              sur le Service au moins 30 jours avant leur entree en vigueur. La poursuite de l'utilisation du
              Service apres l'entree en vigueur des modifications vaut acceptation des nouvelles CGU.
            </p>
            <p>
              En cas de desaccord avec les nouvelles conditions, l'Utilisateur peut resilier son compte avant
              l'entree en vigueur des modifications.
            </p>
          </div>
        </section>

        {/* Article 10 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 10 -- Resiliation du compte</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>10.1 -- Resiliation par l'Utilisateur.</strong> L'Utilisateur peut supprimer son compte
              a tout moment depuis les parametres de son profil ou en contactant le support a l'adresse{' '}
              <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
                {LEGAL_INFO.contact.email}
              </a>.
            </p>
            <p>
              <strong>10.2 -- Consequences de la resiliation.</strong> La suppression du compte entraine la
              suppression definitive de toutes les donnees associees (analyses, historique de conversations,
              preferences) dans un delai de 30 jours, sous reserve des obligations legales de conservation.
            </p>
            <p>
              <strong>10.3 -- Resiliation par l'Editeur.</strong> L'Editeur se reserve le droit de suspendre
              ou resilier un compte en cas de violation des presentes CGU, sans preavis ni indemnite.
            </p>
          </div>
        </section>

        {/* Article 11 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 11 -- Droit applicable et juridiction competente</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Les presentes CGU sont regies par le droit francais. Tout litige relatif a l'interpretation
              ou a l'execution des presentes CGU sera soumis aux tribunaux competents du ressort de Lyon (France),
              sous reserve des regles imperatives de competence applicables aux consommateurs.
            </p>
            <p>
              En cas de litige, les parties s'engagent a rechercher une solution amiable avant toute
              action judiciaire. A defaut d'accord amiable dans un delai de 30 jours, le litige pourra
              etre porte devant les juridictions competentes.
            </p>
          </div>
        </section>

        {/* Article 12 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 12 -- Mediation de la consommation</h2>
          <div className="text-white/80 space-y-3">
            <p>
              Conformement aux articles L611-1 et suivants et R612-1 et suivants du Code de la consommation,
              en cas de litige non resolu par voie amiable, le consommateur peut recourir gratuitement a un
              mediateur de la consommation en vue de la resolution amiable du litige qui l'oppose au professionnel.
            </p>
            <p>
              Le consommateur peut egalement utiliser la plateforme de reglement en ligne des litiges mise en place
              par la Commission europeenne, accessible a l'adresse suivante :{' '}
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
              Pour toute reclamation, l'Utilisateur est invite a contacter prealablement l'Editeur a l'adresse{' '}
              <a href={`mailto:${LEGAL_INFO.contact.email}`} className="text-amber-400 hover:underline">
                {LEGAL_INFO.contact.email}
              </a>{' '}
              ou par telephone au{' '}
              <a href={`tel:${LEGAL_INFO.contact.phone.replace(/\s/g, '')}`} className="text-amber-400 hover:underline">
                {LEGAL_INFO.contact.phone}
              </a>.
            </p>
          </div>
        </section>

        {/* Article 13 */}
        <section className="bg-white/5 rounded-xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4">Article 13 -- Dispositions generales</h2>
          <div className="text-white/80 space-y-3">
            <p>
              <strong>13.1 -- Divisibilite.</strong> Si l'une quelconque des dispositions des presentes CGU
              etait declaree nulle ou inapplicable par une juridiction competente, les autres dispositions
              resteraient en vigueur et de plein effet.
            </p>
            <p>
              <strong>13.2 -- Tolerance.</strong> Le fait pour l'Editeur de ne pas se prevaloir d'un manquement
              de l'Utilisateur a l'une quelconque des obligations visees dans les presentes CGU ne saurait etre
              interprete comme une renonciation a l'obligation en cause.
            </p>
            <p>
              <strong>13.3 -- Integralite.</strong> Les presentes CGU, ensemble avec la{' '}
              <Link to="/legal#privacy" className="text-amber-400 hover:underline">Politique de Confidentialite</Link>
              {' '}et les{' '}
              <Link to="/legal/cgv" className="text-amber-400 hover:underline">Conditions Generales de Vente</Link>,
              constituent l'integralite de l'accord entre l'Utilisateur et l'Editeur.
            </p>
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
            <Link to="/legal/cgv" className="hover:text-white/60 transition-colors">CGV</Link>
            <span>|</span>
            <Link to="/legal#privacy" className="hover:text-white/60 transition-colors">Confidentialite</Link>
          </div>
        </footer>
      </main>
    </div>
  );
};

export default LegalCGU;
