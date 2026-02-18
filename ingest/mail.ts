import { isDirectory, pathExists, readFile, readPublicDir } from "./paths";


const subjectAndText = (s: string) => {
  const lines = s.split("\n");
  return {
    subject: lines[0],
    plain: lines.slice(1).join("\n").trim()
  }
}

export type MailPath = {
  path: string;
  subject: string;
  plain: string;
  html: string | null;
}

export const getLoginMails = (prefix: string): MailPath[] =>
[ ...pathExists(prefix, "login-mail.txt")
     ? [{path: prefix,
         ...subjectAndText(readFile(prefix, "login-mail.txt")),
         html: pathExists(prefix, "login-mail.html")
               ? readFile(prefix, "login-mail.html")
               : null}]
     : [],
  ...readPublicDir(prefix)
    .map((subdir) => `${prefix}/${subdir}`)
    .filter((path) => isDirectory(path))
    .flatMap(getLoginMails)
];
