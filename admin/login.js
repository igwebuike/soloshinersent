const loginForm = document.querySelector('#login-form');
const loginError = document.querySelector('#login-error');
const submitButton = loginForm.querySelector('button[type="submit"]');

loginForm.addEventListener('submit', async event => {
  event.preventDefault();
  loginError.hidden = true;
  submitButton.disabled = true;
  submitButton.textContent = 'Signing you in…';
  const form = new FormData(loginForm);
  try {
    const response = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: form.get('email'), password: form.get('password') }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'We could not sign you in. Please try again.');
    window.location.assign('/admin');
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
    submitButton.disabled = false;
    submitButton.innerHTML = 'Sign in to your studio <span aria-hidden="true">↗</span>';
  }
});
