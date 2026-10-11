# PhiWrite DOCX text interoperability

**Status:** DOCX import preview (#20), basic export (#21), external-style handling (#22), tables (#23), safe inline formatting (#24), and ordered-list interoperability (#25 candidate).

PhiWrite remains a simple local-first Markdown editor. DOCX files use actual ZIP/Office Open XML packaging so compatible word processors can open them. These features are a **text-level conversion path**, not a complete Word document editor or layout-preserving converter.

| Content | PhiWrite → DOCX | DOCX → PhiWrite |
| --- | --- | --- |
| Document title | Visible Word Title paragraph | First Word Title-styled paragraph becomes the PhiWrite title; otherwise filename used |
| Paragraphs and line breaks | Basic Word paragraphs and breaks | Text paragraphs and breaks |
| Headings 1–6 | Word paragraph heading styles | Markdown headings for standard styles, custom style inheritance, and paragraph outline levels |
| Bullet / numbered lists | Standard Word numbering definitions | Simplified Markdown bullets (numbering distinctions are not guaranteed) |
| Code blocks | Basic monospace Word paragraph style | Text is extracted; code styling may be lost |
| Blockquotes | Simple Word Quote style | Text is extracted; quote styling may be lost |
| Simple rectangular tables (2–32 columns; up to 500 rows) | Native Word tables from Markdown pipe tables | Converted to Markdown pipe tables, first row treated as header; text retained | 
| Complex tables (merged/nested cells, multiple cell paragraphs) | Not supported | Flattened to tab-separated text with warning |
| Simple inline bold and italic | Converted to Word run properties | Converted to Markdown emphasis for recognized run properties |
| HTTP(S) hyperlinks | External hyperlink relationships | Safe HTTP(S) external relationships converted to Markdown links; unsafe/missing links become plain text |
| Nested/complex inline markup | Not supported | May lose overlapping run formatting and complex field-code links |
| Images and rich media | Not exported | Not preserved |
| Headers, footers, comments, footnotes, fields | Not exported | Not preserved |
| Pagination, section formatting, margins | Basic default page setup only | Not preserved |
| Tracked edits, macros, complex embedded content | Not exported | Tracked edits and macros not preserved; basic Word content-control text extracted, form behavior lost |

The export is built locally with a strict source-size and package-size limit. It includes the main WordprocessingML document, styles, numbering, and OPC relationships, all as uncompressed ZIP entries for predictable output. It does not require a server, credentials, document upload or new runtime package.

## Safety and acceptance

1. Back up your working PhiWrite draft or workspace before importing important files.
2. Use **Export .docx**, download the document, then open it in Word or LibreOffice to review the appearance before sharing.
3. To reimport, use **Preview .docx** and review the extracted text and loss warnings. **Cancel** keeps the existing draft intact. **Replace** saves simplified content locally.
4. The CI acceptance test exports a generated DOCX, verifies the ZIP signature, then imports that same package in real Chromium and verifies content survives a refresh.

Successful round-trip tests establish **covered text preservation**, not arbitrary third-party DOCX fidelity or pixel-perfect rendering. This remains a deliberately bounded compatibility lab.
