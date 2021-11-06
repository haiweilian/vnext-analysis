/**
 * isOn
 */
const onRE = /^on[^a-z]/;
export const isOn = (key: string) => onRE.test(key);
console.log(isOn("change"));
console.log(isOn("onClick"));
console.log(isOn("onChange"));
