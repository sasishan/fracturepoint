# WWIII: FRACTURE POINT
## Military Units, Weapons & Combat Systems
### Design Document v1.0

---

## OVERVIEW

Combat is resolved across three domains: **Land, Sea, and Air**, with a fourth strategic layer covering **Space, Cyber, and Nuclear**. Units are organized into **Theaters** (regional commands), **Formations** (corps/fleet level), and **Units** (individual asset groups). Players can micromanage individual units or delegate tactical AI.

---

## UNIT HIERARCHY

```
THEATER (Regional Command)
  └── ARMY GROUP / FLEET / AIR COMMAND
        └── CORPS / CARRIER STRIKE GROUP / AIR WING
              └── DIVISION / SQUADRON / FLOTILLA
                    └── BRIGADE / REGIMENT / BATTERY
                          └── UNIT (the clickable entity on map)
```

Each **Unit** on the map represents approximately:
- Land: Brigade (3,000–5,000 troops) or equivalent equipment
- Sea: Task Force (2–8 vessels)
- Air: Squadron (12–24 aircraft)

---

## LAND FORCES

### UNIT TYPES

#### INFANTRY
| Type                  | Role                              | Terrain Bonus        | Cost (Production Points) |
|----------------------|-----------------------------------|----------------------|--------------------------|
| Line Infantry         | General purpose assault/defense  | Urban +20%, Forest +15% | 10 PP                 |
| Airborne              | Rapid deployment, vertical envelopment | Mountain +10%  | 25 PP                    |
| Marines               | Amphibious assault               | Coastal +30%         | 20 PP                    |
| Special Forces        | Sabotage, recon, advise          | All terrain +10%     | 50 PP                    |
| Mountain Infantry     | High-altitude operations         | Mountain +40%        | 15 PP                    |
| Militia/Reserves      | Defensive only, cheap            | Home territory +25%  | 3 PP                     |

#### ARMORED FORCES
| Type                  | Real-World Equivalent        | Attack | Defense | Movement | Cost |
|----------------------|------------------------------|--------|---------|----------|------|
| Main Battle Tank      | M1A2, T-90M, Type 99        | 85     | 70      | 6 hex/day| 40 PP|
| IFV / APC             | Bradley, BMP-3, CV90        | 55     | 50      | 8 hex/day| 25 PP|
| Light Armor           | Stryker, BTR-82              | 40     | 35      | 10 hex/day| 18 PP|
| Self-Propelled Artillery| M109, 2S35 Koalitsiya    | 75 (indirect)| 25 | 5 hex/day | 35 PP |
| Multiple Rocket Launcher| M270 MLRS, BM-30 Smerch  | 90 (indirect)| 15 | 5 hex/day | 30 PP |
| Anti-Tank             | Javelin teams, Kornet        | 70 vs armor| 30 | 7 hex/day | 20 PP |

#### AIR DEFENSE (Ground-Based)
| System                | Real Equivalent              | Range  | Capability              | Cost |
|----------------------|------------------------------|--------|-------------------------|------|
| SHORAD                | Gepard, Avenger, Pantsir-S1 | 15 km  | Low-altitude, UCAV      | 20 PP|
| MANPADS               | Stinger, Igla                | 5 km   | Dispersed infantry AA   | 8 PP |
| Medium-Range SAM      | Patriot PAC-3, S-350         | 100 km | Aircraft + TBM          | 60 PP|
| Long-Range SAM        | S-400, S-500, THAAD          | 400 km | Aircraft, MRBM, some ICBM| 120 PP|
| Counter-Drone         | Drone Gun Tactical           | 1 km   | UAS/Drone swarms        | 10 PP|

#### ENGINEERING & SUPPORT
| Type                  | Role                              | Cost |
|----------------------|-----------------------------------|------|
| Combat Engineers      | Bridge building, mine clearing, fortification | 15 PP |
| Field Hospital        | Casualty recovery (+10% manpower recovery) | 12 PP |
| Logistics Battalion   | Extends supply range by 3 hexes  | 18 PP |
| EW Battalion          | Jams enemy comms in 2-hex radius | 35 PP |
| CBRN Unit             | Operates in nuclear/chem/bio contamination | 20 PP |

---

### COMBAT MECHANICS (LAND)

**Attack Formula:**
```
Final Damage = (Attacker Strength × Equipment Quality × Doctrine Modifier)
             / (Defender Strength × Terrain Modifier × Fortification Level)
             × Random Factor (0.85–1.15)
             × Supply Modifier
             × Morale Modifier
```

**Key Modifiers:**

