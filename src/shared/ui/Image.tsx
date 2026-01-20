import { Media } from "reactstrap";
import { ImageProps } from "../../entities/CoreComponents";

export const Image: React.FC<ImageProps> = (props) => {
    return <Media {...props} alt={props.alt ? props.alt : "image"} loading="lazy" />;
};  

