// Display adaptations only. The finalized question data is never mutated.
export const readingWords = Object.freeze({Q07:'受付',Q08:'改札',Q09:'道具'});
export const readingInstruction = 'Choose the correct reading of the underlined word.';
export function splitMaterialTable(material) {
  const lines=material.split('\n'),start=lines.findIndex(line=>line.startsWith('┌'));
  if(start<0)return null;
  const end=lines.findIndex((line,i)=>i>start&&line.startsWith('└'));
  if(end<0)return null;
  const rows=lines.slice(start,end+1).filter(line=>line.startsWith('│')).map(line=>line.split('│').slice(1,-1).map(cell=>cell.trim()));
  if(rows.length<2||rows.some(row=>row.length!==rows[0].length))return null;
  return {before:lines.slice(0,start).join('\n'),headers:rows[0],rows:rows.slice(1),after:lines.slice(end+1).join('\n')};
}

// Presentation widths prioritize short identifiers/prices and longer comparison fields.
export const readingTableWidths=Object.freeze({Q45:[32,44,24],Q46:[8,23,26,13,30],Q47:[29,12,23,36],Q48:[8,92],Q49:[36,22,42],Q50:[26,23,13,38]});

