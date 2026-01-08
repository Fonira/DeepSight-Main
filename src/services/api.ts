/**
 * 📝 PATCH POUR api.ts
 * 
 * Remplacer la fonction generateSummaryAudio (lignes ~1033-1062)
 * par la version ci-dessous qui gère correctement les messages d'erreur
 */

  /**
   * 🎙️ Génère l'audio pour un résumé
   * 
   * @param summaryId - ID du résumé
   * @param voiceStyle - Style de voix: warm, calm, soft, narrative
   * @param provider - Provider TTS:
   *   - 'auto': ElevenLabs avec fallback OpenAI (défaut, Starter+)
   *   - 'openai': OpenAI TTS HD direct (Pro/Expert uniquement)
   *   - 'elevenlabs': ElevenLabs uniquement
   * 
   * @returns URL du blob audio
   */
  async generateSummaryAudio(
    summaryId: number,
    voiceStyle: VoiceStyle = 'warm',
    provider: TTSProvider = 'auto'
  ): Promise<string> {
    const params = new URLSearchParams({
      voice_style: voiceStyle,
      provider: provider
    });
    
    const response = await fetch(`${API_URL}/api/tts/summary/${summaryId}/audio?${params}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getAccessToken()}`,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'TTS generation failed' }));
      
      // Extraire le message d'erreur proprement (évite [object Object])
      let errorMessage = 'Échec de la génération audio';
      
      if (typeof errorData.detail === 'string') {
        errorMessage = errorData.detail;
      } else if (errorData.detail?.message) {
        errorMessage = errorData.detail.message;
      } else if (errorData.detail?.error) {
        // Traduire les codes d'erreur
        const errorCode = errorData.detail.error;
        if (errorCode === 'tts_generation_failed' || errorCode === 'all_providers_failed') {
          errorMessage = 'Service TTS temporairement indisponible. Veuillez réessayer plus tard.';
        } else if (errorCode === 'tts_pro_required') {
          errorMessage = 'La synthèse vocale nécessite un abonnement Starter ou Pro.';
        } else if (errorCode === 'openai_tts_pro_required') {
          errorMessage = 'OpenAI HD est réservé aux abonnés Pro et Expert.';
        } else {
          errorMessage = `Erreur: ${errorCode}`;
        }
      }
      
      throw new ApiError(errorMessage, response.status, errorData.detail?.error);
    }

    // Créer un blob URL pour le lecteur audio
    const blob = await response.blob();
    return URL.createObjectURL(blob);
  },
