# WWIII: FRACTURE POINT
## Scenario.gg Asset Generation Prompts
### Design Document v1.0

**How to use these prompts:**
1. Go to scenario.gg → Create Asset
2. Choose the recommended model (noted per section)
3. Paste the prompt exactly as written
4. Add the universal negative prompt from the style guide
5. Steps: 40–50 | Guidance: 7–9 | Seed: note the seed for variants
6. Generate 4 variants, select best, upscale to target resolution

---

## SECTION 1 — TERRAIN HEX TILES

**Model:** Photorealistic / Satellite Imagery style
**Resolution:** 512×512px | **Format:** PNG, no alpha | **Tiling:** Seamless

> All terrain tiles are top-down aerial/satellite view. They will be hex-cropped in engine. Generate as square images — the hex mask is applied in Three.js shader.

---

### TILE 01 — TEMPERATE PLAINS / GRASSLAND
```
top-down satellite aerial photograph of temperate grassland plains,
agricultural fields in geometric patterns, light green and yellow-green
patches, dirt roads, slight variation in vegetation density, photorealistic,
muted natural colors, seamless texture tile, no horizon, pure overhead view,
8k texture, sharp detail, natural lighting
```

### TILE 02 — DENSE FOREST / WOODLAND
```
top-down satellite aerial photograph of dense temperate forest, dark green
tree canopy, varied tree crown sizes, dappled shadow between trees, narrow
forest tracks visible, slight texture variation, photorealistic, seamless
overhead texture tile, no sky, rich deep greens and olive tones, 8k sharp
satellite imagery style
```

### TILE 03 — TROPICAL JUNGLE
```
top-down satellite aerial view of dense tropical rainforest canopy, extremely
dense bright emerald green tree cover, no ground visible, slight river
tributaries cutting through, lush varied greens, photorealistic satellite
texture, seamless tile, overhead view, high detail
```

### TILE 04 — MOUNTAIN RANGE
```
top-down aerial satellite photograph of rugged mountain terrain, sharp rocky
peaks with snow on summits, dark gray and brown rock faces, steep terrain,
shadowed valleys, some alpine meadows, snow-capped ridgelines, photorealistic,
seamless overhead texture tile, dramatic terrain, 8k satellite imagery
```

### TILE 05 — DESERT / ARID TERRAIN
```
top-down satellite aerial photograph of desert terrain, sand dunes in flowing
patterns, warm tan and ochre tones, slight wind erosion texture, dry rocky
outcrops, subtle shadow in dune valleys, minimal vegetation, photorealistic
satellite texture, seamless tile, overhead view, warm golden light
```

### TILE 06 — URBAN / CITY DISTRICT
```
top-down satellite aerial photograph of dense urban cityscape, city blocks
with buildings casting short shadows, road grid pattern, parking lots,
rooftops of varied heights, gray concrete and tarmac, small green spaces,
photorealistic, seamless overhead texture tile, modern city, 8k resolution
```

### TILE 07 — ARCTIC / FROZEN TUNDRA
```
top-down satellite aerial photograph of arctic tundra, mostly flat snow
covered terrain, ice and frozen ground, pale blue-white tones, slight
patterned ground from permafrost, scattered dark patches of exposed rock,
frozen rivers and lakes, photorealistic, cold blue-white palette, seamless
overhead texture tile, 8k
```

### TILE 08 — COASTAL WETLANDS / MARSH
```
top-down satellite aerial photograph of coastal wetlands and marshes,
interlocking water channels and mudflats, dark water with green reeds and
grass, tidal patterns, organic winding shapes, brown and green palette,
photorealistic satellite texture, seamless overhead tile, 8k
```

### TILE 09 — SHALLOW COASTAL OCEAN
```
top-down satellite aerial view of shallow coastal ocean water, clear blue-green
water with sandy seafloor visible below, subtle wave patterns, gradation from
turquoise near shore to deeper blue further out, underwater terrain features,
photorealistic, seamless overhead texture tile, 8k satellite imagery
```

### TILE 10 — DEEP OCEAN
```
top-down satellite aerial view of deep ocean, dark navy blue water, subtle
surface texture and swell patterns, very dark uniform blue with slight variation,
no land visible, photorealistic satellite texture, seamless tile, minimal
surface detail, dark deep-sea blues
```

### TILE 11 — RADIOACTIVE CONTAMINATION ZONE (Overlay)
```
top-down aerial view of contaminated wasteland terrain, sickly yellow-green
toxic coloration, dead vegetation, gray-green poisoned ground, toxic pools,
eerie green glow effects, desaturated dying landscape with nuclear contamination
visual effects, dramatic, dark and unsettling, transparent overlay style
```

