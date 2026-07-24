import React, { useState } from 'react';
import { Search, Shield, ShieldAlert, ShieldCheck, AlertTriangle, Users, Flag, UserX } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { ReportCallerSheet } from './ReportCallerSheet';
import { hashPhoneNumber } from '@/utils/phoneHashUtil';

interface CallerIdResult {
 name: string;
 trust_score: number;
 spam_reports: number;
 opted_out: boolean;
}

export const CallerIdLookup: React.FC = () => {
 const [phone, setPhone] = useState('');
 const [result, setResult] = useState<CallerIdResult | null>(null);
 const [notFound, setNotFound] = useState(false);
 const [loading, setLoading] = useState(false);
 const [reportOpen, setReportOpen] = useState(false);

 const handleLookup = async () => {
 if (!phone.trim()) return;
 setLoading(true);
 setNotFound(false);
 setResult(null);

 try {
 const hashedPhone = await hashPhoneNumber(phone.trim());
 const { data, error } = await supabase.rpc('lookup_caller_id', { 
 p_hashed_number: hashedPhone,
 p_raw_number: phone.trim()
 });
 if (error) throw error;
 if (data && typeof data === 'object') {
 setResult(data as CallerIdResult);
 } else {
 setNotFound(true);
 }
 } catch (err) {
 console.error('[CallerIdLookup]', err);
 setNotFound(true);
 } finally {
 setLoading(false);
 }
 };

 const getLabelStyle = (score: number, reports: number, isUnknown: boolean) => {
 if (reports >= 5 || score < 30) return { label: 'Confirmed Spam', color: 'bg-red-500 text-white', icon: ShieldAlert };
 if (reports >= 2 || score < 60) return { label: 'Likely Spam', color: 'bg-orange-500 text-white', icon: AlertTriangle };
 if (isUnknown && reports === 0) return { label: 'Unknown Caller', color: 'bg-muted text-muted-foreground', icon: UserX };
 return { label: 'Verified Safe', color: 'bg-green-500 text-white', icon: ShieldCheck };
 };

 return (
 <div className="space-y-4">
 <div className="flex gap-2">
 <Input
 placeholder="Enter phone number..."
 value={phone}
 onChange={(e) => setPhone(e.target.value)}
 type="tel"
 onKeyDown={(e) => e.key === 'Enter' && handleLookup()}
 />
 <Button onClick={handleLookup} disabled={loading || !phone.trim()}>
 <Search className="w-4 h-4" />
 </Button>
 </div>

 {result && (
 <Card className="border-2">
 <CardContent className="pt-4 space-y-3">
 <div className="flex items-center justify-between">
 <div>
 <p className="text-section font-bold">
 {result.name}
 {result.opted_out && <span className="ml-2 text-label font-normal text-muted-foreground">(Name Hidden by User)</span>}
 </p>
 <p className="text-secondary text-muted-foreground">{phone}</p>
 </div>
 {(() => {
 const style = getLabelStyle(result.trust_score, result.spam_reports, result.name === 'Unknown Caller');
 const Icon = style.icon;
 return (
 <Badge className={`${style.color} px-3 py-1`}>
 <Icon className="w-3 h-3 mr-1" />
 {style.label}
 </Badge>
 );
 })()}
 </div>

 <div className="grid grid-cols-2 gap-3 text-center">
 <div className="p-2 rounded-lg bg-muted">
 <p className="text-page font-bold">{result.spam_reports}</p>
 <p className="text-label text-muted-foreground">Spam Reports</p>
 </div>
 <div className="p-2 rounded-lg bg-muted">
 <p className={`text-page font-bold ${result.trust_score < 50 ? 'text-red-500' : 'text-green-500'}`}>
 {result.trust_score}/100
 </p>
 <p className="text-label text-muted-foreground">Trust Score</p>
 </div>
 </div>

 <div className="flex gap-2">
 <Button variant="outline" size="sm" className="flex-1" onClick={() => setReportOpen(true)}>
 <Flag className="w-3 h-3 mr-1" /> Report
 </Button>
 </div>
 </CardContent>
 </Card>
 )}

 {notFound && (
 <Card>
 <CardContent className="pt-4 text-center space-y-2">
 <Users className="w-8 h-8 mx-auto text-muted-foreground" />
 <p className="text-secondary text-muted-foreground">No reports found for this number</p>
 <Button variant="outline" size="sm" onClick={() => setReportOpen(true)}>
 Be the first to report
 </Button>
 </CardContent>
 </Card>
 )}

 <ReportCallerSheet
 open={reportOpen}
 onOpenChange={setReportOpen}
 phoneNumber={phone}
 />
 </div>
 );
};

