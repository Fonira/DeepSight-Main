import React from "react";
import type { PlanInfo } from "../../types";
import Browser from "../../utils/browser-polyfill";
import { WEBAPP_URL } from "../../utils/config";
import { DoodleIcon } from "./doodles/DoodleIcon";
import { useTranslation } from "../../i18n/useTranslation";

interface FeatureCTAGridProps {
  planInfo: PlanInfo | null;
  summaryId: number;
  isGuest: boolean;
}

interface FeatureItem {
  key: keyof NonNullable<PlanInfo["features"]>;
  doodleName: string;
  labelKey: "flashcards" | "mindMaps" | "webSearch" | "exports" | "playlists";
  descKey:
    | "flashcardsDesc"
    | "mindMapsDesc"
    | "webSearchDesc"
    | "exportsDesc"
    | "playlistsDesc";
  hash: string;
  price: string;
}

const FEATURES: FeatureItem[] = [
  {
    key: "flashcards",
    doodleName: "book",
    labelKey: "flashcards",
    descKey: "flashcardsDesc",
    hash: "#flashcards",
    price: "8,99\u20AC",
  },
  {
    key: "mind_maps",
    doodleName: "brain",
    labelKey: "mindMaps",
    descKey: "mindMapsDesc",
    hash: "#mindmap",
    price: "8,99\u20AC",
  },
  {
    key: "web_search",
    doodleName: "globe",
    labelKey: "webSearch",
    descKey: "webSearchDesc",
    hash: "#websearch",
    price: "8,99\u20AC",
  },
  {
    key: "exports",
    doodleName: "code",
    labelKey: "exports",
    descKey: "exportsDesc",
    hash: "#export",
    price: "8,99\u20AC",
  },
  {
    key: "playlists",
    doodleName: "camera",
    labelKey: "playlists",
    descKey: "playlistsDesc",
    hash: "#playlists",
    price: "8,99\u20AC",
  },
];

export const FeatureCTAGrid: React.FC<FeatureCTAGridProps> = ({
  planInfo,
  summaryId,
  isGuest,
}) => {
  const { t } = useTranslation();

  return (
    <div className="feature-cta-section">
      <h3 className="feature-cta-title">
        {t.teaser?.unlockMore || "Discover more"}
      </h3>
      <div className="feature-cta-grid">
        {FEATURES.map((feat) => {
          const available =
            !isGuest && (planInfo?.features?.[feat.key] ?? false);

          return (
            <button
              key={feat.key}
              className={`feature-cta-card ${available ? "feature-cta-card--available" : "feature-cta-card--locked"}`}
              onClick={() => {
                if (available) {
                  Browser.tabs.create({
                    url: `${WEBAPP_URL}/summary/${summaryId}${feat.hash}`,
                  });
                } else {
                  Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
                }
              }}
            >
              <div className="feature-cta-card__icon">
                <DoodleIcon
                  name={feat.doodleName}
                  size={22}
                  color={
                    available ? "var(--accent-primary)" : "var(--text-tertiary)"
                  }
                />
              </div>
              <span className="feature-cta-card__title">
                {t.features[feat.labelKey]}
              </span>
              <span className="feature-cta-card__desc">
                {(t.features as Record<string, string>)[feat.descKey] || ""}
              </span>
              {!available && (
                <span className="feature-cta-card__badge">
                  {t.features.fromPrice.replace("{price}", feat.price)}
                </span>
              )}
              {available && (
                <span className="feature-cta-card__badge feature-cta-card__badge--open">
                  {"\u2197"}
                </span>
              )}
            </button>
          );
        })}

        {/* Mobile app card */}
        <button
          className="feature-cta-card feature-cta-card--highlight"
          onClick={() => Browser.tabs.create({ url: WEBAPP_URL })}
        >
          <div className="feature-cta-card__icon">
            <DoodleIcon
              name="sparkle4pt"
              size={22}
              color="var(--accent-primary)"
            />
          </div>
          <span className="feature-cta-card__title">Mobile</span>
          <span className="feature-cta-card__desc">
            {(t.features as Record<string, string>).mobileDesc ||
              "DeepSight partout"}
          </span>
          <span className="feature-cta-card__badge feature-cta-card__badge--open">
            {"\u2197"}
          </span>
        </button>
      </div>

      {/* All plans link */}
      <a
        href={`${WEBAPP_URL}/upgrade`}
        className="feature-cta-all-plans"
        onClick={(e) => {
          e.preventDefault();
          Browser.tabs.create({ url: `${WEBAPP_URL}/upgrade` });
        }}
      >
        {t.common.allPlans} {"\u2197"}
      </a>
    </div>
  );
};
