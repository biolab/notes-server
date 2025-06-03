import MdxContent from "@/components/MdxContent";
import { getBookProps } from "@/utils/getBookProps";

const Page = async (props: { params: { slug: string } }) => {
  const book = await getBookProps(props.params.slug);

  return (
    <div>
      <h1>{book.frontmatter.title}</h1>
      <MdxContent content={book.content} />
    </div>
  );
};

export default Page;
