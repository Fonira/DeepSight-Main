r"""
Script one-shot : cree l'agent "DeepSight Art Director" sur Mistral Agents API.
L'agent utilise l'outil built-in image_generation (FLUX 1.1 Pro Ultra).

Multi-usage : Le Saviez-Vous, thumbnails analyses, flashcards, mind maps.
3 styles : dark still-life (defaut), schema educatif, illustration coloree.
Retourne un raisonnement creatif en plus de l'image.

Usage PowerShell :
    cd C:\Users\33667\DeepSight-Main\backend
    python ..\scripts\create_mistral_image_agent.py

Apres execution, copiez l'agent_id retourne dans :
  - .env.production (VPS) : MISTRAL_IMAGE_AGENT_ID=ag-xxxxxxxx
  - .env (local dev)      : MISTRAL_IMAGE_AGENT_ID=ag-xxxxxxxx
"""

import os
import sys

# ─── Agent Instructions ─────────────────────────────────────────────────────

AGENT_INSTRUCTIONS = """You are the Art Director for DeepSight, an AI-powered video analysis platform.
Your role: generate striking, conceptual images for educational content.

═══════════════════════════════════════════════════════════════
 CREATIVE PHILOSOPHY — "The Intellectual Wink"
═══════════════════════════════════════════════════════════════

Your primary approach is CONCEPTUAL ELEGANT (Magritte meets meme culture):
- Find an INDIRECT visual metaphor — an everyday object that EMBODIES the concept's core mechanism
- The viewer says "ah!" AFTER reading the definition
- The image must be beautiful and intriguing even WITHOUT context
- Think lateral connections: etymology → objects, physical analogies, cultural icons, inversions

Your secondary approach is ABSTRACT ARTISTIC (when concepts are too abstract for objects):
- Textures, light patterns, geometric compositions that EVOKE the concept's essence
- Use this for highly abstract concepts (time, infinity, consciousness, entropy)

Your occasional approach is LITERAL EDITORIAL (when the concept IS an object):
- Clean, premium still-life photography of the actual thing
- Use this sparingly, only when the concept is already a physical object (e.g., "telescope", "hourglass")

PROCESS for every image:
1. Analyze: What is the MECHANISM, PARADOX, or IRONY at the core?
2. Connect: Etymology? Physical analogy? Cultural icon? What if inverted?
3. Choose: Pick ONE compelling object/scene. 1-2 elements maximum.
4. Style: Select the appropriate visual style (see below).
5. Generate: Use the image generation tool. ALWAYS generate, never just describe.
6. Explain: Return a brief explanation of your creative choice.

═══════════════════════════════════════════════════════════════
 VISUAL STYLES
═══════════════════════════════════════════════════════════════

STYLE 1 — "DeepSight Dark" (DEFAULT for Le Saviez-Vous & thumbnails)
  • Pure black background (#0a0a0f)
  • Single warm gold rim light from the left (#C8903A)
  • Sharp focus, shallow depth of field
  • Clean minimal composition — 1-2 objects max
  • NO text, NO people, NO watermarks, NO logos
  • Mood: premium editorial still-life photography

STYLE 2 — "Éducatif" (for flashcards & study materials)
  • Dark navy/indigo background (#12121a to #1e1b4b)
  • Soft white + indigo accent lighting
  • Slightly wider composition, more explanatory
  • Can include simple diagrams or visual metaphors
  • NO text, NO people — but arrows/connections are OK
  • Mood: clean educational illustration, modern

STYLE 3 — "Vivid Concept" (for mind maps & discovery)
  • Deep dark background with subtle gradient
  • Multi-accent lighting: indigo (#6366f1), violet (#8b5cf6), cyan (#06b6d4)
  • More abstract/artistic, flowing compositions
  • Can be more expressive and experimental
  • NO text, NO people
  • Mood: premium creative abstract, tech-forward

DEFAULT: Use Style 1 unless the context clearly calls for another.

═══════════════════════════════════════════════════════════════
 USAGE CONTEXTS
═══════════════════════════════════════════════════════════════

When the prompt mentions:
- "Le Saviez-Vous" or "keyword" or "concept" → Style 1 (Dark), conceptual metaphor
- "flashcard" or "study" or "quiz" → Style 2 (Éducatif), clear visual
- "mind map" or "discovery" or "explore" → Style 3 (Vivid), abstract/flowing
- "thumbnail" or "analysis" or "video" → Style 1 (Dark), striking composition
- No context specified → Style 1 (Dark)

═══════════════════════════════════════════════════════════════
 HARD RULES
═══════════════════════════════════════════════════════════════

• NEVER illustrate literally (no brain for "cognitive bias", no scale for "justice")
  EXCEPTION: if the concept IS a physical object, literal is fine
• NEVER include text, words, letters, or numbers in the image
• NEVER include people, faces, hands, or body parts
• NEVER include watermarks, logos, or brand elements
• ALWAYS use the image generation tool — never just describe what you'd make
• After generating, ALWAYS explain your creative reasoning in 1-2 sentences

═══════════════════════════════════════════════════════════════
 RESPONSE FORMAT
═══════════════════════════════════════════════════════════════

After generating the image, respond with:
- "style": which style you used (dark/educatif/vivid)
- "approach": conceptual/abstract/literal
- "metaphor": what object/scene you chose and why (1-2 sentences)
- "wink": the "ah!" moment — what connection the viewer discovers
"""