### TILE 12 — FARMLAND / AGRICULTURAL
```
top-down satellite aerial photograph of agricultural farmland, geometric
irrigation circles and rectangular crop fields in varying shades of green
and yellow-brown, field boundaries, some harvested fields, photorealistic
satellite texture, seamless overhead tile, ordered geometric patterns
```

---

## SECTION 2 — UNIT ICONS (Z2 MAP VIEW)

**Model:** Game Icons / Military Icon style
**Resolution:** 128×128px | **Format:** PNG with alpha | **Background:** Transparent

> Icons use NATO-inspired military symbol shapes. Generate with transparent background. Color fill will be applied via shader tint in-engine — generate in WHITE/GRAY base colors only.

---

### LAND UNIT ICONS

### ICON L01 — INFANTRY / FOOT SOLDIERS
```
military strategy game unit icon, infantry soldiers symbol, top-down view,
square frame border, small crossed rifles symbol in center, flat vector style,
military tactical symbol, white and gray color scheme, transparent background,
clean bold design, game UI icon, 128x128, sharp crisp edges, no text
```

### ICON L02 — MAIN BATTLE TANK
```
military strategy game unit icon, main battle tank top-down silhouette,
square frame, realistic tank shape with turret visible from above, flat
tactical game icon style, white and light gray, transparent background,
bold recognizable silhouette, strategy game map marker, 128x128, no text
```

### ICON L03 — ARMORED INFANTRY (IFV/APC)
```
military strategy game unit icon, armored personnel carrier top-down view,
rectangular armored vehicle silhouette seen from above, small cannon visible,
square frame border, flat game icon, white and gray, transparent background,
tactical map symbol, bold and clear, 128x128
```

### ICON L04 — SELF-PROPELLED ARTILLERY
```
military strategy game unit icon, self-propelled artillery top-down silhouette,
long gun barrel visible, tracked vehicle with large cannon, square frame,
tactical game icon, white and light gray, transparent background,
artillery symbol with range arc indicator, 128x128, bold
```

### ICON L05 — MULTIPLE ROCKET LAUNCHER (MLRS)
```
military strategy game unit icon, multiple launch rocket system top view,
vehicle with multiple rocket tubes pointing forward, square frame, flat
tactical icon, white and gray tones, transparent background, 128x128,
strategy game map unit marker, clean silhouette
```

### ICON L06 — SURFACE-TO-AIR MISSILE BATTERY (SAM)
```
military strategy game unit icon, surface to air missile launcher system
top-down view, radar dish and missile tubes visible from above, hexagonal
or square frame with radar sweep arc decoration, flat tactical icon,
white and gray, transparent background, 128x128, anti-air symbol
```

### ICON L07 — SPECIAL FORCES
```
military strategy game unit icon, special operations forces symbol, square
frame with dagger or lightning bolt symbol, distinctive covert ops visual,
tactical game icon, dark gray and white, transparent background, 128x128,
military special forces insignia style, no text
```

### ICON L08 — COMBAT ENGINEERS
```
military strategy game unit icon, military engineers unit, square frame,
crossed tools or bridge symbol in center, engineering corps tactical marker,
flat game icon, white and gray, transparent background, 128x128, strategy
game map symbol, construction bridge silhouette
```

### ICON L09 — LOGISTICS / SUPPLY TRUCK
```
military strategy game unit icon, military supply convoy top-down view,
supply truck silhouette from above, square frame with supply chain arrows,
flat tactical icon, white and gray, transparent background, 128x128,
logistics unit map marker, bold clean lines
```

### ICON L10 — MILITIA / RESERVES
```
military strategy game unit icon, militia reserves symbol, square frame,
simple armed figure outline, rough irregular border style, less polished
than regular military icons, tactical game map marker, white and gray,
transparent background, 128x128
```

---

### AIR UNIT ICONS

### ICON A01 — FIGHTER JET (5th Gen)
```
military strategy game unit icon, stealth fighter jet top-down silhouette,
F-35 style swept wing aircraft seen from above, diamond/parallelogram frame,
tactical air unit icon, angular stealth aircraft outline, white and gray,
transparent background, 128x128, game map marker, sharp angular design
```

### ICON A02 — STRATEGIC BOMBER
```
military strategy game unit icon, strategic bomber top-down silhouette,
B-2 flying wing or similar large bomber aircraft seen from above, massive
wingspan, diamond frame, tactical air icon, white and gray, transparent
background, 128x128, strategy game air unit symbol, bold wingspan shape
```

