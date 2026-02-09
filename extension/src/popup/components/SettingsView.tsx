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
          &larr; Back
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
            <option value="accessible">{'\u{1F4D6}'} Accessible</option>
            <option value="standard">{'\u{1F4CB}'} Standard</option>
            <option value="expert">{'\u{1F393}'} Expert</option>
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
            <option value="fr">{'\u{1F1EB}\u{1F1F7}'} French</option>
            <option value="en">{'\u{1F1EC}\u{1F1E7}'} English</option>
            <option value="es">{'\u{1F1EA}\u{1F1F8}'} Spanish</option>
            <option value="de">{'\u{1F1E9}\u{1F1EA}'} German</option>
          </select>
        </div>

        <div className="setting-item">
          <label>Notifications</label>
          <input
            type="checkbox"
            checked={settings.showNotifications}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateSetting('showNotifications', e.target.checked)
            }
          />
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
