'use strict';
// the same spoken time the pages use, for the server's own messages
function timeWords(t){if(t==null||t==="")return "";let h,m;if(typeof t==="number"){h=Math.floor(t/60);m=t%60}else{const x=String(t).match(/(\d{1,2}):(\d{2})/);if(!x)return String(t);h=+x[1];m=+x[2]}
  // a time is said the way people say it, quarter past one or half past nine, never with a colon. Early morning and evening say so.
  h=((h%24)+24)%24;if(m===0&&h===12)return "noon";if(m===0&&h===0)return "midnight";
  const N=["twelve","one","two","three","four","five","six","seven","eight","nine","ten","eleven"],M=["","one","two","three","four","five","six","seven","eight","nine","ten","eleven","twelve","thirteen","fourteen","quarter","sixteen","seventeen","eighteen","nineteen","twenty"];
  const mw=n=>(n<=20?M[n]:"twenty-"+M[n-20])+(n%5===0||n===15?"":n===1?" minute":" minutes");
  const t2=m===0?N[h%12]+" o'clock":m===30?"half past "+N[h%12]:m<30?mw(m)+" past "+N[h%12]:mw(60-m)+" to "+N[(h+1)%12];
  return t2+(h<7?" in the morning":h>=18?" in the evening":"")}
module.exports = timeWords;
