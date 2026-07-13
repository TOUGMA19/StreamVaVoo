# StreamFlow — Compilation Android TV avec Android Studio

Guide pas-à-pas pour transformer StreamFlow en APK Android TV.

## Recommandation : Lovable/Vercel + Android Studio (pas Android Studio seul)

On n'embarque **pas** le site dans l'APK. On construit une **coquille
WebView** (dossier `android-tv/`) qui charge l'URL publiée par Lovable.

- Une seule compilation, jamais à refaire.
- Chaque modif dans Lovable est **live immédiatement** sur la box, sans
  réinstaller l'APK.
- Télécommande : Android transmet les touches D-pad, OK, BACK, PLAY/PAUSE,
  CHANNEL_UP/DOWN, COLOR à la WebView, et `useRemoteControl.ts` les
  intercepte.
- Mode TV auto (grosse police, focus rouge, safe-area 5 %) forcé par le
  flag `?tv=1` dans l'URL.

## Étape 1 — Publier l'app sur Lovable

Clique **Publish** en haut à droite. Note l'URL, ex :
`https://streamflow-xxx.lovable.app`.

## Étape 2 — Coller l'URL dans le projet Android

Fichier : `android-tv/app/src/main/java/app/lovable/streamflow/tv/MainActivity.java`

Remplace :

```java
private static final String APP_URL = "https://REPLACE-ME.lovable.app/?tv=1";
```

par ton URL (garde `?tv=1` à la fin — c'est ce qui force le mode TV).

## Étape 3 — Ouvrir dans Android Studio

1. Installe **Android Studio Iguana ou +** (JDK 17 inclus).
2. `File → Open…` → sélectionne le dossier **`android-tv/`**.
3. Attends le "Gradle Sync" (3–8 min la première fois).
4. Accepte l'installation du SDK 34 / Build-Tools 34 si demandé.

## Étape 4 — Émulateur Android TV (optionnel)

`Tools → Device Manager → Create Device → catégorie TV → "Android TV
(1080p)" → API 34`. Les flèches du clavier simulent la télécommande.

## Étape 5 — Compiler l'APK

**Debug** : `Build → Build APK(s)` →
`android-tv/app/build/outputs/apk/debug/app-debug.apk`

**Release signé** : `Build → Generate Signed Bundle / APK → APK`.
Crée une keystore et garde le `.jks` précieusement (sans lui, plus de
mise à jour possible).

## Étape 6 — Installer sur ta box

```bash
adb connect 192.168.1.42:5555    # IP de ta box
adb install -r android-tv/app/build/outputs/apk/debug/app-debug.apk
```

**StreamFlow TV** apparaît sur l'écran d'accueil Android TV.

## Corrections apportées côté web

- **Télécommande D-pad** : navigation spatiale + reconnaissance UA
  Android TV (`bravia`, `shield`, `aftt`, `nexus player`, `android tv`…)
  et flag `?tv=1`. OK/Enter clique, BACK ferme le player,
  CHANNEL_UP/DOWN change de chaîne, PLAY/PAUSE, touches colorées, digits.
- **Adaptativité** : toute la typo passe en `clamp() + vw` en mode TV,
  lisible à 3 m sur 1080p comme sur 4K.
- **Focus visible fort** : anneau rouge épais + halo, scale 1.04.
- **Safe-area 5 %** pour l'overscan.
- **Landscape** verrouillé et **plein écran immersif**.

## Dépannage

| Symptôme | Cause / solution |
|---|---|
| Écran blanc | URL fausse ou pas d'Internet. Vérifie `APP_URL`. |
| Télécommande inactive | L'URL ne finit pas par `?tv=1`. |
| Texte trop petit | Idem — mode TV pas forcé. |
| App absente de l'accueil TV | Vérifie `LEANBACK_LAUNCHER` dans `AndroidManifest.xml`. |

## Pourquoi pas "Android Studio seul" ?

Copier le bundle dans `assets/public` et servir en `file://` a trois
défauts : chaque changement UI = nouveau build + réinstall, le proxy
`/api/public/proxy` (nécessaire pour certaines playlists distantes) n'est
plus dispo, et les cookies/auth Lovable ne marchent pas en `file://`.
La coquille WebView vers l'URL publiée est plus simple et plus rapide.