#!/usr/bin/env python3
"""Fetch a corpus of real Airworthiness Directives from the Federal Register API.

The corpus is committed to the repository on purpose: every test run and every
coverage number the README quotes must be reproducible without network access,
and the applicability text we parse has to be the regulator's wording rather
than something we invented. Re-run this script to refresh it.

Source: https://www.federalregister.gov/reader-aids/developer-resources/rest-api
"""
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "data" / "corpus" / "ads.json"
PAGES = 10
PER_PAGE = 20

# (c) Applicability is the clause that scopes an AD to a set of aircraft.
# Capture up to the next lettered paragraph so the whole provision is kept and
# nothing after it leaks in.
APPLICABILITY = re.compile(r"\(c\)\s*Applicability\s*(.*?)(?=\n\s*\([d-z]\)\s)", re.S | re.I)


def get(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "ad-applicability/0.1 (corpus fetch)"}
    )
    with urllib.request.urlopen(req, timeout=30) as response:
        return response.read().decode("utf-8", "replace")


def list_documents():
    documents = []
    for page in range(1, PAGES + 1):
        query = {
            "per_page": PER_PAGE,
            "page": page,
            "order": "newest",
            "conditions[term]": "airworthiness directives",
            "conditions[type][]": "RULE",
            "fields[]": [
                "document_number",
                "title",
                "publication_date",
                "raw_text_url",
                "html_url",
            ],
        }
        url = "https://www.federalregister.gov/api/v1/documents.json?" + urllib.parse.urlencode(
            query, doseq=True
        )
        documents += json.loads(get(url))["results"]
        time.sleep(0.4)
    return documents


def extract_applicability(text):
    match = APPLICABILITY.search(text)
    if not match:
        return None
    return " ".join(match.group(1).split())


def main():
    documents = list_documents()
    corpus = []
    skipped = 0
    for document in documents:
        raw_text_url = document.get("raw_text_url")
        if not raw_text_url:
            skipped += 1
            continue
        try:
            applicability = extract_applicability(get(raw_text_url))
            time.sleep(0.25)
        except Exception:
            skipped += 1
            continue
        if not applicability:
            skipped += 1
            continue
        corpus.append(
            {
                "documentNumber": document["document_number"],
                "title": document["title"],
                "publicationDate": document["publication_date"],
                "sourceUrl": document["html_url"],
                "applicability": applicability,
            }
        )
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(corpus, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    print("corpus: %d ADs -> %s" % (len(corpus), OUT))
    print("skipped (no raw text or no applicability clause): %d" % skipped)


if __name__ == "__main__":
    main()
