
// Animated rotating prompts for login screen, copied from compose section
const loginPrompts = [
	'> so what song has been stuck in your head lately?',
	'> share a track that made your day better!',
	'> what have you been looping non-stop?',
	'> found a hidden gem? drop it here!',
	'> what tune do you want everyone to hear right now?'
];

let loginPromptIndex = 0;
let loginPromptChar = 0;
let loginPromptTimeout = null;
let loginPromptErase = false;

function animateLoginPrompt() {
	const el = document.getElementById('loginAnimatedPrompt');
	if (!el) return;
	const prompt = loginPrompts[loginPromptIndex];
	if (!loginPromptErase) {
		// Typing
		loginPromptChar++;
		el.textContent = prompt.slice(0, loginPromptChar);
		if (loginPromptChar < prompt.length) {
			loginPromptTimeout = setTimeout(animateLoginPrompt, 28 + Math.random() * 32);
		} else {
			loginPromptErase = true;
			loginPromptTimeout = setTimeout(animateLoginPrompt, 1200);
		}
	} else {
		// Erasing
		loginPromptChar--;
		el.textContent = prompt.slice(0, loginPromptChar);
		if (loginPromptChar > 0) {
			loginPromptTimeout = setTimeout(animateLoginPrompt, 16 + Math.random() * 24);
		} else {
			loginPromptErase = false;
			loginPromptIndex = (loginPromptIndex + 1) % loginPrompts.length;
			loginPromptTimeout = setTimeout(animateLoginPrompt, 300);
		}
	}
}

export function startLoginPromptAnimation() {
	loginPromptIndex = Math.floor(Math.random() * loginPrompts.length);
	loginPromptChar = 0;
	loginPromptErase = false;
	clearTimeout(loginPromptTimeout);
	animateLoginPrompt();
}

export function stopLoginPromptAnimation() {
	clearTimeout(loginPromptTimeout);
}
