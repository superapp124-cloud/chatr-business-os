import{j as t}from"./framer-motion-Dhh0nONF.js";import{u as n,C as i}from"./index-DZVCP-1o.js";import"./react-vendor-CFX5uzez.js";import"./ui-radix-DusOh_9w.js";import"./lucide-icons-CYHCfOAF.js";function p(){const{isConnected:e,connectionState:s,isEnabled:o}=n();return i.isNativePlatform()||!o||e?null:t.jsxs("div",{style:{position:"fixed",top:0,left:0,right:0,height:"28px",zIndex:1e3,display:"flex",alignItems:"center",justifyContent:"center",gap:"6px",fontSize:"12px",fontWeight:600,background:"#FF8F00",color:"#fff",transition:"all 0.3s ease-in-out",animation:"slideDown 0.3s ease-out"},children:[t.jsx("span",{style:{width:6,height:6,borderRadius:"50%",background:"#fff",boxShadow:"0 0 4px #fff",opacity:.9,flexShrink:0,animation:"pulse 1s infinite"}}),"Reconnecting...",t.jsx("style",{children:`
        @keyframes pulse {
          0% { transform: scale(1); opacity: 0.9; }
          50% { transform: scale(1.3); opacity: 0.5; }
          100% { transform: scale(1); opacity: 0.9; }
        }
        @keyframes slideDown {
          from { transform: translateY(-100%); }
          to { transform: translateY(0); }
        }
      `})]})}export{p as SocketStatusIndicator};
