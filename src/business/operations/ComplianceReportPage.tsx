import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, FileText, Loader2, ShieldCheck, FileJson, Table as TableIcon } from 'lucide-react';
// import { jsPDF } from 'jspdf'; // Assuming this is available or will be added

export default function ComplianceReport() {
 const [loading, setLoading] = useState(false);
 const [dateRange, setDateRange] = useState('30d');

 const generateReport = async (format: 'pdf' | 'csv' | 'json') => {
 setLoading(true);
 try {
 const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
 const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
 
 const { data, error } = await supabase
 .from('audit_logs')
 .select('*')
 .gte('created_at', startDate)
 .order('created_at', { ascending: false })
 .limit(1000); // Limit for demo purposes

 if (error) throw error;
 if (!data) return;

 if (format === 'json') {
 const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
 downloadBlob(blob, `compliance_audit_${new Date().toISOString().split('T')[0]}.json`);
 } else if (format === 'csv') {
 const headers = ['ID', 'Timestamp', 'Actor ID', 'Action', 'Resource Type', 'Resource ID'];
 const rows = data.map(log => [
 log.id, 
 log.created_at, 
 log.actor_id || 'system', 
 log.action, 
 log.resource_type, 
 log.resource_id || ''
 ]);
 const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
 const blob = new Blob([csvContent], { type: 'text/csv' });
 downloadBlob(blob, `compliance_audit_${new Date().toISOString().split('T')[0]}.csv`);
 } else if (format === 'pdf') {
 // Fallback for PDF if jsPDF is not installed, we'll just download a text summary
 // In a real implementation, you'd use jsPDF here
 const summary = `CHATR OS Compliance Report\nGenerated: ${new Date().toISOString()}\nPeriod: Last ${days} days\nTotal Records: ${data.length}\n\nThis is a placeholder for the PDF export feature. Please install 'jspdf' to enable full PDF rendering.`;
 const blob = new Blob([summary], { type: 'text/plain' });
 downloadBlob(blob, `compliance_report_${new Date().toISOString().split('T')[0]}.txt`);
 }
 } catch (err) {
 console.error('Error generating report:', err);
 } finally {
 setLoading(false);
 }
 };

 const downloadBlob = (blob: Blob, filename: string) => {
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 document.body.appendChild(a);
 a.click();
 document.body.removeChild(a);
 URL.revokeObjectURL(url);
 };

 return (
 <div className="min-h-screen bg-[#0a0a0f] text-white p-6">
 <div className="max-w-4xl mx-auto space-y-6">
 <div>
 <h1 className="text-page font-bold tracking-tight">Compliance & Audit</h1>
 <p className="text-secondary text-slate-400 mt-1">Export certified audit logs for security and compliance reviews.</p>
 </div>

 <Card className="bg-slate-900/60 border-slate-800">
 <CardHeader>
 <div className="flex items-center gap-3">
 <div className="p-2.5 rounded-lg bg-emerald-500/20 text-emerald-400">
 <ShieldCheck className="w-5 h-5" />
 </div>
 <div>
 <CardTitle className="text-section">Generate Audit Report</CardTitle>
 <CardDescription className="text-slate-400">Extract an immutable record of system and user activity.</CardDescription>
 </div>
 </div>
 </CardHeader>
 <CardContent className="space-y-6">
 
 <div className="space-y-3">
 <label className="text-secondary font-medium text-slate-300">Time Period</label>
 <div className="flex gap-2">
 {['7d', '30d', '90d'].map(period => (
 <button
 key={period}
 onClick={() => setDateRange(period)}
 className={`px-4 py-2 rounded-md text-secondary transition-colors ${
 dateRange === period 
 ? 'bg-blue-600 text-white' 
 : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
 }`}
 >
 Last {period.replace('d', ' Days')}
 </button>
 ))}
 </div>
 </div>

 <div className="pt-4 border-t border-slate-800">
 <label className="text-secondary font-medium text-slate-300 block mb-3">Export Format</label>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <Button 
 variant="outline" 
 className="h-24 flex flex-col gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:text-white"
 onClick={() => generateReport('pdf')}
 disabled={loading}
 >
 {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <FileText className="w-6 h-6 text-red-400" />}
 <span>Executive PDF</span>
 </Button>
 
 <Button 
 variant="outline" 
 className="h-24 flex flex-col gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:text-white"
 onClick={() => generateReport('csv')}
 disabled={loading}
 >
 {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <TableIcon className="w-6 h-6 text-emerald-400" />}
 <span>Raw Data (CSV)</span>
 </Button>
 
 <Button 
 variant="outline" 
 className="h-24 flex flex-col gap-2 bg-slate-800/50 border-slate-700 hover:bg-slate-800 hover:text-white"
 onClick={() => generateReport('json')}
 disabled={loading}
 >
 {loading ? <Loader2 className="w-6 h-6 animate-spin text-slate-400" /> : <FileJson className="w-6 h-6 text-blue-400" />}
 <span>System Import (JSON)</span>
 </Button>
 </div>
 </div>

 </CardContent>
 </Card>
 </div>
 </div>
 );
}
