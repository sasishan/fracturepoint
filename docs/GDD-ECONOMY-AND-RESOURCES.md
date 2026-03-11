# WWIII: FRACTURE POINT
## Economy, Resources & Supply Chains
### Design Document v1.0

---

## ECONOMIC OVERVIEW

The economy is the backbone of military power. Without GDP, you cannot field armies. Without energy, factories stop. Without food, morale collapses. The game models a realistic modern economy where **economic warfare is as important as military operations**.

---

## CORE RESOURCES

### PRIMARY RESOURCES

| Resource       | Description                                              | Primary Sources              |
|---------------|----------------------------------------------------------|------------------------------|
| **GDP**        | Overall economic output; determines all budgets          | Industry, trade, services    |
| **Energy**     | Powers military operations and industry                  | Oil, gas, nuclear, renewables|
| **Manpower**   | Available military recruits from population              | Population × mobilization %  |
| **Production Points (PP)** | Direct military production capacity        | Factories, defense industry  |
| **Research Points (RP)** | Technology advancement                           | Universities, R&D spending   |
| **Political Capital (PC)** | Used for diplomatic and internal actions       | Stability, elections, events |
| **Intelligence Points (IP)** | Fuels espionage and intel operations         | Intelligence agencies, SIGINT|
| **Food**       | Population sustenance and morale                        | Agriculture, imports         |
| **Rare Earth Materials** | Advanced electronics and weapons production     | Mining, imports              |

---

## GDP SYSTEM

### GDP Calculation (Per Nation)
```
GDP = Industrial Output + Agricultural Output + Service Sector + Trade Revenue
    - War Damage - Sanctions Penalty - Corruption Loss - Infrastructure Damage
```

### GDP Allocation (Player Controls Budget %)
| Sector               | Default % | Range   | Effect                             |
|---------------------|-----------|---------|-------------------------------------|
| Military (Operations)| 3%        | 1–25%   | Pays for unit upkeep and operations |
| Military (Investment)| 2%        | 0–15%   | Production points generation        |
| Research & Development| 1.5%     | 0–8%    | Research points per turn            |
| Infrastructure       | 4%        | 1–10%   | Province development, logistics     |
| Social Welfare       | 25%       | 5–40%   | Morale, population health           |
| Intelligence         | 0.5%      | 0.1–3%  | Intelligence points generation      |
| Foreign Aid          | 0.2%      | 0–5%    | Influence with recipient nations    |
| Debt Service         | Variable  | N/A     | Mandatory based on debt level       |

### War Economy Mode
When war is declared, player can switch to **War Economy**:
- Military investment cap increases to 40%
- Social welfare drops to minimum automatically
- Morale takes -10 immediate hit
- Production Points increase by 50%
- War bonds become available (debt instrument)

---

## ENERGY SYSTEM

### Energy Sources
| Source            | Nations With Access             | Energy Output | Resilience | Cost |
|------------------|---------------------------------|---------------|------------|------|
| Oil & Gas         | Russia, Saudi Arabia, Iran, US  | Very High     | Vulnerable | Low  |
| Nuclear Power     | US, France, Russia, China, UK   | High          | High       | Medium|
| Renewables        | Germany, EU, China              | Medium-High   | Distributed| Low  |
| Coal              | China, India, US                | Medium        | High       | Low  |
| Hydroelectric     | China, Canada, Brazil           | Medium        | Vulnerable | Low  |

### Energy Dependency
Each nation has an **Energy Import Dependency** score (0–100%):
- 0%: Fully energy independent (US, Russia, Saudi Arabia)
- 50%: Half imported (Germany, Japan)
- 90%+: Highly vulnerable (Japan, South Korea, most EU states)

**Energy Disruption Effects:**
| Supply Level | Industry Output | Military Operations |
|-------------|----------------|---------------------|
| 80–100%     | Normal          | Normal              |
| 60–79%      | -15%            | -10%                |
| 40–59%      | -35%            | -25%                |
| 20–39%      | -55%            | -45%                |
| <20%        | -80%            | -70%                |

### Energy Targets (Prioritized Strike Targets)
- Oil refineries: Destroy = -30% energy per refinery
- Power plants: Destroy = -15% energy, cascades to grid
- Pipelines: Interdict = reduce flow by 20–50%
- LNG terminals: Destroy = -25% import capacity
- Power grid nodes: Cyberattack = temporary but widespread disruption

