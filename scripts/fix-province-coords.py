#!/usr/bin/env python3
"""
Recompute province hex coordinates from real-world lon/lat.

Calibration (derived from world map overlay):
  x = (lon - 1.52) / 0.5396          (world units)
  q = x / 1.5 = (lon - 1.52) / 0.8094

  z = 5 - 1.853 * lat                (world units; equator = z=5, north = smaller z)
  z = sqrt(3) * (r + q/2)
  r = (5 - 1.853*lat) / sqrt(3) - q/2
    = 2.887 - 1.070*lat - q/2

  s = -q - r  (cube coordinate constraint)
"""

import json, math, os, glob

SQRT3 = math.sqrt(3)

def compute_hex(lon: float, lat: float):
    q = round((lon - 1.52) / 0.8094)
    r = round(2.887 - 1.070 * lat - q / 2)
    s = -q - r
    return {"q": q, "r": r, "s": s}

# Real-world lon/lat centroids for every province (region center, not city)
COORDS = {
    # ── USA ──────────────────────────────────────────────────────────────────
    "PRV_000001": (-77.0,  38.9),   # Washington DC
    "PRV_000002": (-74.0,  40.7),   # New York
    "PRV_000003": (-119.5, 37.0),   # California
    "PRV_000004": (-99.0,  31.5),   # Texas
    "PRV_000005": (-82.0,  28.0),   # Florida
    "PRV_000006": (-85.0,  44.0),   # Great Lakes
    "PRV_000007": (-111.0, 40.5),   # Mountain West
    "PRV_000008": (-121.0, 46.5),   # Pacific Northwest
    "PRV_000009": (-153.0, 64.2),   # Alaska
    "PRV_000010": (-157.5, 20.8),   # Hawaii
    "PRV_000011": (-66.5,  18.2),   # Puerto Rico
    # ── Russia ───────────────────────────────────────────────────────────────
    "PRV_000101": ( 37.6,  55.8),   # Moscow
    "PRV_000102": ( 30.3,  59.9),   # St. Petersburg
    "PRV_000103": ( 68.0,  58.0),   # Siberia West  (Tyumen region)
    "PRV_000104": (108.0,  56.0),   # Siberia East  (Irkutsk region)
    "PRV_000105": (134.0,  48.5),   # Far East      (Khabarovsk)
    "PRV_000106": ( 60.6,  56.8),   # Ural          (Yekaterinburg)
    "PRV_000107": ( 50.2,  52.3),   # Volga
    "PRV_000108": ( 43.5,  43.8),   # North Caucasus
    "PRV_000109": ( 55.0,  72.0),   # Arctic Russia
    "PRV_000110": ( 20.5,  54.7),   # Kaliningrad
    "PRV_000111": ( 34.1,  44.9),   # Crimea
    "PRV_000112": (131.9,  43.1),   # Vladivostok
    # ── China ────────────────────────────────────────────────────────────────
    "PRV_000201": (116.4,  39.9),   # Beijing
    "PRV_000202": (121.5,  31.2),   # Shanghai
    "PRV_000203": (113.3,  23.2),   # Guangdong
    "PRV_000204": (104.1,  30.7),   # Sichuan
    "PRV_000205": ( 86.9,  42.0),   # Xinjiang
    "PRV_000206": ( 91.1,  29.7),   # Tibet
    "PRV_000207": (126.6,  44.5),   # Manchuria
    "PRV_000208": (112.0,  43.0),   # Inner Mongolia
    "PRV_000209": (102.7,  24.8),   # Yunnan
    "PRV_000210": (109.7,  19.2),   # Hainan
    "PRV_000211": (120.5,  24.0),   # Taiwan Strait
    "PRV_000212": (114.0,   9.0),   # South China Sea
    # ── UK ───────────────────────────────────────────────────────────────────
    "PRV_000301": ( -0.1,  51.5),   # London
    "PRV_000302": ( -4.2,  57.5),   # Scotland
    "PRV_000303": ( -3.8,  52.5),   # Wales
    "PRV_000304": ( -6.5,  54.7),   # Northern Ireland
    "PRV_000305": ( -1.5,  53.5),   # England North
    "PRV_000306": (-59.0, -51.7),   # Falklands
    # ── EU Federation ────────────────────────────────────────────────────────
    "PRV_000401": (  4.4,  50.8),   # Brussels
    "PRV_000402": (  2.4,  46.8),   # France
    "PRV_000403": ( 10.5,  51.2),   # Germany
    "PRV_000404": ( 12.5,  43.0),   # Italy
    "PRV_000405": ( 19.9,  52.2),   # Poland
    "PRV_000406": ( -3.7,  40.4),   # Spain
    "PRV_000407": ( 15.0,  63.0),   # Nordics
    "PRV_000408": ( 24.8,  57.0),   # Baltics
    "PRV_000409": ( 21.0,  44.0),   # Balkans
    "PRV_000410": ( 14.0,  38.0),   # Mediterranean (Sicily/S.Italy)
    # ── North Korea ──────────────────────────────────────────────────────────
    "PRV_000501": (125.8,  39.0),   # Pyongyang
    "PRV_000502": (127.5,  41.5),   # North Province
    "PRV_000503": (126.3,  37.8),   # South Province
    "PRV_000504": (129.2,  40.5),   # Coast
    # ── Iran ─────────────────────────────────────────────────────────────────
    "PRV_000601": ( 51.4,  35.7),   # Tehran
    "PRV_000602": ( 51.7,  32.7),   # Isfahan
    "PRV_000603": ( 48.7,  31.5),   # Khuzestan
    "PRV_000604": ( 46.5,  35.5),   # Kurdistan
    "PRV_000605": ( 59.6,  36.3),   # Khorasan
    "PRV_000606": ( 56.3,  27.0),   # Hormuz Strait
    # ── India ────────────────────────────────────────────────────────────────
    "PRV_000701": ( 77.2,  28.6),   # New Delhi
    "PRV_000702": ( 72.8,  19.1),   # Mumbai
    "PRV_000703": ( 80.3,  13.1),   # Chennai
    "PRV_000704": ( 88.4,  22.6),   # Kolkata
    "PRV_000705": ( 75.9,  31.0),   # Punjab (India)
    "PRV_000706": ( 74.0,  27.0),   # Rajasthan
    "PRV_000707": ( 93.6,  26.0),   # Northeast India
    "PRV_000708": ( 92.7,  11.6),   # Andaman
    # ── Pakistan ─────────────────────────────────────────────────────────────
    "PRV_000801": ( 73.1,  33.7),   # Islamabad
    "PRV_000802": ( 72.3,  30.7),   # Punjab (Pakistan)
    "PRV_000803": ( 68.4,  25.9),   # Sindh
    "PRV_000804": ( 65.0,  27.5),   # Balochistan
    "PRV_000805": ( 71.5,  34.0),   # KPK
    # ── Saudi Arabia ─────────────────────────────────────────────────────────
    "PRV_000901": ( 46.7,  24.7),   # Riyadh
    "PRV_000902": ( 49.6,  26.4),   # Eastern Province
    "PRV_000903": ( 39.8,  21.4),   # Mecca
    "PRV_000904": ( 37.0,  22.5),   # Hejaz
    "PRV_000905": ( 53.0,  21.0),   # Empty Quarter
    # ── Israel ───────────────────────────────────────────────────────────────
    "PRV_001001": ( 35.2,  31.8),   # Jerusalem
    "PRV_001002": ( 34.8,  32.1),   # Tel Aviv
    "PRV_001003": ( 34.9,  30.5),   # Negev
    "PRV_001004": ( 35.7,  33.0),   # Golan
    # ── Turkey ───────────────────────────────────────────────────────────────
    "PRV_001101": ( 32.9,  39.9),   # Ankara
    "PRV_001102": ( 28.9,  41.0),   # Istanbul
    "PRV_001103": ( 27.5,  38.5),   # Western Anatolia
    "PRV_001104": ( 42.0,  39.5),   # Eastern Anatolia
    "PRV_001105": ( 36.5,  41.0),   # Black Sea Coast
    "PRV_001106": ( 33.3,  35.1),   # Cyprus
}