### ICON A03 — ATTACK HELICOPTER
```
military strategy game unit icon, attack helicopter top-down view, Apache
style helicopter silhouette from above, rotor blades visible, slim attack
profile, diamond or circle frame, tactical air icon, white and gray,
transparent background, 128x128, game map marker
```

### ICON A04 — TRANSPORT HELICOPTER
```
military strategy game unit icon, military transport helicopter top-down
silhouette, large helicopter with two rotors visible from above, chinook
style, circle frame, tactical air transport icon, white and gray,
transparent background, 128x128, strategy game map symbol
```

### ICON A05 — DRONE / UAV
```
military strategy game unit icon, military surveillance drone top-down
silhouette, Reaper drone style, long narrow fuselage with wide wings,
no pilot cockpit, diamond frame, tactical drone icon, white and gray,
transparent background, 128x128, unmanned aerial vehicle symbol
```

### ICON A06 — KAMIKAZE DRONE SWARM
```
military strategy game unit icon, swarm of small attack drones top-down,
multiple small diamond shapes arranged in swarm pattern, chaotic clustering,
diamond frame, modern drone warfare icon, gray and white, transparent
background, 128x128, tactical game map marker
```

---

### NAVAL UNIT ICONS

### ICON N01 — AIRCRAFT CARRIER
```
military strategy game unit icon, aircraft carrier top-down silhouette,
massive flat flight deck with aircraft visible, island superstructure,
rounded-corner rectangle frame, tactical naval icon, white and gray,
transparent background, 128x128, carrier strike group marker
```

### ICON N02 — DESTROYER
```
military strategy game unit icon, destroyer warship top-down silhouette,
sleek modern destroyer hull seen from above, gun turrets and missile
launchers visible, rounded frame, tactical naval icon, white and gray,
transparent background, 128x128, strategy game ship unit
```

### ICON N03 — NUCLEAR SUBMARINE
```
military strategy game unit icon, nuclear submarine top-down silhouette,
long teardrop hull shape, conning tower visible, ghost shape suggesting
underwater stealth, rounded frame, tactical naval icon, dark gray and white,
transparent background, 128x128, SSBN symbol with stealth indicator
```

### ICON N04 — FRIGATE
```
military strategy game unit icon, frigate warship top-down silhouette,
smaller than destroyer, compact hull, rounded frame, tactical naval icon,
white and gray, transparent background, 128x128, game map naval marker
```

### ICON N05 — AMPHIBIOUS ASSAULT SHIP
```
military strategy game unit icon, amphibious assault ship top-down silhouette,
flat deck with helicopter spots, wide hull, landing craft visible at stern,
rounded frame, tactical naval icon, white and gray, transparent background,
128x128, marine assault ship game symbol
```

---

### STRATEGIC UNIT ICONS

### ICON S01 — ICBM / MISSILE SILO
```
military strategy game unit icon, ICBM missile silo strategic symbol,
diamond frame with upward-pointing missile silhouette, nuclear warning symbol
incorporated, red and white color scheme, transparent background, 128x128,
strategic nuclear forces game icon, bold and alarming
```

### ICON S02 — SPY / INTELLIGENCE ASSET
```
military strategy game unit icon, intelligence spy asset symbol, cloak and
dagger visual metaphor, eye symbol or shadow figure, irregular dark frame
suggesting concealment, dark gray and white, transparent background, 128x128,
covert operations game map marker, subtle sinister design
```

---

## SECTION 3 — UNIT 3D MODELS (Z3 PROVINCE VIEW)

**Model:** Isometric Game Asset / 3D Render style
**Resolution:** 256×256px | **Format:** PNG with alpha | **Angle:** Isometric top-down 45°

> Consistent lighting: light source upper-left. All units on transparent background with soft drop shadow. Vehicle color = light gray/beige (engine tints to faction color).

---

### MODEL M01 — MAIN BATTLE TANK (M1A2 / T-90 style)
```
isometric 3D game asset, modern main battle tank, M1 Abrams style,
viewed from 45 degree isometric angle from upper-left, highly detailed
military vehicle, desert tan and olive drab base color, realistic metal
texture, reactive armor tiles on hull, gun barrel pointing forward-right,
turret detail, track links visible, transparent background, soft drop shadow,
game-ready 3D render, 256x256, military simulation game asset
```

### MODEL M02 — INFANTRY FIGHTING VEHICLE (Bradley / BMP style)
```
isometric 3D game asset, modern infantry fighting vehicle Bradley style,
tracked armored vehicle viewed from 45 degree isometric upper-left angle,
25mm cannon turret, realistic metal and armor texture, olive drab base,
detailed tracks and hull, transparent background, soft drop shadow,
high quality game asset render, military simulation, 256x256
```

