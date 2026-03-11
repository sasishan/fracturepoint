# WWIII: FRACTURE POINT
## Visual Design Style Guide
### Design Document v1.0

---

## DESIGN PHILOSOPHY

**"Satellite Command"** — The game looks like the real world viewed through military intelligence systems. Not a fantasy map, not cartoonish. It feels like you've hacked into a live NORAD/NATO command terminal with a feed from reconnaissance satellites. Every visual reinforces that you are commanding real forces in a real world at the brink of catastrophe.

**Three Visual Registers:**
1. **The Map** — Satellite-realistic terrain; the world as seen from orbit
2. **The HUD** — Military command terminal; dark glass with amber phosphor glow
3. **The Units** — Tactical icons elevated to 3D; readable at any zoom

---

## COLOR PALETTE

### Primary Palette (HUD + UI)

| Name          | Hex       | RGB             | Usage                                      |
|--------------|-----------|-----------------|---------------------------------------------|
| Void Black    | `#07090D` | 7, 9, 13        | Deepest background; borders of screens     |
| Deep Navy     | `#0A0E14` | 10, 14, 20      | Primary app background                     |
| Command Blue  | `#0F1520` | 15, 21, 32      | Panel backgrounds                          |
| Steel Panel   | `#141C2B` | 20, 28, 43      | Secondary panels, hover states             |
| Border Dim    | `#1E2D45` | 30, 45, 69      | UI borders, dividers                       |
| Border Bright | `#2A3F60` | 42, 63, 96      | Active borders, selected states            |
| Amber Core    | `#E8A020` | 232, 160, 32    | Primary accent; player faction color       |
| Amber Dim     | `#A06A0A` | 160, 106, 10    | Inactive amber; secondary accents         |
| Intel Green   | `#3FB950` | 63, 185, 80     | Positive values; allied units; health      |
| Threat Red    | `#CF4444` | 207, 68, 68     | Enemy units; danger; damage                |
| Data Blue     | `#58A6FF` | 88, 166, 255    | Information; neutral data; research        |
| Smoke White   | `#CDD9E5` | 205, 217, 229   | Primary text                               |
| Ghost Gray    | `#7D8FA0` | 125, 143, 160   | Secondary text; labels                     |
| Nuclear Glow  | `#7CFC00` | 124, 252, 0     | Radiation zones; nuclear alerts            |

### Faction / Nation Colors

| Nation        | Primary Hex | Accent Hex  | Notes                                  |
|--------------|-------------|-------------|----------------------------------------|
| USA           | `#1C4E8A`   | `#C8102E`   | Navy blue + red; stars and stripes     |
| Russia        | `#CC0000`   | `#003082`   | Red + deep blue; imperial feel         |
| China         | `#CC0000`   | `#FFDE00`   | CCP red + gold                         |
| UK            | `#012169`   | `#C8102E`   | Union Jack blue + red                  |
| EU            | `#003399`   | `#FFCC00`   | EU blue + gold stars                   |
| DPRK          | `#024FA2`   | `#BE0000`   | Korean Workers' Party colors           |
| Iran          | `#239F40`   | `#FFFFFF`   | Green + white; Islamic Republic        |
| India         | `#FF9933`   | `#138808`   | Saffron + India green                  |
| Pakistan      | `#01411C`   | `#FFFFFF`   | Dark green + white crescent            |
| Saudi Arabia  | `#006C35`   | `#FFFFFF`   | Saudi green + white                    |
| Israel        | `#0038B8`   | `#FFFFFF`   | Star of David blue + white             |
| Turkey        | `#E30A17`   | `#FFFFFF`   | Turkish red + white crescent           |

### Terrain Color Language (Map Layer)

| Terrain Type  | Base Color  | Notes                                      |
|--------------|-------------|--------------------------------------------|
| Plains        | `#8A9F6A`   | Muted olive green; grass and farmland      |
| Forest        | `#2D5A27`   | Deep forest green; darker than plains      |
| Mountain      | `#8C7B6B`   | Rocky gray-brown; snow-capped peaks white  |
| Desert        | `#C4A86A`   | Sand tan; slight orange undertone          |
| Urban         | `#5A5A6B`   | Gray with slight purple; concrete          |
| Arctic        | `#C8D8E8`   | Ice blue-white; pale and cold              |
| Coastal       | `#4A7A8A`   | Teal-blue transition; shallower blue       |
| Deep Ocean    | `#0D2B45`   | Deep navy; darkest map color               |
| Shallow Water | `#1E4D6A`   | Mid-blue; sea zones near coast             |
| Radioactive   | `#3A5A1A`   | Sickly green-black; contaminated zones     |

