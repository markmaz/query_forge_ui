import { Media } from "reactstrap";
import { ImageProps } from "../../domain-model/CoreComponents";

export const Image: React.FC<ImageProps> = (props) => {
  const alt = props.alt || "image";
  return <Media {...props} alt={alt} loading="lazy" />;
};