### MODEL M03 — SELF-PROPELLED ARTILLERY (M109 Paladin style)
```
isometric 3D game asset, self-propelled artillery M109 Paladin style,
large tracked vehicle with long 155mm howitzer barrel, viewed from
isometric 45 degree angle, olive green base color, detailed metal texture,
gun barrel extended, armored cab, transparent background, drop shadow,
military simulation game asset, 256x256
```

### MODEL M04 — MULTIPLE ROCKET LAUNCHER (M270 MLRS style)
```
isometric 3D game asset, multiple launch rocket system M270 MLRS, tracked
vehicle with box launcher pod on top, two rocket pods raised, viewed from
45 degree isometric angle, olive drab coloring, detailed mechanical texture,
transparent background, soft drop shadow, military game asset, 256x256
```

### MODEL M05 — S-400 / PATRIOT SAM SYSTEM
```
isometric 3D game asset, surface to air missile launcher battery,
Patriot or S-400 style launch vehicle with vertical launch tubes,
radar vehicle nearby, viewed from isometric 45 degree angle,
military green and gray, detailed technical texture, transparent background,
drop shadow, military simulation game asset, 256x256
```

### MODEL M06 — FIGHTER JET (F-35 / Su-57 style)
```
isometric 3D game asset, stealth fighter jet F-35 style, viewed from
above-left isometric angle, angular stealth surfaces, air intakes visible,
weapon hardpoints, dark gray and charcoal coloring, highly detailed,
metallic sheen, transparent background, dramatic lighting, soft drop shadow,
military aviation game asset, 256x256
```

### MODEL M07 — STRATEGIC BOMBER (B-2 / Tu-160 style)
```
isometric 3D game asset, strategic stealth bomber B-2 spirit style,
massive flying wing aircraft, viewed from above isometric angle, dark
charcoal gray, smooth blended wing body, engine nacelles, transparent
background, dramatic lighting, soft drop shadow, military aviation
game asset, 256x256
```

### MODEL M08 — AIRCRAFT CARRIER (Gerald Ford class style)
```
isometric 3D game asset, nuclear aircraft carrier Gerald R Ford class,
viewed from above isometric 45 degree angle, massive flight deck with
aircraft visible, island superstructure, catapult tracks, arresting wires,
dark gray hull, flight deck markings, transparent background, soft drop
shadow, naval simulation game asset, 256x256
```

### MODEL M09 — ARLEIGH BURKE DESTROYER
```
isometric 3D game asset, Arleigh Burke class destroyer warship, viewed
from above isometric angle, sleek gray hull, Aegis radar arrays, vertical
launch system cells, 5 inch gun, helicopter deck at stern, realistic naval
gray paint, transparent background, soft drop shadow, naval game asset, 256x256
```

### MODEL M10 — NUCLEAR SUBMARINE
```
isometric 3D game asset, nuclear submarine Ohio class or Virginia class,
viewed from isometric angle slightly above, sleek dark gray teardrop hull,
conning tower with periscopes, missile hatches visible on hull, dark gray
and black coloring, transparent background with underwater blue-tinted
shadow effect, naval simulation game asset, 256x256
```

### MODEL M11 — ATTACK HELICOPTER (AH-64 Apache style)
```
isometric 3D game asset, AH-64 Apache attack helicopter, viewed from
isometric 45 degree upper-left angle, tandem cockpit, stub wings with
hellfire missiles, rotor blades, chain gun under nose, olive drab and dark
green, highly detailed, transparent background, soft drop shadow,
military aviation game asset, 256x256
```

### MODEL M12 — REAPER DRONE / UAV
```
isometric 3D game asset, MQ-9 Reaper unmanned combat drone, viewed from
isometric upper angle, long narrow fuselage, large high-aspect ratio wings,
inverted V-tail, sensor turret under nose, weapon hardpoints, dark gray,
transparent background, soft drop shadow, modern military game asset, 256x256
```

---

## SECTION 4 — HUD & UI ELEMENTS

**Model:** Game UI / Dark Interface style
**Format:** PNG with alpha (or SVG where noted)

---

### HUD 01 — MAIN HUD FRAME / BORDER
```
dark military command center UI frame, top HUD bar, deep navy black
background, amber orange accent lines and borders, tactical military
interface design, subtle circuit board pattern texture in dark background,
amber phosphor glow effect on borders, angular sharp corners, no rounded
edges, game UI design, dark glass morphism, widescreen 1920x100 proportions
```

