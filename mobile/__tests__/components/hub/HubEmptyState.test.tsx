/**
 * Tests for HubEmptyState — empty state du tab Hub.
 *
 * Couvre spec §4.6 + §10.1 :
 *   - rendu titre + 2 CTA
 *   - onPickConv() callback
 *   - onPasteUrl(url) callback avec URL valide YouTube/TikTok
 */
import React from "react";
import { render, fireEvent } from "@testing-library/react-native";
import { Alert } from "react-native";

// Theme mock — cohérent avec les autres tests
jest.mock("../../../src/contexts/ThemeContext", () => {
  const { darkColors } = jest.requireActual("../../../src/theme/colors");
  return {
    useTheme: () => ({
      colors: darkColors,
      isDark: true,
      theme: "dark" as const,
      setTheme: jest.fn(),
      toggleTheme: jest.fn(),
    }),
  };
});

jest.spyOn(Alert, "alert").mockImplementation(() => {});

import { HubEmptyState } from "../../../src/components/hub/HubEmptyState";

describe("HubEmptyState", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders title and 2 CTAs", () => {
    const { getByText } = render(
      <HubEmptyState onPickConv={jest.fn()} onPasteUrl={jest.fn()} />,
    );
    expect(getByText(/aucune conversation/i)).toBeTruthy();
    expect(getByText(/choisir une conversation/i)).toBeTruthy();
  });

  it("calls onPickConv when 'Choisir' CTA tapped", () => {
    const onPickConv = jest.fn();
    const { getByText } = render(
      <HubEmptyState onPickConv={onPickConv} onPasteUrl={jest.fn()} />,
    );
    fireEvent.press(getByText(/choisir une conversation/i));
    expect(onPickConv).toHaveBeenCalled();
  });

  it("calls onPasteUrl when valid URL submitted", () => {
    const onPasteUrl = jest.fn();
    const { getByPlaceholderText } = render(
      <HubEmptyState onPickConv={jest.fn()} onPasteUrl={onPasteUrl} />,
    );
    const input = getByPlaceholderText(/youtube\.com|tiktok\.com/i);
    fireEvent.changeText(input, "https://youtube.com/watch?v=abc");
    fireEvent(input, "submitEditing");
    expect(onPasteUrl).toHaveBeenCalledWith("https://youtube.com/watch?v=abc");
  });
});
