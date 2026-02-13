/**
 * FeatureValidator - Système de validation automatique des fonctionnalités
 *
 * Permet de valider que chaque feature fonctionne correctement avant
 * et après les modifications. Utilisé pour prévenir les régressions.
 */

import { API_BASE_URL } from '../constants/config';
import { tokenStorage } from './storage';

// Types de validation
export type ValidationStatus = 'pending' | 'success' | 'warning' | 'error';

export interface ValidationResult {
  feature: string;
  status: ValidationStatus;
  message: string;
  details?: string;
  duration?: number;
}

export interface FeatureValidation {
  name: string;
  category: 'auth' | 'api' | 'ui' | 'navigation' | 'storage';
  validator: () => Promise<ValidationResult>;
}

// Logger pour debug
const log = (message: string, data?: unknown) => {
  if (__DEV__) {
    console.log(`[FeatureValidator] ${message}`, data || '');
  }
};

// Utilitaire pour mesurer le temps d'exécution
const measureTime = async <T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> => {
  const start = Date.now();
  const result = await fn();
  const duration = Date.now() - start;
  return { result, duration };
};

/**
 * Validations d'authentification
 */
const authValidations: FeatureValidation[] = [
  {
    name: 'Token Storage',
    category: 'auth',
    validator: async (): Promise<ValidationResult> => {
      try {
        // Test de sauvegarde et lecture des tokens
        const testToken = 'test_token_' + Date.now();
        await tokenStorage.setTokens(testToken, 'test_refresh');
        const retrieved = await tokenStorage.getAccessToken();
        await tokenStorage.clearTokens();

        if (retrieved === testToken) {
          return {
            feature: 'Token Storage',
            status: 'success',
            message: 'Le stockage des tokens fonctionne correctement',
          };
        } else {
          return {
            feature: 'Token Storage',
            status: 'error',
            message: 'Erreur: token récupéré différent du token sauvegardé',
            details: `Expected: ${testToken}, Got: ${retrieved}`,
          };
        }
      } catch (error) {
        return {
          feature: 'Token Storage',
          status: 'error',
          message: 'Erreur lors du test du stockage des tokens',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
];

/**
 * Validations API
 */
const apiValidations: FeatureValidation[] = [
  {
    name: 'Backend Connectivity',
    category: 'api',
    validator: async (): Promise<ValidationResult> => {
      try {
        const { result: response, duration } = await measureTime(() =>
          fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          })
        );

        if (response.ok) {
          return {
            feature: 'Backend Connectivity',
            status: 'success',
            message: `Backend accessible (${duration}ms)`,
            duration,
          };
        } else {
          return {
            feature: 'Backend Connectivity',
            status: 'warning',
            message: `Backend répond avec status ${response.status}`,
            duration,
          };
        }
      } catch (error) {
        return {
          feature: 'Backend Connectivity',
          status: 'error',
          message: 'Impossible de contacter le backend',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
  {
    name: 'Google OAuth Endpoint',
    category: 'api',
    validator: async (): Promise<ValidationResult> => {
      try {
        const { result: response, duration } = await measureTime(() =>
          fetch(`${API_BASE_URL}/api/auth/google/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ redirect_uri: 'deepsight://auth/callback', platform: 'mobile' }),
          })
        );

        const data = await response.json().catch(() => null);

        if (response.ok && data?.url) {
          return {
            feature: 'Google OAuth Endpoint',
            status: 'success',
            message: `Endpoint Google OAuth fonctionne (${duration}ms)`,
            duration,
          };
        } else if (response.status === 400 || response.status === 422) {
          return {
            feature: 'Google OAuth Endpoint',
            status: 'warning',
            message: 'Endpoint existe mais paramètres invalides',
            details: JSON.stringify(data),
            duration,
          };
        } else {
          return {
            feature: 'Google OAuth Endpoint',
            status: 'error',
            message: `Endpoint retourne ${response.status}`,
            details: JSON.stringify(data),
            duration,
          };
        }
      } catch (error) {
        return {
          feature: 'Google OAuth Endpoint',
          status: 'error',
          message: 'Erreur lors du test de l\'endpoint Google OAuth',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
  {
    name: 'Login Endpoint',
    category: 'api',
    validator: async (): Promise<ValidationResult> => {
      try {
        // Envoie une requête invalide pour vérifier que l'endpoint répond
        const { result: response, duration } = await measureTime(() =>
          fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: 'test@test.com', password: 'wrong' }),
          })
        );

        // On s'attend à une erreur 401 ou 400, ce qui signifie que l'endpoint fonctionne
        if (response.status === 401 || response.status === 400 || response.status === 422) {
          return {
            feature: 'Login Endpoint',
            status: 'success',
            message: `Endpoint login fonctionne (${duration}ms)`,
            duration,
          };
        } else if (response.ok) {
          return {
            feature: 'Login Endpoint',
            status: 'warning',
            message: 'Login a réussi avec des identifiants test - vérifier la sécurité',
            duration,
          };
        } else {
          return {
            feature: 'Login Endpoint',
            status: 'error',
            message: `Endpoint retourne ${response.status}`,
            duration,
          };
        }
      } catch (error) {
        return {
          feature: 'Login Endpoint',
          status: 'error',
          message: 'Erreur lors du test de l\'endpoint login',
          details: error instanceof Error ? error.message : String(error),
        };
      }
    },
  },
];

/**
 * Classe principale du validateur
 */
export class FeatureValidator {
  private validations: FeatureValidation[] = [];
  private results: ValidationResult[] = [];

  constructor() {
    // Enregistrer toutes les validations
    this.validations = [
      ...authValidations,
      ...apiValidations,
    ];
  }

  /**
   * Ajouter une validation personnalisée
   */
  addValidation(validation: FeatureValidation): void {
    this.validations.push(validation);
  }

  /**
   * Exécuter toutes les validations
   */
  async validateAll(): Promise<ValidationResult[]> {
    log('Démarrage de la validation complète...');
    this.results = [];

    for (const validation of this.validations) {
      try {
        log(`Validation: ${validation.name}`);
        const result = await validation.validator();
        this.results.push(result);
        log(`Résultat: ${result.status} - ${result.message}`);
      } catch (error) {
        this.results.push({
          feature: validation.name,
          status: 'error',
          message: 'Exception non gérée lors de la validation',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return this.results;
  }

  /**
   * Exécuter les validations d'une catégorie spécifique
   */
  async validateCategory(category: FeatureValidation['category']): Promise<ValidationResult[]> {
    log(`Validation de la catégorie: ${category}`);
    const categoryValidations = this.validations.filter(v => v.category === category);
    const results: ValidationResult[] = [];

    for (const validation of categoryValidations) {
      try {
        const result = await validation.validator();
        results.push(result);
      } catch (error) {
        results.push({
          feature: validation.name,
          status: 'error',
          message: 'Exception non gérée',
          details: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return results;
  }

  /**
   * Obtenir un résumé des résultats
   */
  getSummary(): { total: number; success: number; warnings: number; errors: number } {
    return {
      total: this.results.length,
      success: this.results.filter(r => r.status === 'success').length,
      warnings: this.results.filter(r => r.status === 'warning').length,
      errors: this.results.filter(r => r.status === 'error').length,
    };
  }

  /**
   * Obtenir les résultats
   */
  getResults(): ValidationResult[] {
    return this.results;
  }

  /**
   * Afficher un rapport dans la console
   */
  printReport(): void {
    if (!__DEV__) return;

    console.log('\n========================================');
    console.log('     RAPPORT DE VALIDATION FEATURES     ');
    console.log('========================================\n');

    for (const result of this.results) {
      const icon = result.status === 'success' ? '✅' :
                   result.status === 'warning' ? '⚠️' : '❌';
      console.log(`${icon} ${result.feature}`);
      console.log(`   ${result.message}`);
      if (result.details) {
        console.log(`   Détails: ${result.details}`);
      }
      if (result.duration) {
        console.log(`   Durée: ${result.duration}ms`);
      }
      console.log('');
    }

    const summary = this.getSummary();
    console.log('----------------------------------------');
    console.log(`Total: ${summary.total} | ✅ ${summary.success} | ⚠️ ${summary.warnings} | ❌ ${summary.errors}`);
    console.log('========================================\n');
  }
}

// Instance singleton pour usage global
export const featureValidator = new FeatureValidator();

// Hook pour exécuter la validation au démarrage (dev only)
export const runStartupValidation = async (): Promise<void> => {
  if (__DEV__) {
    console.log('[FeatureValidator] Exécution de la validation au démarrage...');
    await featureValidator.validateAll();
    featureValidator.printReport();
  }
};

export default FeatureValidator;
