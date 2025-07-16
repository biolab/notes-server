/* eslint-disable @next/next/no-img-element */
import NextImage from "next/image";

// TODO Remove this, if it will be deployed on Vercel
// This is needed to make NextImage work on GH pages
// Opt-out of image optimization
const customLoader = ({ src }) => {
  return src;
};

export default function Image(props) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { blurWidth, blurHeight, placeholder, blurDataURL, ...safeProps } =
    props;
  if (!(props.width && props.height)) {
    return <img {...safeProps} alt={safeProps.alt || ""} />;
  }
  return <NextImage {...safeProps} loader={customLoader} />;
}