---

## TYPOGRAPHY

### Primary Typefaces

**Tactical Display (headers, HUD values):**
`Rajdhani Bold` (Google Fonts) — angular, military stencil feel
- Use for: DEFCON display, resource numbers, unit stats, damage numbers
- Letter-spacing: +1–3px on all caps usage

**Interface (panel labels, buttons, nav):**
`Inter Medium` (Google Fonts) — clean, highly legible at small sizes
- Use for: menu items, panel headers, table labels, tooltips
- Never use below 11px

**Data / Monospace (coordinates, codes, logs):**
`JetBrains Mono` or `Cascadia Code` — technical, terminal feel
- Use for: hex coordinates, game event log, nuclear auth codes, system messages
- Use sparingly; reinforces "data terminal" aesthetic

### Type Scale

| Level     | Size | Weight | Font     | Usage                          |
|----------|------|--------|----------|--------------------------------|
| Display   | 32px | 700    | Rajdhani | Screen titles, game logo       |
| H1        | 24px | 700    | Rajdhani | Major panel headers            |
| H2        | 18px | 600    | Rajdhani | Section headers                |
| H3        | 14px | 600    | Inter    | Sub-headers, unit names        |
| Body      | 13px | 400    | Inter    | Panel content, descriptions    |
| Label     | 11px | 500    | Inter    | Map labels, icon labels        |
| Micro     | 10px | 500    | Inter    | Status tags, badges            |
| Code      | 12px | 400    | JB Mono  | Data, coordinates, codes       |

---

## HUD & UI DESIGN LANGUAGE

### Glass Panel Style
All UI panels use **Military Glass Morphism**:
- Background: `rgba(10, 14, 20, 0.92)` — near-opaque dark navy
- Border: 1px solid `#1E2D45` (dim) or `#2A3F60` (active)
- Left accent border: 3px solid `#E8A020` (amber) on primary panels
- No border-radius (sharp, angular corners — military aesthetic)
- Subtle inner shadow: `inset 0 1px 0 rgba(255,255,255,0.04)`

### Interactive States
```
Default:   border #1E2D45, bg rgba(10,14,20,0.92)
Hover:     border #A06A0A, bg rgba(20,28,43,0.95), cursor crosshair
Active:    border #E8A020, bg rgba(14,20,30,0.98), amber left border 3px
Danger:    border #CF4444, bg rgba(30,10,10,0.95), pulsing red glow
Disabled:  border #1E2D45 at 40% opacity, text at 30% opacity
```

### Icon Grid System
All icons are designed on a **32×32 grid** (base), scaling to 16/24/32/48/64px:
- 2px padding on all sides (28×28 active area)
- Stroke weight: 1.5px at 32px / 1px at 16px
- Corner treatment: sharp (0px radius) — no rounding

### Animation Language
- Transitions: 150ms ease-out for hover states, 200ms for panel slides
- Map overlays: 300ms fade
- DEFCON change: 500ms flash + sustained pulse
- Nuclear launch: 10-second countdown with increasing pulse frequency
- Battle: Province border pulses at 1Hz while combat ongoing
- Alert icons: rotate 360° at 2Hz (for active threats)

---

## UNIT DESIGN LANGUAGE

### Unit Representation System

Units are represented in **two modes** depending on zoom level:

**Z2 Mode — Icon Sprites (shown at regional zoom)**
- 64×64px sprite, transparent background
- NATO military symbology-inspired but stylized
- Shape encodes domain: Square = Land, Circle = Sea, Triangle/Arrow = Air
- Color fill encodes faction
- Center symbol encodes unit type (tank silhouette, plane, ship, etc.)
- White stroke outline for legibility on any terrain

**Z3 Mode — 3D Model Icons (shown at province zoom)**
- Isometric 3D renders of actual vehicles/units
- Top-down 45° angle view
- Consistent lighting: light from upper-left
- Soft drop shadow for depth on map
- Nation color tinting on vehicle body panels