### HUD 02 — RESOURCE PANEL BACKGROUND
```
dark military game UI panel, resource display panel background, deep navy
dark background, amber orange border lines with right angle geometric
accents, subtle scan line effect, tactical information display aesthetic,
military command terminal style, transparent areas for content,
dark glass panel UI element, 400x200 pixels
```

### HUD 03 — DEFCON DISPLAY WIDGET
```
military game UI element, DEFCON status display, circular or rectangular
widget, 5 numbered levels displayed, current level highlighted in red with
glowing effect, others dim, radar sweep animation circle in background,
dark military interface, amber and red color scheme, game HUD element,
alert display panel, tactical command interface
```

### HUD 04 — NUCLEAR COMMAND AUTHENTICATION PANEL
```
dark ominous military game UI panel, nuclear launch authorization screen,
red warning color scheme, authentication code input display, countdown
timer element, two key slots visible, LAUNCH AUTHORIZED text area,
classified document aesthetic, nuclear command control interface,
military game UI, dramatic red and black with amber text, 800x600
```

### HUD 05 — MINIMAP FRAME
```
military game UI minimap frame, small tactical map overlay, dark angular
frame with amber border accents, compass rose in corner, coordinate display,
scan line overlay, radar/sonar aesthetic, tactical display frame,
game minimap container, 256x256, military command interface style
```

### HUD 06 — UNIT SELECTION PANEL
```
dark military game UI panel, unit information panel, shows unit portrait
area, health and supply bars, movement indicator, combat stats display,
deep navy background, amber orange accents and borders, tactical interface,
angular design, no rounded corners, game HUD panel element, 400x300
```

### HUD 07 — DIPLOMACY SCREEN HEADER
```
diplomatic affairs game UI header element, formal government document
aesthetic mixed with military command interface, deep navy background,
silver and amber accents, world map silhouette motif, international flags
row, treaty document corner elements, sophisticated dark UI, 1920x120
```

### HUD 08 — PROGRESS / LOADING BAR
```
military game UI loading progress bar, tactical loading screen element,
amber orange fill color on dark navy track, angular sharp ends not rounded,
scan line overlay, military data transfer aesthetic, percentage text,
command terminal style, dark glass panel, 400x30 proportions
```

---

## SECTION 5 — ICON SET

**Model:** Flat Game Icons
**Resolution:** 64×64px | **Format:** PNG with alpha
**Style:** Flat vector-style, consistent stroke weight, amber/white on transparent

---

### RESOURCE ICONS

### ICON R01 — OIL / PETROLEUM
```
game UI resource icon, oil barrel petroleum symbol, stylized oil drum
silhouette, flat design, white and amber color, transparent background,
64x64 game icon, bold clear outline, strategy game resource symbol,
no text, minimal clean design
```

### ICON R02 — NATURAL GAS
```
game UI resource icon, natural gas flame symbol, stylized blue-orange
flame, flat design, white and light blue color, transparent background,
64x64 game icon, energy resource symbol, strategy game, bold clean design
```

### ICON R03 — COAL
```
game UI resource icon, coal mineral resource symbol, black angular rock
chunk shape with slight shine, flat design, dark gray and white,
transparent background, 64x64 game icon, mining resource, strategy game
```

### ICON R04 — URANIUM / NUCLEAR MATERIAL
```
game UI resource icon, uranium nuclear material symbol, glowing yellow
radioactive cylinder or atom symbol, biohazard/radioactive warning aesthetic,
flat design, yellow-green and white, transparent background, 64x64 game icon,
nuclear resource symbol, strategy game
```

### ICON R05 — STEEL / METALS
```
game UI resource icon, steel ingot or iron ore symbol, metallic rectangular
ingot shape, flat design with metallic sheen, silver and gray, transparent
background, 64x64 game icon, industrial metals resource, strategy game
```

### ICON R06 — ELECTRONICS / SEMICONDUCTORS
```
game UI resource icon, electronics semiconductor chip symbol, circuit board
or microchip flat design, blue and white, circuit pattern, transparent
background, 64x64 game icon, high tech resource symbol, strategy game
```

### ICON R07 — FOOD / GRAIN
```
game UI resource icon, food and grain supply symbol, wheat sheaf or bread
loaf silhouette, flat design, warm gold and white, transparent background,
64x64 game icon, agricultural resource, strategy game, simple and bold
```

### ICON R08 — MANPOWER / POPULATION
```
game UI resource icon, military manpower population symbol, soldier figure
silhouette or group of people icons, flat design, white and gray,
transparent background, 64x64 game icon, human resources symbol,
strategy game
```

