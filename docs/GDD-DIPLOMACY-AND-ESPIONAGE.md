# WWIII: FRACTURE POINT
## Diplomacy, Espionage & Political Systems
### Design Document v1.0

---

## DIPLOMACY SYSTEM

Diplomacy is the art of achieving strategic goals without firing a shot — or laying the groundwork for when you do. Every diplomatic action costs **Political Capital (PC)** and has reputation consequences.

---

### DIPLOMATIC ACTIONS MENU

#### BILATERAL ACTIONS (Nation-to-Nation)

| Action                 | PC Cost | Effect                                               | Cooldown  |
|-----------------------|---------|------------------------------------------------------|-----------|
| Declare War            | 0 (free)| Initiates armed conflict; triggers alliance chains   | N/A       |
| Propose Peace/Armistice| 20 PC   | Opens negotiation; both sides must accept            | 10 turns  |
| Demand Surrender       | 5 PC    | Enemy accepts if morale <20 + military disadvantaged | 5 turns   |
| Form Alliance          | 30 PC   | Mutual defense pact; shared intelligence             | —         |
| Form Non-Aggression Pact| 15 PC  | Both commit to not attacking each other for X turns  | —         |
| Trade Agreement        | 10 PC   | Boost bilateral trade by 20%; access to resources   | —         |
| Military Basing Rights | 25 PC   | Permission to station forces in their territory      | —         |
| Arms Sale              | 5 PC    | Transfer equipment; gain influence                   | 3 turns   |
| Military Aid           | 10 PC   | Give PP grant; significant influence boost           | 3 turns   |
| Economic Aid           | 10 PC   | Give GDP grant; significant influence boost          | 3 turns   |
| Issue Ultimatum        | 20 PC   | Demand action within X turns or face consequence     | 5 turns   |
| Break Diplomatic Relations| 5 PC | Sever ties; recall ambassadors                      | —         |
| Restore Relations      | 15 PC   | Reopen dialogue after breakdown                      | 5 turns   |
| Extradition Request    | 10 PC   | Request enemy hands over war criminal/defector      | —         |
| Propose Joint Exercise | 8 PC    | Military exercise builds interoperability + influence| 5 turns   |

#### MULTILATERAL ACTIONS

| Action                    | PC Cost | Effect                                              |
|--------------------------|---------|-----------------------------------------------------|
| UN Security Council Vote  | 20 PC   | Propose resolution; major legitimacy effects        |
| Propose Sanctions Package | 15 PC   | Multilateral sanctions via coalition                |
| Call Emergency Summit     | 25 PC   | Pause active conflict; negotiate terms globally     |
| Form Coalition            | 30 PC   | Organize multi-nation military coalition            |
| Invoke Article 5          | 0 (automatic)| NATO mutual defense; all members must respond   |
| Propose Arms Control Treaty| 35 PC  | Freeze/reduce nuclear arsenals; verify compliance  |
| Establish DMZ             | 20 PC   | Create demilitarized buffer zone at ceasefire line  |
| War Crimes Tribunal       | 25 PC   | ICC referral; morale and legitimacy effects         |

---

### REPUTATION SYSTEM

Each nation has a **Global Reputation** score (0–100) and **Bloc-Specific Reputation** scores:

**Global Reputation Effects:**
| Score | Status          | Effects                                               |
|-------|----------------|-------------------------------------------------------|
| 80–100| Trusted Leader  | +20% diplomatic success rate; easier coalition building|
| 60–79 | Respected Power | Normal diplomatic relations                           |
| 40–59 | Controversial   | -10% success rate; neutral nations wary              |
| 20–39 | Pariah State    | -30% success rate; only desperate allies available   |
| 0–19  | Rogue Nation    | -50% success; only DPRK/Iran-like nations ally with you|

**Reputation Modifiers:**
| Action                        | Rep Change    |
|------------------------------|---------------|
| First nuclear use (tactical) | -30           |
| First nuclear use (strategic)| -60           |
| Civilian mass casualty event | -15 to -25    |
| Poison gas attack            | -20           |
| Attack on hospital/school    | -10           |
| War crimes (confirmed)       | -20           |
| Winning declared war cleanly | +5            |
| Providing humanitarian aid   | +3 to +8      |
| Honoring peace treaty        | +10           |
| Breaking peace treaty        | -25           |
| Successful peacekeeping      | +15           |

---

### UNITED NATIONS MECHANICS

**UN Security Council:**
- 5 permanent members (P5): US, UK, France, Russia, China — each has veto power
- 10 rotating members
- Player P5 nations can veto resolutions

**UN Resolutions can:**
- Authorize military intervention (legitimacy bonus to intervening forces)
- Impose multilateral sanctions
- Establish ceasefire monitoring
- Declare war crimes investigations
- Authorize no-fly zones

