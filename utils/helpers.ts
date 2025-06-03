import fs from "fs";
import path from "path";

const joinedPath = (spath: string | string[]) =>
  path.join("public", ...(typeof spath === "string" ? [spath] : spath));

export const isDirectory = (...spath: string[]) =>
  fs.statSync(joinedPath(spath), { throwIfNoEntry: false })?.isDirectory();

export const getMdFile = (spath: string | string[], base = "index") => {
  const bpath = joinedPath(spath);
  // Don't be smart and call the above isDirectory function;
  // you'll add another 'public' to the path
  if (!fs.statSync(bpath).isDirectory()) {
    return null;
  }

  const fname = path.join(bpath, `${base}.md`);
  const fnamex = path.join(bpath, `${base}.mdx`);
  if (fs.existsSync(fname)) {
    if (fs.existsSync(fnamex)) {
      throw new Error(`Both ${fname} and ${fnamex} exist. Please remove one.`);
    } else {
      return fname;
    }
  }
  if (fs.existsSync(fnamex)) {
    return fnamex;
  }
  return null;
};

export const readPublicDir = (...spath: string[]) =>
  fs.readdirSync(joinedPath(spath));

export const readPublicDirMd = (spath: string | string[], base = "index") => {
  const bpath = typeof spath == "string" ? [spath] : spath;
  return readPublicDir(...bpath).filter(
    (dir) => !!getMdFile([...bpath, dir], base)
  );
};

export function parseMd(content: string, imgRelativePath: string = "") {
  content = addRelativePathToImages(content, imgRelativePath);

  const macroStart = "<!!!";
  const macroEnd = "!!!>";

  const startIndex = content.indexOf(macroStart);
  const endIndex = content.indexOf(macroEnd);

  if (startIndex === -1 || endIndex === -1) {
    return content;
  }

  const macro = content
    .substring(startIndex + macroStart.length, endIndex)
    .split(" ")
    .map((s) => s.trim())
    .filter((s) => !s.includes(macroStart) && !s.includes(macroEnd))
    .filter(Boolean);

  const insert =
    `<div ${macro.map((m) => "data-" + m).join(" ")}></div>` + "\n";

  return parseMd(
    content.substring(0, startIndex) +
      insert +
      content.substring(endIndex + macroEnd.length)
  );
}

function addRelativePathToImages(
  content: string,
  imgRelativePath: string
): string {
  if (!imgRelativePath || !content) {
    return content;
  }

  // Add relative path IF img src does NOT start with 'http' OR '/'
  return content
    .replace(/src="(?!(http)|(\/))/g, `src="${imgRelativePath}/`)
    .replace(/\]\((?!(http)|(\/))/g, `](${imgRelativePath}/`);
}

module.exports = {
  getMdFile,
  readPublicDir,
  readPublicDirMd,
  isDirectory,
  parseMd,
};
