import JSZip from "jszip";

export const zipResponse = async (zip: JSZip, fileName: string) => {
  const zipBuffer: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.generateNodeStream({type: "nodebuffer", streamFiles: true})
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
  const zipFilename = encodeURIComponent(fileName);
  return new Response(zipBuffer, {
    status: 200,
    headers: {
      'Content-Type':
        'application/zip',
      'Content-Disposition':
        `attachment; filename="${zipFilename}"`,
    },
  });
}
