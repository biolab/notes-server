import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import {getCollectionResults, UserDesc} from "@/api/quiz";
import { getCollection } from "@/api/collection";


// copied from Results.tsx, know to little to make it async
function filterResults<T extends UserDesc>(results: T[] | false | null, group: number | null): T[] | false | null {
  return group && results
      ? results.filter(({groupId}) => groupId === group)
      : results;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const collectionId = parseInt(url.searchParams.get("collectionId") || "-1");
  const accessToken = url.searchParams.get("accessToken") || "";
  const groupId = url.searchParams.get("groupId");

  const results = await getCollectionResults(
    collectionId,
    accessToken);
  if (!results) {
    return new Response("Forbidden", {status: 403});
  }

  const filteredResults = filterResults(
    results,
    groupId === null ? null : parseInt(groupId));

  const collection = await getCollection(collectionId) || {};
  const books = collection.books;

  const workbook = new ExcelJS.Workbook();

  const sheet1 = workbook.addWorksheet('Points');
  sheet1.columns = [
    {header: 'Name', key: 'name', width: 20},
    {header: 'Surname', key: 'surname', width: 20},
    {header: 'Email', key: 'email', width: 30},
    ...books.map(({title, slug}) => ({
      header: title,
      key: slug,
      width: 10,
    })),
    {header: 'Total', key: 'total', width: 10}
  ];

  if (filteredResults)
    filteredResults.forEach(({name, surname, email, points}) => {
      sheet1.addRow({
        name, surname, email,
        ...Object.fromEntries(
          books.map(({id, slug}) =>
            [slug, points?.[id] ?? ""])),
        total: Object.values(points || {}).reduce((a, b) => a + b, 0)
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
