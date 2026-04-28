export function toast(msg: string, ok = true): void {
  const el = document.createElement('div')
  el.className = `toast ${ok ? 'toast-ok' : 'toast-err'}`
  el.textContent = msg
  document.body.appendChild(el)
  requestAnimationFrame(() => el.classList.add('toast-show'))
  setTimeout(() => {
    el.classList.remove('toast-show')
    setTimeout(() => el.remove(), 300)
  }, 2600)
}
