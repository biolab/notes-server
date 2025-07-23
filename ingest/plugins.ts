import {visit} from "unist-util-visit";
import dictJson from "../i18n/dict.json";

const dict: Record<string, any> = dictJson;

const replacements = {
    " -- ": " — ",
    " ...": " …"
};

export const replacer = ({language, extra_replacements}: {language: string, extra_replacements?: [string, string][]}) => () => (tree: any) => {
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
