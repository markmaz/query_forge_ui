import React from "react";
import { Table } from "reactstrap";
import "./StyledTable.css";

interface StyledTableProps {
  children: React.ReactNode;
}

const StyledTable: React.FC<StyledTableProps> = ({ children }) => {
  return <Table responsive className="styled-table">{children}</Table>;
};

export default StyledTable;
