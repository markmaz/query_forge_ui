import { useEffect, useState } from "react";
import { ChevronsUp } from "react-feather";

const TapTop = () => {
  const [isVisible, setIsVisible] = useState(false);

  const executeScroll = () => window.scrollTo({ top: 0, left: 0, behavior: "smooth" });

  useEffect(() => {
    const handleScroll = () => setIsVisible(window.scrollY > 0);
    window.addEventListener("scroll", handleScroll);
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <div className="tap-top" style={{ display: isVisible ? "block" : "none" }}>
      <ChevronsUp onClick={executeScroll} />
    </div>
  );
};

export default TapTop;
