import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';

const DeferredGlobalCallListener = React.lazy(() =>
 import("@/components/calling/GlobalCallListener").then((module) => ({
 default: module.GlobalCallListener,
 }))
);

export const MobileLayout = () => {
 return (
 <>
 <Suspense fallback={null}>
 <DeferredGlobalCallListener />
 </Suspense>
 <Outlet />
 </>
 );
};
