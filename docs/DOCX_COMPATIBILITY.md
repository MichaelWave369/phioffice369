# PhiWrite DOCX text interoperability

**Status:** DOCX import preview (#20), basic DOCX export (#21), and a custom-style/content-control interoperability lab (#22 candidate).

PhiWrite remains a simple local-first Markdown editor. DOCX files use actual ZIP/Office Open XML packaging so compatible word processors can open them. These features are a **text-level conversion path**, not a complete Word document editor or layout-preserving converter.

| Content | PhiWrite → DOCX | DOCX → PhiWrite |
| --- | --- | --- |
| Document title | Visible Word Title paragraph | First Word Title-styled paragraph becomes the PhiWrite title; otherwise filename used |
| Paragraphs and line breaks | Basic Word paragraphs and breaks | Text paragraphs and breaks |
| Headings 1–6 | Word paragraph heading styles | Markdown headings for standard Word heading styles |
| Bullet / numbered lists | Standard Word numbering definitions | Simplified Markdown bullets (numbering distinctions are not guaranteed) |
| Code blocks | Basic monospace Word paragraph style | Text is extracted; code styling may be lost |
| Blockquotes | Simple Word Quote style | Text is extracted; quote styling may be lost |
| Tables | No native Word table export | Flattened to tab-separated text |
| Inline bold, italic, hyperlinks | Markdown syntax remains literal text | Inline formatting is lost |
| Images and rich media | Not exported | Not preserved |
| Headers, footers, comments, footnotes, fields | Not exported | Not preserved |
| Pagination, section formatting, margins | Basic default page setup only | Not preserved |
| Tracked edits, macros, complex embedded content | Not exported | Not preserved |

The export is built locally with a strict source-size and package-size limit. It includes the main WordprocessingML document, styles, numbering, and OPC relationships, all as uncompressed ZIP entries for predictable output. It does not require a server, credentials, document upload or new runtime package.

## Safety and acceptance

1. Back up your working PhiWrite draft or workspace before importing important files.
2. Use **Export .docx**, download the document, then open it in Word or LibreOffice to review the appearance before sharing.
3. To reimport, use **Preview .docx** and review the extracted text and loss warnings. **Cancel** keeps the existing draft intact. **Replace** saves simplified content locally.
4. The CI acceptance test exports a generated DOCX, verifies the ZIP signature, then imports that same package in real Chromium and verifies content survives a refresh.

Successful round-trip tests establish **covered text preservation**, not arbitrary third-party DOCX fidelity or pixel-perfect rendering. This remains a deliberately bounded compatibility lab.
