/**
 * DEEP SIGHT — Right Sidebar
 * Premium insight panel with concepts, Tournesol picks, and recent activity.
 * Visible on xl+ screens, collapsible via toggle button.
 */

import React, { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';
import { useRightSidebarStore } from '../../store/rightSidebarStore';
import { useRightSidebarData } from '../../hooks/useRightSidebarData';
import { useAuth } from '../../hooks/useAuth';
import { useLanguage } from '../../contexts/LanguageContext';
import { ConceptCard } from './right-sidebar/ConceptCard';
import { TournesolPicks } from './right-sidebar/TournesolPicks';
import { RecentActivity } from './right-sidebar/RecentActivity';
import { UpgradeCTA } from './right-sidebar/UpgradeCTA';
import GouvernailSpinner from '../ui/GouvernailSpinner';

const SIDEBAR_WIDTH = 280;

const sidebarVariants = {
  open: {
    x: 0,
    opacity: 1,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
  closed: {
    x: SIDEBAR_WIDTH,
    opacity: 0,
    transition: { duration: 0.2, ease: [0.4, 0, 0.2, 1] },
  },
};

const staggerContainer = {
  open: {
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
};

const staggerItem = {
  open: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.4, 0, 0.2, 1] },
  },
  closed: {
    opacity: 0,
    y: 12,
  },
};

export const RightSidebar: React.FC = () => {
  const { isOpen, toggle } = useRightSidebarStore();
  const { user } = useAuth();
  const { language } = useLanguage();
  const navigate = useNavigate();

  const {
    tournesolPicks,
    recentActivity,
    isLoadingTournesol,
    isLoadingActivity,
    refreshTournesol,
  } = useRightSidebarData();

  const handleAnalyze = useCallback((videoId: string) => {
    navigate(`/dashboard?url=https://www.youtube.com/watch?v=${videoId}`);
  }, [navigate]);

  const userPlan = user?.plan || 'free';

  return (
    <>
      {/* Toggle button — always visible on xl+ */}
      <button
        onClick={toggle}
        className="hidden xl:flex fixed z-40 items-center justify-center w-7 h-14 rounded-l-lg bg-bg-secondary border border-r-0 border-border-default hover:border-accent-primary/30 hover:bg-bg-tertiary transition-all group"
        style={{
          top: '50%',
          transform: 'translateY(-50%)',
          right: isOpen ? SIDEBAR_WIDTH : 0,
          transition: 'right 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
        }}
        title={isOpen
          ? (language === 'fr' ? 'Masquer le panneau' : 'Hide panel')
          : (language === 'fr' ? 'Afficher le panneau' : 'Show panel')
        }
      >
        {isOpen ? (
          <PanelRightClose className="w-3.5 h-3.5 text-text-tertiary group-hover:text-accent-primary transition-colors" />
        ) : (
          <PanelRightOpen className="w-3.5 h-3.5 text-text-tertiary group-hover:text-accent-primary transition-colors" />
        )}
      </button>

      {/* Sidebar panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.aside
            variants={sidebarVariants}
            initial="closed"
            animate="open"
            exit="closed"
            className="hidden xl:block fixed right-0 top-0 h-screen z-30 border-l border-border-subtle bg-bg-secondary overflow-hidden"
            style={{ width: SIDEBAR_WIDTH }}
          >
            {/* Inner scrollable area */}
            <div className="h-full overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              <div className="p-4 space-y-5">

                {/* Header with Gouvernail ornament */}
                <div className="flex items-center gap-2 pb-2 border-b border-border-subtle">
                  <GouvernailSpinner
                    size={18}
                    color="var(--accent-primary)"
                    variant="spin"
                  />
                  <h2 className="font-display text-sm font-semibold text-text-primary tracking-wide">
                    Insights
                  </h2>
                </div>

                {/* Staggered sections */}
                <motion.div
                  variants={staggerContainer}
                  initial="closed"
                  animate="open"
                  className="space-y-5"
                >
                  {/* Section 1: Le Saviez-Vous? */}
                  <motion.div variants={staggerItem}>
                    <ConceptCard />
                  </motion.div>

                  {/* Divider */}
                  <div className="border-t border-border-subtle/50" />

                  {/* Section 2: Tournesol Picks */}
                  <motion.div variants={staggerItem}>
                    <TournesolPicks
                      picks={tournesolPicks}
                      isLoading={isLoadingTournesol}
                      onRefresh={refreshTournesol}
                      onAnalyze={handleAnalyze}
                    />
                  </motion.div>

                  {/* Divider */}
                  <div className="border-t border-border-subtle/50" />

                  {/* Section 3: Recent Activity */}
                  <motion.div variants={staggerItem}>
                    <RecentActivity
                      items={recentActivity}
                      isLoading={isLoadingActivity}
                    />
                  </motion.div>

                  {/* Section 4: Upgrade CTA (conditional) */}
                  <motion.div variants={staggerItem}>
                    <UpgradeCTA plan={userPlan} />
                  </motion.div>
                </motion.div>

                {/* Bottom doodle ornament */}
                <div className="flex justify-center pt-2 opacity-[0.06]">
                  <svg viewBox="0 0 48 48" width={32} height={32} fill="none" stroke="var(--accent-primary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="24" cy="24" r="20" opacity="0.3" />
                    <circle cx="24" cy="24" r="12" opacity="0.2" />
                    <line x1="24" y1="4" x2="24" y2="11" />
                    <line x1="37.25" y1="10.75" x2="33.2" y2="14.8" />
                    <line x1="44" y1="24" x2="37" y2="24" />
                    <line x1="37.25" y1="37.25" x2="33.2" y2="33.2" />
                    <line x1="24" y1="44" x2="24" y2="37" />
                    <line x1="10.75" y1="37.25" x2="14.8" y2="33.2" />
                    <line x1="4" y1="24" x2="11" y2="24" />
                    <line x1="10.75" y1="10.75" x2="14.8" y2="14.8" />
                    <circle cx="24" cy="24" r="3" />
                  </svg>
                </div>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
};

export default RightSidebar;
