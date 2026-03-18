# Audio Assets

Place audio files here. All formats the browser supports work (`.mp3` recommended; `.mp3` and `.wav` also fine).
Missing files are silently skipped — the game runs without any audio assets.

---

## Sound Effects — `sfx/`

### Unit Selection — domain-specific voice lines (pick 1–3 variations)
| File | Suggested line |
|---|---|
| `unit_select_land_1.mp3` | "Awaiting orders." |
| `unit_select_land_2.mp3` | "Ready to advance." |
| `unit_select_land_3.mp3` | "Infantry reporting." |
| `unit_select_air_1.mp3`  | "Flight systems ready." |
| `unit_select_air_2.mp3`  | "On standby." |
| `unit_select_air_3.mp3`  | "Engines hot." |
| `unit_select_naval_1.mp3` | "Fleet at your command." |
| `unit_select_naval_2.mp3` | "Standing by, Admiral." |
| `unit_select_naval_3.mp3` | "Helm ready." |

### Move Orders
| File | Suggested line |
|---|---|
| `unit_order_move_land_1.mp3` | "Moving out." |
| `unit_order_move_land_2.mp3` | "Understood, advancing." |
| `unit_order_move_land_3.mp3` | "Roger that." |
| `unit_order_move_air_1.mp3`  | "Heading to coordinates." |
| `unit_order_move_air_2.mp3`  | "Airborne." |
| `unit_order_move_naval_1.mp3` | "Setting course." |
| `unit_order_move_naval_2.mp3` | "Helmsman, ahead full." |

### Movement Loops — play during animation, fade out on arrival
Seamlessly loopable ambient sounds (1–3 s loop point). Per-unit overrides take priority over the domain fallback.
| File | Sound | Units |
|---|---|---|
| `unit_infantry_marching.mp3` | Boots on ground / marching cadence | Infantry, Special Forces, Reserves, Engineers |
| `unit_move_land_loop.mp3`    | Vehicle engine / tank treads (fallback for all other land) | Tank, Artillery, Air Defense, etc. |
| `unit_move_air_loop.mp3`     | Jet turbine / propeller drone | All air units |
| `unit_move_naval_loop.mp3`   | Ship engine rumble / bow wave | All naval units |

### Attack Orders (voice — player only)
| File | Suggested line |
|---|---|
| `unit_order_attack_1.mp3` | "Engaging enemy." |
| `unit_order_attack_2.mp3` | "Opening fire." |
| `unit_order_attack_3.mp3` | "Commencing assault." |

### Weapon Fire (plays on ALL attacks — player and AI)
One random variant is chosen per attack. Short, punchy shots (0.5–2 s). No silence at start.

| File | Sound | Units |
|---|---|---|
| `weapon_infantry_1.mp3`   | Rifle burst / automatic fire | Infantry, Special Forces, Reserves, Engineers |
| `weapon_infantry_2.mp3`   | Different burst / suppression fire | ← same |
| `weapon_infantry_3.mp3`   | Heavy suppression / third burst variant | ← same |
| `weapon_tank_1.mp3`       | Tank cannon shot + shell crack | Tank |
| `weapon_tank_2.mp3`       | Tank cannon, different perspective | ← same |
| `weapon_artillery_1.mp3`  | Heavy artillery boom | Artillery, Multi-launcher, Launcher |
| `weapon_artillery_2.mp3`  | Artillery salvo / multiple impacts | ← same |
| `weapon_air_defense_1.mp3`| SAM launch / radar ping | Air Defense |
| `weapon_jet_1.mp3`        | Missile launch / strafing gun burst | Stealth Fighter, Combat Drone |
| `weapon_jet_2.mp3`        | Air-to-ground strike | ← same |
| `weapon_bomber_1.mp3`     | Bomb bay doors + release + distant detonation | Bomber |
| `weapon_helicopter_1.mp3` | Helicopter minigun fire | Helicopter |
| `weapon_helicopter_2.mp3` | Rocket pod salvo | ← same |
| `weapon_naval_1.mp3`      | Naval gun salvo | Carrier, Destroyer, Warship, Assault Ship |
| `weapon_naval_2.mp3`      | Cruise missile launch | ← same |
| `weapon_torpedo_1.mp3`    | Torpedo launch + underwater sonar ping | Nuclear Submarine |
| `weapon_general_1.mp3`    | Generic impact / explosion (fallback) | Logistics, Recon Drone, Transport Heli |
| `weapon_general_2.mp3`    | Different generic impact | ← same |

### Fortify Orders
| File | Suggested line |
|---|---|
| `unit_order_fortify_1.mp3` | "Digging in." |
| `unit_order_fortify_2.mp3` | "Establishing defensive position." |

### Combat Results
| File | Trigger |
|---|---|
| `unit_under_attack.mp3` | Player's unit is being attacked by an enemy |
| `combat_victory.mp3`    | Player wins combat |
| `combat_defeat.mp3`     | Player loses combat |

### Production
| File | Suggested line |
|---|---|
| `production_order_1.mp3`    | "Order received." |
| `production_order_2.mp3`    | "Mobilizing resources." |
| `production_complete_1.mp3` | "Unit ready." |
| `production_complete_2.mp3` | "Production complete." |

### Building Selection
| File | Suggested line |
|---|---|
| `building_select_1.mp3` | "Structure status confirmed." |
| `building_select_2.mp3` | "Facility online." |
| `building_select_3.mp3` | "Command acknowledged." |

### UI / Turn
| File | Trigger |
|---|---|
| `ui_click.mp3`    | General button press |
| `turn_end.mp3`    | Player clicks End Turn |
| `turn_start.mp3`  | New player turn begins |

---

## Music — `music/`

| File | Context |
|---|---|
| `theme_strategic.mp3` | Main ambient loop during gameplay — starts on first click |
| `theme_tension.mp3`   | High-tension situations (future use) |

Music files should be seamlessly loopable. SFX should be short (0.1–3 s) with no silence at the start.

---

## Unassigned Raw Assets — `sfx/`

These files are on disk but not yet wired to any game event. Rename and register them in `AudioManager.ts` when ready.

| File | Notes |
|---|---|
| `asset_3j8v2V878qiaRwcUb46mMBY1.mp3` | Also copied as `building_select_1.mp3` |
| `asset_ZyoqVe5aDhrRbAbKUc7e36w6.mp3` | Also copied as `building_select_2.mp3` |
| `asset_exKPuRFuFPdZw3KbEcq3Dhxx.mp3` | Also copied as `building_select_3.mp3` |
| `asset_Dw29m1hJvaJvaUDD2Gx3Bjej.mp3` | Unassigned |
| `asset_A44DkeW5mjQwrp6TKc7nCeCw.mp3` | Unassigned |
| `asset_afQn9ud3Gk3jrWN9PiHFtuf2.mp3` | Unassigned |
| `asset_JQ4xZtJKAmb4nWbCBppHpDJd.mp3` | Unassigned |
| `asset_zA9jXqq8XavSJBFoMKnFptk7.mp3` | Unassigned |
| `asset_ZyoqVe5aDhrRbAbKUc7e36w6 (1).mp3` | Duplicate of ZyoqVe5a — safe to delete |
