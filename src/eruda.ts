import eruda from "eruda";
const erudaCode = require("eruda-code");
const erudaDom = require("eruda-dom");

eruda.init();
eruda.add(erudaCode);
eruda.add(erudaDom);

export default eruda;
