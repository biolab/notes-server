import NextImage from "next/image";

// Remove this, if it will be deployed on Vercel
// This is needed to make NextImage work on GH pages
// Opt-out of image optimization
const customLoader = ({ src }) => {
  return src;
};

export default function Image(props) {
  if (!(props.width && props.height)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img {...props} alt={props.alt || ""} />;
  }

  return <NextImage {...props} loader={customLoader} />;
}
