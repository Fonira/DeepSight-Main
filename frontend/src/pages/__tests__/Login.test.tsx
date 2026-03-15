/**
 * 🧪 Tests — Login Page
 * Coverage: Form rendering, validation, auth flow, errors, OAuth
 *
 * NOTES:
 * - useAuth est mocké pour contrôler login/register/OAuth
 * - Langue par défaut = FR (via LanguageProvider)
 * - Les labels n'ont pas htmlFor → on utilise getByPlaceholderText
 * - Quand authLoading=true → le composant rend un spinner, pas le form
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '../../__tests__/test-utils';
import { Login } from '../Login';

// Mock useAuth hook
vi.mock('../../hooks/useAuth', () => ({
  useAuth: vi.fn()
}));

import { useAuth } from '../../hooks/useAuth';

// ═══════════════════════════════════════════════════════════════════════════════
// 🧹 SETUP & TEARDOWN
// ═══════════════════════════════════════════════════════════════════════════════

const mockUseAuth = useAuth as ReturnType<typeof vi.fn>;

const defaultAuthState = {
  user: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  loading: false,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  logout: vi.fn(),
  refreshUser: vi.fn()
};

beforeEach(() => {
  localStorage.clear();
  mockUseAuth.mockReturnValue({ ...defaultAuthState });
});

afterEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ RENDERING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Rendering', () => {
  it('should render login form with title', () => {
    renderWithProviders(<Login />);
    // FR: "Bon retour !" est dans le h2
    expect(screen.getByRole('heading', { name: /Bon retour/i })).toBeInTheDocument();
  });

  it('should render email input', () => {
    renderWithProviders(<Login />);
    // Le label "Adresse email" n'a pas htmlFor → on cherche par placeholder
    expect(screen.getByPlaceholderText('you@example.com')).toBeInTheDocument();
  });

  it('should render password input', () => {
    renderWithProviders(<Login />);
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    renderWithProviders(<Login />);
    // FR: "Se connecter" est le texte du bouton submit
    expect(screen.getByRole('button', { name: /Se connecter/i })).toBeInTheDocument();
  });

  it('should render register link', () => {
    renderWithProviders(<Login />);
    // FR: "Créer un compte"
    expect(screen.getByText(/Créer un compte/)).toBeInTheDocument();
  });

  it('should render Google OAuth button', () => {
    renderWithProviders(<Login />);
    // FR: "Continuer avec Google"
    expect(screen.getByRole('button', { name: /Continuer avec Google/i })).toBeInTheDocument();
  });

  it('should render logo', () => {
    renderWithProviders(<Login />);
    // Multiple "Deep Sight" alt images — use getAllByAltText
    const logos = screen.getAllByAltText(/Deep Sight/);
    expect(logos.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✏️ FORM INTERACTION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Form Interaction', () => {
  it('should accept email input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com') as HTMLInputElement;
    await user.type(emailInput, 'test@example.com');

    expect(emailInput).toHaveValue('test@example.com');
  });

  it('should accept password input', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    await user.type(passwordInput, 'password123');

    expect(passwordInput).toHaveValue('password123');
  });

  it('should render password visibility toggle button', () => {
    renderWithProviders(<Login />);

    // The toggle button is among the buttons
    const toggleButtons = screen.getAllByRole('button');
    // At least: Google, eye toggle, submit
    expect(toggleButtons.length).toBeGreaterThanOrEqual(3);
  });

  it('should toggle password visibility on click', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const passwordInput = screen.getByPlaceholderText('••••••••') as HTMLInputElement;
    expect(passwordInput.type).toBe('password');

    // The eye toggle button has tabIndex -1, find it near password field
    const buttons = screen.getAllByRole('button', { hidden: true });
    // tabIndex=-1 means it's "hidden" from accessible roles unless we use hidden:true
    // Let's find the button in the password's parent
    const passwordContainer = passwordInput.closest('.relative');
    const toggleBtn = passwordContainer?.querySelector('button[type="button"]');
    expect(toggleBtn).toBeTruthy();

    if (toggleBtn) {
      await user.click(toggleBtn as HTMLElement);
      expect(passwordInput.type).toBe('text');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ✅ FORM VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Form Validation', () => {
  it('should show error when email is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const button = screen.getByRole('button', { name: /Se connecter/ });
    await user.click(button);

    // FR: "Veuillez remplir tous les champs"
    await waitFor(() => {
      expect(screen.getByText(/Veuillez remplir tous les champs/i)).toBeInTheDocument();
    });
  });

  it('should show error when password is empty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    await user.type(emailInput, 'test@example.com');

    const button = screen.getByRole('button', { name: /Se connecter/ });
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Veuillez remplir tous les champs/i)).toBeInTheDocument();
    });
  });

  it('should not call login when validation fails', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn();
    mockUseAuth.mockReturnValue({ ...defaultAuthState, login: mockLogin });

    renderWithProviders(<Login />);

    const button = screen.getByRole('button', { name: /Se connecter/ });
    await user.click(button);

    expect(mockLogin).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔓 LOGIN FLOW
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Login Flow', () => {
  it('should call login with valid credentials', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...defaultAuthState, login: mockLogin });

    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const button = screen.getByRole('button', { name: /Se connecter/ });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password123');
    await user.click(button);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
    });
  });

  it('should show spinner when authLoading is true', () => {
    // Quand authLoading=true, le composant rend un spinner (pas le formulaire)
    mockUseAuth.mockReturnValue({ ...defaultAuthState, isLoading: true });

    const { container } = renderWithProviders(<Login />);

    // Le spinner est un div avec border-accent-primary
    const spinner = container.querySelector('[class*="border-accent-primary"]');
    expect(spinner).toBeInTheDocument();

    // Le formulaire n'est PAS rendu
    expect(screen.queryByPlaceholderText('you@example.com')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// ❌ ERROR HANDLING
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Error Handling', () => {
  it('should display error when login fails', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    mockUseAuth.mockReturnValue({ ...defaultAuthState, login: mockLogin });

    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const button = screen.getByRole('button', { name: /Se connecter/ });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'wrongpassword');
    await user.click(button);

    // Error should be displayed
    await waitFor(() => {
      expect(screen.getByText(/Invalid credentials/)).toBeInTheDocument();
    });
  });

  it('should render error from component local state after failed submit', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockRejectedValue(new Error('Service temporarily unavailable.'));
    mockUseAuth.mockReturnValue({ ...defaultAuthState, login: mockLogin });

    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const button = screen.getByRole('button', { name: /Se connecter/ });

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, 'password');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText(/Service temporarily unavailable/)).toBeInTheDocument();
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔐 GOOGLE OAUTH
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Google OAuth', () => {
  it('should render Google login button', () => {
    renderWithProviders(<Login />);
    expect(screen.getByRole('button', { name: /Continuer avec Google/i })).toBeInTheDocument();
  });

  it('should call loginWithGoogle when button clicked', async () => {
    const user = userEvent.setup();
    const mockLoginWithGoogle = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...defaultAuthState, loginWithGoogle: mockLoginWithGoogle });

    renderWithProviders(<Login />);

    const googleButton = screen.getByRole('button', { name: /Continuer avec Google/i });
    await user.click(googleButton);

    expect(mockLoginWithGoogle).toHaveBeenCalled();
  });

  it('should show loading state spinner when authLoading', () => {
    mockUseAuth.mockReturnValue({ ...defaultAuthState, isLoading: true });

    const { container } = renderWithProviders(<Login />);

    // Le spinner est rendu au lieu du formulaire
    const spinner = container.querySelector('[class*="border-accent-primary"]');
    expect(spinner).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🔗 NAVIGATION & REDIRECTS
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Navigation', () => {
  it('should show register link toggle', () => {
    renderWithProviders(<Login />);
    expect(screen.getByText(/Créer un compte/)).toBeInTheDocument();
  });

  it('should not redirect when not authenticated', () => {
    mockUseAuth.mockReturnValue({ ...defaultAuthState });

    renderWithProviders(<Login />);

    expect(screen.getByRole('button', { name: /Se connecter/ })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 🎯 EDGE CASES
// ═══════════════════════════════════════════════════════════════════════════════

describe('Login Page - Edge Cases', () => {
  it('should accept email with special characters', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...defaultAuthState, login: mockLogin });

    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const button = screen.getByRole('button', { name: /Se connecter/ });

    await user.type(emailInput, 'test+tag@example.co.uk');
    await user.type(passwordInput, 'password123');
    await user.click(button);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('test+tag@example.co.uk', 'password123');
    });
  });

  it('should accept very long password', async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ ...defaultAuthState, login: mockLogin });

    renderWithProviders(<Login />);

    const emailInput = screen.getByPlaceholderText('you@example.com');
    const passwordInput = screen.getByPlaceholderText('••••••••');
    const button = screen.getByRole('button', { name: /Se connecter/ });

    const longPassword = 'password' + 'x'.repeat(100);

    await user.type(emailInput, 'test@example.com');
    await user.type(passwordInput, longPassword);
    await user.click(button);

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    });
  });

  it('should show spinner (not form) when authLoading is true', () => {
    mockUseAuth.mockReturnValue({ ...defaultAuthState, isLoading: true });

    const { container } = renderWithProviders(<Login />);

    // Spinner est rendu, pas de bouton "Se connecter"
    expect(container.querySelector('[class*="border-accent-primary"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Se connecter/ })).not.toBeInTheDocument();
  });
});
