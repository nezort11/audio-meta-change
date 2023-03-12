import eruda from "eruda";
// @ts-expect-error no types
import erudaCode from "eruda-code";
// @ts-expect-error no types
import erudaDom from "eruda-dom";

eruda.init();
eruda.add(erudaCode);
eruda.add(erudaDom);

export default eruda;
