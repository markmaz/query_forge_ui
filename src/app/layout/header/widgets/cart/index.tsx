import SvgIcon from "../../../../../shared/ui/SvgIcon";
import { CartTitle } from "../../../../../constants";
import CartList from "./CartList";

const Cart = () => {
  return (
    <li className="onhover-dropdown">
      <div className="cart-box">
        <SvgIcon iconId="Buy" />
      </div>
      <div className="cart-dropdown onhover-show-div">
        <h6 className="f-18 mb-0 dropdown-title">{CartTitle}</h6>
        <CartList />
      </div>
    </li>
  );
};
export default Cart;
