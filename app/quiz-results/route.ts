import { readFileSync } from "fs";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import { NextRequest, NextResponse } from "next/server";
import { AnswerRecord, getAnswersFilesInBook, getAnswersInBook} from "@/api/quiz";
import { getBook } from "@/api/book";
import { getUploadDir, zipResponse } from "@/utils/zip";

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
  const { frontmatter: { title, quizThreshold }, chapters } = await getBook(bookId) || {};
  const questions =
    chapters.flatMap(({questions}) =>
      questions.map(({question, questionId, maxPoints}) => [question, questionId, maxPoints] as [string, string, number | null]));
  const threshold = (quizThreshold ?? 0) * questions.reduce((acc, [, , maxPoints]) => acc + (maxPoints ?? 0), 0);

  const workbook = new ExcelJS.Workbook();

  const sheet1 = workbook.addWorksheet('Points');
  sheet1.views = [{state: 'frozen', xSplit: 3, ySplit: 1}];
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
    const totals = Object.values(answers)
      .map((ans) => (ans.length === 0 ? 0 : ans[ans.length - 1].points ?? 0));
    const total = totals.length ? totals.reduce((a, b) => a + b, 0) : undefined;
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
      total
    });
    if (total !== undefined && threshold) {
      sheet1.lastRow!.getCell("total").font = {
        color: {argb: total < threshold ? 'FFBB0000' : 'FF00BB00'}
      }
    }
  });

  function addAnswerWorksheet(name: string) {
    const ws = workbook.addWorksheet(name);
    ws.views = [{state: 'frozen', xSplit: 3, ySplit: 1}];
    ws.columns = [
      {header: 'Name', key: 'name', width: 20},
      {header: 'Surname', key: 'surname', width: 20},
      {header: 'Email', key: 'email', width: 30},
      ...questions.map(([question, questionId]) => ({
        header: question || questionId,
        key: questionId,
        width: 30,
      }))
    ];
    const headerRow = ws.getRow(1);
    headerRow.height = 120;
    questions.forEach((_, i) => {
      headerRow.getCell(i + 4).alignment = {
        textRotation: 90,
        wrapText: true,
        horizontal: "left"};
    });
    return ws
  }

  function renderAnswer(a: AnswerRecord) {
    return a.isCorrect === undefined
           ? a.answer
           : a.isCorrect
             ? `✅ ${a.answer}`
             : `❌ ${a.answer}`
  }

  const sheet2 = addAnswerWorksheet("Answers");
  answers.forEach(({name, surname, email, answers}) => {
    sheet2.addRow({
      name, surname, email,
      ...Object.fromEntries(
        Object.entries(answers).map(([questionId, ans]) => [
          questionId,
          ans.map(renderAnswer).at(-1)
        ])
      )
    });
  });

  const sheet3 = addAnswerWorksheet("Answers (all)");
  answers.forEach(({name, surname, email, answers}) => {
    sheet3.addRow({
      name, surname, email,
      ...Object.fromEntries(
        Object.entries(answers).map(([questionId, ans]) => [
          questionId,
          ans.map(renderAnswer).join('\n')
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
  for(const {group, questionId, userId, name, surname, email, fileNames,
             ...dirParts}
      of answersFiles) {
    const { dir, error} = await getUploadDir({bookId, ...dirParts});
    if (!dir || error) { // both will be true; this is to satisfy TS later on
      return NextResponse.json({ error }, { status: 500 });
    }
    const userDir = name ? `${name}-${surname}-${email}` : `User-${userId}`;
    fileNames.forEach((fileName) => {
      const data = readFileSync(`${dir}/${fileName}`);
      // Sanitize each part separately, otherwise you lose / :)
      const path = [
        "files",
        groupId && group,
        questionId,
        userDir,
        fileName
      ].filter(Boolean)
        // Cannot be null, but TS does not know that?!
       .map((n: string | null) => n && n.replace(/[<>:"/\\|?*]/g, '_'))
       .join("/")
      zip.file(path, data, {binary: true});
    });
  }
  return await zipResponse(zip, `${title}-quiz-answers.zip`);
}
