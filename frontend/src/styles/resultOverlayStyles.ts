import type { CSSProperties } from 'react';

export const resultOverlayStyle: CSSProperties = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%,-50%)',
  background: 'rgba(0,0,0,0.85)',
  color: '#fff',
  borderRadius: '8px',
  padding: '20px',
  minWidth: '320px',
  zIndex: 100,
};

export const resultHeaderStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '14px',
};

export const resultTitleStyle: CSSProperties = {
  fontSize: '1.1em',
  fontWeight: 'bold',
  letterSpacing: '0.04em',
};

export const resultDismissButtonStyle: CSSProperties = {
  background: 'none',
  border: '1px solid #888',
  color: '#ccc',
  padding: '3px 10px',
  cursor: 'pointer',
  borderRadius: '4px',
  fontSize: '0.9em',
};

export const resultTableStyle: CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
};

export const resultHeadRowStyle: CSSProperties = {
  borderBottom: '1px solid #555',
  color: '#aaa',
  fontSize: '0.85em',
};

export const resultHeaderCellStyle: CSSProperties = {
  padding: '4px 10px',
  textAlign: 'left',
  fontWeight: 'normal',
};

export const resultDataCellStyle: CSSProperties = {
  padding: '6px 10px',
};
