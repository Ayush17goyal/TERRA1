import * as AdmZip from 'adm-zip';

// Phase 0.3 fixtures. Built programmatically rather than checked in as binary blobs: a
// hand-written minimal DOCX/PPTX (both are just zips of XML) is straightforward and versionable
// as code; a hand-written valid PDF binary is not, so PDF-path specs mock `pdf-parse` instead of
// depending on a real PDF fixture (see stages/format-normalizer.stage.spec.ts).

export const BARE_ACT_TEXT = `PART III
Fundamental Rights

Article 19
Protection of certain rights regarding freedom of speech, etc.

(1) All citizens shall have the right to freedom of speech and expression.

Provided that nothing in this clause shall prevent the State from making any law imposing
reasonable restrictions on the exercise of the right in the interests of the sovereignty and
integrity of India.

"restriction" means any limitation imposed by law on the exercise of a right.

Illustration: A publishes a pamphlet inciting violence; the State may restrict such publication
under this clause.
`;

export const CASE_COMPILATION_TEXT = `Kesavananda Bharati v. State of Kerala

FACTS
The petitioner challenged the validity of the 29th Amendment to the Constitution, which had
inserted certain State laws into the Ninth Schedule, thereby seeking to place them beyond the
reach of judicial review under Articles 14, 19 and 31. The petitioner argued that Parliament's
power to amend the Constitution under Article 368 could not extend to altering its basic
structure or destroying the fundamental rights guaranteed to citizens.

ISSUES FOR CONSIDERATION
Whether Parliament has unlimited power to amend the Constitution under Article 368, and whether
such power extends to abrogating or damaging the basic structure of the Constitution itself.

HELD
The Supreme Court held that Parliament's amending power is subject to the basic structure
doctrine, and that while Parliament may amend any part of the Constitution, including
Fundamental Rights, it cannot alter the basic structure or framework of the Constitution.

RATIO DECIDENDI
Any amendment that damages or destroys the basic structure of the Constitution is void, AIR 1973
SC 1461. The basic structure includes, among other things, the supremacy of the Constitution,
the republican and democratic form of government, the separation of powers, and judicial review.
`;

export const NOTES_TEXT = `Unit 3: Contract Law

Consideration is something of value given by both parties to a contract.

For example, suppose A agrees to sell his car to B for Rs. 50,000; the price is the consideration
moving from B and the car is the consideration moving from A.
`;

export const NON_LEGAL_TEXT = `My Summer Vacation

Last summer my family went to the mountains. We hiked every day and cooked meals over a
campfire. It was the best trip we have ever taken together and I hope we can go again next year.
`;

export const HINDI_TEXT = `भारत का संविधान

अनुच्छेद 19 सभी नागरिकों को भाषण और अभिव्यक्ति की स्वतंत्रता का अधिकार देता है।
`;

export function buildDocxBuffer(paragraphs: Array<{ text: string; headingLevel?: number }>): Buffer {
  const zip = new AdmZip();
  const body = paragraphs
    .map((p) => {
      const style = p.headingLevel ? `<w:pPr><w:pStyle w:val="Heading${p.headingLevel}"/></w:pPr>` : '';
      return `<w:p>${style}<w:r><w:t>${p.text}</w:t></w:r></w:p>`;
    })
    .join('');
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${body}</w:body>
</w:document>`;
  zip.addFile('word/document.xml', Buffer.from(xml, 'utf8'));
  return zip.toBuffer();
}

export function buildPptxBuffer(slides: Array<{ title?: string; body?: string }>): Buffer {
  const zip = new AdmZip();
  slides.forEach((slide, index) => {
    const titleShape = slide.title
      ? `<p:sp><p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr><p:txBody><a:p><a:r><a:t>${slide.title}</a:t></a:r></a:p></p:txBody></p:sp>`
      : '';
    const bodyShape = slide.body
      ? `<p:sp><p:txBody><a:p><a:r><a:t>${slide.body}</a:t></a:r></a:p></p:txBody></p:sp>`
      : '';
    const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree>${titleShape}${bodyShape}</p:spTree></p:cSld>
</p:sld>`;
    zip.addFile(`ppt/slides/slide${index + 1}.xml`, Buffer.from(xml, 'utf8'));
  });
  return zip.toBuffer();
}
