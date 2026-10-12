# PhiWrite DOCX text interoperability

**Status:** DOCX import preview (#20), basic export (#21), external-style handling (#22), tables (#23), safe inline formatting (#24), ordered lists (#25), two-level lists (#26), inline/fenced code (#27), quotation interoperability (#28), rich text in simple table cells (#29), strikethrough/yellow highlighting (#30), single underline interoperability (#31), the selection-aware formatting toolbar (#32), reviewed safe-link insertion (#33), paragraph-heading/list toolbar actions (#34), and reversible Quote/Code block controls (#35 candidate).

PhiWrite remains a simple local-first Markdown editor. DOCX files use actual ZIP/Office Open XML packaging so compatible word processors can open them. These features are a **text-level conversion path**, not a complete Word document editor or layout-preserving converter.

| Content | PhiWrite → DOCX | DOCX → PhiWrite |
| --- | --- | --- |
| Document title | Visible Word Title paragraph | First Word Title-styled paragraph becomes the PhiWrite title; otherwise filename used |
| Paragraphs and line breaks | Basic Word paragraphs and breaks | Text paragraphs and breaks |
| Headings 1–6 | Word paragraph heading styles | Markdown headings for standard styles, custom style inheritance, and paragraph outline levels |
| Bullet / decimal-numbered lists with up to two levels | Native multilevel Word numbering definitions with level-specific formats and start overrides | Word numbering.xml converted to two-space-indented Markdown with level-specific bullet/decimal markers and start values |
| More than two levels, Roman/lettered/legal numbering, Word custom restarts | Not supported | Flattened or approximated with a visible warning; exact semantics not guaranteed |
| Code blocks (simple fenced Markdown) | Word Code paragraph style with monospace font | Recognized Code/CodeBlock/HTMLPreformatted paragraphs become literal tilde-fenced Markdown; unsafe fence collisions fall back to text with a warning |
| Inline code (single backticks) | Word CodeChar character style and escaped monospace text | Recognized CodeChar runs become literal single-backtick spans; complex or nested code styles are not retained |
| Blockquotes and simple quotations | Native Word Quote paragraphs with rich inline runs | Recognized Quote, IntenseQuote, BlockQuote and styles based on them become Markdown blockquotes; adjacent quote paragraphs group together |
| Complex quote typography and sidebars | Approximate only | Alignment, decorative typography, borders and advanced quote placement are not preserved |
| Simple rectangular tables (2–32 columns; up to 500 rows) | Native Word tables from Markdown pipe tables; basic bold/italic/inline code and safe HTTP(S) links in cells become true Word runs | Converted to Markdown pipe tables; recognized cell emphasis, inline code and safe external links retained; first row treated as header, column styling/layout not preserved | 
| Complex tables (merged/nested cells, multiple cell paragraphs) | Not supported | Flattened to tab-separated text with warning |
| Simple inline bold and italic | Converted to Word run properties | Converted to Markdown emphasis for recognized run properties |
| Strikethrough and yellow highlighting | `~~removed~~` becomes `w:strike`; `==review==` becomes yellow `w:highlight` | Recognized strike/double-strike and exactly yellow-highlighted runs become matching markers; other colors and overlapping styling are not faithfully preserved |
| Single underline | Nonstandard `++underlined++` becomes native Word `w:u w:val="single"` | Word simple single underline runs become `++text++`; double/dotted/wavy/disabled and overlapping underline styles are not preserved |
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
