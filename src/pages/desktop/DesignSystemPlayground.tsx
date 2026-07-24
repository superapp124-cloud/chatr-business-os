import React from 'react';
import { LayoutEngine, LayoutWidget, DensityControls } from '@/components/ui/LayoutEngine';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Table, TableHeader, TableBody, TableHead, TableRow, TableCell } from '@/components/ui/table';
import { useAdaptiveLayout, Density, WorkspacePersona } from '@/hooks/useAdaptiveLayout';
import { Sparkles, Layers, Sliders, Type, Grid, Palette, Box } from 'lucide-react';

export default function DesignSystemPlayground() {
  const [density, setDensity] = React.useState<Density | 'auto'>('auto');
  const [persona, setPersona] = React.useState<WorkspacePersona>('standard');

  return (
    <div className="min-h-screen bg-background text-foreground p-6 md:p-10 space-y-10">
      {/* Header */}
      <div className="border-b border-border pb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-tiny font-bold uppercase tracking-widest mb-1">
            <Sparkles size={14} /> CHATR Experience System (CXS) v1.0
          </div>
          <h1 className="text-display font-semibold text-white tracking-tight">Design System Playground</h1>
          <p className="text-secondary text-zinc-400 mt-1">Interactive workbench for enterprise design tokens, adaptive layouts, density, and primitives.</p>
        </div>
      </div>

      {/* CXS Control Bar */}
      <DensityControls
        currentDensity={density}
        onDensityChange={setDensity}
        currentPersona={persona}
        onPersonaChange={setPersona}
      />

      {/* Typography Scale Section */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-white flex items-center gap-2 border-b border-border pb-2">
          <Type size={18} className="text-indigo-400" /> Typography Scale (Geist + Inter + Geist Mono)
        </h2>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-display (30px / 700)</span>
            <div className="md:col-span-3 text-display text-white">The Future of Enterprise Business OS</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-page (24px / 600)</span>
            <div className="md:col-span-3 text-page text-white">Universal Intent OS Dashboard</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-workspace (20px / 600)</span>
            <div className="md:col-span-3 text-workspace text-white">TalentXcel Services Workspace</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-section (18px / 600)</span>
            <div className="md:col-span-3 text-section text-white">Active Intent Twin Pipelines</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-card (16px / 600)</span>
            <div className="md:col-span-3 text-card text-white">Sales & CRM Analytics Engine</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-button (14px / 500)</span>
            <div className="md:col-span-3 text-button text-indigo-400 font-medium">Execute Autonomous Agent →</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4 border-b border-border/50 pb-3">
            <span className="text-label text-zinc-500 font-mono">text-table (13px / Mono)</span>
            <div className="md:col-span-3 text-table font-mono text-emerald-400">KPI: $1,420,900.00 (+14.2%)</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 items-baseline gap-4">
            <span className="text-label text-zinc-500 font-mono">text-caption (12px / 400)</span>
            <div className="md:col-span-3 text-caption text-zinc-400">Last updated 2 mins ago by Autonomous Intelligence.</div>
          </div>
        </div>
      </section>

      {/* Adaptive Layout Demo */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-white flex items-center gap-2 border-b border-border pb-2">
          <Grid size={18} className="text-emerald-400" /> Adaptive Layout Engine Preview
        </h2>

        <LayoutEngine workspaceType="dashboard" density={density} persona={persona}>
          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle>Sales Pipeline</CardTitle>
              <CardDescription>Real-time revenue forecast</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-display text-emerald-400 font-mono font-bold">$2.4M</div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle>Autonomous Agents</CardTitle>
              <CardDescription>Live execution threads</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-display text-indigo-400 font-mono font-bold">14 Active</div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900/60 border-zinc-800">
            <CardHeader>
              <CardTitle>System Health</CardTitle>
              <CardDescription>Edge cluster uptime</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-display text-blue-400 font-mono font-bold">99.98%</div>
            </CardContent>
          </Card>
        </LayoutEngine>
      </section>

      {/* Standard Primitives Demo */}
      <section className="space-y-4">
        <h2 className="text-section font-semibold text-white flex items-center gap-2 border-b border-border pb-2">
          <Box size={18} className="text-purple-400" /> CXS Primitive Components Showcase
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Buttons & Inputs */}
          <Card className="bg-zinc-900/60 border-zinc-800 space-y-4 p-6">
            <h3 className="text-card font-semibold text-white">Interactive Elements</h3>
            <div className="flex flex-wrap gap-3">
              <Button variant="default">Primary Action</Button>
              <Button variant="outline">Secondary</Button>
              <Button variant="destructive">Destructive</Button>
            </div>
            <div className="space-y-2">
              <span className="text-label text-zinc-400">Input Field</span>
              <Input placeholder="Enter intent prompt..." />
            </div>
          </Card>

          {/* Table Primitive */}
          <Card className="bg-zinc-900/60 border-zinc-800 p-6">
            <h3 className="text-card font-semibold text-white mb-3">Tabular Data Primitive</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Intent ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Execution</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="font-medium text-white">INT-9041</TableCell>
                  <TableCell className="text-emerald-400">Completed</TableCell>
                  <TableCell className="text-right">120ms</TableCell>
                </TableRow>
                <TableRow>
                  <TableCell className="font-medium text-white">INT-9042</TableCell>
                  <TableCell className="text-amber-400">Running</TableCell>
                  <TableCell className="text-right">450ms</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>
    </div>
  );
}
