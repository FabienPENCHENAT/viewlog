// Dictionnaire français. Un objet plat clé → texte (interpolation {var}).
export default {
  "lang.switch": "Changer de langue",

  "home.title_pre": "Vos fichiers de logs, ",
  "home.title_accent": "enfin agréables à lire.",
  "home.lead_pre":
    "Déposez un fichier de log, obtenez un dashboard lisible (graphs, recherche, filtres). Et surtout : ",
  "home.lead_local": "100 % local",
  "home.lead_post":
    ". Vos logs sont interprétés et mis en forme dans votre navigateur, et ne sont jamais envoyés ni stockés sur un serveur.",
  "home.recent": "Fichiers récents",
  "home.recent_count": "({count}/5)",
  "home.storage_note":
    "Stockés uniquement dans votre navigateur. Supprimez-les via la croix, ou videz les données du site pour tout effacer.",
  "home.empty": "Aucun fichier pour l'instant.",
  "home.file_meta": "{lines} lignes · {size} · {date}",
  "home.badge_err": "{count} err",
  "home.badge_warn": "{count} warn",
  "home.delete": "Supprimer",

  "dropzone.analyzing": "Lecture du fichier…",
  "dropzone.title": "Déposez votre fichier de log ici",
  "dropzone.wait": "Un instant",
  "dropzone.hint": "ou cliquez pour parcourir · .log / .txt / .csv",

  "paste.toggle": "Ou collez vos logs directement",
  "paste.placeholder": "Collez vos logs ici…",
  "paste.submit": "Visualiser",
  "paste.name": "Logs collés",

  "stats.lines": "Lignes",
  "stats.errors": "Erreurs",
  "stats.warnings": "Warnings",
  "stats.duration": "Durée couverte",
  "stats.instant": "instantané",

  "dash.back_home": "← Retour",
  "dash.back_files": "← Fichiers",
  "dash.loading": "Chargement…",
  "dash.truncated":
    "Fichier volumineux : seules les {max} premières lignes ont été traitées.",
  "dash.timeline": "Volume dans le temps",
  "dash.levels": "Répartition par niveau",
  "dash.journal": "Journal",
  "dash.default_name": "Log",

  "table.search": "Rechercher dans les logs…",
  "table.regex": "Recherche par expression régulière (regex)",
  "table.entries": "{count} entrée(s)",
  "table.shown": "· {count} affichées",
  "table.col_line": "#",
  "table.col_ts": "Horodatage",
  "table.col_level": "Niveau",
  "table.col_msg": "Message",
  "table.empty": "Aucune entrée ne correspond.",
  "table.period": "Période",
  "table.period_all": "Tout",
  "table.period_from": "Début de période",
  "table.period_to": "Fin de période",
  "table.view": "Vue",
  "table.view_journal": "Journal",
  "table.view_patterns": "Motifs",
  "patterns.unique": "{count} motifs uniques",
  "patterns.example": "ex. ",
  "patterns.more": "+ {count} autres motifs",
  "patterns.filtered": "Motif :",
  "patterns.clear": "Retirer le filtre de motif",

  "msg.collapse": "Réduire ▲",
  "msg.expand": "Afficher tout ({count} lignes) ▼",

  "chart.no_data": "Aucune donnée.",
  "chart.entries": "Entrées",
  "chart.no_ts": "Aucun timestamp détecté dans ce fichier.",
  "chart.total": "Total",
  "chart.errors": "Erreurs",

  "unit.b": "o",
  "unit.kb": "Ko",
  "unit.mb": "Mo",

  "dur.s": "s",
  "dur.min": "min",
  "dur.h": "h",
  "dur.d": "j",
  "dur.mo": "mois",
  "dur.y": "an",

  "errors.load_list": "Impossible de charger la liste",
  "errors.upload": "Échec de l'import",
  "errors.not_found": "Fichier introuvable",
  "errors.delete": "Suppression impossible",

  "nav.faq": "FAQ",

  "footer.legal": "Mentions légales",
  "footer.changelog": "Nouveautés",

  "changelog.title": "Journal des modifications",
  "changelog.intro":
    "Les nouveautés et améliorations de ViewLog, de la plus récente à la plus ancienne.",

  "legal.title": "Mentions légales",
  "legal.editor_h": "Éditeur",
  "legal.editor_body":
    "Ce site est édité par Fabien P., directeur de la publication. Contact : contact@viewlog.io.",
  "legal.host_h": "Hébergeur",
  "legal.host_body":
    "Cloudflare, Inc., 101 Townsend Street, San Francisco, CA 94107, États-Unis (cloudflare.com).",
  "legal.data_h": "Données personnelles et cookies",
  "legal.data_body":
    "ViewLog ne collecte aucune donnée personnelle, n'utilise aucun cookie et ne dépose aucun identifiant permettant de vous suivre d'une visite à l'autre. Vos fichiers de logs sont interprétés et mis en forme entièrement dans votre navigateur ; ni leur contenu, ni leur nom ne sont jamais transmis ou stockés sur un serveur. Votre choix de langue est mémorisé localement dans votre navigateur.\n\nAfin de suivre la fiabilité du service et de comprendre quelles fonctionnalités sont utiles, nous enregistrons uniquement des mesures anonymes et agrégées : les pages consultées, le fait qu'un traitement de fichier réussisse ou échoue, la méthode d'import (glisser-déposer, sélection ou collage), l'extension du fichier, une tranche de taille approximative (jamais la taille exacte), le fait que la limite de traitement soit atteinte, les fonctionnalités activées (recherche, filtres, motifs, etc.) et le pays de connexion. Aucun contenu de vos logs, aucun nom de fichier et aucune adresse IP ne sont enregistrés, et ces mesures ne permettent pas de vous identifier ni de reconstituer votre activité individuelle. Si votre navigateur signale une préférence « Do Not Track » ou « Global Privacy Control », aucune de ces mesures n'est envoyée.",

  "faq.title": "Questions fréquentes",
  "faq.group_usage": "Utilisation",
  "faq.group_privacy": "Confidentialité et données",
  "faq.group_meta": "Le service",
  "faq.q_privacy": "Où vont mes fichiers de logs ?",
  "faq.a_privacy":
    "Confidentialité par conception : le contenu de vos fichiers de logs est traité entièrement dans votre navigateur et ne quitte jamais votre poste.",
  "faq.q_sensitive":
    "ViewLog est-il sûr pour des logs sensibles ou de production ?",
  "faq.a_sensitive":
    "Oui. ViewLog s'exécute à 100 % dans votre navigateur et n'envoie jamais vos logs vers un serveur. Le contenu de vos fichiers est analysé localement, sur votre poste : vos logs sensibles ou de production ne quittent donc jamais votre machine. Rien n'est transmis sur le réseau ni stocké côté serveur.",
  "faq.q_compare":
    "En quoi ViewLog protège-t-il mieux mes données que les autres visualiseurs de logs en ligne ?",
  "faq.a_compare":
    "La plupart des visualiseurs de logs en ligne envoient vos fichiers vers un serveur distant pour les traiter. ViewLog est différent : il est 100 % côté client, donc le contenu de vos logs n'est jamais envoyé, stocké ni transmis. Cette conception privacy-first, sans aucun serveur, le rend adapté aux logs sensibles (RGPD, HIPAA).",
  "faq.q_retention": "Combien de fichiers sont conservés ?",
  "faq.a_retention":
    "Les 5 derniers fichiers ouverts sont gardés localement, dans votre navigateur, et remplacés automatiquement au fil de vos nouveaux imports.",
  "faq.q_delete": "Comment supprimer mes données ?",
  "faq.a_delete":
    "Chaque fichier peut être supprimé depuis la liste des fichiers récents. Vous pouvez aussi tout effacer d'un coup en vidant les données du site dans votre navigateur.",
  "faq.q_formats": "Quels formats sont pris en charge ?",
  "faq.a_formats":
    "Tout fichier texte .log ou .txt. Le parsing est générique : détection automatique de l'horodatage, du niveau (de TRACE à FATAL) et du message, avec rattachement des stack traces multi-lignes. Les fichiers .csv sont aussi pris en charge : le délimiteur et les colonnes horodatage, niveau et message sont détectés automatiquement.",
  "faq.q_size": "Y a-t-il une limite de taille ?",
  "faq.a_size":
    "Les très gros fichiers sont pris en charge (plusieurs dizaines de Mo, des centaines de milliers de lignes). Le traitement porte sur le premier million de lignes. Tout se fait dans votre navigateur et l'affichage reste fluide grâce à la virtualisation.",
  "faq.q_how": "Comment fonctionne ViewLog ?",
  "faq.a_how":
    "Déposez un fichier .log ou .txt : ViewLog le lit directement dans votre navigateur et détecte automatiquement, ligne par ligne, l'horodatage, le niveau et le message (les stack traces multi-lignes sont rattachées à leur entrée). Vous arrivez ensuite sur un tableau de bord clair. Aucune installation, aucun fichier envoyé.",
  "faq.q_features": "Quelles sont les fonctionnalités principales ?",
  "faq.a_features":
    "Un tableau de bord avec les stats clés (lignes, erreurs, warnings, durée couverte), le volume dans le temps et la répartition par niveau. Un journal complet avec recherche plein-texte, filtres par niveau et filtre par période (curseur temporel). Et une vue « Motifs » qui regroupe les erreurs récurrentes.",
  "faq.q_patterns": "À quoi sert la vue « Motifs » ?",
  "faq.a_patterns":
    "Elle transforme des milliers de lignes en quelques motifs lisibles. ViewLog normalise les messages (nombres, identifiants, dates et adresses variables sont masqués) pour regrouper les entrées identiques et faire ressortir les erreurs les plus récurrentes, triées par fréquence. Cliquez un motif pour revenir au journal filtré sur celui-ci.",
  "faq.q_search": "Comment rechercher dans les logs ?",
  "faq.a_search":
    "La barre de recherche filtre le journal en temps réel. Par défaut, elle cherche un texte simple ; activez le bouton « .* » pour passer en expression régulière (regex). Dans les deux cas, les correspondances sont surlignées directement dans les messages.",
  "faq.q_free": "ViewLog est-il gratuit ?",
  "faq.a_free":
    "Oui, ViewLog est entièrement gratuit. Comme tout se passe dans votre navigateur, il n'y a ni compte à créer, ni serveur à faire tourner.",
  "faq.q_contact": "Comment vous contacter ou proposer une amélioration ?",
  "faq.a_contact":
    "Écrivez-nous à contact@viewlog.io. Retours, idées de formats à prendre en charge, signalements de bugs : tout est bienvenu.",
};
