import React from "react";

interface HeadingProps {
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  children: React.ReactNode;
}

const Heading: React.FC<HeadingProps> = ({ level = 1, children }) => {
  const Tag = `h${level}` as keyof JSX.IntrinsicElements;
  return <Tag className={`ui-heading ui-heading--${level}`}>{children}</Tag>;
};

export default Heading;