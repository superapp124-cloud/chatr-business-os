import React from 'react';
import { MetadataEngine } from './MetadataEngine';
import { Virtuoso } from 'react-virtuoso'; // Already in package.json

export interface TableEngineProps {
 entityName: string;
 viewName: string;
 data: any[];
 onRowClick?: (row: any) => void;
}

export const UniversalTableEngine: React.FC<TableEngineProps> = ({ entityName, viewName, data, onRowClick }) => {
 const viewDef = MetadataEngine.getViewDef(entityName, viewName);

 if (!viewDef) return <div>Loading table definition...</div>;

 const columns = viewDef.layout_json?.columns || [];

 return (
 <div className="w-full h-full border rounded-md">
 {/* Header */}
 <div className="flex border-b bg-muted/50 p-2 font-medium">
 {columns.map((col: any) => (
 <div key={col.name} style={{ width: col.width || '150px' }} className="px-2">
 {col.label}
 </div>
 ))}
 </div>

 {/* Virtualized Body for 100k+ rows support */}
 <div style={{ height: 'calc(100vh - 200px)' }}>
 <Virtuoso
 totalCount={data.length}
 data={data}
 itemContent={(index, row) => (
 <div 
 className="flex border-b p-2 hover:bg-muted/50 cursor-pointer"
 onClick={() => onRowClick && onRowClick(row)}
 >
 {columns.map((col: any) => (
 <div key={col.name} style={{ width: col.width || '150px' }} className="px-2 truncate">
 {row[col.name]}
 </div>
 ))}
 </div>
 )}
 />
 </div>
 </div>
 );
};