def main():
    base = os.path.join(os.path.dirname(__file__), "..", "data", "provinces")
    updated = 0
    skipped = []

    for path in sorted(glob.glob(os.path.join(base, "province-PRV_*.json"))):
        with open(path) as f:
            data = json.load(f)

        pid = data["id"]
        if pid not in COORDS:
            skipped.append(pid)
            continue

        lon, lat = COORDS[pid]
        centroid = compute_hex(lon, lat)

        old_q = data["centroidHex"]["q"]
        old_r = data["centroidHex"]["r"]

        data["centroidHex"] = centroid
        # Reset hexCoords to just the centroid — Voronoi expansion fills the rest
        data["hexCoords"] = [centroid]

        with open(path, "w") as f:
            json.dump(data, f, indent=2)
            f.write("\n")

        dq = centroid["q"] - old_q
        dr = centroid["r"] - old_r
        print(f"{pid:15} {data['name']:25} lon={lon:7.1f} lat={lat:5.1f}  "
              f"q={centroid['q']:4d} r={centroid['r']:4d} s={centroid['s']:4d}  "
              f"Δq={dq:+d} Δr={dr:+d}")
        updated += 1

    print(f"\nUpdated {updated} provinces.")
    if skipped:
        print(f"Skipped (no coords defined): {skipped}")

if __name__ == "__main__":
    main()
