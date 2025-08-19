// js/views/login.js
import DB from '../db.js';
import { setSession } from '../session.js';

export function renderLogin(root, ctx = {}){
  const div = document.createElement('div');
  div.className = 'box login';
  div.innerHTML = `
    <div class="small muted">┌─ register or login to</div>
    <div class="logo">ascii.fm</div>
    <div class="small muted">└──────────────────────</div>
    <div class="sep"></div>
    <form id="registerForm" class="stack" autocomplete="off">
      <label>username
        <input required minlength="2" maxlength="24" id="regName" class="field" placeholder="e.g. moonbeam" />
      </label>
      <label>email
        <input required type="email" id="regEmail" class="field" placeholder="e.g. you@email.com" />
      </label>
      <label>password
        <input required minlength="6" maxlength="64" id="regPass" class="field" type="password" placeholder="password" />
      </label>
      <div class="hstack">
        <button class="btn" type="submit">[ register ]</button>
        <button class="btn btn-ghost" id="showLoginBtn" type="button">[ login ]</button>
      </div>
      <div class="muted small" id="regMsg">${DB.isRemote ? 'Synced with Supabase. ' : ''}Register to access content.</div>
    </form>
    <form id="loginForm" class="stack" autocomplete="off" style="display:none">
      <label>email
        <input required type="email" id="loginEmail" class="field" placeholder="your@email.com" />
      </label>
      <label>password
        <input required minlength="6" maxlength="64" id="loginPass" class="field" type="password" placeholder="password" />
      </label>
      <div class="hstack">
        <button class="btn" type="submit">[ login ]</button>
        <button class="btn btn-ghost" id="showRegBtn" type="button">[ register ]</button>
      </div>
      <div class="muted small" id="loginMsg">${DB.isRemote ? 'Synced with Supabase. ' : ''}Login to access content.</div>
    </form>
  `;
  root.appendChild(div);

  // Toggle forms
  div.querySelector('#showLoginBtn').onclick = () => {
    div.querySelector('#registerForm').style.display = 'none';
    div.querySelector('#loginForm').style.display = '';
  };
  div.querySelector('#showRegBtn').onclick = () => {
    div.querySelector('#registerForm').style.display = '';
    div.querySelector('#loginForm').style.display = 'none';
  };

  // Register
  div.querySelector('#registerForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = div.querySelector('#regName').value.trim();
    const email = div.querySelector('#regEmail').value.trim();
    const pass = div.querySelector('#regPass').value;
    if (!name || !email || !pass) return;
    div.querySelector('#regMsg').textContent = 'Registering...';
    try {
      let u;
      if (DB.isRemote && DB.supabase) {
        const { data, error } = await DB.supabase.auth.signUp({ email, password: pass, options: { data: { name } } });
        if (error) throw error;
        const userId = data.session?.user?.id || data.user?.id;
        u = { id: userId, name, email };
        await DB.ensureUser(name);
        setSession({ userId: u.id });
        await DB.refresh();
        ctx.onAuthed && ctx.onAuthed();
      } else {
        u = await DB.ensureUser(name, email, pass);
        setSession({ userId: u.id });
        await DB.refresh();
        ctx.onAuthed && ctx.onAuthed();
      }
    } catch (err) {
      div.querySelector('#regMsg').textContent = 'Registration failed: ' + (err.message || err);
    }
  });

  // Login
  div.querySelector('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = div.querySelector('#loginEmail').value.trim();
    const pass = div.querySelector('#loginPass').value;
    if (!email || !pass) return;
    div.querySelector('#loginMsg').textContent = 'Logging in...';
    try {
      let u;
      if (DB.isRemote && DB.supabase) {
        const { data, error } = await DB.supabase.auth.signInWithPassword({ email, password: pass });
        if (error) throw error;
        const userId = data.session?.user?.id || data.user?.id;
        u = { id: userId, email };
        setSession({ userId: u.id });
        await DB.refresh();
        ctx.onAuthed && ctx.onAuthed();
      } else {
        u = await DB.loginUser(email, pass);
        if (!u) throw new Error('Invalid credentials');
        setSession({ userId: u.id });
        await DB.refresh();
        ctx.onAuthed && ctx.onAuthed();
      }
    } catch (err) {
      div.querySelector('#loginMsg').textContent = 'Login failed: ' + (err.message || err);
    }
  });

  div.querySelector('#regName').focus();
}