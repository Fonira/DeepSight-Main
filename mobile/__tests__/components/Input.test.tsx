import React from 'react';
import { render, fireEvent, screen, act } from '@testing-library/react-native';

// Mock theme context
jest.mock('../../src/contexts/ThemeContext', () => ({
  useTheme: () => ({
    colors: {
      bgElevated: '#1F1F23',
      textPrimary: '#FFFFFF',
      textSecondary: '#B8B8C0',
      textTertiary: '#8E8E96',
      textMuted: '#5E5E66',
      border: '#2A2A2F',
      accentPrimary: '#7C3AED',
      accentError: '#EF4444',
    },
  }),
}));

// Import after mocks
import { Input } from '../../src/components/ui/Input';

describe('Input Component', () => {
  describe('Rendering', () => {
    it('should render basic input', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });

    it('should render with label', () => {
      render(<Input label="Email" placeholder="Enter email" />);
      expect(screen.getByText('Email')).toBeTruthy();
    });

    it('should render with left icon', () => {
      render(<Input leftIcon="mail" placeholder="Email" />);
      expect(screen.getByPlaceholderText('Email')).toBeTruthy();
    });

    it('should render with right icon', () => {
      render(<Input rightIcon="close" placeholder="Search" />);
      expect(screen.getByPlaceholderText('Search')).toBeTruthy();
    });

    it('should render error message', () => {
      render(<Input error="This field is required" placeholder="Email" />);
      expect(screen.getByText('This field is required')).toBeTruthy();
    });

    it('should render hint text', () => {
      render(<Input hint="Enter a valid email address" placeholder="Email" />);
      expect(screen.getByText('Enter a valid email address')).toBeTruthy();
    });

    it('should not render hint when error is present', () => {
      render(
        <Input
          error="Invalid email"
          hint="Enter a valid email address"
          placeholder="Email"
        />
      );
      expect(screen.getByText('Invalid email')).toBeTruthy();
      expect(screen.queryByText('Enter a valid email address')).toBeNull();
    });
  });

  describe('Password Input', () => {
    it('should hide password by default', () => {
      render(<Input secureTextEntry placeholder="Password" />);
      const input = screen.getByPlaceholderText('Password');
      expect(input.props.secureTextEntry).toBe(true);
    });

    it('should show password toggle button', () => {
      render(<Input secureTextEntry placeholder="Password" />);
      expect(screen.getByTestId('password-toggle')).toBeTruthy();
    });

    it('should toggle password visibility when button pressed', async () => {
      render(<Input secureTextEntry placeholder="Password" />);

      const toggleButton = screen.getByTestId('password-toggle');
      await act(async () => {
        fireEvent.press(toggleButton);
      });

      const input = screen.getByPlaceholderText('Password');
      expect(input.props.secureTextEntry).toBe(false);
    });

    it('should toggle back to hidden', async () => {
      render(<Input secureTextEntry placeholder="Password" />);

      const toggleButton = screen.getByTestId('password-toggle');

      await act(async () => {
        fireEvent.press(toggleButton);
      });
      expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(false);

      await act(async () => {
        fireEvent.press(toggleButton);
      });
      expect(screen.getByPlaceholderText('Password').props.secureTextEntry).toBe(true);
    });
  });

  describe('Text Input - Controlled', () => {
    it('should call onChangeText when text changes', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, 'Hello World');

      expect(onChangeText).toHaveBeenCalledWith('Hello World');
    });

    it('should display controlled value', () => {
      render(<Input value="Controlled Value" placeholder="Enter text" />);
      const input = screen.getByPlaceholderText('Enter text');
      expect(input.props.value).toBe('Controlled Value');
    });

    it('should handle empty string', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, '');

      expect(onChangeText).toHaveBeenCalledWith('');
    });

    it('should handle long text', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      const longText = 'a'.repeat(10000);
      fireEvent.changeText(input, longText);

      expect(onChangeText).toHaveBeenCalledWith(longText);
    });

    it('should handle special characters', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, '!@#$%^&*()_+-=[]{}|;:\'",./<>?/`~');

      expect(onChangeText).toHaveBeenCalledWith('!@#$%^&*()_+-=[]{}|;:\'",./<>?/`~');
    });

    it('should handle unicode characters', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent.changeText(input, 'Hello World');

      expect(onChangeText).toHaveBeenCalled();
    });
  });

  describe('Focus State', () => {
    it('should call onFocus when focused', () => {
      const onFocus = jest.fn();
      render(<Input placeholder="Enter text" onFocus={onFocus} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent(input, 'focus');

      expect(onFocus).toHaveBeenCalled();
    });

    it('should call onBlur when blurred', () => {
      const onBlur = jest.fn();
      render(<Input placeholder="Enter text" onBlur={onBlur} />);

      const input = screen.getByPlaceholderText('Enter text');
      fireEvent(input, 'blur');

      expect(onBlur).toHaveBeenCalled();
    });
  });

  describe('Border Color', () => {
    it('should have error border when error prop is set', () => {
      render(<Input error="Error message" placeholder="Email" />);
      expect(screen.getByText('Error message')).toBeTruthy();
    });

    it('should have default border when not focused and no error', () => {
      render(<Input placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });
  });

  describe('Right Icon Press', () => {
    it('should call onRightIconPress when right icon pressed', async () => {
      const mockOnPress = jest.fn();
      render(
        <Input
          rightIcon="close"
          onRightIconPress={mockOnPress}
          placeholder="Search"
        />
      );

      const rightIconButton = screen.getByTestId('right-icon-button');
      await act(async () => {
        fireEvent.press(rightIconButton);
      });
      expect(mockOnPress).toHaveBeenCalled();
    });

    it('should be disabled when onRightIconPress not provided', () => {
      render(<Input rightIcon="close" placeholder="Search" />);
      const rightIconButton = screen.getByTestId('right-icon-button');
      expect(rightIconButton.props.accessibilityState?.disabled).toBe(true);
    });
  });

  describe('Ref Forwarding', () => {
    it('should forward ref to TextInput', () => {
      const ref = React.createRef<any>();
      render(<Input ref={ref} placeholder="Enter text" />);
      expect(ref.current).toBeTruthy();
    });
  });

  describe('Custom Styles', () => {
    it('should apply custom container style', () => {
      render(
        <Input
          containerStyle={{ marginTop: 20 }}
          placeholder="Enter text"
        />
      );
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });

    it('should apply custom input style', () => {
      render(
        <Input
          style={{ fontSize: 20 }}
          placeholder="Enter text"
        />
      );
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });
  });

  describe('Security Tests', () => {
    it('should handle XSS attempt in input', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      const xssString = '<script>alert("xss")</script>';
      fireEvent.changeText(input, xssString);

      expect(onChangeText).toHaveBeenCalledWith(xssString);
    });

    it('should handle SQL injection attempt', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');
      const sqlString = "'; DROP TABLE users;--";
      fireEvent.changeText(input, sqlString);

      expect(onChangeText).toHaveBeenCalledWith(sqlString);
    });

    it('should not execute javascript: URLs', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter URL" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter URL');
      fireEvent.changeText(input, 'javascript:alert(1)');

      expect(onChangeText).toHaveBeenCalledWith('javascript:alert(1)');
    });
  });

  describe('Accessibility', () => {
    it('should have accessible label when label provided', () => {
      render(<Input label="Email" placeholder="Enter email" />);
      expect(screen.getByText('Email')).toBeTruthy();
    });

    it('should announce error to screen reader', () => {
      render(<Input error="Invalid email" placeholder="Email" />);
      expect(screen.getByText('Invalid email')).toBeTruthy();
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined value', () => {
      render(<Input placeholder="Enter text" value={undefined} />);
      expect(screen.getByPlaceholderText('Enter text')).toBeTruthy();
    });

    it('should handle rapid text changes', () => {
      const onChangeText = jest.fn();
      render(<Input placeholder="Enter text" onChangeText={onChangeText} />);

      const input = screen.getByPlaceholderText('Enter text');

      for (let i = 0; i < 100; i++) {
        fireEvent.changeText(input, `text${i}`);
      }

      expect(onChangeText).toHaveBeenCalledTimes(100);
      expect(onChangeText).toHaveBeenLastCalledWith('text99');
    });

    it('should update when value prop changes', () => {
      const { rerender } = render(<Input value="Initial" placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text').props.value).toBe('Initial');

      rerender(<Input value="Updated" placeholder="Enter text" />);
      expect(screen.getByPlaceholderText('Enter text').props.value).toBe('Updated');
    });
  });
});
