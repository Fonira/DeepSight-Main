/**
 * useChat.test.ts — une question qui échoue affiche un message adapté à l'erreur
 * (avant : toujours « Désolé, une erreur est survenue. Réessayez. »).
 */
import { act, renderHook } from "@testing-library/react-native";

const mockSendMessage = jest.fn();

jest.mock("../../services/api", () => ({
  chatApi: {
    sendMessage: (...args: unknown[]) => mockSendMessage(...args),
    getHistory: jest.fn(),
  },
}));

import { ApiError } from "../../services/apiErrors";
import { useChat } from "../useChat";

describe("useChat", () => {
  beforeEach(() => mockSendMessage.mockReset());

  it("quota de chat atteint : message dédié dans le fil", async () => {
    mockSendMessage.mockRejectedValue(
      new ApiError("Chat limit reached: daily quota", 429, "Chat limit reached: daily quota"),
    );
    const { result } = renderHook(() => useChat("42"));

    await act(async () => {
      await result.current.sendMessage("Bonjour ?");
    });

    const last = result.current.messages[result.current.messages.length - 1];
    expect(last.role).toBe("assistant");
    expect(last.content).toContain("Limite de questions");
    expect(result.current.isLoading).toBe(false);
  });

  it("réponse normale ajoutée au fil", async () => {
    mockSendMessage.mockResolvedValue({ response: "Voici la réponse." });
    const { result } = renderHook(() => useChat("42"));

    await act(async () => {
      await result.current.sendMessage("Question");
    });

    expect(result.current.messages.map((m) => m.content)).toEqual([
      "Question",
      "Voici la réponse.",
    ]);
  });
});
