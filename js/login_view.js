import { $ } from './utils.js';
import { startLoginPromptAnimation, stopLoginPromptAnimation } from './login_prompts.js';
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
  <div class="small muted" style="margin-bottom:0;">└──────────────────────</div>
  <div class="title" style="margin-bottom:8px; min-height:24px;">
        <span id="loginAnimatedPrompt"></span>
      </div>
      <form id="loginForm" class="stack" autocomplete="off" style="max-width:340px; margin:0 auto; text-align:center;">
  <input required type="email" id="loginEmail" class="field" placeholder="Email" style="width:100%; margin:0 0 8px 0; text-align:center;" />
  <input required minlength="6" maxlength="64" id="loginPass" class="field" type="password" placeholder="Password" style="width:100%; margin:0 0 8px 0; text-align:center;" />
        <button class="btn" type="submit" style="margin-top:8px; width:100%;">[ sign in ]</button>
        <div style="margin-top:8px; text-align:center;">
          <a href="#" id="showRegister" class="muted small" style="text-decoration:underline;">Don't have an account? Create one</a>
        </div>
        <div class="muted small" id="loginMsg" style="min-height:18px;">${DB.isRemote ? 'Sign in to be able to post content,<br>' : ''}or use guest mode below.</div>
      </form>
      <div class="title" style="margin-bottom:8px; min-height:24px; display:none;" id="registerPromptTitle">
        <span id="registerAnimatedPrompt"></span>
      </div>
      <form id="registerForm" class="stack" autocomplete="off" style="display:none; max-width:340px; margin:0 auto; text-align:center;">
  <input required minlength="2" maxlength="24" id="regName" class="field" placeholder="Username" style="width:100%; margin-bottom:8px; text-align:center;" />
  <input required type="email" id="regEmail" class="field" placeholder="Email" style="width:100%; margin-bottom:8px; text-align:center;" />
  <input required minlength="6" maxlength="64" id="regPass" class="field" type="password" placeholder="Password" style="width:100%; margin-bottom:8px; text-align:center;" />
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
  // Start animated prompt
  setTimeout(startLoginPromptAnimation, 0);

  root.appendChild(div);

  let registerPromptInterval = null;
  function showLoginForm() {
    $('#loginForm').style.display = '';
    $('#registerForm').style.display = 'none';
    $('#registerPromptTitle').style.display = 'none';
    $('#loginEmail').focus();
    setTimeout(startLoginPromptAnimation, 0);
    if (registerPromptInterval) {
      clearInterval(registerPromptInterval);
      registerPromptInterval = null;
    }
    const regEl = document.getElementById('registerAnimatedPrompt');
    if (regEl) regEl.textContent = '';
  }
  function showRegisterForm() {
    $('#loginForm').style.display = 'none';
    $('#registerForm').style.display = '';
    $('#registerPromptTitle').style.display = '';
    $('#regName').focus();
    stopLoginPromptAnimation();
    const loginEl = document.getElementById('loginAnimatedPrompt');
    if (loginEl) loginEl.textContent = '';
    // Animate the same prompts in register form
    const prompts = [
      '> so what song has been stuck in your head lately?',
      '> share a track that made your day better!',
      '> what have you been looping non-stop?',
      '> found a hidden gem? drop it here!',
      '> what tune do you want everyone to hear right now?'
    ];
    let idx = Math.floor(Math.random() * prompts.length);
    let char = 0;
    let erase = false;
    const regEl = document.getElementById('registerAnimatedPrompt');
    function animate() {
      if (!regEl) return;
      const prompt = prompts[idx];
      if (!erase) {
        char++;
        regEl.textContent = prompt.slice(0, char);
        if (char < prompt.length) {
          registerPromptInterval = setTimeout(animate, 28 + Math.random() * 32);
        } else {
          erase = true;
          registerPromptInterval = setTimeout(animate, 1200);
        }
      } else {
        char--;
        regEl.textContent = prompt.slice(0, char);
        if (char > 0) {
          registerPromptInterval = setTimeout(animate, 16 + Math.random() * 24);
        } else {
          erase = false;
          idx = (idx + 1) % prompts.length;
          registerPromptInterval = setTimeout(animate, 300);
        }
      }
    }
    animate();
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