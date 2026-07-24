import{j as e}from"./framer-motion-CYBAdf7M.js";import{r as i}from"./react-vendor-CFX5uzez.js";import{s as f,c as n,z as o,B as d}from"./index-BD5RwrQ5.js";import{A as w,a as L}from"./alert-BiQv5t2j.js";import{T as C,a as v,b as N,c as E}from"./tabs-mrQu2isz.js";import{x as y,by as A,R as T,bz as R,J as S}from"./lucide-icons--zqaA471.js";import"./ui-radix-BlpYF40o.js";import"./firebase-core-oTls-BLf.js";const Y=()=>{const[r,j]=i.useState(""),[c,m]=i.useState([]),[u,_]=i.useState([]),[x,p]=i.useState(!1);i.useState(""),i.useEffect(()=>{b()},[]);const b=async()=>{try{const a=["profiles","conversations","messages","user_roles","user_points","point_transactions","appointments","service_providers","payments","official_accounts","account_followers","announcements","contacts","fame_cam_posts","fame_leaderboard","brand_partnerships","brand_impressions","mini_apps","business_profiles","crm_leads","doctor_applications"],s=[];for(const t of a)try{const{count:l}=await f.from(t).select("*",{count:"exact",head:!0});s.push({table_name:t,row_count:l||0})}catch{console.log(`Skipping table ${t}`)}_(s.sort((t,l)=>t.table_name.localeCompare(l.table_name)))}catch(a){console.error("Error loading tables:",a),n.error("Failed to load tables")}},h=async a=>{if(a){p(!0);try{const{data:s,error:t}=await f.from(a).select("*").limit(100);if(t)throw t;m(s||[]),j(a),n.success(`Loaded ${(s==null?void 0:s.length)||0} rows from ${a}`)}catch(s){n.error(s.message||"Failed to load table data"),m([])}finally{p(!1)}}},g={createTable:`-- Create a new table with RLS enabled
CREATE TABLE example_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE example_table ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own data"
  ON example_table FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own data"
  ON example_table FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own data"
  ON example_table FOR UPDATE
  USING (auth.uid() = user_id);`,addColumn:`-- Add a new column to existing table
ALTER TABLE table_name 
ADD COLUMN new_column_name TEXT;

-- Add column with default value
ALTER TABLE table_name 
ADD COLUMN new_column_name TEXT DEFAULT 'default_value';`,createIndex:`-- Create an index for better query performance
CREATE INDEX idx_table_column 
ON table_name(column_name);

-- Create a unique index
CREATE UNIQUE INDEX idx_unique_email 
ON profiles(email);`,createRLS:`-- Enable RLS on existing table
ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;

-- Create basic RLS policies
CREATE POLICY "Users can view their own records"
  ON table_name FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own records"
  ON table_name FOR INSERT
  WITH CHECK (auth.uid() = user_id);`};return e.jsxs("div",{className:"p-6 space-y-6 max-w-7xl mx-auto",children:[e.jsxs("div",{children:[e.jsx("h1",{className:"text-3xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent",children:"Database Schema Manager"}),e.jsx("p",{className:"text-muted-foreground mt-1",children:"View and analyze your database structure"})]}),e.jsxs(w,{children:[e.jsx(y,{className:"h-4 w-4"}),e.jsx(L,{children:"To make schema changes, use database migrations in the Lovable Cloud dashboard or migration tool."})]}),e.jsxs(C,{defaultValue:"tables",className:"w-full",children:[e.jsxs(v,{className:"grid w-full grid-cols-2",children:[e.jsx(N,{value:"tables",children:"Tables & Data"}),e.jsx(N,{value:"templates",children:"SQL Templates"})]}),e.jsx(E,{value:"tables",className:"space-y-4",children:e.jsxs("div",{className:"grid grid-cols-1 lg:grid-cols-3 gap-6",children:[e.jsxs(o,{className:"p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("h3",{className:"font-semibold flex items-center gap-2",children:[e.jsx(A,{className:"h-4 w-4 text-primary"}),"Tables (",u.length,")"]}),e.jsx(d,{variant:"outline",size:"sm",onClick:b,children:e.jsx(T,{className:"h-4 w-4"})})]}),e.jsx("div",{className:"space-y-2 max-h-[600px] overflow-y-auto",children:u.map(a=>e.jsx("div",{className:`p-3 rounded-lg cursor-pointer transition-colors ${r===a.table_name?"bg-primary/10 border-primary":"bg-muted hover:bg-muted/80"}`,onClick:()=>h(a.table_name),children:e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsxs("div",{className:"flex items-center gap-2",children:[e.jsx(R,{className:"h-4 w-4 text-primary"}),e.jsx("span",{className:"text-sm font-medium",children:a.table_name})]}),e.jsxs("span",{className:"text-xs text-muted-foreground",children:[a.row_count," rows"]})]})},a.table_name))})]}),e.jsx("div",{className:"lg:col-span-2",children:e.jsxs(o,{className:"p-6",children:[e.jsxs("div",{className:"flex items-center justify-between mb-4",children:[e.jsxs("h3",{className:"font-semibold flex items-center gap-2",children:[e.jsx(S,{className:"h-4 w-4 text-primary"}),r?`Table: ${r}`:"Select a table to view data"]}),r&&e.jsx(d,{variant:"outline",size:"sm",onClick:()=>h(r),disabled:x,children:x?e.jsx("div",{className:"animate-spin rounded-full h-4 w-4 border-b-2 border-primary"}):e.jsx(T,{className:"h-4 w-4"})})]}),r&&c.length>0?e.jsx("div",{className:"overflow-x-auto",children:e.jsxs("table",{className:"w-full text-sm",children:[e.jsx("thead",{children:e.jsx("tr",{className:"border-b",children:Object.keys(c[0]).map(a=>e.jsx("th",{className:"text-left p-2 font-medium",children:a},a))})}),e.jsx("tbody",{children:c.map((a,s)=>e.jsx("tr",{className:"border-b hover:bg-muted/50",children:Object.values(a).map((t,l)=>e.jsx("td",{className:"p-2",children:typeof t=="object"?JSON.stringify(t):String(t||"-")},l))},s))})]})}):r?e.jsx("div",{className:"text-center py-12 text-muted-foreground",children:"No data in this table"}):e.jsx("div",{className:"text-center py-12 text-muted-foreground",children:"Select a table from the list to view its data"})]})})]})}),e.jsx(E,{value:"templates",className:"space-y-4",children:e.jsxs(o,{className:"p-6",children:[e.jsx("h3",{className:"font-semibold mb-4",children:"SQL Templates for Migrations"}),e.jsx("p",{className:"text-sm text-muted-foreground mb-4",children:"Copy these templates and use them in the migration tool or Lovable Cloud dashboard"}),e.jsx("div",{className:"space-y-4",children:Object.entries(g).map(([a,s])=>e.jsxs("div",{className:"space-y-2",children:[e.jsxs("div",{className:"flex items-center justify-between",children:[e.jsx("h4",{className:"font-medium capitalize",children:a.replace(/([A-Z])/g," $1").trim()}),e.jsx(d,{variant:"outline",size:"sm",onClick:()=>{navigator.clipboard.writeText(s),n.success("Template copied to clipboard!")},children:"Copy"})]}),e.jsx("pre",{className:"bg-muted p-4 rounded-lg overflow-x-auto text-sm",children:e.jsx("code",{children:s})})]},a))})]})})]})]})};export{Y as default};
