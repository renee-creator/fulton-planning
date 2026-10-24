'use strict';
// the same clock time the pages use, 1:15 pm or 9:00 am, for the server's own messages
function clockTime(t){if(t==null||t==="")return "";let h,m;if(typeof t==="number"){h=Math.floor(t/60);m=t%60}else{const x=String(t).match(/(\d{1,2}):(\d{2})/);if(!x)return String(t);h=+x[1];m=+x[2]}
  // a time is a plain clock time, 1:15 pm or 9:00 am, the same on every page, print and reminder
  h=((h%24)+24)%24;return (h%12||12)+":"+String(m).padStart(2,"0")+(h<12?" am":" pm")}
module.exports = clockTime;
