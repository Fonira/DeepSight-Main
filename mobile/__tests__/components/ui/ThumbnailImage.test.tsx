/**
 * ThumbnailImage — une cellule FlashList recyclée pour une autre vidéo repart de
 * sa première URL (avant : l'index de repli / l'échec de la vidéo précédente restaient).
 */
import React from "react";
import { act, render } from "@testing-library/react-native";
import { ThumbnailImage } from "../../../src/components/ui/ThumbnailImage";

interface ImageProps {
  source: { uri: string };
  onError: () => void;
}

function currentImage(screen: ReturnType<typeof render>): ImageProps {
  return screen.UNSAFE_getByType("Image" as unknown as React.ComponentType)
    .props as ImageProps;
}

describe("ThumbnailImage", () => {
  it("passe à la miniature YouTube suivante sur erreur", () => {
    const screen = render(<ThumbnailImage uri="https://cdn/a.webp" videoId="vidA" />);
    expect(currentImage(screen).source.uri).toBe("https://cdn/a.webp");

    act(() => currentImage(screen).onError());
    expect(currentImage(screen).source.uri).toContain("/vi/vidA/");
    expect(currentImage(screen).source.uri).not.toBe("https://cdn/a.webp");
  });

  it("cellule recyclée avec une autre vidéo : repart de sa première URL", () => {
    const screen = render(<ThumbnailImage uri="https://cdn/a.webp" videoId="vidA" />);
    act(() => currentImage(screen).onError());
    act(() => currentImage(screen).onError());

    screen.rerender(<ThumbnailImage uri="https://cdn/b.webp" videoId="vidB" />);
    expect(currentImage(screen).source.uri).toBe("https://cdn/b.webp");
  });
});
