import { Fragment } from "react";
import { CardHeader, Button } from "reactstrap";
import { CardHeaderProp } from "../../entities/CoreComponents";

interface ExtendedCardHeaderProps extends CardHeaderProp {
  onInviteClick?: () => void;
  inviteLabel?: string;
}

const CommonCardHeader: React.FC<ExtendedCardHeaderProps> = ({
  title,
  span,
  headClass,
  icon,
  tagClass,
  tag,
  onInviteClick,
  inviteLabel = "Invite Users",
}) => {
  return (
    <CardHeader className={`${headClass || "pb-0"} d-flex justify-content-between align-items-start`}>
      <div>
        <h4 className={tagClass || ""}>
          {icon && icon}
          {title}
        </h4>
        {span &&
          (tag ? (
            <span>
              {span.map((data, index) => (
                <Fragment key={index}>
                  {data?.text} {data.code && <code>{data.code}</code>}{" "}
                  {data.mark && <mark>{data.mark}</mark>}
                </Fragment>
              ))}
            </span>
          ) : (
            <p className="f-m-light mt-1">
              {span.map((data, index) => (
                <Fragment key={index}>
                  {data?.text} {data.code && <code>{data.code}</code>}{" "}
                  {data.mark && <mark>{data.mark}</mark>}
                </Fragment>
              ))}
            </p>
          ))}
      </div>
      {onInviteClick && (
        <Button color="primary" onClick={onInviteClick}>
          {inviteLabel}
        </Button>
      )}
    </CardHeader>
  );
};

export default CommonCardHeader;
