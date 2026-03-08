import { Fragment } from "react";
import { CardHeader } from "reactstrap";
import { CardHeaderProp } from "../../domain-model/CoreComponents";

function renderSpanContent(span: CardHeaderProp["span"]) {
  if (!span) {
    return null;
  }

  return span.map((data, index) => (
    <Fragment key={index}>
      {data?.text} {data.code && <code>{data.code}</code>} {data.mark && <mark>{data.mark}</mark>}
    </Fragment>
  ));
}

const CommonCardHeader: React.FC<CardHeaderProp> = ({ title, span, headClass, icon, tagClass, tag }) => {
  const content = renderSpanContent(span);

  return (
    <CardHeader className={headClass || "pb-0"}>
      <h4 className={tagClass || ""}>
        {icon && icon}
        {title}
      </h4>
      {span &&
        (tag ? (
          <span>{content}</span>
        ) : (
          <p className="f-m-light mt-1">{content}</p>
        ))}
    </CardHeader>
  );
};

export default CommonCardHeader;
