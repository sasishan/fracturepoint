# WWIII: FRACTURE POINT — Game Design Document Index
### Version 1.0 | March 2026

---

## DOCUMENT REGISTRY

| # | Document                         | File                                          | Status   |
|---|----------------------------------|-----------------------------------------------|----------|
| 1 | Master Overview & Game Concept   | GDD-OVERVIEW.md                               | Complete |
| 2 | Nations, Factions & Alliances    | GDD-NATIONS-AND-FACTIONS.md                   | Complete |
| 3 | Military Units, Weapons & Combat | GDD-MILITARY-SYSTEMS.md                       | Complete |
| 4 | Economy, Resources & Supply      | GDD-ECONOMY-AND-RESOURCES.md                  | Complete |
| 5 | Diplomacy, Espionage & Politics  | GDD-DIPLOMACY-AND-ESPIONAGE.md                | Complete |
| 6 | Technology Tree & Research       | GDD-TECHNOLOGY-TREE.md                        | Complete |
| 7 | Multiplayer, AI & Game Modes     | GDD-MULTIPLAYER-AND-AI.md                     | Complete |
| 8 | Graphics, UI & Tech Architecture | GDD-GRAPHICS-AND-TECH-ARCHITECTURE.md         | Complete |

**Future Documents (Phase 2):**
| # | Document                         | File                                          | Status   |
|---|----------------------------------|-----------------------------------------------|----------|
| 9 | Campaign Narrative & Missions    | GDD-CAMPAIGN.md                               | Planned  |
|10 | Audio Design Document            | GDD-AUDIO.md                                  | Planned  |
|11 | Monetization & Live Service      | GDD-MONETIZATION.md                           | Planned  |
|12 | UI/UX Wireframes & Flows         | GDD-UI-WIREFRAMES.md                          | Planned  |
|13 | Balance Parameters Spreadsheet   | BALANCE-PARAMETERS.xlsx                       | Planned  |
|14 | Scenario Design Guide            | GDD-SCENARIO-EDITOR.md                        | Planned  |

---

## QUICK REFERENCE: CORE SYSTEMS

### RESOURCE TYPES
GDP, Energy, Manpower, Production Points (PP), Research Points (RP),
Political Capital (PC), Intelligence Points (IP), Food, Rare Earth Materials

### PLAYABLE NATIONS (12)
United States, United Kingdom, European Union, Russia, China, North Korea,
Iran, India, Pakistan, Saudi Arabia, Israel, [12th: Turkey — TBD]

### VICTORY CONDITIONS (6)
Military, Economic, Political, Nuclear, Ideological, Armistice

### GAME MODES (5)
Campaign, Skirmish, Grand Strategy (Persistent), Crisis Mode, Sandbox

### TECH BRANCHES (6)
1. Conventional Land Warfare
2. Air Power & Aerospace
3. Naval Power
4. Strategic & Nuclear
5. Cyber & Information
6. Space & Strategic Systems

### UNIT DOMAINS (4)
Land Forces, Air Forces, Naval Forces, Strategic/WMD

---

## DESIGN PRINCIPLES (SUMMARY)

1. **Geopolitical Authenticity** — Real nations, real weapons, real doctrine
2. **Cascading Consequences** — Every action ripples through all systems
3. **Strategic Depth Without Micromanagement Hell** — Delegate tactical AI; focus on strategy
4. **Online First, Offline Capable** — Seamless MP; full solo experience
5. **Cinematic Presentation** — Globe-to-unit zoom; AAA-quality visuals

---

## KEY DESIGN NUMBERS

| Parameter                    | Value                          |
|-----------------------------|--------------------------------|
| Nations on map              | 195 sovereign nations          |
| Provinces                   | 1,200+                         |
| Playable major powers       | 12                             |
| Unit types                  | 60+ across all domains         |
| Tech tree nodes             | ~100 across 6 branches         |
| Crisis scenarios (launch)   | 5                              |
| Max players per match       | 8                              |
| Grand Strategy max players  | 32                             |
| Skirmish duration           | 45–90 minutes                  |
| Grand Strategy season       | 8–12 real weeks                |
| DEFCON levels               | 5                              |
| Nuclear authentication steps| 2 (two-key system)             |
| AI difficulty levels        | 5 + Adaptive                   |
| PC client engine            | Unreal Engine 5.4+             |
| Browser engine              | Three.js + WebGPU              |

---

## TONE DOCUMENT

WWIII: Fracture Point is NOT a glorification of war. It is a sobering strategic simulation that:
- Shows the terrifying complexity of modern geopolitics
- Demonstrates how quickly rational actors can escalate into catastrophe
- Rewards players who use diplomacy, economics, and intelligence over brute force
- Makes nuclear use feel consequential, not trivially powerful
- Includes humanitarian consequences as mechanical penalties (civilian casualties, refugee flows, morale)

The game asks: *What would YOU do in charge of the most powerful nation on earth?*
And it lets you discover — through play — why peace is harder than war.