---

## STRATEGIC RESOURCES

### OIL & NATURAL GAS

**Global Oil Market:**
- Modeled as a single global price ($/barrel)
- Base: $85/barrel (2026 baseline)
- Price affected by:
  - Supply disruptions (−supply = +price)
  - Demand destruction (recession, sanctions = −demand = −price)
  - Strategic reserves drawdown
  - OPEC+ production decisions (AI-controlled unless player is Saudi Arabia/Russia)

**Oil Price Effects:**
| Price Range    | Effect on Non-Producers            | Effect on Major Producers |
|---------------|-------------------------------------|---------------------------|
| <$50          | GDP +3% (cheap energy)              | GDP −20% (revenue loss)   |
| $50–$100      | Normal                              | Normal                    |
| $100–$150     | GDP −5%, inflation +3%              | GDP +15%                  |
| $150–$200     | GDP −15%, unrest risk               | GDP +30%                  |
| >$200         | Economic crisis, recession trigger  | GDP +50%, but demand crash |

### RARE EARTH ELEMENTS & CRITICAL MINERALS

China controls 60% of global rare earth processing. This is modeled as a strategic lever:

| Material       | Used For                                  | China Control | Alt Sources    |
|---------------|-------------------------------------------|---------------|----------------|
| Neodymium      | Fighter jet motors, missile guidance      | 85%           | Australia, US  |
| Lithium        | EV batteries, soldier electronics         | 55%           | Chile, Australia|
| Cobalt         | Aircraft, precision munitions             | 70% (processing)| Congo (raw)  |
| Tungsten       | Armor-piercing penetrators                | 83%           | Russia, Austria|
| Gallium/Germanium| Semiconductors, radar systems           | 94%           | None viable    |

**China's Rare Earth Embargo** (possible action):
- Immediately halts advanced unit production for affected nations
- Takes 18 months to build alternative supply chains
- Triggers -40% Research Points for affected nations

### FOOD & AGRICULTURE

**Global Food Supply Tracks:**
- Ukraine/Russia = 30% of global wheat exports (modeled as strategic)
- Agricultural disruption from war (occupation, bombing, drought)
- Nuclear winter effects (>50 detonations = global famine mechanics)

**Food Security Score by Nation:**
| Nation Group  | Baseline Score | Risk if trade disrupted |
|--------------|---------------|------------------------|
| US, Canada    | 95            | Very Low               |
| EU (avg)      | 75            | Low-Medium             |
| China         | 70            | Medium                 |
| Russia        | 85            | Low                    |
| MENA region   | 35            | Extreme                |
| Sub-Saharan Africa | 30      | Critical               |

---

## TRADE & SANCTIONS SYSTEMS

### TRADE ROUTES
Each nation has bilateral trade routes showing:
- Import goods (what they need)
- Export goods (what they sell)
- Volume (GDP % of each nation involved)
- Route type: Overland, Sea, Air, Pipeline

**Trade interdiction options:**
1. Naval blockade (sea routes)
2. Land interdiction (overland routes via third-party pressure)
3. Airspace denial (minor effect on air cargo)
4. Financial sanctions (cut SWIFT access)

### SANCTIONS SYSTEM

**Sanctions Types:**
| Type                  | Implementation   | Effect                                        |
|----------------------|------------------|-----------------------------------------------|
| Trade Embargo         | Immediate        | Stops bilateral trade; -GDP for both parties  |
| Sectoral Sanctions    | 2-turn delay     | Targets specific industry (oil, banking, arms)|
| SWIFT Exclusion       | 1-turn delay     | Cuts financial system access; -20% GDP        |
| Asset Freeze          | Immediate        | Freezes foreign-held assets                   |
| Secondary Sanctions   | 3-turn delay     | Penalizes third parties trading with target   |
| Technology Export Ban | Immediate        | Halts tech transfers; -15% RP for target      |
| Travel Bans           | Immediate        | Political pressure; minor reputation damage   |

**Sanctions Effectiveness:**
- Most effective: Nations with high import dependency, USD reliance, foreign assets
- Least effective: Self-sufficient nations (Russia, North Korea model)
- Backfire risk: If too broad, accelerates de-dollarization and alternative systems

