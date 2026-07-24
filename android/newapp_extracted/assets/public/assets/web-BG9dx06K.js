import{W as N,aB as W,aC as g}from"./index-BD5RwrQ5.js";import{L as j,a as b,_ as O,b as B,d as K,c as C,C as E,r as D,E as Y,i as q,e as M,F as H,f as V,v as J,h as Q}from"./firebase-core-oTls-BLf.js";import"./framer-motion-CYBAdf7M.js";import"./react-vendor-CFX5uzez.js";import"./ui-radix-BlpYF40o.js";import"./lucide-icons--zqaA471.js";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const I="analytics",X="firebase_id",Z="origin",ee=60*1e3,te="https://firebase.googleapis.com/v1alpha/projects/-/apps/{app-id}/webConfig",_="https://www.googletagmanager.com/gtag/js";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const d=new j("@firebase/analytics");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ne={"already-exists":"A Firebase Analytics instance with the appId {$id}  already exists. Only one Firebase Analytics instance can be created for each appId.","already-initialized":"initializeAnalytics() cannot be called again with different options than those it was initially called with. It can be called again with the same options to return the existing instance, or getAnalytics() can be used to get a reference to the already-initialized instance.","already-initialized-settings":"Firebase Analytics has already been initialized.settings() must be called before initializing any Analytics instanceor it will have no effect.","interop-component-reg-failed":"Firebase Analytics Interop Component failed to instantiate: {$reason}","invalid-analytics-context":"Firebase Analytics is not supported in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","indexeddb-unavailable":"IndexedDB unavailable or restricted in this environment. Wrap initialization of analytics in analytics.isSupported() to prevent initialization in unsupported environments. Details: {$errorInfo}","fetch-throttle":"The config fetch request timed out while in an exponential backoff state. Unix timestamp in milliseconds when fetch request throttling ends: {$throttleEndTimeMillis}.","config-fetch-failed":"Dynamic config fetch failed: [{$httpStatus}] {$responseMessage}","no-api-key":'The "apiKey" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid API key.',"no-app-id":'The "appId" field is empty in the local Firebase config. Firebase Analytics requires this field tocontain a valid app ID.',"no-client-id":'The "client_id" field is empty.',"invalid-gtag-resource":"Trusted Types detected an invalid gtag resource: {$gtagURL}."},u=new Y("analytics","Analytics",ne);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ie(e){if(!e.startsWith(_)){const t=u.create("invalid-gtag-resource",{gtagURL:e});return d.warn(t.message),""}return e}function x(e){return Promise.all(e.map(t=>t.catch(n=>n)))}function ae(e,t){let n;return window.trustedTypes&&(n=window.trustedTypes.createPolicy(e,t)),n}function se(e,t){const n=ae("firebase-js-sdk-policy",{createScriptURL:ie}),i=document.createElement("script"),a=`${_}?l=${e}&id=${t}`;i.src=n?n==null?void 0:n.createScriptURL(a):a,i.async=!0,document.head.appendChild(i)}function re(e){let t=[];return Array.isArray(window[e])?t=window[e]:window[e]=t,t}async function oe(e,t,n,i,a,s){const r=i[a];try{if(r)await t[r];else{const c=(await x(n)).find(l=>l.measurementId===a);c&&await t[c.appId]}}catch(o){d.error(o)}e("config",a,s)}async function ce(e,t,n,i,a){try{let s=[];if(a&&a.send_to){let r=a.send_to;Array.isArray(r)||(r=[r]);const o=await x(n);for(const c of r){const l=o.find(f=>f.measurementId===c),p=l&&t[l.appId];if(p)s.push(p);else{s=[];break}}}s.length===0&&(s=Object.values(t)),await Promise.all(s),e("event",i,a||{})}catch(s){d.error(s)}}function le(e,t,n,i){async function a(s,...r){try{if(s==="event"){const[o,c]=r;await ce(e,t,n,o,c)}else if(s==="config"){const[o,c]=r;await oe(e,t,n,i,o,c)}else if(s==="consent"){const[o,c]=r;e("consent",o,c)}else if(s==="get"){const[o,c,l]=r;e("get",o,c,l)}else if(s==="set"){const[o]=r;e("set",o)}else e(s,...r)}catch(o){d.error(o)}}return a}function de(e,t,n,i,a){let s=function(...r){window[i].push(arguments)};return window[a]&&typeof window[a]=="function"&&(s=window[a]),window[a]=le(s,e,t,n),{gtagCore:s,wrappedGtag:window[a]}}function ue(e){const t=window.document.getElementsByTagName("script");for(const n of Object.values(t))if(n.src&&n.src.includes(_)&&n.src.includes(e))return n;return null}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fe=30,pe=1e3;class me{constructor(t={},n=pe){this.throttleMetadata=t,this.intervalMillis=n}getThrottleMetadata(t){return this.throttleMetadata[t]}setThrottleMetadata(t,n){this.throttleMetadata[t]=n}deleteThrottleMetadata(t){delete this.throttleMetadata[t]}}const L=new me;function he(e){return new Headers({Accept:"application/json","x-goog-api-key":e})}async function ge(e){var r;const{appId:t,apiKey:n}=e,i={method:"GET",headers:he(n)},a=te.replace("{app-id}",t),s=await fetch(a,i);if(s.status!==200&&s.status!==304){let o="";try{const c=await s.json();(r=c.error)!=null&&r.message&&(o=c.error.message)}catch{}throw u.create("config-fetch-failed",{httpStatus:s.status,responseMessage:o})}return s.json()}async function ye(e,t=L,n){const{appId:i,apiKey:a,measurementId:s}=e.options;if(!i)throw u.create("no-app-id");if(!a){if(s)return{measurementId:s,appId:i};throw u.create("no-api-key")}const r=t.getThrottleMetadata(i)||{backoffCount:0,throttleEndTimeMillis:Date.now()},o=new Ie;return setTimeout(async()=>{o.abort()},ee),z({appId:i,apiKey:a,measurementId:s},r,o,t)}async function z(e,{throttleEndTimeMillis:t,backoffCount:n},i,a=L){var o;const{appId:s,measurementId:r}=e;try{await we(i,t)}catch(c){if(r)return d.warn(`Timed out fetching this Firebase app's measurement ID from the server. Falling back to the measurement ID ${r} provided in the "measurementId" field in the local Firebase config. [${c==null?void 0:c.message}]`),{appId:s,measurementId:r};throw c}try{const c=await ge(e);return a.deleteThrottleMetadata(s),c}catch(c){const l=c;if(!be(l)){if(a.deleteThrottleMetadata(s),r)return d.warn(`Failed to fetch this Firebase app's measurement ID from the server. Falling back to the measurement ID ${r} provided in the "measurementId" field in the local Firebase config. [${l==null?void 0:l.message}]`),{appId:s,measurementId:r};throw c}const p=Number((o=l==null?void 0:l.customData)==null?void 0:o.httpStatus)===503?M(n,a.intervalMillis,fe):M(n,a.intervalMillis),f={throttleEndTimeMillis:Date.now()+p,backoffCount:n+1};return a.setThrottleMetadata(s,f),d.debug(`Calling attemptFetch again in ${p} millis`),z(e,f,i,a)}}function we(e,t){return new Promise((n,i)=>{const a=Math.max(t-Date.now(),0),s=setTimeout(n,a);e.addEventListener(()=>{clearTimeout(s),i(u.create("fetch-throttle",{throttleEndTimeMillis:t}))})})}function be(e){if(!(e instanceof H)||!e.customData)return!1;const t=Number(e.customData.httpStatus);return t===429||t===500||t===503||t===504}class Ie{constructor(){this.listeners=[]}addEventListener(t){this.listeners.push(t)}abort(){this.listeners.forEach(t=>t())}}async function ve(e,t,n,i,a){if(a&&a.global){e("event",n,i);return}else{const s=await t,r={...i,send_to:s};e("event",n,r)}}async function Ae(e,t,n,i){{const a=await t;e("config",a,{update:!0,user_id:n})}}async function Te(e,t,n,i){if(i&&i.global){const a={};for(const s of Object.keys(n))a[`user_properties.${s}`]=n[s];return e("set",a),Promise.resolve()}else{const a=await t;e("config",a,{update:!0,user_properties:n})}}async function _e(e,t){const n=await e;window[`ga-disable-${n}`]=!t}let A;function U(e){A=e}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ce(){if(V())try{await J()}catch(e){return d.warn(u.create("indexeddb-unavailable",{errorInfo:e==null?void 0:e.toString()}).message),!1}else return d.warn(u.create("indexeddb-unavailable",{errorInfo:"IndexedDB is not available in this environment."}).message),!1;return!0}async function Ee(e,t,n,i,a,s,r){const o=ye(e);o.then(m=>{n[m.measurementId]=m.appId,e.options.measurementId&&m.measurementId!==e.options.measurementId&&d.warn(`The measurement ID in the local Firebase config (${e.options.measurementId}) does not match the measurement ID fetched from the server (${m.measurementId}). To ensure analytics events are always sent to the correct Analytics property, update the measurement ID field in the local config or remove it from the local config.`)}).catch(m=>d.error(m)),t.push(o);const c=Ce().then(m=>{if(m)return i.getId()}),[l,p]=await Promise.all([o,c]);ue(s)||se(s,l.measurementId),A&&(a("consent","default",A),U(void 0)),a("js",new Date);const f=(r==null?void 0:r.config)??{};return f[Z]="firebase",f.update=!0,p!=null&&(f[X]=p),a("config",l.measurementId,f),l.measurementId}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class De{constructor(t){this.app=t}_delete(){return delete h[this.app.options.appId],Promise.resolve()}}let h={},P=[];const F={};let v="dataLayer",Me="gtag",S,y,R=!1;function Pe(){const e=[];if(q()&&e.push("This is a browser extension environment."),Q()||e.push("Cookies are not available."),e.length>0){const t=e.map((i,a)=>`(${a+1}) ${i}`).join(" "),n=u.create("invalid-analytics-context",{errorInfo:t});d.warn(n.message)}}function Fe(e,t,n){Pe();const i=e.options.appId;if(!i)throw u.create("no-app-id");if(!e.options.apiKey)if(e.options.measurementId)d.warn(`The "apiKey" field is empty in the local Firebase config. This is needed to fetch the latest measurement ID for this Firebase app. Falling back to the measurement ID ${e.options.measurementId} provided in the "measurementId" field in the local Firebase config.`);else throw u.create("no-api-key");if(h[i]!=null)throw u.create("already-exists",{id:i});if(!R){re(v);const{wrappedGtag:s,gtagCore:r}=de(h,P,F,v,Me);y=s,S=r,R=!0}return h[i]=Ee(e,P,F,t,S,v,n),new De(e)}function w(e=B()){e=b(e);const t=O(e,I);return t.isInitialized()?t.getImmediate():Se(e)}function Se(e,t={}){const n=O(e,I);if(n.isInitialized()){const a=n.getImmediate();if(K(t,n.getOptions()))return a;throw u.create("already-initialized")}return n.initialize({options:t})}function Re(e,t,n){e=b(e),Ae(y,h[e.app.options.appId],t).catch(i=>d.error(i))}function G(e,t,n){e=b(e),Te(y,h[e.app.options.appId],t,n).catch(i=>d.error(i))}function $e(e,t){e=b(e),_e(h[e.app.options.appId],t).catch(n=>d.error(n))}function T(e,t,n,i){e=b(e),ve(y,h[e.app.options.appId],t,n,i).catch(a=>d.error(a))}function ke(e){y?y("consent","update",e):U(e)}const $="@firebase/analytics",k="0.10.19";function Oe(){C(new E(I,(t,{options:n})=>{const i=t.getProvider("app").getImmediate(),a=t.getProvider("installations-internal").getImmediate();return Fe(i,a,n)},"PUBLIC")),C(new E("analytics-internal",e,"PRIVATE")),D($,k),D($,k,"esm2020");function e(t){try{const n=t.getProvider(I).getImmediate();return{logEvent:(i,a,s)=>T(n,i,a,s),setUserProperties:(i,a)=>G(n,i,a)}}catch(n){throw u.create("interop-component-reg-failed",{reason:n})}}}Oe();class We extends N{async getAppInstanceId(){throw this.unimplemented("Not implemented on web.")}async setConsent(t){const n=t.status===W.Granted?"granted":"denied",i={};switch(t.type){case g.AdPersonalization:i.ad_personalization=n;break;case g.AdStorage:i.ad_storage=n;break;case g.AdUserData:i.ad_user_data=n;break;case g.AnalyticsStorage:i.analytics_storage=n;break;case g.FunctionalityStorage:i.functionality_storage=n;break;case g.PersonalizationStorage:i.personalization_storage=n;break}ke(i)}async setUserId(t){const n=w();Re(n,t.userId)}async setUserProperty(t){const n=w();G(n,{[t.key]:t.value})}async setCurrentScreen(t){const n=w();T(n,"screen_view",{firebase_screen:t.screenName||void 0,firebase_screen_class:t.screenClassOverride||void 0})}async logEvent(t){const n=w();T(n,t.name,t.params)}async setSessionTimeoutDuration(t){throw this.unimplemented("Not implemented on web.")}async setEnabled(t){const n=w();$e(n,t.enabled)}async isEnabled(){return{enabled:window["ga-disable-analyticsId"]===!0}}async resetAnalyticsData(){throw this.unimplemented("Not implemented on web.")}async initiateOnDeviceConversionMeasurementWithEmailAddress(t){throw this.unimplemented("Not implemented on web.")}async initiateOnDeviceConversionMeasurementWithPhoneNumber(t){throw this.unimplemented("Not implemented on web.")}async initiateOnDeviceConversionMeasurementWithHashedEmailAddress(t){throw this.unimplemented("Not implemented on web.")}async initiateOnDeviceConversionMeasurementWithHashedPhoneNumber(t){throw this.unimplemented("Not implemented on web.")}}export{We as FirebaseAnalyticsWeb};
