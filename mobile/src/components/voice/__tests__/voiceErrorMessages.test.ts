/**
 * voiceErrorMessages.test.ts — messages FR/EN des erreurs de l'appel vocal.
 */
import { voiceErrorMessage, voiceErrorTitle } from "../voiceErrorMessages";

const fr = (frText: string) => frText;
const en = (_frText: string, enText: string) => enText;

describe("voiceErrorMessages", () => {
  it("service indisponible : titre et message dédiés, en FR et EN", () => {
    expect(voiceErrorTitle("SERVICE_UNAVAILABLE", fr)).toBe("Appel vocal indisponible");
    expect(voiceErrorTitle("SERVICE_UNAVAILABLE", en)).toBe("Voice call unavailable");
    expect(voiceErrorMessage("SERVICE_UNAVAILABLE", "x", fr)).toContain(
      "momentanément indisponible",
    );
    expect(voiceErrorMessage("SERVICE_UNAVAILABLE", "x", en)).toContain(
      "temporarily unavailable",
    );
  });

  it("micro refusé traduit en anglais", () => {
    expect(voiceErrorMessage("MICROPHONE_DENIED", "x", en)).toBe(
      "Allow microphone access in your device settings.",
    );
  });

  it("code inconnu ou absent : message d'origine", () => {
    expect(voiceErrorMessage(undefined, "Erreur SDK", en)).toBe("Erreur SDK");
    expect(voiceErrorTitle(undefined, en)).toBe("Voice call");
  });
});
