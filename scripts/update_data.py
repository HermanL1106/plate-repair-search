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
    update_index(csv_text)
    print(f"Updated data.csv and data.js from sheet: {SHEET_NAME}")


def update_index(csv_text):
    index_path = ROOT / "index.html"
    index = index_path.read_text(encoding="utf-8")
    start = "    <!-- SHEET_DATA_START -->"
    end = "    <!-- SHEET_DATA_END -->"
    if start not in index or end not in index:
        raise RuntimeError("index.html is missing sheet data markers.")

    before, rest = index.split(start, 1)
    _, after = rest.split(end, 1)
    script = (
        f"{start}\n"
        "    <script>window.__PLATE_SEARCH_DATA_CSV__ = "
        + json.dumps(csv_text, ensure_ascii=False)
        + ";</script>\n"
        f"{end}"
    )
    index_path.write_text(before + script + after, encoding="utf-8")


if __name__ == "__main__":
    main()