### DE-DOLLARIZATION MECHANIC
If sanctions are overused, target nations develop alternative financial systems:
- CIPS (Chinese alternative to SWIFT) adoption increases
- Bilateral barter trade develops (oil-for-weapons, etc.)
- US loses financial leverage (permanent penalty to US sanctions effectiveness)

---

## PRODUCTION SYSTEM

### PRODUCTION POINTS (PP)

PP is generated by defense industry capacity:
```
PP/turn = (Defense Industry Level × Factory Count × Worker Efficiency)
        × (Energy Supply % × Material Availability %)
        - (War Damage × 0.5)
```

### PRODUCTION QUEUES

Players manage production across multiple facilities:
- **Tier 1 Factories**: Light vehicles, ammunition, basic equipment (1–5 PP/turn)
- **Tier 2 Factories**: Heavy vehicles, ships, aircraft (5–20 PP/turn)
- **Tier 3 Factories**: Advanced systems, missiles, nuclear components (20–100 PP/turn)

**Build Times (examples):**
| Item              | PP Cost | Build Time    |
|------------------|---------|---------------|
| Infantry Brigade  | 10 PP   | 2 game-weeks  |
| MBT Battalion    | 40 PP   | 4 game-weeks  |
| Fighter Squadron  | 150 PP  | 8 game-weeks  |
| Destroyer         | 150 PP  | 12 game-weeks |
| SSBN              | 600 PP  | 48 game-weeks |
| ICBM              | 200 PP  | 24 game-weeks |

### LEND-LEASE / ARMS TRANSFERS
Players can sell or gift military equipment to allies:
- Transferred immediately (no build time for recipient)
- Costs PP from sender's stockpile
- Builds diplomatic influence with recipient
- Can be interdicted in transit (air or sea)

---

## DEBT & ECONOMIC STABILITY

### WAR DEBT SYSTEM
- Military spending beyond sustainable GDP% creates debt
- Debt accumulates interest (1–5%/turn depending on credit rating)
- **Debt Crisis Threshold**: Debt > 120% of GDP triggers:
  - International credit rating downgrade
  - Currency devaluation (-15% trade efficiency)
  - Domestic political instability
  - IMF intervention option (must accept conditions)

### INFLATION
Wartime spending causes inflation:
- Every 5% of GDP overspent = +1% inflation
- Inflation above 15% = -10% civilian production
- Hyperinflation (>50%) = economic collapse, coup risk

### CURRENCY & RESERVE SYSTEM
Nations hold foreign exchange reserves:
- US Dollar (dominant reserve)
- Euro, Yuan, Gold
- If reserves depleted: can no longer import critical supplies
- Reserve warfare: depleting enemy reserves via economic pressure

---

## INFRASTRUCTURE & DEVELOPMENT

### PROVINCE INFRASTRUCTURE LEVELS
Each province has a development score (0–100):

| Score | Description           | PP Generation | Supply Efficiency | Rebuild Cost |
|-------|-----------------------|---------------|-------------------|--------------|
| 0–20  | Undeveloped/destroyed | Minimal       | Poor              | High         |
| 21–40 | Basic                 | Low           | Moderate          | Medium       |
| 41–60 | Developing            | Moderate      | Good              | Medium       |
| 61–80 | Developed             | High          | Very Good         | Low          |
| 81–100| Industrial core       | Very High     | Excellent         | Very Low     |

### TARGETABLE INFRASTRUCTURE (Strategic Bombing)
| Target Type        | Effect if Destroyed                        | Rebuild Time |
|-------------------|--------------------------------------------|--------------|
| Power Grid Node   | -30% energy in connected region             | 2–4 weeks    |
| Oil Refinery      | -25% refined fuel production                | 8–16 weeks   |
| Rail Hub          | Supply routes disrupted in 3-hex radius     | 3–6 weeks    |
| Port              | -50% maritime trade for that coast          | 6–12 weeks   |
| Industrial Complex| -40% PP production in province              | 12–24 weeks  |
| Airfield          | Denies air operations from base             | 1–3 weeks    |
| Road Network      | Slows unit movement by -30%                 | 1–2 weeks    |
| Communication Hub | Intel and coordination penalties            | 1–2 weeks    |
| Hospital          | Casualty recovery reduced; morale -5        | 2–4 weeks    |
| University/R&D    | Research Points -15% for 6 months          | 8–16 weeks   |
