"""
Tests pour storage.r2.delete_objects_by_prefix — RGPD Article 17 helper.

Couvre :
1. Prefix vide → 0 deleted, pas d'appel R2
2. R2 mode → list_objects_v2 paginated + delete_objects batched
3. R2 mode → erreurs partielles loggées mais comptage correct
4. R2 mode → ClientError sur list → 0 deleted, pas de raise
5. Local fallback → suppression récursive des fichiers sous LOCAL_THUMB_DIR/<prefix>
"""

import importlib

import pytest
from unittest.mock import MagicMock, patch

# Marker partagé : skip les tests R2 mode si boto3/botocore absent en dev local.
# Le code prod l'importe lazily, donc l'absence locale n'affecte pas la prod.
_HAS_BOTOCORE = importlib.util.find_spec("botocore") is not None
needs_botocore = pytest.mark.skipif(not _HAS_BOTOCORE, reason="boto3/botocore not installed locally")


@pytest.mark.asyncio
async def test_empty_prefix_returns_zero():
    """Un prefix vide doit retourner 0 sans toucher R2 ni le filesystem."""
    from storage.r2 import delete_objects_by_prefix

    with patch("storage.r2._is_r2_credentials_set", return_value=True), patch(
        "storage.r2._get_r2_client"
    ) as mock_client:
        deleted = await delete_objects_by_prefix("")

    assert deleted == 0
    mock_client.assert_not_called()


@needs_botocore
@pytest.mark.asyncio
async def test_r2_mode_lists_and_batch_deletes():
    """En mode R2, doit paginer list_objects_v2 et batcher delete_objects."""
    from storage.r2 import delete_objects_by_prefix

    fake_client = MagicMock()
    page_iterator = iter(
        [
            {"Contents": [{"Key": "audio-summaries/42/a.mp3"}, {"Key": "audio-summaries/42/b.mp3"}]},
            {"Contents": [{"Key": "audio-summaries/42/c.mp3"}]},
        ]
    )
    paginator = MagicMock()
    paginator.paginate.return_value = page_iterator
    fake_client.get_paginator.return_value = paginator
    fake_client.delete_objects.return_value = {"Errors": []}

    with patch("storage.r2._is_r2_credentials_set", return_value=True), patch(
        "storage.r2._get_r2_client", return_value=fake_client
    ), patch.dict("storage.r2.R2_CONFIG", {"BUCKET": "test-bucket"}, clear=False):
        deleted = await delete_objects_by_prefix("audio-summaries/42/")

    assert deleted == 3
    assert fake_client.delete_objects.call_count == 2
    # Premier batch contient bien les deux objets de la première page
    first_call_kwargs = fake_client.delete_objects.call_args_list[0].kwargs
    assert first_call_kwargs["Bucket"] == "test-bucket"
    assert {o["Key"] for o in first_call_kwargs["Delete"]["Objects"]} == {
        "audio-summaries/42/a.mp3",
        "audio-summaries/42/b.mp3",
    }


@needs_botocore
@pytest.mark.asyncio
async def test_r2_mode_partial_errors_counted_correctly():
    """Si delete_objects renvoie 1 Error sur 3, on ne compte que 2 deleted."""
    from storage.r2 import delete_objects_by_prefix

    fake_client = MagicMock()
    paginator = MagicMock()
    paginator.paginate.return_value = iter(
        [
            {
                "Contents": [
                    {"Key": "audio-summaries/7/x.mp3"},
                    {"Key": "audio-summaries/7/y.mp3"},
                    {"Key": "audio-summaries/7/z.mp3"},
                ]
            }
        ]
    )
    fake_client.get_paginator.return_value = paginator
    fake_client.delete_objects.return_value = {
        "Errors": [{"Key": "audio-summaries/7/y.mp3", "Code": "AccessDenied"}]
    }

    with patch("storage.r2._is_r2_credentials_set", return_value=True), patch(
        "storage.r2._get_r2_client", return_value=fake_client
    ), patch.dict("storage.r2.R2_CONFIG", {"BUCKET": "test-bucket"}, clear=False):
        deleted = await delete_objects_by_prefix("audio-summaries/7/")

    assert deleted == 2


@needs_botocore
@pytest.mark.asyncio
async def test_r2_mode_list_failure_returns_zero_no_raise():
    """Si list_objects_v2 lève ClientError, on log et retourne 0 sans raise."""
    from botocore.exceptions import ClientError
    from storage.r2 import delete_objects_by_prefix

    fake_client = MagicMock()
    paginator = MagicMock()
    paginator.paginate.side_effect = ClientError(
        {"Error": {"Code": "NoSuchBucket", "Message": "boom"}}, "ListObjectsV2"
    )
    fake_client.get_paginator.return_value = paginator

    with patch("storage.r2._is_r2_credentials_set", return_value=True), patch(
        "storage.r2._get_r2_client", return_value=fake_client
    ), patch.dict("storage.r2.R2_CONFIG", {"BUCKET": "test-bucket"}, clear=False):
        deleted = await delete_objects_by_prefix("audio-summaries/42/")

    assert deleted == 0
    fake_client.delete_objects.assert_not_called()


@pytest.mark.asyncio
async def test_local_fallback_deletes_files_under_prefix(tmp_path):
    """En mode local fallback (pas de creds R2), supprime les fichiers sous le prefix."""
    from storage import r2 as r2_module

    target = tmp_path / "audio-summaries" / "99"
    target.mkdir(parents=True)
    (target / "a.mp3").write_bytes(b"x")
    (target / "b.mp3").write_bytes(b"y")
    (target / "sub").mkdir()
    (target / "sub" / "c.mp3").write_bytes(b"z")

    with patch("storage.r2._is_r2_credentials_set", return_value=False), patch.object(
        r2_module, "LOCAL_THUMB_DIR", tmp_path
    ):
        deleted = await r2_module.delete_objects_by_prefix("audio-summaries/99")

    assert deleted == 3
    assert not (target / "a.mp3").exists()
    assert not (target / "sub" / "c.mp3").exists()


@pytest.mark.asyncio
async def test_local_fallback_missing_prefix_returns_zero(tmp_path):
    """Si le dossier prefix n'existe pas localement, retourne 0 sans erreur."""
    from storage import r2 as r2_module

    with patch("storage.r2._is_r2_credentials_set", return_value=False), patch.object(
        r2_module, "LOCAL_THUMB_DIR", tmp_path
    ):
        deleted = await r2_module.delete_objects_by_prefix("audio-summaries/inexistant")

    assert deleted == 0
