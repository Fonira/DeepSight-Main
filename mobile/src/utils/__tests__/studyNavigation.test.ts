/**
 * studyNavigation.test.ts — « Chat IA » (onglet Étude) ouvre le chat de la vidéo.
 * Régression : initialTab "1" ouvrait l'onglet Sources du détail d'analyse.
 */
import { hubChatRoute } from "../studyNavigation";

describe("hubChatRoute", () => {
  it("ouvre le Hub en mode chat pour la vidéo", () => {
    expect(hubChatRoute(42)).toEqual({
      pathname: "/(tabs)/hub",
      params: { summaryId: "42", initialMode: "chat" },
    });
  });

  it("accepte un id déjà en chaîne", () => {
    expect(hubChatRoute("7").params.summaryId).toBe("7");
  });
});
