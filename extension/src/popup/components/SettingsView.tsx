import React, { useState, useEffect, ChangeEvent } from 'react';
import { WEBAPP_URL } from '../../utils/config';
import type { ExtensionSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../types';
import { getStoredSettings, setStoredSettings } from '../../utils/storage';

interface SettingsViewProps {
  onBack: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ onBack }) => {
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    getStoredSettings().then(setSettings);
  }, []);

  async function updateSetting<K extends keyof ExtensionSettings>(
    key: K,
    value: ExtensionSettings[K],
  ): Promise<void> {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    await setStoredSettings(updated);
  }

  return (
    <div className="view settings-view">
      <header>
        <button onClick={onBack} className="back-btn">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <h2>Settings</h2>
      </header>

      <div className="settings-list">
        <div className="setting-item">
          <label>Default Mode</label>
          <select
            value={settings.defaultMode}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              updateSetting('defaultMode', e.target.value as ExtensionSettings['defaultMode'])
            }
          >
            <option value="accessible">Standard</option>
            <option value="standard">Advanced</option>
            <option value="expert">Expert</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Default Language</label>
          <select
            value={settings.defaultLang}
            onChange={(e: ChangeEvent<HTMLSelectElement>) =>
              updateSetting('defaultLang', e.target.value as ExtensionSettings['defaultLang'])
            }
          >
            <option value="fr">Fran{'\u00e7'}ais</option>
            <option value="en">English</option>
            <option value="es">Espa{'\u00f1'}ol</option>
            <option value="de">Deutsch</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Notifications</label>
          <label className="toggle-switch">
            <input
              type="checkbox"
              checked={settings.showNotifications}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateSetting('showNotifications', e.target.checked)
              }
            />
            <span className="toggle-slider"></span>
          </label>
        </div>
      </div>

      <div className="settings-footer">
        <a href={`${WEBAPP_URL}/settings`} target="_blank" rel="noreferrer">
          More settings on DeepSight &rarr;
        </a>
      </div>
    </div>
  );
};
