#!/usr/bin/env python3
from pathlib import Path
import json
from urllib.parse import quote
from urllib.request import Request, urlopen


ROOT = Path(__file__).resolve().parents[1]
SPREADSHEET_ID = "1DpSxO_ugC0tYlEdqMthc-xN8yVgiezsd2N3dIFiWQfc"
SHEET_NAME = "改裝業績"


def main():
    url = (
        f"https://docs.google.com/spreadsheets/d/{SPREADSHEET_ID}/gviz/tq"
        f"?tqx=out:csv&sheet={quote(SHEET_NAME)}"
    )
    request = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(request, timeout=30) as response:
        body = response.read()

    if b"\xe8\xbb\x8a\xe8\x99\x9f" not in body:
        raise RuntimeError("Downloaded data does not include the 車號 column.")

    csv_text = body.decode("utf-8-sig")
    (ROOT / "data.csv").write_text(csv_text, encoding="utf-8")
    (ROOT / "data.js").write_text(
        "window.__PLATE_SEARCH_DATA_CSV__ = "
        + json.dumps(csv_text, ensure_ascii=False)
        + ";\n",
        encoding="utf-8",
    )
    print(f"Updated data.csv and data.js from sheet: {SHEET_NAME}")


if __name__ == "__main__":
    main()
