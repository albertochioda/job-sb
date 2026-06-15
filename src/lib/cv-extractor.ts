// Text extraction from PDF and DOCX files

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfParse = (await import("pdf-parse")) as any;
  const data = await pdfParse(buffer);
  return data.text.trim();
}

export async function extractTextFromDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value.trim();
}

export async function extractText(
  buffer: Buffer,
  fileType: "pdf" | "docx"
): Promise<string> {
  if (fileType === "pdf") return extractTextFromPdf(buffer);
  return extractTextFromDocx(buffer);
}
