/**
 * Tests for DismissKeyboardView — wrapper qui dismiss le clavier
 * lorsqu'un tap atteint le wrapper sans être absorbé par un enfant.
 */
import React from "react";
import { Keyboard, Text, TextInput } from "react-native";
import { fireEvent, render, screen } from "@testing-library/react-native";

import { DismissKeyboardView } from "../../src/components/ui/DismissKeyboardView";

describe("DismissKeyboardView", () => {
  beforeEach(() => {
    jest.spyOn(Keyboard, "dismiss").mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("renders its children", () => {
    render(
      <DismissKeyboardView>
        <Text>child-content</Text>
      </DismissKeyboardView>,
    );
    expect(screen.getByText("child-content")).toBeTruthy();
  });

  it("calls Keyboard.dismiss when the wrapper is pressed", () => {
    render(
      <DismissKeyboardView testID="wrap">
        <Text>child</Text>
      </DismissKeyboardView>,
    );

    fireEvent.press(screen.getByTestId("wrap"));
    expect(Keyboard.dismiss).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss the keyboard when a child input is focused", () => {
    render(
      <DismissKeyboardView testID="wrap">
        <TextInput testID="input" placeholder="type" />
      </DismissKeyboardView>,
    );

    fireEvent(screen.getByTestId("input"), "focus");
    expect(Keyboard.dismiss).not.toHaveBeenCalled();
  });
});
