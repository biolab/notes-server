import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import {getCollectionResults, getCollectionBooksWithQuestions} from "@/api/quiz";
import { getCollection } from "@/api/collection";


export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const collectionId = parseInt(url.searchParams.get("collectionId") || "-1");
  const accessToken = url.searchParams.get("accessToken") || "";
  const groupId = url.searchParams.get("groupId");

  const results = await getCollectionResults(
    collectionId,
    accessToken,
    groupId === null ? null : parseInt(groupId));
  if (!results) {
    return new Response("Forbidden", {status: 403});
  }

  const collection = await getCollection(collectionId) || {};
  const books = collection.books;

  const thresholds = await getCollectionBooksWithQuestions(collectionId);
  const actBooks = books.filter(({id}) => thresholds[id] !== undefined);

  const workbook = new ExcelJS.Workbook();

  const sheet1 = workbook.addWorksheet('Points');
  sheet1.views = [{state: 'frozen', xSplit: 3, ySplit: 1}];
  sheet1.columns = [
    {header: 'Name', key: 'name', width: 20},
    {header: 'Surname', key: 'surname', width: 20},
    {header: 'Email', key: 'email', width: 30},
    ...actBooks.map(({title, slug}) => ({
      header: title,
      key: slug,
      width: 10,
    })),
    {header: 'Total', key: 'total', width: 10}
  ];

  results.forEach(({name, surname, email, points}) => {
    sheet1.addRow({
      name, surname, email,
      ...Object.fromEntries(
        actBooks.map(({id, slug}) =>
          [slug, points?.[id] ?? ""])),
      total: Object.values(points || {}).reduce((a, b) => a + b, 0)
    });
    actBooks.forEach(({id}, i) => {
      const cell = sheet1.getRow(sheet1.lastRow!.number).getCell(i + 4);
      if (points?.[id] !== undefined && thresholds[id]) {
        cell.font = {
          color: { argb: points[id] < thresholds[id] ? 'FFBB0000' : 'FF00BB00' }
        };
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = encodeURIComponent(`${collection.slug}-quiz-collection.xlsx`);

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