**UN Veto System:**
- Veto use costs -5 global reputation
- Repeated vetoes (3+ times) on same issue: International "veto abuse" penalty (-10 rep)
- US and China frequent vetoes may split UN into parallel institutions (rare event)

---

## INTELLIGENCE & ESPIONAGE SYSTEM

### INTELLIGENCE OVERVIEW

Intelligence operations use **Intelligence Points (IP)** generated by:
- Intelligence budget allocation (from GDP)
- Friendly nation intelligence sharing agreements
- Satellite coverage (own satellites or allied)
- Signal intercept infrastructure (SIGINT stations globally)

**Intelligence Layers:**
1. **Strategic Intelligence** — Nation-level data (GDP, military strength, political stability)
2. **Operational Intelligence** — Theater-level (unit locations, supply routes, planned operations)
3. **Tactical Intelligence** — Unit-level (exact positions, readiness states, equipment quality)

**Fog of War:** By default, players only see what their intelligence reveals:
- Strategic: Always visible (public information)
- Operational: Requires satellite coverage or SIGINT
- Tactical: Requires HUMINT, SOF recon, or signals intercept

---

### INTELLIGENCE OPERATIONS

#### COLLECTION OPERATIONS

| Operation             | IP Cost | Duration | Intelligence Gained                       |
|----------------------|---------|----------|-------------------------------------------|
| Satellite Pass        | 5 IP    | Immediate| Unit positions in 5-hex area              |
| SIGINT Intercept      | 10 IP   | 3 turns  | Enemy communications; planned operations  |
| HUMINT Plant          | 20 IP   | 10 turns | Deep access to enemy HQ info              |
| Open Source Analysis  | 2 IP    | 1 turn   | General political/economic data           |
| Drone Recon           | 8 IP    | 1 turn   | High-res unit positions; risk of shootdown|
| Submarine Surveillance| 15 IP   | 5 turns  | Naval movements in ocean zone             |
| Cyber Intrusion       | 25 IP   | 5 turns  | Full military network access (if success) |
| Embassy Intelligence  | 3 IP    | Passive  | General diplomatic signals from capital   |

**Intelligence Success Rate:**
```
Success % = Base Rate × (Own Intel Quality / Enemy Counterintel Quality)
           × Relationship Penalty (hostile nations = harder)
           × Technology Modifier
```

---

#### COVERT ACTION OPERATIONS

| Operation              | IP Cost | Success Rate | Effect if Successful                     |
|-----------------------|---------|-------------|-------------------------------------------|
| Assassination: Military| 50 IP   | 30–60%      | Kill enemy general; unit -30% for 5 turns|
| Assassination: Political| 80 IP  | 20–45%      | Remove foreign leader; alignment shift   |
| Coup Support           | 100 IP  | 20–35%      | Friendly government installed             |
| Election Interference  | 40 IP   | 40–65%      | Shift party in power; policy changes      |
| Propaganda Campaign    | 20 IP   | 60–80%      | -10–20 morale in target province          |
| Sabotage: Infrastructure| 35 IP  | 40–70%      | Destroy facility; as if bombed            |
| Sabotage: Military     | 40 IP   | 30–60%      | Disable unit or weapons system for 3 turns|
| Cyberattack: Grid      | 30 IP   | 50–75%      | Power grid failure in region              |
| Cyberattack: Military  | 45 IP   | 35–65%      | C2 disruption; unit coordination -50%    |
| False Flag Operation   | 60 IP   | 35–55%      | Frame another nation for incident         |
| Defector Extraction    | 30 IP   | 40–70%      | Gain +20 RP one-time; enemy loses -5 RP  |
| WMD Component Theft    | 100 IP  | 20–35%      | Delay enemy nuclear/chem program 10 turns |
| Asset Recruitment      | 25 IP   | 45–70%      | Ongoing intelligence flow from enemy govt |

**Blowback Risk:** Failed covert operations have consequences:
- **Discovered:** Target nation gains knowledge of your intelligence capabilities; -10 rep
- **Agent Captured:** Can be used for diplomatic incident or propaganda
- **Escalation:** Failed assassination = casus belli; failed coup = diplomatic crisis

---

#### COUNTERINTELLIGENCE

| Operation              | IP Cost | Duration | Effect                                   |
|-----------------------|---------|----------|------------------------------------------|
| CI Sweep               | 15 IP   | 3 turns  | Detect enemy agents; expel or use as doubles |
| Disinformation Feed    | 20 IP   | 5 turns  | Feed false intelligence to enemy analysts|
| Honeypot Operation     | 30 IP   | 8 turns  | Trap enemy spy; gain intelligence on their network |
| Signals Denial         | 10 IP   | 2 turns  | Jam enemy SIGINT in your territory       |
| Source Protection      | 5 IP/turn| Ongoing | Maintain cover of placed assets         |

