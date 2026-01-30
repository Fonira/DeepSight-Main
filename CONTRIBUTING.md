# Contributing to DeepSight 🤿

Thank you for your interest in contributing to DeepSight! This document provides guidelines and instructions for contributing.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Code Standards](#code-standards)
- [Pull Request Process](#pull-request-process)
- [Issue Guidelines](#issue-guidelines)

---

## 📜 Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. We expect all contributors to:

- Be respectful and considerate
- Accept constructive criticism gracefully
- Focus on what's best for the community
- Show empathy towards others

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+** — Backend development
- **Node.js 20+** — Frontend and mobile development
- **Git** — Version control
- **PostgreSQL** (optional) — Production-like database testing

### Setting Up Your Development Environment

1. **Fork the Repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone Your Fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/DeepSight-Main.git
   cd DeepSight-Main
   ```

3. **Add Upstream Remote**

   ```bash
   git remote add upstream https://github.com/ORIGINAL_OWNER/DeepSight-Main.git
   ```

4. **Set Up Each Component**

   Follow the setup instructions in the main [README.md](README.md) for backend, frontend, and mobile.

---

## 🔄 Development Workflow

### Branching Strategy

We use a simplified Git Flow:

- `main` — Production-ready code
- `develop` — Integration branch for features
- `feature/*` — New features (`feature/add-export-pdf`)
- `fix/*` — Bug fixes (`fix/chat-scroll-issue`)
- `docs/*` — Documentation updates
- `refactor/*` — Code refactoring

### Creating a Feature Branch

```bash
# Sync with upstream
git fetch upstream
git checkout main
git merge upstream/main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Making Changes

1. Make your changes in small, logical commits
2. Write meaningful commit messages
3. Test your changes locally
4. Update documentation if needed

### Commit Message Format

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat` — New feature
- `fix` — Bug fix
- `docs` — Documentation
- `style` — Formatting (no code change)
- `refactor` — Code restructuring
- `test` — Adding tests
- `chore` — Maintenance tasks

**Examples:**

```bash
feat(videos): add PDF export functionality
fix(chat): resolve message ordering issue
docs(api): update authentication endpoints
refactor(auth): simplify token validation logic
```

---

## 📝 Code Standards

### Python (Backend)

- **Style**: Follow PEP 8
- **Type Hints**: Required for all functions
- **Docstrings**: Required for public functions
- **Async**: Use `async/await` for all I/O operations

```python
# ✅ Good
async def get_summary(
    db: AsyncSession, 
    user_id: int, 
    summary_id: int
) -> Optional[Summary]:
    """
    Retrieve a summary by ID for a specific user.
    
    Args:
        db: Database session
        user_id: The user's ID
        summary_id: The summary's ID
        
    Returns:
        Summary object if found, None otherwise
    """
    result = await db.execute(
        select(Summary).where(
            Summary.id == summary_id,
            Summary.user_id == user_id
        )
    )
    return result.scalar_one_or_none()

# ❌ Bad
def get_summary(db, user_id, summary_id):
    return db.query(Summary).filter_by(id=summary_id).first()
```

### TypeScript (Frontend & Mobile)

- **Style**: ESLint + Prettier
- **Types**: Strict mode enabled, no `any`
- **Components**: Functional with hooks
- **Interfaces**: Prefer over type aliases for objects

```typescript
// ✅ Good
interface AnalysisResult {
  id: string;
  summary: string;
  concepts: Concept[];
}

const useAnalysis = (videoId: string): UseQueryResult<AnalysisResult> => {
  return useQuery({
    queryKey: ['analysis', videoId],
    queryFn: () => videoApi.getSummary(videoId),
  });
};

// ❌ Bad
const useAnalysis = (videoId: any) => {
  return useQuery(['analysis', videoId], () => videoApi.getSummary(videoId));
};
```

### File Organization

- Keep files focused and small (<300 lines preferred)
- Group related functionality together
- Use index files for clean exports

---

## 🔍 Pull Request Process

### Before Submitting

1. **Sync with Upstream**
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run Tests**
   ```bash
   # Backend
   cd backend && pytest tests/ -v

   # Frontend
   cd frontend && npm run typecheck && npm run lint

   # Mobile
   cd mobile && npm run typecheck
   ```

3. **Update Documentation**
   - Update README if adding features
   - Update API.md if changing endpoints
   - Add inline comments for complex logic

### Submitting a PR

1. Push your branch to your fork
   ```bash
   git push origin feature/your-feature-name
   ```

2. Open a Pull Request on GitHub

3. Fill out the PR template:

   ```markdown
   ## Description
   Brief description of changes

   ## Type of Change
   - [ ] Bug fix
   - [ ] New feature
   - [ ] Documentation
   - [ ] Refactoring

   ## Testing
   Describe how you tested your changes

   ## Screenshots (if applicable)
   Add screenshots for UI changes

   ## Checklist
   - [ ] My code follows the project style guidelines
   - [ ] I have performed a self-review
   - [ ] I have added tests (if applicable)
   - [ ] I have updated documentation (if applicable)
   ```

### Review Process

- PRs require at least one approval
- Address all review comments
- Keep the PR focused and reasonably sized
- Be patient — reviews take time

---

## 🐛 Issue Guidelines

### Reporting Bugs

Use the bug report template:

```markdown
**Describe the bug**
A clear description of what the bug is.

**To Reproduce**
Steps to reproduce:
1. Go to '...'
2. Click on '...'
3. See error

**Expected behavior**
What you expected to happen.

**Screenshots**
If applicable, add screenshots.

**Environment:**
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- App version: [e.g., 3.7.1]
```

### Requesting Features

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
A clear description of the problem.

**Describe the solution you'd like**
A clear description of what you want to happen.

**Describe alternatives you've considered**
Any alternative solutions or features you've considered.

**Additional context**
Any other context or screenshots.
```

---

## 💡 Tips for Contributors

### First-Time Contributors

Look for issues labeled:
- `good first issue` — Simple, beginner-friendly
- `help wanted` — We need community help
- `documentation` — Improve docs (great starting point!)

### Communication

- **GitHub Issues** — Bug reports, feature requests
- **Pull Request Comments** — Code-specific discussions
- **Be Clear** — Provide context and be specific

### Getting Help

If you're stuck:
1. Check existing issues and PRs
2. Read the documentation
3. Ask in your PR or issue

---

## 🙏 Thank You!

Every contribution matters, whether it's:
- Fixing a typo
- Improving documentation
- Adding a feature
- Reporting a bug

Thank you for helping make DeepSight better! 🤿
