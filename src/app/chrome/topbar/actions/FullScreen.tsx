import { useState } from "react";
import { NavLink } from 'reactstrap';
import { Maximize } from 'react-feather';
import { Href } from '../../../../theme-constants';

async function toggleFullscreen(enabled: boolean) {
  if (enabled) {
    await document.documentElement.requestFullscreen();
    return;
  }
  if (document.fullscreenElement) {
    await document.exitFullscreen();
  }
}

const FullScreen = () => {
    const [isFullscreen, setIsFullscreen] = useState(false);
    const fullScreenHandler = (nextFullscreen: boolean) => {
        setIsFullscreen(nextFullscreen);
        void toggleFullscreen(nextFullscreen);
    };

    return (
        <li onClick={() => fullScreenHandler(!isFullscreen)}>
            <NavLink href={Href}>
                <Maximize className="svg-color" />
            </NavLink>
        </li>
    );
};

export default FullScreen;