| Factor               | Effect                                      |
|---------------------|---------------------------------------------|
| Terrain              | Mountain: -40% attacker; Urban: -30% attacker|
| Supply               | <50% supply = -25% combat; <25% = -50%      |
| Air Superiority      | Friendly air dominance = +20%; enemy = -20% |
| Fortification Level  | L1: +15%, L2: +30%, L3: +50% defense       |
| Night               | Night attack: -20% (unless night-vision equipped) |
| Combined Arms        | INF + ARMOR + ARTY combo: +25% bonus       |
| Flanking             | Attack from unexpected direction: +35%      |
| Exhaustion          | >5 days continuous combat: -15% per day    |

---

## AIR FORCES

### AIRCRAFT TYPES

#### FIGHTER / MULTIROLE
| Aircraft              | Nation          | Air-Air | Air-Ground | Stealth | Range   | Cost  |
|----------------------|-----------------|---------|------------|---------|---------|-------|
| F-35A Lightning II    | US/UK/allies    | 90      | 85         | High    | 2,200km | 150PP |
| F-22 Raptor           | US only         | 98      | 70         | Very High| 2,960km| 200PP |
| F-15EX Eagle II       | US/allies       | 88      | 90         | None    | 3,900km | 110PP |
| Eurofighter Typhoon   | EU              | 85      | 80         | Low     | 2,900km | 120PP |
| Rafale F4             | France          | 84      | 85         | Low     | 3,700km | 125PP |
| Su-57 Felon           | Russia          | 88      | 82         | Medium  | 3,500km | 140PP |
| J-20 Mighty Dragon    | China           | 85      | 78         | High    | 2,000km | 145PP |
| Su-35S Flanker-E      | Russia/exports  | 82      | 78         | None    | 3,600km | 90PP  |
| J-16                  | China           | 78      | 82         | None    | 3,900km | 80PP  |

#### BOMBERS & STRIKE AIRCRAFT
| Aircraft              | Nation    | Payload | Range    | Nuclear-Capable | Cost  |
|----------------------|-----------|---------|----------|-----------------|-------|
| B-2 Spirit            | US        | 18,000kg| 11,000km | Yes             | 400PP |
| B-21 Raider           | US        | 13,500kg| 9,000km+ | Yes             | 350PP |
| B-52H Stratofortress  | US        | 31,000kg| 16,000km | Yes             | 180PP |
| Tu-160 Blackjack      | Russia    | 45,000kg| 12,000km | Yes             | 300PP |
| Tu-22M3 Backfire      | Russia    | 24,000kg| 7,000km  | Yes             | 150PP |
| H-6N                  | China     | 12,000kg| 6,000km  | Yes             | 120PP |

#### DRONES / UCAV
| Type                  | Role              | Endurance | Payload  | Cost  |
|----------------------|-------------------|-----------|----------|-------|
| MQ-9B Reaper          | Strike/ISR        | 27 hrs    | 1,700kg  | 40PP  |
| RQ-4 Global Hawk      | Strategic ISR     | 34 hrs    | Sensors  | 80PP  |
| MQ-25 Stingray        | Carrier tanker/ISR| 20 hrs    | 900kg    | 60PP  |
| Bayraktar TB2         | Light strike/ISR  | 27 hrs    | 150kg    | 8PP   |
| Shahed-136 swarm      | Kamikaze          | 2,500km   | 50kg     | 1PP   |
| Loyal Wingman (MQ-28) | Combat wingman    | 3,700km   | 2,000kg  | 70PP  |

#### HELICOPTERS
| Type                  | Role              | Cost  |
|----------------------|-------------------|-------|
| AH-64E Apache         | Attack helicopter | 45PP  |
| CH-47F Chinook        | Heavy lift        | 30PP  |
| UH-60M Black Hawk     | Utility/assault   | 20PP  |
| Mi-28NM Havoc         | Attack helicopter | 40PP  |
| Ka-52M Alligator      | Attack helicopter | 40PP  |

### AIR COMBAT MECHANICS

**Air Superiority Zones:** Each regional theater has an air superiority rating (0–100%):
- 0–30%: Enemy air dominance (−30% to ground units, no air support)
- 31–60%: Contested airspace (mutual penalties)
- 61–80%: Friendly air superiority (+15% to ground units)
- 81–100%: Air dominance (+30% to ground; enemy loses air support)

**Air Missions:**
1. **CAP (Combat Air Patrol)** — Defend airspace; intercept enemy aircraft
2. **CAS (Close Air Support)** — Bonus to friendly ground attacks in designated hex
3. **SEAD/DEAD** — Suppress/destroy enemy air defenses
4. **Strategic Bombing** — Target enemy infrastructure (cities, factories, power grids)
5. **Airlift** — Rapid deployment of ground units
6. **Maritime Patrol** — ASW and anti-ship surveillance
7. **Electronic Warfare** — Jam enemy radar/comms in target zone
8. **Nuclear Strike** — Requires authentication sequence (see Nuclear chapter)