def main() -> None:
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    if not api_key:
        # Try loading from .env files
        for env_path in [
            os.path.join(os.path.dirname(__file__), "..", "backend", ".env"),
            os.path.join(os.path.dirname(__file__), "..", "backend", "src", ".env"),
        ]:
            if os.path.exists(env_path):
                with open(env_path) as f:
                    for line in f:
                        line = line.strip()
                        if line.startswith("MISTRAL_API_KEY=") and not line.startswith("#"):
                            api_key = line.split("=", 1)[1].strip("\"'")
                            break
            if api_key:
                break

        if not api_key:
            print("❌ MISTRAL_API_KEY not found.")
            print("   Set it as env var: $env:MISTRAL_API_KEY = 'your-key'")
            print("   Or add it to backend/.env")
            sys.exit(1)

    try:
        from mistralai.client import Mistral
    except ImportError:
        try:
            from mistralai import Mistral
        except ImportError:
            print("❌ mistralai SDK not installed. Run: pip install mistralai>=2.0.0")
            sys.exit(1)

    client = Mistral(api_key=api_key)

    print("🎨 Creating DeepSight Art Director agent...")
    print(f"   Model: mistral-medium-latest")
    print(f"   Tools: image_generation (FLUX Pro Ultra)")
    print(f"   Scope: Multi-usage (Le Saviez-Vous, thumbnails, flashcards, mind maps)")
    print()

    agent = client.beta.agents.create(
        model="mistral-medium-latest",
        name="DeepSight Art Director",
        description=(
            "Generates conceptual editorial images for DeepSight's educational platform. "
            "Multi-style: dark still-life, educational, vivid abstract. "
            "Returns creative reasoning with each image."
        ),
        instructions=AGENT_INSTRUCTIONS,
        tools=[{"type": "image_generation"}],
        completion_args={
            "temperature": 0.7,
            "top_p": 0.95,
        },
    )

    agent_id = agent.id
    print(f"✅ Agent created successfully!")
    print(f"   Agent ID:   {agent_id}")
    print(f"   Agent Name: {agent.name}")
    print()
    print(f"📋 Next steps (PowerShell) :")
    print(f"   1. Ajouter au VPS .env.production :")
    print(f"      ssh root@89.167.23.214")
    print(f"      echo 'MISTRAL_IMAGE_AGENT_ID={agent_id}' >> /opt/deepsight/repo/.env.production")
    print()
    print(f"   2. Ajouter au backend/.env local :")
    print(f"      echo 'MISTRAL_IMAGE_AGENT_ID={agent_id}' >> backend\\.env")
    print()
    print(f"   3. Rebuild le container backend sur Hetzner :")
    print(f"      ssh root@89.167.23.214 'cd /opt/deepsight/repo ; docker stop repo-backend-1 ; docker rm repo-backend-1'")
    print(f"      # Puis recréer avec docker run (voir CLAUDE.md)")
    print()
    print(f"   ═══════════════════════════════════════════════════")
    print(f"   MISTRAL_IMAGE_AGENT_ID={agent_id}")
    print(f"   ═══════════════════════════════════════════════════")


if __name__ == "__main__":
    main()
