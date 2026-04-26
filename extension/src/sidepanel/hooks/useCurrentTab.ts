import { useEffect, useState } from "react";
import { detectPlatform } from "../../utils/video";

export type Platform = "youtube" | "tiktok" | null;

export interface CurrentTabInfo {
  url: string | null;
  platform: Platform;
  tabId: number | null;
}

const queryActiveTab = async (): Promise<CurrentTabInfo> => {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab) {
    return { url: null, platform: null, tabId: null };
  }
  return {
    url: tab.url ?? null,
    platform: tab.url ? (detectPlatform(tab.url) as Platform) : null,
    tabId: tab.id ?? null,
  };
};

export function useCurrentTab(): CurrentTabInfo {
  const [info, setInfo] = useState<CurrentTabInfo>({
    url: null,
    platform: null,
    tabId: null,
  });

  useEffect(() => {
    let cancelled = false;

    queryActiveTab().then((next) => {
      if (!cancelled) setInfo(next);
    });

    const onMessage = (msg: any) => {
      if (msg?.action === "VIDEO_URL_UPDATED" && msg.payload) {
        setInfo((prev) => ({
          ...prev,
          url: msg.payload.url ?? prev.url,
          platform: (msg.payload.platform ?? null) as Platform,
        }));
      } else if (msg?.action === "TAB_CHANGED") {
        queryActiveTab().then((next) => {
          if (!cancelled) setInfo(next);
        });
      }
    };

    chrome.runtime.onMessage.addListener(onMessage);

    return () => {
      cancelled = true;
      chrome.runtime.onMessage.removeListener(onMessage);
    };
  }, []);

  return info;
}
