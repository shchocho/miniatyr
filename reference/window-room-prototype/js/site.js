// Miniatyr — page behaviour that does not need WebGL: the theme switch, "add to enquiry", and the order form's checks.
const root = document.documentElement;

/* ---------- theme ---------- */
const toggle = document.querySelector('.theme-toggle');
function showTheme() {
  const dark = root.getAttribute('data-theme') === 'dark';
  toggle.textContent = dark ? '밝은 화면' : '어두운 화면';
  toggle.setAttribute('aria-pressed', String(dark));
}
toggle.addEventListener('click', () => {
  const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  root.setAttribute('data-theme', next);
  try { localStorage.setItem('miniatyr-theme', next); } catch (e) { /* private window: the choice lasts for this visit */ }
  showTheme();
});
showTheme();

/* ---------- collection: put a piece into the enquiry form ---------- */
const form = document.getElementById('order-form');
const piece = form.elements.piece;
const status = document.getElementById('form-status');
document.querySelectorAll('[data-pick]').forEach((btn) => btn.addEventListener('click', () => {
  piece.value = btn.dataset.pick;
  clearError(piece);
  status.textContent = `${btn.dataset.pick}을(를) 문의에 담았습니다.`;
  document.getElementById('order').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  form.elements.name.focus({ preventScroll: true });
}));

/* ---------- order form: checked on submit, each reason under its own field ---------- */
const checks = {
  name: (v) => v.trim().length > 0,
  email: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
  piece: (v) => v !== '',
  quantity: (v) => /^[1-9]\d{0,2}$/.test(v.trim()),
};
function errorOf(field) { return document.getElementById(field.getAttribute('aria-describedby')); }
function clearError(field) { field.removeAttribute('aria-invalid'); const e = errorOf(field); if (e) e.hidden = true; }
function setError(field) { field.setAttribute('aria-invalid', 'true'); const e = errorOf(field); if (e) e.hidden = false; }

Object.keys(checks).forEach((name) => form.elements[name].addEventListener('input', () => {
  const field = form.elements[name];
  if (field.getAttribute('aria-invalid') === 'true' && checks[name](field.value)) clearError(field);
}));

form.addEventListener('submit', (event) => {
  event.preventDefault();
  const failed = Object.keys(checks).filter((name) => {
    const field = form.elements[name], ok = checks[name](field.value);
    ok ? clearError(field) : setError(field);
    return !ok;
  });
  if (failed.length) {
    status.textContent = `고칠 곳이 ${failed.length}군데 있습니다.`;
    form.elements[failed[0]].focus();
    return;
  }
  // a design draft with no server behind it: say so instead of pretending the enquiry went out
  status.textContent = `시안 페이지라 전송되지는 않습니다. 입력한 내용: ${piece.value} ${form.elements.quantity.value.trim()}개.`;
});
