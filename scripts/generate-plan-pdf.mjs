import fs from "node:fs";
import path from "node:path";

const inputPath = path.resolve("docs/plano-execucao-menuz.md");
const outputPath = path.resolve("docs/plano-execucao-menuz.pdf");

const source = fs.readFileSync(inputPath, "utf8");
const rawLines = source
  .split(/\r?\n/)
  .map((line) => line.replace(/\t/g, "  ").trimEnd());

const lines = [];
for (const line of rawLines) {
  if (!line) {
    lines.push("");
    continue;
  }
  const normalized = line
    .replace(/^###\s+/g, "")
    .replace(/^##\s+/g, "")
    .replace(/^#\s+/g, "")
    .replace(/^- \s+/g, "- ")
    .replace(/^\d+\)\s+/g, (match) => match);

  wrapText(normalized, 100).forEach((wrapped) => lines.push(wrapped));
}

const linesPerPage = 44;
const pages = [];
for (let i = 0; i < lines.length; i += linesPerPage) {
  pages.push(lines.slice(i, i + linesPerPage));
}

const objects = [];
objects.push("<< /Type /Catalog /Pages 2 0 R >>");

const pageObjectIds = [];
const contentObjectIds = [];

for (let i = 0; i < pages.length; i += 1) {
  const pageObjectId = 3 + i * 2;
  const contentObjectId = 4 + i * 2;
  pageObjectIds.push(pageObjectId);
  contentObjectIds.push(contentObjectId);
}

const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ");
objects.push(`<< /Type /Pages /Count ${pages.length} /Kids [ ${kids} ] >>`);

for (let i = 0; i < pages.length; i += 1) {
  const pageId = pageObjectIds[i];
  const contentId = contentObjectIds[i];
  objects[pageId - 1] =
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] ` +
    `/Resources << /Font << /F1 ${3 + pages.length * 2} 0 R >> >> /Contents ${contentId} 0 R >>`;

  const stream = buildTextStream(pages[i]);
  objects[contentId - 1] = `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`;
}

const fontObjectId = 3 + pages.length * 2;
objects[fontObjectId - 1] = "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>";

const pdfParts = [];
pdfParts.push("%PDF-1.4\n");

const offsets = [0];
for (let i = 0; i < objects.length; i += 1) {
  const body = `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  offsets.push(Buffer.byteLength(pdfParts.join(""), "utf8"));
  pdfParts.push(body);
}

const xrefStart = Buffer.byteLength(pdfParts.join(""), "utf8");
let xref = `xref\n0 ${objects.length + 1}\n`;
xref += "0000000000 65535 f \n";
for (let i = 1; i <= objects.length; i += 1) {
  xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
}

const trailer =
  `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n` +
  `startxref\n${xrefStart}\n%%EOF`;

pdfParts.push(xref);
pdfParts.push(trailer);

fs.writeFileSync(outputPath, pdfParts.join(""), "binary");
console.log(`PDF gerado em: ${outputPath}`);

function buildTextStream(pageLines) {
  const parts = [];
  parts.push("BT");
  parts.push("/F1 11 Tf");
  parts.push("50 800 Td");
  for (let i = 0; i < pageLines.length; i += 1) {
    const line = escapePdfText(pageLines[i]);
    parts.push(`(${line}) Tj`);
    if (i < pageLines.length - 1) {
      parts.push("0 -16 Td");
    }
  }
  parts.push("ET");
  return parts.join("\n");
}

function escapePdfText(input) {
  return input
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapText(input, maxLength) {
  if (input.length <= maxLength) return [input];
  const words = input.split(" ");
  const out = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > maxLength) {
      if (current) out.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) out.push(current);
  return out;
}
