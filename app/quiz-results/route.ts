import { readFileSync } from "fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextRequest } from "next/server";
import { getAnswersFilesInBook, getAnswersInBook } from "@/api/quiz";
import { getBook } from "@/api/book";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const bookId = parseInt(url.searchParams.get("bookId") || "-1");
  const groupId = url.searchParams.get("groupId");
  const accessToken = url.searchParams.get("accessToken") || "";

  const answers = await getAnswersInBook(
    bookId,
    accessToken,
    groupId === null ? null : parseInt(groupId));
  if (!answers) {
    return new Response("Forbidden", {status: 403});
  }
  const { frontmatter: { title }, chapters } = await getBook(bookId) || {};
  const questions =
    chapters.flatMap(({questions}) =>
      questions.map(({question, questionId}) => [question, questionId]))

  const workbook = new ExcelJS.Workbook();

  const sheet1 = workbook.addWorksheet('Points');
  sheet1.columns = [
    {header: 'Name', key: 'name', width: 20},
    {header: 'Surname', key: 'surname', width: 20},
    {header: 'Email', key: 'email', width: 30},
    ...questions.map(([question, questionId]) => ({
      header: question || questionId,
      key: questionId,
      width: 10,
    })),
    {header: 'Total', key: 'total', width: 10}
  ];
  answers.forEach(({name, surname, email, answers}) => {
    sheet1.addRow({
      name, surname, email,
      ...Object.fromEntries(
        Object.entries(answers).map(([questionId, ans]) => [
          questionId,
          ans.length === 0 ? ""
          : ans[ans.length - 1].isCorrect === undefined ? ""
          : ans[ans.length - 1].points
        ])
      ),
      total: Object.values(answers)
        .map((ans) => ans.length === 0 ? 0 : ans[ans.length - 1].points || 0)
        .reduce((a: number, b: number) => a + b, 0)
    });
  });

  const sheet2 = workbook.addWorksheet('Answers');
  sheet2.columns = [
    {header: 'Name', key: 'name', width: 20},
    {header: 'Surname', key: 'surname', width: 20},
    {header: 'Email', key: 'email', width: 30},
    ...questions.map(([question, questionId]) => ({
      header: question || questionId,
      key: questionId,
      width: 30,
    }))
  ];
  const headerRow = sheet2.getRow(1);
  headerRow.height = 120;
  questions.forEach((_, i) => {
    headerRow.getCell(i + 4).alignment = {
      textRotation: 90,
      wrapText: true,
      horizontal: "left"};
  });

  answers.forEach(({name, surname, email, answers}) => {
    sheet2.addRow({
      name, surname, email,
      ...Object.fromEntries(
        Object.entries(answers).map(([questionId, ans]) => [
          questionId,
          ans.map(a =>
            a.isCorrect === undefined
            ? a.answer
            : a.isCorrect
              ? `✅ ${a.answer}`
              : `❌ ${a.answer}`
          ).join('\n')
        ])
      )
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent(`${title}-quiz-answers.xlsx`);

  const answersFiles = await getAnswersFilesInBook(
    bookId, accessToken, groupId === null ? null : parseInt(groupId));

  if (!answersFiles || answersFiles.length == 0) {
    return new Response(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          `attachment; filename="${filename}"`,
      },
    });
  }

  const zip = new JSZip();
  zip.file("answers.xlsx", buffer, {binary: true});
  answersFiles.forEach(({group, questionId, name, surname, email, qId, fileNames}) => {
    fileNames.forEach((fileName) => {
      const data = readFileSync(`uploads/${bookId}/${groupId ? `${group}` : "no-group"}/${qId}/${accessToken}/${fileName}`);
      const path = `files/${groupId ? `${group}/` : ""}${questionId}/${name}-${surname}-${email}/${fileName}`;
      zip.file(path, data, {binary: true});
    });
  });

  const zipBuffer: Buffer = await new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    zip.generateNodeStream({type: "nodebuffer", streamFiles: true})
      .on("data", (chunk: Buffer) => chunks.push(chunk))
      .on("error", reject)
      .on("end", () => resolve(Buffer.concat(chunks)));
  });
  const zipFilename = encodeURIComponent(`${title}-quiz-answers.zip`);
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
