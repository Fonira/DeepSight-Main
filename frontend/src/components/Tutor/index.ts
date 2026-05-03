/**
 * 🎓 Le Tuteur — Public exports.
 *
 * Le composant `Tutor` est le mount à utiliser dans le layout des routes
 * protégées. Il gère lui-même la state machine (useTutor) et compose les
 * 4 sous-composants visuels (Idle / Prompting / MiniChat / DeepSession).
 */

export { Tutor, default } from "./Tutor";
export { useTutor } from "./useTutor";
export { TutorIdle } from "./TutorIdle";
export { TutorPrompting } from "./TutorPrompting";
export { TutorMiniChat } from "./TutorMiniChat";
export { TutorDeepSession } from "./TutorDeepSession";
