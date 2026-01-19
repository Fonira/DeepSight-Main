// ═══════════════════════════════════════════════════════════════════════════════
// 📊 TYPES CORRIGÉS — PlaylistTaskStatus
// Remplacer l'interface existante dans services/api.ts (vers ligne 129-139)
// ═══════════════════════════════════════════════════════════════════════════════

export interface PlaylistTaskStatus {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  
  // Progression (les deux noms pour compatibilité backend)
  progress?: number;
  progress_percent?: number;  // 🆕 Alias envoyé par backend corrigé
  
  // Compteurs
  current_video?: number;
  completed_videos?: number;  // 🆕 Nombre de vidéos terminées
  total_videos?: number;
  
  // Messages
  message?: string;
  current_step?: string;  // 🆕 Étape actuelle (fetching, transcript, summary, etc.)
  
  // Métadonnées
  playlist_id?: string;    // 🆕 ID de la playlist
  playlist_title?: string; // 🆕 Titre de la playlist
  
  // Estimation temps
  estimated_time_remaining?: string;  // 🆕 Ex: "~5 min"
  
  // Résultats
  results?: Summary[];
  corpus_summary?: string;
  result?: {
    playlist_id?: string;
    num_videos?: number;
    total_duration?: number;
    total_words?: number;
  };
  
  // Erreur
  error?: string;
}
