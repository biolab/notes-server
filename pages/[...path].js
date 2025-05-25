import { Book } from "../components/Book/Book";
import {getMdFile, isDirectory, readPublicDir} from "../utils/helpers";
import {Collection} from "../components/Collection/Collection";
import {getBookProps} from "../utils/getBookProps";
import {getCollectionProps} from "../utils/getCollectionProps";
import React from "react";

export const getStaticPaths = async () => {
  const getPaths = (path) => readPublicDir(...path)
    .filter((entry) => entry !== "_chapters" && isDirectory(...path, entry))
    .flatMap((entry) => {
      const newPath = [...path, entry];
      const indexFile = getMdFile([...newPath]);
      const collectionFile = getMdFile([...newPath], "collection");
      if (indexFile && collectionFile) {
        throw new Error(`Both index and collection files exist for ${newPath.join("/")}`);
      }
      return [
        ...(indexFile || collectionFile ? [{params: {path: newPath}}] : []),
        ...(!indexFile ? getPaths(newPath) : [])
      ]
    });

  return {
    paths: getPaths([]),
    fallback: false
  }
}

export const getStaticProps = async ({ params: { path } }) => {
  return getMdFile(path)
    ? {...await getBookProps(path)}
    : await getCollectionProps(path);
}

const CollectionOrBook = (props) => {
  React.useEffect(() => {
    document.title = props.frontmatter.title;
  }, [props.frontmatter.title]);

  return props.chapters === undefined
    ? <Collection {...props} />
    : <Book {...props} />;
}

export default CollectionOrBook;