### ICON R09 — CURRENCY / GDP
```
game UI resource icon, economy currency symbol, abstract coin or economy
graph upward arrow, flat design, gold and white, transparent background,
64x64 game icon, economic resource, strategy game, no dollar sign
```

### ICON R10 — RARE EARTH MINERALS
```
game UI resource icon, rare earth minerals symbol, crystal or mineral
cluster shape, flat design, purple and teal iridescent colors, transparent
background, 64x64 game icon, strategic minerals resource, strategy game
```

---

### ACTION ICONS

### ICON ACT01 — MOVE UNITS
```
game UI action icon, move military units command symbol, arrow pointing
direction with boot print or unit silhouette, flat design, white and amber,
transparent background, 64x64 game icon, movement order command
```

### ICON ACT02 — ATTACK ORDER
```
game UI action icon, attack military order symbol, crossed swords or
aggressive red arrow, flat design, red and white, transparent background,
64x64 game icon, attack command button, strategy game action
```

### ICON ACT03 — FORTIFY / DIG IN
```
game UI action icon, fortify dig in defense command, sandbag wall or
earthwork symbol, flat design, brown and white, transparent background,
64x64 game icon, defensive order button, strategy game
```

### ICON ACT04 — DECLARE WAR
```
game UI action icon, declare war diplomatic action symbol, two crossed
swords with broken treaty document, dramatic flat design, red and dark,
transparent background, 64x64 game icon, war declaration button
```

### ICON ACT05 — PROPOSE ALLIANCE
```
game UI action icon, diplomatic alliance proposal symbol, two hands
shaking or interlocked shield symbols, flat design, gold and white,
transparent background, 64x64 game icon, diplomacy action button
```

### ICON ACT06 — IMPOSE SANCTIONS
```
game UI action icon, economic sanctions symbol, chain or lock over
trade route arrows, flat design, red and white, transparent background,
64x64 game icon, economic warfare action button, strategy game
```

### ICON ACT07 — RESEARCH TECHNOLOGY
```
game UI action icon, research technology symbol, atom or light bulb
with tech circuit elements, flat design, blue and white, transparent
background, 64x64 game icon, research action button, strategy game
```

### ICON ACT08 — ESPIONAGE / SPY
```
game UI action icon, espionage covert operations symbol, eye with
crosshair or shadow figure with hat, flat design, dark gray and white,
transparent background, 64x64 game icon, intelligence action button
```

### ICON ACT09 — NUCLEAR LAUNCH
```
game UI action icon, nuclear launch authorization symbol, missile with
atom symbol or mushroom cloud silhouette, flat design, red warning
colors and white, transparent background, 64x64 game icon,
nuclear command action button, alarming design
```

### ICON ACT10 — DEPLOY SUPPLY
```
game UI action icon, supply logistics deployment symbol, supply crate
with parachute or truck with arrows, flat design, white and amber,
transparent background, 64x64 game icon, logistics action button
```

---

### STATUS ICONS

### ICON ST01 — LOW SUPPLY WARNING
```
game UI status icon, low military supply warning symbol, supply crate
with X or empty fuel gauge, flat design, amber warning color and white,
transparent background, 64x64 game icon, unit status indicator
```

### ICON ST02 — COMBAT ENGAGED
```
game UI status icon, unit combat engaged status symbol, crossed swords
or explosion symbol, flat design, red and white, transparent background,
64x64 game icon, combat status indicator, strategy game
```

### ICON ST03 — UNIT FORTIFIED
```
game UI status icon, unit fortified defensive status, shield with
chevron or sandbag wall symbol, flat design, green and white,
transparent background, 64x64 game icon, defensive status indicator
```

### ICON ST04 — NUCLEAR ALERT
```
game UI status icon, nuclear threat alert symbol, atom with radiation
symbol and alert ring, pulsing design, yellow-green on dark, transparent
background, 64x64 game icon, nuclear warning status, alarming
```

### ICON ST05 — MORALE (HIGH)
```
game UI status icon, high morale positive status symbol, raised fist
or upward star, bold and heroic, flat design, gold and white,
transparent background, 64x64 game icon, morale status indicator
```

### ICON ST06 — MORALE (LOW)
```
game UI status icon, low morale negative status symbol, broken weapon
or downward arrow with figure, flat design, gray and red, transparent
background, 64x64 game icon, morale status indicator
```

---

## SECTION 6 — ATMOSPHERIC & EFFECTS

**Model:** VFX Concept Art / Cinematic style
**Resolution:** 1024×1024 | **Format:** PNG with alpha for sprites; JPG for backgrounds

---