---

### CYBER WARFARE SYSTEM

**Cyber Capabilities** are rated 0–100 for each nation:

| Nation        | Cyber Offense | Cyber Defense | Notable Capabilities             |
|--------------|--------------|--------------|----------------------------------|
| US            | 95           | 90           | NSA TAO; full-spectrum cyber     |
| China         | 90           | 80           | APT groups; infrastructure attacks|
| Russia        | 85           | 70           | GRU/SVR; grid attacks; disinfo   |
| Israel        | 88           | 85           | Unit 8200; Stuxnet-class         |
| North Korea   | 75           | 40           | Financial theft; ransomware       |
| Iran          | 70           | 60           | Shamoon; industrial sabotage     |
| UK            | 80           | 82           | GCHQ; offensive cyber            |

**Cyber Attack Targets:**
- Power grids (most impactful)
- Financial systems (SWIFT disruption, market manipulation)
- Military C2 networks (unit coordination disruption)
- Nuclear safety systems (extreme; triggers near-automatic escalation)
- Industrial control systems (Stuxnet-style centrifuge attack)
- Media/communications (information warfare)
- GPS/navigation spoofing (tactical disruption)

**Cyber Defense:**
- High cyber defense = better detection of incoming attacks
- Air-gapping critical systems reduces vulnerability
- Redundant systems limit cascading failures

---

## POLITICAL SYSTEMS & INTERNAL POLITICS

### GOVERNMENT TYPES

Each nation starts with a government type affecting available actions:

| Type                | PC Generation | Military Flexibility | War Fatigue | Coup Risk |
|--------------------|--------------|---------------------|------------|-----------|
| Liberal Democracy   | High          | Low (approval needed)| Fast       | Low       |
| Authoritarian       | Medium        | High                | Slow       | Medium    |
| Totalitarian        | Low           | Very High           | None       | High*     |
| Military Junta      | Low           | Very High           | Slow       | High**    |
| Theocracy           | Medium        | High                | Very Slow  | Low       |
| Oligarchy           | Medium        | Medium              | Medium     | Medium    |

*Totalitarian: Coup risk from within inner circle, not population
**Military Junta: Coup risk from rival military factions

### DOMESTIC POLITICS (Democratic Nations)

For democratic players, public opinion constrains military options:

**Approval Rating** (0–100%):
- Below 30%: Cannot declare war or escalate; risk of losing next election
- Below 20%: Coalition collapse; new election forced
- Below 10%: Constitutional crisis

**Approval Modifiers:**
| Event                          | Approval Change |
|-------------------------------|-----------------|
| Military victory               | +5 to +15      |
| Military defeat                | -10 to -25     |
| Own forces suffer high casualties| -5 to -15    |
| Enemy civilian casualties (blame on you)| -8 to -20|
| Economic growth                | +3 to +8       |
| Recession                      | -8 to -15      |
| Terrorist attack on homeland   | +10 (rally effect) then -5/turn|
| Nuclear use (own)              | -25            |
| Corruption scandal             | -10 to -20     |
| Major peace deal               | +15            |

**Elections:** Democratic nations hold elections every 4–8 in-game years:
- Can be won or lost based on performance
- Losing party might have different foreign policy priorities
- Player controls strategy but must manage approval to retain power

### COUPS & REVOLUTIONS

**Coup Risk Factors:**
- Military spending cuts to army while generals are unpopular
- Major military defeat
- Perception of leader as weak or corrupt
- External instigation (enemy intelligence operation)
- Economic collapse

**Coup Resolution:**
- New government may have different ideology
- 50% chance new government seeks better relations with your enemy (devastating)
- 50% chance nationalist hardliner takes over (more militaristic but isolated)

**Revolution (Popular Uprising):**
- Triggered by very low morale + economic hardship + political repression
- Changes government type toward democracy or theocracy
- Temporary -50% military effectiveness during transition

---

## PROPAGANDA & INFORMATION WARFARE

### INFORMATION OPERATIONS

**Domestic Propaganda:**
- Boost your own population morale: +5–15
- Suppresses war fatigue: -1 morale loss rate
- Cost: IP + PC

**Foreign Propaganda:**
- Target enemy population morale: -5–15
- Target neutral nation alignment: shift by 3–8 points toward you
- Can be exposed as foreign interference: -10 global reputation

**Media Control:**
- Authoritarian governments can control narrative completely
- Democratic governments must manage free press (can hurt or help)
- Social media disinformation campaigns: fastest spread but detectable

### NARRATIVE VICTORY POINTS

Public perception of the war affects the global "moral authority" score:
- Who started the war (massive importance)
- Who committed atrocities
- Who is protecting civilians
- Who is willing to negotiate
- International media coverage (controllable through information ops)

High moral authority = easier alliance building, better neutral nation alignment, better diplomatic outcomes
