/**
 * SearchBar.test.tsx — Phase 3 Mobile, Task 3
 *
 * Tests UI du champ de recherche racine du tab Search :
 *   - placeholder rendu
 *   - propagation onChangeText
 *   - bouton clear visible si value non vide
 *   - bouton clear absent si value vide
 */

import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import { SearchBar } from "../SearchBar";
import { ThemeProvider } from "@/contexts/ThemeContext";

const renderWithTheme = (ui: React.ReactElement) =>
  render(<ThemeProvider>{ui}</ThemeProvider>);

describe("SearchBar (search tab)", () => {
  it("affiche le placeholder par défaut", () => {
    const { getByPlaceholderText } = renderWithTheme(
      <SearchBar value="" onChangeText={jest.fn()} />,
    );
    expect(getByPlaceholderText(/rechercher/i)).toBeTruthy();
  });

  it("propage onChangeText à chaque frappe", () => {
    const onChange = jest.fn();
    const { getByPlaceholderText } = renderWithTheme(
      <SearchBar value="" onChangeText={onChange} />,
    );
    fireEvent.changeText(getByPlaceholderText(/rechercher/i), "transition");
    expect(onChange).toHaveBeenCalledWith("transition");
  });

  it("affiche le bouton clear quand value non vide et le déclenche", () => {
    const onChange = jest.fn();
    const { getByLabelText } = renderWithTheme(
      <SearchBar value="abc" onChangeText={onChange} />,
    );
    const clearBtn = getByLabelText(/effacer/i);
    fireEvent.press(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("ne montre pas le bouton clear si value vide", () => {
    const { queryByLabelText } = renderWithTheme(
      <SearchBar value="" onChangeText={jest.fn()} />,
    );
    expect(queryByLabelText(/effacer/i)).toBeNull();
  });
});