---

## NAVAL FORCES

### VESSEL TYPES

#### CARRIERS & CAPITAL SHIPS
| Type                  | Real Equivalent          | Aircraft | Range   | Cost   |
|----------------------|--------------------------|----------|---------|--------|
| Supercarrier          | Gerald R. Ford class     | 90+      | Global  | 800PP  |
| Fleet Carrier         | Queen Elizabeth class    | 40       | Global  | 500PP  |
| Light Carrier         | Juan Carlos I, Liaoning  | 20–30    | Global  | 300PP  |
| Battlecruiser         | Kirov class (Russia)     | N/A      | 14,000km| 400PP  |

#### SURFACE COMBATANTS
| Type                  | Real Equivalent          | Air Defense | Anti-Ship | Cost  |
|----------------------|--------------------------|-------------|-----------|-------|
| Destroyer (AAW)       | Arleigh Burke, Type 052D | Excellent   | Good      | 150PP |
| Destroyer (ASW)       | Akizuki class            | Good        | Good      | 130PP |
| Cruiser               | Ticonderoga class        | Excellent   | Excellent | 200PP |
| Frigate               | FREMM, Type 054A         | Good        | Moderate  | 80PP  |
| Corvette              | Karakurt class           | Limited     | Good      | 40PP  |
| Fast Attack Craft     | Gepard, Tarantul         | Limited     | Good      | 20PP  |

#### SUBMARINES
| Type                  | Real Equivalent          | Special             | Cost   |
|----------------------|--------------------------|---------------------|--------|
| SSBN (Ballistic)      | Ohio, Borei-A, Jin class | Nuclear deterrent   | 600PP  |
| SSN (Attack)          | Virginia, Yasen-M        | Hunter-killer, TLAM | 300PP  |
| SSK (Diesel-Electric) | Type 212A, Kilo class    | Very quiet, AIP     | 100PP  |
| SSGN (Guided Missile) | Oscar II class           | Land-attack cruise  | 350PP  |

#### AMPHIBIOUS & SUPPORT
| Type                  | Real Equivalent          | Capacity            | Cost  |
|----------------------|--------------------------|---------------------|-------|
| LHD/LHA               | Wasp class, Mistral      | 2,000 marines       | 300PP |
| LPD/LSD               | San Antonio class        | 800 marines         | 150PP |
| Replenishment Ship    | Supply class             | Extends group range | 80PP  |
| Hospital Ship         | USNS Comfort             | Morale/casualty     | 50PP  |
| Mine Layer/Sweeper    | Various                  | Sea denial          | 30PP  |

### NAVAL COMBAT MECHANICS

**Sea Zones:** Oceans are divided into 48 strategic sea zones. Control is contested.

**Carrier Strike Group (CSG) Composition:**
- 1 carrier + 2–3 destroyers + 1 cruiser + 1–2 submarines + 1 support ship
- CSG projects air power 800km from center
- Can be targeted as a group by AShMs

**Anti-Ship Missiles (AShM) — Key Systems:**
| Missile         | Nation   | Range   | Speed    | Effect               |
|----------------|----------|---------|----------|----------------------|
| Harpoon Block II| US/allies| 280km   | Mach 0.85| Anti-ship            |
| DF-21D (ASBM)  | China    | 1,500km | Mach 10  | Carrier killer       |
| DF-26 (ASBM)   | China    | 4,000km | Mach 18  | Extended carrier kill|
| P-800 Oniks    | Russia   | 600km   | Mach 2.5 | Anti-ship            |
| Zircon         | Russia   | 1,000km | Mach 9   | Hypersonic anti-ship |
| BrahMos        | India    | 500km   | Mach 3   | Anti-ship            |

**Submarine Warfare:**
- Submarines have stealth ratings (0–100)
- ASW (anti-submarine warfare) probability of detection based on opponent ASW rating
- SSBNs (boomers) are permanently hidden unless actively hunted; losing one = strategic crisis

---

## MISSILE & ROCKET FORCES

### CONVENTIONAL MISSILES

