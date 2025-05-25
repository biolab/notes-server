import {visit} from "unist-util-visit";
import dict from "../i18n/dict.json";

const replacements = {
    " -- ": " — ",
    " ...": " …"
};

export const replacer = ({language, extra_replacements}) => () => (tree) => {
    const all_replacements =
      Object.entries({...replacements,
                      ...(dict[language]?.["text-replacements"] || {}),
                      ...(extra_replacements || {})})
      .map(([k, v]) => [k.startsWith("/") && k.endsWith("/") ? new RegExp(k.slice(1, -1), "g") : k, v]);
    visit(tree, 'text', textNode => {
        textNode.value = all_replacements.reduce(
            (value, repl) => value.replaceAll(...repl),
            textNode.value); })
}
