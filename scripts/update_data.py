#!/usr/bin/env python3
from pathlib import Path
import csv
import json
from io import StringIO
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
    update_app(csv_text, rows_to_objects(csv_text))
    print(f"Updated data.csv, data.js, index.html, and app.js from sheet: {SHEET_NAME}")


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


def update_app(csv_text, rows):
    app_path = ROOT / "app.js"
    app = app_path.read_text(encoding="utf-8")
    app = replace_marked_block(
        app,
        "// EMBEDDED_DATA_START",
        "// EMBEDDED_DATA_END",
        "const EMBEDDED_DATA_CSV = " + json.dumps(csv_text, ensure_ascii=False) + ";",
    )
    app = replace_marked_block(
        app,
        "// EMBEDDED_ROWS_START",
        "// EMBEDDED_ROWS_END",
        "const EMBEDDED_ROWS = " + json.dumps(rows, ensure_ascii=False, separators=(",", ":")) + ";",
    )
    app_path.write_text(app, encoding="utf-8")


def replace_marked_block(text, start, end, replacement):
    if start not in text or end not in text:
        raise RuntimeError(f"Missing markers: {start} / {end}")
    before, rest = text.split(start, 1)
    _, after = rest.split(end, 1)
    return before + f"{start}\n{replacement}\n{end}" + after


def rows_to_objects(csv_text):
    matrix = list(csv.reader(StringIO(csv_text)))
    if not matrix:
        return []

    headers = [cell.strip() or f"欄位 {index + 1}" for index, cell in enumerate(matrix[0])]
    rows = []
    for row_number, cells in enumerate(matrix[1:], start=2):
        fields = {}
        for cell_index, header in enumerate(headers):
            value = cells[cell_index].strip() if cell_index < len(cells) else ""
            if value:
                fields[header] = value

        plate = fields.get("車號", "").strip()
        if not plate:
            continue

        rows.append(
            {
                "sheetName": SHEET_NAME,
                "rowNumber": row_number,
                "fields": fields,
                "plate": plate,
            }
        )
    return rows


if __name__ == "__main__":
    main()
