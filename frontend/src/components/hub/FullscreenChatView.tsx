// frontend/src/components/hub/FullscreenChatView.tsx
//
// Vue dispatcher pour les chats plein écran rendus depuis HubPage quand
// l'URL porte `?fsChat=<type>` (V2 — mai 2026). Architecture extensible
// pour ajouter quickchat, debate, etc. plus tard. V1 ne supporte que
// `tutor`.

import React from "react";
import { TutorFullscreen } from "../Tutor/TutorFullscreen";

export interface FullscreenChatViewProps {
  /** Type lu depuis l'URL `?fsChat=<type>`. */
  chatType: string;
}

export const FullscreenChatView: React.FC<FullscreenChatViewProps> = ({
  chatType,
}) => {
  if (chatType === "tutor") return <TutorFullscreen />;
  // V1 : seul "tutor" supporté. Architecture extensible pour quickchat,
  // debate, etc. — retourner null permet à HubPage de fallback sur le
  // rendu hub normal si un type inconnu apparaît dans l'URL.
  return null;
};

export default FullscreenChatView;
