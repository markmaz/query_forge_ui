import React from 'react';
import type { LogicMode } from '../../model/types';

export const LogicBar: React.FC<{ value: LogicMode; onChange: (m: LogicMode) => void }> = ({ value, onChange }) => {
  return (
    <div className="card shadow-sm">
      <div className="card-body">
        <div className="form-check">
          <input className="form-check-input" type="radio" id="logic-all" checked={value==='all'} onChange={() => onChange('all')} />
          <label className="form-check-label" htmlFor="logic-all">Must match <strong>ALL</strong> filters</label>
        </div>
        <div className="form-check mt-2">
          <input className="form-check-input" type="radio" id="logic-any" checked={value==='any'} onChange={() => onChange('any')} />
          <label className="form-check-label" htmlFor="logic-any">Must match <strong>ANY</strong> filter</label>
        </div>
      </div>
    </div>
  );
};
