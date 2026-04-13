---
description: "Conventions et procédures obligatoires pour écrire et exécuter les tests DeepSight. Pyramide complète : Backend (Pytest), Frontend Web (Vitest), E2E Web (Playwright), Mobile (Jest/Maestro)."
---

# Tests DeepSight — Pyramide complète

## Règle : quelle couche tester ?

1. Fonction pure → test unitaire
2. Endpoint ou hook data → test d'intégration
3. Flux utilisateur critique → test E2E

## 1. Backend — Pytest

### Structure

```
backend/tests/
├── conftest.py          # Fixtures (client, db, auth)
├── unit/test_subscriptions.py, test_utils.py
└── integration/test_analyses.py, test_auth.py, test_stripe_webhooks.py
```

### Pattern test endpoint

```python
class TestCreateAnalysis:
    def test_success(self, client, auth_headers, mocker):
        mocker.patch("app.services.mistral.analyze_video", return_value={...})
        resp = client.post("/api/v1/analyses", json={"video_url": "..."}, headers=auth_headers)
        assert resp.status_code == 201

    def test_insufficient_plan(self, client, auth_headers):
        resp = client.post("/api/v1/analyses/compare", json={...}, headers=auth_headers)
        assert resp.status_code == 403
```

### Test is_feature_available (critique)

```python
@pytest.mark.parametrize("plan,feature,platform,expected", [
    ("decouverte", "create_analysis", "web", True),
    ("decouverte", "flashcards", "web", False),
    ("pro", "compare_videos", "web", True),
])
def test_feature_availability(plan, feature, platform, expected):
    assert is_feature_available(plan, feature, platform) == expected
```

### Commandes

```powershell
cd C:\Users\33667\DeepSight-Main\backend
python -m pytest tests/ -v
python -m pytest tests/ --cov=app --cov-report=html -v
```

## 2. Frontend Web — Vitest

### Pattern test composant

```typescript
describe('AnalysisCard', () => {
  it('affiche le titre', () => {
    render(<AnalysisCard analysis={mockAnalysis} />)
    expect(screen.getByText('Test Video')).toBeInTheDocument()
  })
})
```

### Mock API avec MSW

```typescript
export const server = setupServer(
  http.post('/api/v1/analyses', () => HttpResponse.json({ status: 'success', data: {...} }))
)
```

### Commandes

```powershell
cd C:\Users\33667\DeepSight-Main\frontend
npx vitest run
npx vitest run --coverage
```

## 3. E2E Web — Playwright

### Flux prioritaires : auth (P0), analysis (P0), subscription/Stripe (P0), sharing (P1), studio (P1)

### Pattern

```typescript
test("analyser une URL YouTube", async ({ page }) => {
  await page.fill(
    '[data-testid="youtube-url-input"]',
    "https://youtube.com/watch?v=...",
  );
  await page.click('[data-testid="analyze-button"]');
  await expect(page.locator('[data-testid="analysis-result"]')).toBeVisible({
    timeout: 30_000,
  });
});
```

### Commandes

```powershell
cd C:\Users\33667\DeepSight-Main\frontend
npx playwright test
npx playwright test --ui
```

## 4. Mobile — Jest + Maestro

### Jest

```typescript
jest.mock("@/services/api", () => ({
  createAnalysis: jest
    .fn()
    .mockResolvedValue({ id: "1", status: "processing" }),
}));
```

### Maestro (E2E yaml)

```yaml
appId: com.deepsight.app
- launchApp
- tapOn: "Nouvelle analyse"
- inputText: { id: "youtube-url-input", text: "..." }
- tapOn: "Analyser"
```

## Règles transversales

- Jamais tester avec la DB prod — SQLite en mémoire ou DB test
- Toujours mocker : Mistral, Perplexity, Stripe, YouTube API
- `data-testid` obligatoires sur éléments interactifs
- Coverage minimum : 80% sur `app/subscriptions.py`
