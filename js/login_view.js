import { $ } from './utils.js';
import { setGuestMode, setSession, clearSession } from './session.js';

export function renderLogin(root, DB, render) {
  const banner = document.getElementById('ascii-banner');
  if (banner) banner.style.display = 'none';
  document.body.classList.remove('show-header');

  const div = document.createElement('div');
  div.className = 'login login-fadein';
  div.style.display = 'flex';
  div.style.flexDirection = 'column';
  div.style.alignItems = 'center';
  div.style.justifyContent = 'center';
  div.style.minHeight = '70vh';
  div.innerHTML = `
    <div style="display:inline-block; text-align:center;">
  <img src="/logo_white_no_bg.png" alt="Logo" class="login-logo-anim" style="display:block; margin:0 auto 10px auto; width:64px; height:64px; object-fit:contain;" />
      <div class="small muted" style="margin-bottom:2px;">┌─ login or register to</div>
      <div class="logo" style="margin:0 auto;">tunedIn.space</div>
      <div class="small muted" style="margin-bottom:12px;">└──────────────────────</div>
      <form id="loginForm" class="stack" autocomplete="off" style="max-width:340px; margin:0 auto; text-align:center;">
        <div class="title" style="margin-bottom:8px;">Music & community that you care about.</div>
        <div style="margin:0 auto 8px auto; max-width:320px;">
          <input required type="email" id="loginEmail" class="field" placeholder="Email" style="width:100%; margin-top:2px; text-align:center;" />
        </div>
        <div style="margin:0 auto 8px auto; max-width:320px;">
          <input required minlength="6" maxlength="64" id="loginPass" class="field" type="password" placeholder="Password" style="width:100%; margin-top:2px; text-align:center;" />
        </div>
        <button class="btn" type="submit" style="margin-top:8px; width:100%;">[ sign in ]</button>
        <div style="margin-top:8px; text-align:center;">
          <a href="#" id="showRegister" class="muted small" style="text-decoration:underline;">Don't have an account? Create one</a>
        </div>
  <div class="muted small" id="loginMsg" style="min-height:18px;">${DB.isRemote ? 'Sign in to be able to post content,<br>' : ''}or use guest mode below.</div>
      </form>
      <form id="registerForm" class="stack" autocomplete="off" style="display:none; max-width:340px; margin:0 auto; text-align:center;">
        <div class="title" style="margin-bottom:8px;">Create an account</div>
        <label style="display:block; text-align:left; margin:0 auto 8px auto; max-width:320px;">Username
          <input required minlength="2" maxlength="24" id="regName" class="field" placeholder="e.g. moonbeam" style="width:100%; margin-top:2px;" />
        </label>
        <label style="display:block; text-align:left; margin:0 auto 8px auto; max-width:320px;">Email
          <input required type="email" id="regEmail" class="field" placeholder="e.g. you@email.com" style="width:100%; margin-top:2px;" />
        </label>
        <label style="display:block; text-align:left; margin:0 auto 8px auto; max-width:320px;">Password
          <input required minlength="6" maxlength="64" id="regPass" class="field" type="password" placeholder="password" style="width:100%; margin-top:2px;" />
        </label>
        <button class="btn" type="submit" style="margin-top:8px; width:100%;">[ create account ]</button>
        <div style="margin-top:8px; text-align:center;">
          <a href="#" id="showLogin" class="muted small" style="text-decoration:underline;">Already have an account? Sign in</a>
        </div>
        <div class="muted small" id="regMsg" style="min-height:18px;">${DB.isRemote ? 'Register to post.  ' : ''}Or view in guest mode.</div>
      </form>
      <div class="sep"></div>
      <div class="hstack" style="justify-content:center; margin-top:8px;">
        <button class="btn btn-ghost" id="guestBtn" type="button">[ continue as guest ]</button>
      </div>
    </div>
  `;
  root.appendChild(div);

  function showLoginForm() {
    $('#loginForm').style.display = '';
    $('#registerForm').style.display = 'none';
    $('#loginEmail').focus();
  }
  function showRegisterForm() {
    $('#loginForm').style.display = 'none';
    $('#registerForm').style.display = '';
    $('#regName').focus();
  }
  $('#showLogin').onclick = (e) => { e.preventDefault(); showLoginForm(); };
  $('#showRegister').onclick = (e) => { e.preventDefault(); showRegisterForm(); };

  $('#guestBtn').onclick = () => {
    setGuestMode(true);
    render();
  };

  // Register
  $('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = $('#regName').value.trim();
    const email = $('#regEmail').value.trim();
    const pass = $('#regPass').value;
    if (!name || !email || !pass) return;
    $('#regMsg').textContent = 'Registering...';
    try {
      let u;
      if (DB.isRemote && DB.supabase) {
        const { data, error } = await DB.supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
        if (error) throw error;
        const userId = data.session?.user?.id || data.user?.id;
        u = { id: userId, name, email };
        await DB.ensureUser(name);
        setSession({ userId: u.id });
        setGuestMode(false);
        await DB.refresh();
        render();
      } else {
        u = await DB.ensureUser(name, email, pass);
        setSession({ userId: u.id });
        setGuestMode(false);
        await DB.refresh();
        render();
      }
    } catch (err) {
      $('#regMsg').textContent = 'Registration failed: ' + (err.message || err);
    }
  });

  // Login
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#loginEmail').value.trim();
    const pass = $('#loginPass').value;
    if (!email || !pass) return;
    $('#loginMsg').textContent = 'Logging in...';
    try {
      let u;
      if (DB.isRemote && DB.supabase) {
        const { data, error } = await DB.supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        const userId = data.session?.user?.id || data.user?.id;
        u = { id: userId, email };
        setSession({ userId: u.id });
        setGuestMode(false);
        await DB.refresh();
        render();
      } else {
        u = await DB.loginUser(email, pass);
        if (!u) throw new Error('Invalid credentials');
        setSession({ userId: u.id });
        setGuestMode(false);
        await DB.refresh();
        render();
      }
    } catch (err) {
      $('#loginMsg').textContent = 'Login failed: ' + (err.message || err);
    }
  });

  showLoginForm();
}