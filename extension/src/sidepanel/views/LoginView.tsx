import React, { useState } from "react";
import Browser from "../../utils/browser-polyfill";
import { GoogleIcon } from "../shared/Icons";
import { DoodleIcon } from "../shared/doodles/DoodleIcon";
import { DeepSightSpinner } from "../shared/DeepSightSpinner";
import { useTranslation } from "../../i18n/useTranslation";

interface LoginViewProps {
  onLogin: (email: string, password: string) => Promise<void>;
  onGoogleLogin: () => Promise<void>;
  onGuestMode: () => void;
  error: string | null;
}

export const LoginView: React.FC<LoginViewProps> = ({
  onLogin,
  onGoogleLogin,
  onGuestMode,
  error,
}) => {
  const { t, language, setLanguage } = useTranslation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const displayError = localError || error;

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!email || !password) return;

    setLoading(true);
    setLocalError(null);
    try {
      await onLogin(email, password);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle(): Promise<void> {
    setGoogleLoading(true);
    setLocalError(null);
    try {
      await onGoogleLogin();
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <div className="login-view">
      {/* Doodle decorations */}
      <DoodleIcon
        name="sparkles"
        size={32}
        className="doodle-decoration"
        style={{ top: 20, left: 16, transform: "rotate(-15deg)" }}
      />
      <DoodleIcon
        name="brain"
        size={28}
        className="doodle-decoration"
        style={{ top: 60, right: 20, transform: "rotate(10deg)" }}
      />
      <DoodleIcon
        name="lightning"
        size={24}
        className="doodle-decoration"
        style={{ bottom: 80, left: 24, transform: "rotate(-25deg)" }}
      />
      <DoodleIcon
        name="star"
        size={20}
        className="doodle-decoration"
        style={{ bottom: 120, right: 30, transform: "rotate(20deg)" }}
      />

      {/* Language toggle */}
      <div className="login-lang-toggle">
        <button
          className={`login-lang-btn ${language === "fr" ? "login-lang-active" : ""}`}
          onClick={() => setLanguage("fr")}
        >
          FR
        </button>
        <button
          className={`login-lang-btn ${language === "en" ? "login-lang-active" : ""}`}
          onClick={() => setLanguage("en")}
        >
          EN
        </button>
      </div>

      {/* Hero spinner with platform logos */}
      <div className="login-hero">
        <DeepSightSpinner size="lg" speed="slow" showLogos />
      </div>
      <div className="login-logo">
        <h1>DeepSight</h1>
      </div>

      {/* Tagline */}
      <p className="login-tagline">{t.login.tagline}</p>

      {/* Platform logos */}
      <div className="login-platforms">
        <img
          src={Browser.runtime.getURL("platforms/youtube-icon-red.png")}
          alt="YouTube"
          className="login-platform-logo"
          style={{ height: 20, width: "auto" }}
        />
        <span className="login-platform-sep" />
        <img
          src={Browser.runtime.getURL("platforms/tiktok-note-white.png")}
          alt="TikTok"
          className="login-platform-logo"
          style={{ height: 18, width: "auto" }}
        />
        <span className="login-platform-sep" />
        <img
          src={Browser.runtime.getURL("platforms/mistral-m-orange.svg")}
          alt="Mistral"
          className="login-platform-logo"
          style={{ height: 18, width: "auto" }}
        />
        <span className="login-platform-sep" />
        <img
          src={Browser.runtime.getURL("platforms/tournesol-logo.png")}
          alt="Tournesol"
          className="login-platform-logo"
          style={{ height: 16, width: "auto" }}
        />
      </div>

      {/* Trust badges */}
      <div className="login-badges">
        <span className="login-badge">
          <span className="login-badge-flag">{"\uD83C\uDDEB\uD83C\uDDF7"}</span>{" "}
          {t.login.badgeFr}
        </span>
        <span className="login-badge">
          <span className="login-badge-flag">{"\uD83C\uDDEA\uD83C\uDDFA"}</span>{" "}
          {t.login.badgeEu}
        </span>
      </div>

      {/* Google Login */}
      <button
        className="btn-google"
        onClick={handleGoogle}
        disabled={googleLoading || loading}
      >
        {googleLoading ? (
          t.login.googleLoading
        ) : (
          <>
            <GoogleIcon /> {t.login.googleButton}
          </>
        )}
      </button>

      {/* Divider */}
      <div className="login-divider">{t.login.divider}</div>

      {/* Email/Password */}
      <form className="login-form" onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder={t.login.emailPlaceholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          disabled={loading}
        />
        <input
          type="password"
          placeholder={t.login.passwordPlaceholder}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          disabled={loading}
        />
        {displayError && <div className="login-error">{displayError}</div>}
        <button
          type="submit"
          className="btn-login"
          disabled={loading || !email || !password}
        >
          {loading ? t.login.loginLoading : t.common.login}
        </button>
      </form>

      {/* Guest mode */}
      <button className="btn-guest" onClick={onGuestMode}>
        {t.login.guestButton}
      </button>

      {/* Footer */}
      <div className="login-footer">
        <a
          href="https://www.deepsightsynthesis.com/register"
          target="_blank"
          rel="noreferrer"
        >
          {t.common.createAccount}
        </a>
        <span>&middot;</span>
        <a
          href="https://www.deepsightsynthesis.com/forgot-password"
          target="_blank"
          rel="noreferrer"
        >
          {t.login.forgotPassword}
        </a>
        <span>&middot;</span>
        <a
          href="https://www.deepsightsynthesis.com"
          target="_blank"
          rel="noreferrer"
        >
          deepsightsynthesis.com
        </a>
      </div>

      {/* Legal */}
      <div className="login-legal">
        <a
          href="https://www.deepsightsynthesis.com/legal/privacy"
          target="_blank"
          rel="noreferrer"
        >
          {t.login.privacy}
        </a>
        <span>&middot;</span>
        <a
          href="https://www.deepsightsynthesis.com/legal/cgu"
          target="_blank"
          rel="noreferrer"
        >
          {t.login.terms}
        </a>
      </div>
    </div>
  );
};
