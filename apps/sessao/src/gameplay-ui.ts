export function node<K extends keyof HTMLElementTagNameMap>(tag:K,text = '') {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}