### Unit Icon Shapes (Z2 Mode)

```
LAND units:    ┌─────┐
               │ sym │  Rectangle/square frame
               └─────┘

SEA units:     ╭─────╮
               │ sym │  Rounded-corner rectangle
               ╰─────╯

AIR units:    ╱───────╲
             │   sym   │  Parallelogram / diamond frame
              ╲───────╱

MISSILE/WMD:   ◇─────◇  Diamond frame
               │ sym │
               ◇─────◇
```

---

## TERRAIN TILE DESIGN PRINCIPLES

**Tile Resolution:** 512×512px per hex tile (displayed scaled to map resolution)
**Style:** Photorealistic satellite-imagery-inspired, slightly desaturated, top-down
**Key Rules:**
- Tiles must be seamlessly tileable within hex grid
- Terrain type immediately readable at all zoom levels
- Province ownership color is applied as a shader tint — do NOT bake political colors in
- Weather overlays (snow, rain, fog) applied as separate particle/texture layer
- Night mode darkens all tiles 60%; city lights added as separate glow layer

---

## SPECIAL EFFECTS DESIGN

### Nuclear Effects
- **Blast radius:** White flash expanding outward, orange fire ring, dark smoke column
- **Radiation zone:** Sickly green hex overlay tiles, particle drift upward
- **Nuclear winter:** Desaturates all terrain colors -70%; adds gray particle snow layer

### Combat Effects
- **Explosion:** Orange-red burst, black smoke plume, brief white flash
- **Artillery strike:** Smaller burst with dirt/debris spray
- **Air strike:** Fast diagonal streak + explosion below
- **Naval bombardment:** Water splash + explosion on coastal hex

### Strategic Overlays
- **Frontline:** Animated white dashed line, shifts toward controlling faction
- **Supply route:** Blue dotted line with directional arrow pulse
- **Air superiority zone:** Transparent color wash (blue = friendly, red = enemy)
- **Blockade:** Red X icons over sea zone hexes
- **Radiation fallout:** Semi-transparent green overlay with pulsing edge

---

## ASSET RESOLUTION SPECIFICATIONS

| Asset Type           | Resolution  | Format       | Notes                              |
|--------------------|-------------|--------------|-------------------------------------|
| Terrain hex tiles  | 512×512     | PNG (no alpha)| Tileable; RGB only                  |
| Unit icons (Z2)    | 128×128     | PNG (alpha)  | Transparent bg; multiple sizes     |
| Unit models (Z3)   | 256×256     | PNG (alpha)  | Isometric; transparent bg          |
| UI icons           | 64×64       | PNG (alpha)  | Crisp; also provide SVG            |
| HUD panels         | Vectorized  | SVG          | Scale-independent                   |
| Nation flags       | 128×80      | PNG (alpha)  | 16:10 ratio; standard              |
| Effects sprites    | 512×512     | PNG (alpha)  | Part of spritesheet                |
| Loading screens    | 1920×1080   | JPG          | 16:9; no UI elements baked in      |
| Main menu BG       | 3840×2160   | JPG          | 4K source; scale down for display  |
| Leader portraits   | 256×256     | PNG          | Square; slight vignette            |

---

## SCENARIO.GG MODEL RECOMMENDATIONS

For each asset category, use these Scenario.gg model settings:

| Category       | Model Style Tag        | Quality Steps | Guidance Scale |
|---------------|------------------------|--------------|----------------|
| Terrain tiles  | `Photorealistic`       | 40           | 7.0            |
| Unit icons     | `Game Icons`           | 35           | 7.5            |
| Unit 3D models | `Isometric Game Asset` | 45           | 8.0            |
| HUD / UI       | `Game UI`              | 30           | 7.0            |
| Resource icons | `Flat Game Icon`       | 30           | 7.5            |
| Effects        | `VFX Concept Art`      | 50           | 9.0            |
| Portraits      | `Character Portrait`   | 50           | 8.5            |
| Backgrounds    | `Cinematic Concept Art`| 60           | 8.0            |

**Universal Negative Prompt (apply to all generations):**
```
blurry, low quality, pixelated, watermark, signature, text, letters, words,
cartoon, anime, cute, fantasy, medieval, sci-fi spacecraft, alien,
low resolution, jpeg artifacts, overexposed, underexposed
```