### FX01 — NUCLEAR DETONATION SEQUENCE
```
cinematic nuclear explosion detonation visual effect, massive mushroom cloud
forming, blinding white flash at ground zero expanding outward, orange and
red fireball below dark mushroom stem, enormous scale, billowing gray-black
smoke cloud cap, shock wave visible in air, dramatic apocalyptic lighting,
photorealistic, cinematic quality, dark sky background, isolated on dark
```

### FX02 — TACTICAL MISSILE STRIKE
```
game visual effect, cruise missile impact explosion, medium sized orange
fireball on impact, dark smoke plume rising, debris cloud spreading outward,
dramatic lighting, concrete and earth debris, photorealistic explosion effect,
transparent/dark background, game VFX asset, isolated explosion
```

### FX03 — ARTILLERY BARRAGE
```
game visual effect, artillery shell impact explosions sequence, multiple
smaller orange-red explosions with dirt clouds, smoke plumes, realistic
ground impact debris patterns, battlefield smoke, photorealistic,
transparent background, VFX sprite, military artillery effect
```

### FX04 — RADIATION ZONE OVERLAY
```
game visual effect overlay, nuclear radiation contamination zone, sickly
green-yellow radioactive glow effect, particles drifting upward slowly,
toxic fog at ground level, subtle skull motifs in particle patterns,
ominous eerie glow, transparent background overlay effect, 1024x1024
```

### FX05 — FRONTLINE BATTLE SMOKE
```
game visual effect, frontline battle smoke and haze, long horizontal smoke
bank, gray-white and black smoke mixed, fire glow visible below, battlefield
atmosphere, photorealistic smoke effect, transparent background, game VFX,
wide panoramic smoke texture
```

### FX06 — MISSILE CONTRAIL
```
game visual effect, ballistic missile launch contrail, bright orange rocket
exhaust at base, white condensation trail arcing upward, slight spiral in
trail, against dark sky, dramatic lighting, transparent background,
game VFX sprite, missile launch effect
```

### FX07 — AIR STRIKE TRACER ROUNDS
```
game visual effect, aerial strafing run tracer rounds, bright orange-white
tracer lines angled downward, impact sparks at bottom, motion blur,
night combat aesthetic, transparent background, VFX game effect,
fighter jet strafing visual
```

### FX08 — NAVAL BOMBARDMENT SPLASH
```
game visual effect, naval artillery shell impact in water, massive water
splash column with white foam, concentric wave rings spreading outward,
mist cloud, dramatic ocean spray, photorealistic, transparent background,
naval combat VFX game asset
```

---

## SECTION 7 — BACKGROUNDS & CINEMATICS

**Model:** Cinematic Concept Art
**Resolution:** 1920×1080 (or 3840×2160 for source) | **Format:** JPG

---

### BG01 — MAIN MENU BACKGROUND
```
cinematic concept art, war room command center interior, large world map
holographic display in center, generals and military officers silhouetted
around table, dramatic blue and amber lighting, dark atmospheric room,
nuclear threat indicators on walls, multiple screens, photorealistic
cinematic render, widescreen 16:9, no UI elements, no text,
photoreal military sci-fi aesthetic
```

### BG02 — LOADING SCREEN — EUROPE THEATER
```
cinematic aerial concept art, Europe at night from very high altitude,
city lights forming country shapes, military aircraft silhouettes,
dark sky, dramatic atmospheric lighting, no UI, photorealistic cinematic,
widescreen 16:9, winter 2026 aesthetic, tension and drama
```

### BG03 — LOADING SCREEN — PACIFIC THEATER
```
cinematic aerial concept art, Pacific Ocean viewed from high altitude,
carrier battle groups visible as tiny dots on vast ocean, island chains,
aircraft silhouettes, dawn light, dramatic scale of ocean vs forces,
no UI elements, photorealistic cinematic, widescreen 16:9
```

### BG04 — LOADING SCREEN — NUCLEAR AFTERMATH
```
cinematic concept art, post nuclear exchange aftermath scene, horizon
glowing orange from multiple distant fires, dark roiling mushroom clouds
in distance, foreground rubble and devastation, ash falling, haunting
apocalyptic beauty, dark atmospheric, no UI, widescreen 16:9
```

### BG05 — CAMPAIGN MAP — WORLD WAR OVERVIEW
```
cinematic world map concept art, global strategic overview, Earth from
low orbit, frontlines visible as glowing lines of conflict across multiple
continents, military satellite orbital paths visible, dramatic planetary
lighting, dark space background, photorealistic render, widescreen
```

### BG06 — NATION SELECT SCREEN — USA
```
cinematic concept art, American military power projection, aircraft carrier
battle group at sea, F-35 jets in formation overhead, American flag in sky,
dramatic golden hour lighting, patriotic but serious military aesthetic,
photorealistic, widescreen 16:9, no text or UI
```

