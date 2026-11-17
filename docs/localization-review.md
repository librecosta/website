# P1-C localization review

Japanese, German, French, and Spanish follow the current Chinese copy and English V1. The four ABOUT display statements, LibreCosta, The Expanse, and product names retain their original wording. Preserve the registered company name as given in English V1. Island names describe the original places and stay separate from product names.

| Concept | 日本語 | Deutsch | Français | Español |
| --- | --- | --- | --- | --- |
| Project archive | 作品アーカイブ | Projektarchiv | Archives des projets | Archivo de proyectos |
| Observation records | 観測記録 | Beobachtungsprotokolle | Relevés d’observation | Registros de observación |
| Uptime monitoring | 稼働監視 | Verfügbarkeitsüberwachung | Suivi de disponibilité | Monitorización de disponibilidad |
| Open source | オープンソース | Open Source | Open source | Código abierto |
| Released | 公開済み | Veröffentlicht | Publié | Publicado |

## Verification

- `pnpm check`, `pnpm build:cn`, and `pnpm build:intl` validate typed copy and the two static exports. The exports contain 48 localized pages in total, with the correct document language and a single set of unprefixed default-language URLs per region.
- Chrome covered the four pages in all six languages at 1920×1080, 1440×900, 960×720, 390×844, and 320×568. Mobile results use browser emulation. Checks covered navigation and language selection, ABOUT's five chapters, eight WORKS dossiers in each new language, the CONTACT single-screen layout, localized 404s, and WebGL and island fallbacks.
- Live WebGL checks covered the three witness sequences, observation cards, brand reveal and reverse scrolling, plus island loading and controls. The new locales keep the same scroll cues, adapt typing speed to the translated length, and queue pending subtitles on a fast scroll. The brand reveal starts after the subtitles finish.
- The CN release check remains gated on a confirmed production origin. The INTL release check passes.
