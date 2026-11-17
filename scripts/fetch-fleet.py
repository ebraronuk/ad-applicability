#!/usr/bin/env python3
"""Build a sample fleet from the OpenSky aircraft database.

Why not the FAA Releasable Aircraft Database, which would be the obvious source
for directives issued by the FAA: registry.faa.gov returns 403 and then 503 to
automated requests, with or without a browser user agent. Rather than work
around a publisher's bot protection, this uses the OpenSky aircraft database,
which is published for programmatic access and carries the four fields the
evaluator needs: registration, manufacturer, model and serial number.

The trade-off is recorded because it matters for how results read: the fleet is
worldwide rather than US-registered, so it is a realistic fleet to evaluate
against, not the actual population an FAA directive binds. Everything in it is
a real aircraft with a real serial number.

Source: https://opensky-network.org/datasets/
Licence: CC-BY-SA 4.0 (OpenSky Network)
"""
import csv
import json
import random
import re
import sys
import urllib.request
from collections import Counter
from pathlib import Path

CSV_URL = (
    "https://s3.opensky-network.org/data-samples/metadata/"
    "aircraft-database-complete-2024-01.csv"
)
USER_AGENT = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/133.0.0.0 Safari/537.36"

ROOT = Path(__file__).resolve().parent.parent
DOWNLOAD = ROOT / "data" / ".cache" / "aircraft-database.csv"
OUT = ROOT / "data" / "fleet" / "sample-fleet.json"

# The file ships without a header row; this is the documented column order,
# confirmed against the data before use.
COLUMNS = [
    "icao24",
    "registration",
    "manufacturericao",
    "manufacturername",
    "model",
    "typecode",
    "serialnumber",
    "linenumber",
    "icaoaircrafttype",
    "operator",
    "operatorcallsign",
    "operatoricao",
    "operatoriata",
    "owner",
    "categoryDescription",
]

# The manufacturers the directive corpus actually targets, so the sample fleet
# exercises real clauses instead of sitting inert beside them.
WANTED = (
    "boeing",
    "airbus",
    "bombardier",
    "dassault",
    "bell",
    "md helicopters",
    "diamond",
    "embraer",
)

FLEET_SIZE = 400
SEED = 20261117  # fixed so the committed fleet is reproducible


def download() -> None:
    if DOWNLOAD.exists() and DOWNLOAD.stat().st_size > 50_000_000:
        print("cached: %s" % DOWNLOAD)
        return
    DOWNLOAD.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(CSV_URL, headers={"User-Agent": USER_AGENT})
    print("downloading %s ..." % CSV_URL)
    with urllib.request.urlopen(request, timeout=180) as response, DOWNLOAD.open("wb") as out:
        while True:
            chunk = response.read(1 << 20)
            if not chunk:
                break
            out.write(chunk)
    print("downloaded %d bytes" % DOWNLOAD.stat().st_size)


def wanted(manufacturer: str) -> bool:
    lowered = manufacturer.lower()
    return any(name in lowered for name in WANTED)


def main() -> None:
    download()
    candidates = []
    with DOWNLOAD.open(newline="", encoding="utf-8", errors="replace") as handle:
        for row in csv.DictReader(handle, fieldnames=COLUMNS):
            registration = (row.get("registration") or "").strip()
            manufacturer = (row.get("manufacturername") or "").strip()
            model = (row.get("model") or "").strip()
            serial = (row.get("serialnumber") or "").strip()
            # All four fields are required: an aircraft missing any of them
            # cannot be evaluated, and padding the fleet with unevaluable rows
            # would inflate the undetermined count for no reason.
            if not (registration and manufacturer and model and serial):
                continue
            if not wanted(manufacturer):
                continue
            if not re.fullmatch(r"[A-Z0-9-]{3,12}", registration.upper()):
                continue
            candidates.append(
                {
                    "nNumber": registration.upper(),
                    "manufacturer": manufacturer.upper(),
                    "model": model,
                    "serialNumber": serial,
                    **({"typeDesignator": row["typecode"].strip()} if (row.get("typecode") or "").strip() else {}),
                }
            )

    if not candidates:
        sys.exit("no usable rows found; check the column order against the source")

    random.seed(SEED)
    # Spread the sample across manufacturers so one fleet does not become 380
    # Boeings and 20 of everything else.
    by_manufacturer: dict[str, list] = {}
    for aircraft in candidates:
        key = next(n for n in WANTED if n in aircraft["manufacturer"].lower())
        by_manufacturer.setdefault(key, []).append(aircraft)

    per_group = max(1, FLEET_SIZE // len(by_manufacturer))
    fleet = []
    for group in by_manufacturer.values():
        random.shuffle(group)
        fleet.extend(group[:per_group])
    fleet.sort(key=lambda a: (a["manufacturer"], a["model"], a["nNumber"]))

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(
        json.dumps(
            {
                "name": "Sample mixed fleet (OpenSky aircraft database, 2024-01)",
                "source": CSV_URL,
                "licence": "CC-BY-SA 4.0, OpenSky Network",
                "aircraft": fleet,
            },
            indent=1,
            ensure_ascii=False,
        )
        + "\n",
        encoding="utf-8",
    )
    print("usable rows: %d" % len(candidates))
    print("fleet: %d aircraft -> %s" % (len(fleet), OUT))
    print("by manufacturer:")
    for name, count in Counter(a["manufacturer"] for a in fleet).most_common(12):
        print("  %-28s %d" % (name[:28], count))


if __name__ == "__main__":
    main()