### BG07 — NATION SELECT SCREEN — RUSSIA
```
cinematic concept art, Russian military might, nuclear submarine surfacing
in Arctic waters, T-14 tanks in formation on snowy steppe, dark stormy sky,
red and gray color palette, dramatic cold war aesthetic, photorealistic,
widescreen 16:9, no text or UI
```

### BG08 — NATION SELECT SCREEN — CHINA
```
cinematic concept art, Chinese military rise, PLA navy carrier group in
South China Sea, J-20 stealth fighters, Type 99 tanks, dawn light over
eastern horizon, red and gold color palette, assertive powerful aesthetic,
photorealistic, widescreen 16:9, no text or UI
```

### BG09 — VICTORY SCREEN
```
cinematic concept art, war is over victory scene, soldiers raising flags
in rubble, smoke clearing to reveal blue sky, dramatic rays of light,
devastation and hope mixed, powerful emotional moment, photorealistic,
widescreen 16:9, no text or UI
```

### BG10 — DEFEAT SCREEN / GAME OVER
```
cinematic concept art, military defeat surrender scene, dark and somber,
bombed out capital building, enemy forces in streets, soldiers laying
down weapons, heavy dark atmosphere, rain, loss and consequence,
photorealistic, no text, widescreen 16:9
```

---

## SECTION 8 — NATION FLAG BORDERS & LEADER PORTRAITS

**Model:** Character Portrait (portraits) / Graphic Design (flags)

---

### PORTRAIT FRAME — GENERIC LEADER
```
game UI portrait frame, military leader commander portrait frame,
dark navy background with amber ornate border, rank insignia decoration
in corners, national seal space at top, tactical military aesthetic,
no portrait inside just the frame, game UI element, 256x256
```

### LEADER PORTRAIT STYLE PROMPT (apply to any generated leader)
```
official military portrait photograph style, head and shoulders composition,
formal military uniform, serious expression, national flag or blurred
command center background, studio lighting, photorealistic,
game character portrait, 256x256, sharp detail
```

---

## SECTION 9 — SCENARIO.GG WORKFLOW TIPS

### Batch Generation Strategy
Generate in this order (each category builds on style established by previous):
1. Start with terrain tiles (establishes photorealistic baseline)
2. Unit 3D models (establishes isometric lighting standard)
3. Unit icons (flat style derived from models)
4. Resource/action icons (same flat style as unit icons)
5. HUD elements (dark UI style)
6. Effects (VFX style)
7. Backgrounds (cinematic style)
8. Portraits (character style)

### Seed Pinning for Consistency
Once you find a generation you like in a category, note the seed. Use the same seed ±100 for variants within the same category. This maintains visual consistency across similar assets.

### Recommended Scenario.gg Settings Per Category

| Category       | Steps | CFG | Sampler  | Upscale |
|---------------|-------|-----|----------|---------|
| Terrain tiles  | 40    | 7.0 | DPM++ 2M | 2×      |
| Unit icons     | 35    | 7.5 | Euler A  | 2×      |
| Unit 3D models | 50    | 8.0 | DPM++ 2M | 2×      |
| HUD elements   | 30    | 7.0 | DPM++ 2M | 1×      |
| Small icons    | 30    | 7.5 | Euler A  | 2×      |
| Effects VFX    | 50    | 9.0 | DPM++ 2M | 2×      |
| Backgrounds    | 60    | 8.0 | DPM++ 2M | 4×      |
| Portraits      | 50    | 8.5 | DPM++ 2M | 2×      |

### Asset Naming Convention for Import
```
terrain_plains_512.png
terrain_forest_512.png
unit_icon_land_mbt_128.png
unit_3d_land_mbt_256.png
hud_defcon_display.png
icon_resource_oil_64.png
icon_action_attack_64.png
icon_status_supply_low_64.png
fx_nuclear_blast_1024.png
bg_main_menu_1920.jpg
bg_loading_europe_1920.jpg
portrait_frame_256.png
```

### Post-Processing Checklist (after import)
- [ ] Terrain tiles: verify seamless tiling (offset test in Photoshop)
- [ ] Unit icons: verify transparent background (no fringe)
- [ ] Unit models: normalize lighting direction (all upper-left)
- [ ] Icons: pixel-snap to 1px grid; verify at 16px display size
- [ ] HUD elements: export SVG version alongside PNG
- [ ] Effects: trim transparent margins; build spritesheets (TexturePacker)
- [ ] Backgrounds: compress to 85% JPG quality; strip metadata