| Category           | Real Examples                         | Range     | Accuracy | Cost  |
|-------------------|---------------------------------------|-----------|----------|-------|
| SRBM (<500km)      | Iskander-M, ATACMS, Fateh-110        | 70–500km  | CEP <10m | 15PP  |
| MRBM (500–3000km) | DF-17, Ababeel, Agni-III             | 500–3000km| CEP <30m | 40PP  |
| IRBM (3000–5500km)| DF-26, RSD-10 (if redeployed)        | 3000–5500km| CEP <50m| 80PP  |
| ICBM (5500km+)     | Minuteman III, RS-28 Sarmat, DF-41   | 13,000km  | CEP <100m| 200PP |
| ALCM               | AGM-86B, Kh-101, CJ-100             | 2500km    | CEP <5m  | 20PP  |
| SLCM               | Tomahawk Block V, Kalibr             | 2500km    | CEP <5m  | 25PP  |
| Hypersonic Glide   | DF-17, Avangard, AGM-183A ARRW      | 2000km+   | Mach 5–27| 60PP  |

### NUCLEAR FORCES

See dedicated Nuclear Systems document.

---

## SPECIAL OPERATIONS FORCES (SOF)

SOF units are single entities (not brigades) with high cost and unique capabilities:

| Mission Type         | Capability                                        | Detection Risk |
|--------------------|---------------------------------------------------|----------------|
| Direct Action        | Eliminate HVT (high-value target); destroy facility| High           |
| Reconnaissance       | Reveal hidden enemy units in 3-hex area           | Low            |
| Sabotage             | Destroy infrastructure (bridge, pipeline, power)  | Medium         |
| Training/Advise      | Give +15% bonus to allied militia/irregular forces| Very Low       |
| PSYOP                | Reduce enemy province morale by 10–20             | None           |
| Hostage Rescue       | Recover captured leaders/pilots                   | Very High      |
| WMD Interdiction     | Attempt to seize/destroy enemy nuclear/chem weapons| Extreme       |

---

## WEAPONS OF MASS DESTRUCTION

### NUCLEAR WEAPONS

**DEFCON System:** Each nation has an independent DEFCON level (1–5):
- DEFCON 5: Normal peacetime readiness
- DEFCON 4: Increased surveillance, strengthened security
- DEFCON 3: Air Force ready in 15 minutes
- DEFCON 2: Armed forces ready for deployment
- DEFCON 1: Nuclear war imminent; weapons authorized

**Nuclear Authentication:** To fire nuclear weapons:
1. Player must be at DEFCON 2 or 1
2. Two-key confirmation system (AI "second key" for solo play)
3. 5-second countdown with option to abort
4. Global notification: All players warned of launch
5. Target nation retaliates with own nuclear forces (if surviving)

**Nuclear Effects:**
- Immediate: Target province destroyed, units eliminated
- Radiation Zone: 5-hex radius contaminated for 20 in-game days
- Nuclear Winter: If >50 detonations, global agricultural penalty (-40% food production)
- Political: -50 global reputation; neutral nations join enemy; internal morale collapse

### CHEMICAL WEAPONS

Available only to specific nations (Syria, Russia historical, DPRK):
- Lesser international condemnation than nuclear (but still severe)
- Effective against unprotected infantry
- CBRN units can operate in contaminated zones
- Use triggers international coalition against offender

### BIOLOGICAL WEAPONS

Rare, high-risk weapons:
- Uncontrollable spread risk (may affect your own forces/population)
- Massive international condemnation
- WHO/global health response triggered
- Game-changing if used strategically; game-losing if mishandled

---

## SUPPLY & LOGISTICS SYSTEM

Every unit requires supply to function effectively:

**Supply Sources:**
- Home territory factories and depots
- Captured enemy depots
- Airlifted emergency supply
- Carrier-based supply (naval forces)
- Allied resupply

**Supply Range:**
- Road: 10 hexes from depot
- Rail: 20 hexes (faster, but tracks are targetable)
- Air: Unlimited range but expensive; weather dependent
- Sea: Port-to-port; naval interdiction risk

**Out-of-Supply Penalties:**
| Supply Level | Combat Penalty | Movement Penalty | Attrition |
|-------------|---------------|-----------------|-----------|
| 75–100%     | None          | None            | None      |
| 50–74%      | -15%          | -10%            | 0.5%/day  |
| 25–49%      | -35%          | -25%            | 1.5%/day  |
| 0–24%       | -60%          | -50%            | 3%/day    |
| 0%          | -80%          | -75%            | 5%/day    |

---

## FORTIFICATION SYSTEM

Provinces can be fortified over time:
- **Level 0**: Open terrain (no bonus)
- **Level 1**: Field fortifications (3 days, +15% defense)
- **Level 2**: Prepared positions (+30% defense; includes AT obstacles, minefields)
- **Level 3**: Hardened bunkers (+50% defense; requires engineers + 7 days)
- **Level 4**: Fortress complex (+70% defense; massive construction investment)

Fortifications can be breached by:
- Sustained artillery bombardment (degrades by 1 level per 24 hrs of heavy bombardment)
- Precision airstrikes
- Tunnel/sappers (SOF)
- Nuclear strike (instant elimination)
