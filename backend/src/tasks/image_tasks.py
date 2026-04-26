"""
╔════════════════════════════════════════════════════════════════════════════════════╗
║  🎨 IMAGE TASKS — Génération d'illustrations IA pour "Le Saviez-Vous"              ║
╠════════════════════════════════════════════════════════════════════════════════════╣
║  TÂCHES:                                                                           ║
║  • generate_keyword_image_task: Génération unitaire (Mistral → fal.ai → R2)       ║
║  • batch_generate_missing_images_task: Batch nocturne des keywords sans image     ║
║  • generate_default_words_images_task: Pré-génération des 50 mots par défaut      ║
╚════════════════════════════════════════════════════════════════════════════════════╝
"""

import asyncio
from typing import Dict, Any

from tasks.celery_app import celery_app, BaseTask


def run_async(coro):
    """Execute async function in sync context."""
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


# ═══════════════════════════════════════════════════════════════════════════════
# 🎨 SINGLE IMAGE GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.generate_keyword_image_task',
    max_retries=2,
    soft_time_limit=90,
    time_limit=120,
)
def generate_keyword_image_task(
    self,
    term: str,
    definition: str,
    category: str = "misc",
) -> Dict[str, Any]:
    """Generate an AI illustration for a single keyword."""
    print(f"🎨 [TASK] Generating image for: '{term}' ({category})", flush=True)

    try:
        from images.keyword_images import generate_keyword_image
        image_url = run_async(generate_keyword_image(term, definition, category))

        if image_url:
            print(f"✅ [TASK] Image ready for '{term}': {image_url}", flush=True)
            return {"term": term, "status": "ready", "image_url": image_url}
        else:
            print(f"⚠️ [TASK] Image generation returned None for '{term}'", flush=True)
            return {"term": term, "status": "skipped"}

    except Exception as exc:
        print(f"❌ [TASK] Image generation failed for '{term}': {exc}", flush=True)
        raise self.retry(exc=exc, countdown=30)


# ═══════════════════════════════════════════════════════════════════════════════
# 🌙 BATCH NIGHTLY GENERATION
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.batch_generate_missing_images_task',
    max_retries=1,
    soft_time_limit=1800,
    time_limit=3600,
)
def batch_generate_missing_images_task(self) -> Dict[str, Any]:
    """Batch: find keywords without images, generate top 50 by fun_score."""
    print("🌙 [TASK] Starting batch image generation", flush=True)

    async def _batch():
        from images.keyword_images import generate_keyword_image, _get_pool

        pool = await _get_pool()
        async with pool.acquire() as conn:
            rows = await conn.fetch(
                """
                SELECT term, term_hash, category
                FROM keyword_images
                WHERE status = 'pending' OR (status = 'failed' AND retry_count < 3)
                ORDER BY fun_score DESC
                LIMIT 50
                """
            )

        if not rows:
            print("🌙 [TASK] No pending keywords to generate", flush=True)
            return {"generated": 0, "total_pending": 0}

        generated = 0
        for row in rows:
            try:
                # Fetch definition from summaries if available
                async with pool.acquire() as conn:
                    await conn.fetchrow(
                        """
                        SELECT definition FROM keyword_images WHERE term_hash = $1
                        """,
                        row["term_hash"],
                    )
                definition = ""  # Batch mode may not have definitions
                result = await generate_keyword_image(
                    row["term"], definition, row["category"], pool=pool,
                )
                if result:
                    generated += 1
                # Rate limiting: 5 per minute
                await asyncio.sleep(12)
            except Exception as e:
                print(f"⚠️ [BATCH] Failed for '{row['term']}': {e}", flush=True)
                continue

        print(f"🌙 [TASK] Batch complete: {generated}/{len(rows)} generated", flush=True)
        return {"generated": generated, "total_pending": len(rows)}

    return run_async(_batch())


# ═══════════════════════════════════════════════════════════════════════════════
# 🌱 SEED DEFAULT WORDS
# ═══════════════════════════════════════════════════════════════════════════════

@celery_app.task(
    bind=True,
    base=BaseTask,
    name='tasks.generate_default_words_images_task',
    max_retries=1,
    soft_time_limit=3600,
    time_limit=7200,
)
def generate_default_words_images_task(self) -> Dict[str, Any]:
    """One-shot: generate images for the 50 default words."""
    print("🌱 [TASK] Starting default words image generation", flush=True)

    from scripts.seed_keyword_images import DEFAULT_WORDS

    enqueued = 0
    for word in DEFAULT_WORDS:
        generate_keyword_image_task.apply_async(
            args=[word["term"], word["definition"], word.get("category", "misc")],
            countdown=enqueued * 12,  # Stagger: 1 every 12 seconds (5/min)
        )
        enqueued += 1

    print(f"🌱 [TASK] Enqueued {enqueued} default word image tasks", flush=True)
    return {"enqueued": enqueued}
