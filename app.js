/* ----------------------------------------------------
   CASH LANDING PAGE — app.js v2
   Supabase Integration • Form Validation • Admin
---------------------------------------------------- */

// ==========================================
// 1. CONFIGURATION SUPABASE
// ==========================================
const SUPABASE_URL = window.CASH_CONFIG?.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = window.CASH_CONFIG?.SUPABASE_ANON_KEY || '';

let supabaseClient = null;

const isSupabaseConfigured = () =>
    SUPABASE_URL &&
    !SUPABASE_URL.includes('VOTRE_') &&
    SUPABASE_ANON_KEY &&
    !SUPABASE_ANON_KEY.includes('VOTRE_') &&
    typeof supabase !== 'undefined';

if (isSupabaseConfigured()) {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('%c[CONNECTED] Supabase connecté !', 'color: #2ECC71; font-weight: bold;');
    } catch (err) {
        console.error('Erreur Supabase :', err);
    }
} else {
    console.log('%c[LOCAL] Mode LOCAL (Supabase non configuré)', 'color: #E67E22; font-weight: bold; font-size: 13px;');
    console.log('→ Inscrivez la clé SUPABASE_ANON_KEY dans app.js pour activer la base de données.');
}

// ==========================================
// 2. COMPTEUR WAITLIST EN TEMPS RÉEL
// ==========================================
const BASE_COUNT = 148;

const updateWaitlistCounter = async () => {
    const el = document.getElementById('waitlist-counter-value');
    if (!el) return;

    let count = BASE_COUNT;

    if (supabaseClient) {
        try {
            const { count: dbCount, error } = await supabaseClient
                .from('waitlist')
                .select('*', { count: 'exact', head: true });
            if (!error && dbCount !== null) count = BASE_COUNT + dbCount;
        } catch (e) { /* silence */ }
    } else {
        const local = JSON.parse(localStorage.getItem('cash_waitlist_v2') || '[]');
        count = BASE_COUNT + local.length;
    }

    animateCounter(el, count);
};

const animateCounter = (el, target) => {
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 60));
    const tick = () => {
        current = Math.min(current + step, target);
        el.textContent = current.toLocaleString('fr-FR');
        if (current < target) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
};

// Simulation d'activité (uniquement en mode local)
const simulateActivity = () => {
    if (supabaseClient) return;
    const delay = Math.random() * 60000 + 45000;
    setTimeout(() => {
        const el = document.getElementById('waitlist-counter-value');
        if (!el) return;
        const current = parseInt(el.textContent.replace(/\s/g, ''), 10);
        if (!isNaN(current)) animateCounter(el, current + 1);
        simulateActivity(); // relancer
    }, delay);
};

// ==========================================
// 3. FORMULAIRE — VALIDATION & SOUMISSION
// ==========================================
const $ = id => document.getElementById(id);

const showError = (inputEl, errorEl, msg) => {
    inputEl.style.borderColor = 'var(--expense)';
    inputEl.style.boxShadow = '0 0 0 3px rgba(231,76,60,0.12)';
    if (msg) errorEl.textContent = msg;
    errorEl.style.display = 'block';
};

const clearError = (inputEl, errorEl) => {
    inputEl.style.borderColor = '';
    inputEl.style.boxShadow = '';
    if (errorEl) errorEl.style.display = 'none';
};

const isValidEmail = email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.toLowerCase());
const isValidPhone = phone => phone.replace(/[\s\-().+]/g, '').length >= 6;

// Attacher les listeners de nettoyage
window.addEventListener('DOMContentLoaded', () => {
    [
        ['waitlist-firstname', 'error-firstname'],
        ['waitlist-lastname', 'error-lastname'],
        ['waitlist-whatsapp', 'error-whatsapp'],
        ['waitlist-email', 'error-email'],
    ].forEach(([inputId, errorId]) => {
        const input = $(inputId);
        const error = $(errorId);
        if (input && error) {
            input.addEventListener('input', () => clearError(input, error));
        }
    });

    injectHelperStyles();
    updateWaitlistCounter();
    simulateActivity();
});

// Soumission du formulaire
const form = $('waitlist-form');
if (form) {
    form.addEventListener('submit', async e => {
        e.preventDefault();

        const firstNameVal   = $('waitlist-firstname').value.trim();
        const lastNameVal    = $('waitlist-lastname').value.trim();
        const whatsappVal    = $('waitlist-whatsapp').value.trim();
        const emailVal       = $('waitlist-email').value.trim();
        const generalErrEl   = $('form-error-general');

        generalErrEl.style.display = 'none';
        let valid = true;

        if (!firstNameVal) {
            showError($('waitlist-firstname'), $('error-firstname'), 'Le prénom est requis.');
            valid = false;
        }
        if (!lastNameVal) {
            showError($('waitlist-lastname'), $('error-lastname'), 'Le nom est requis.');
            valid = false;
        }
        if (!whatsappVal || !isValidPhone(whatsappVal)) {
            showError($('waitlist-whatsapp'), $('error-whatsapp'), 'Veuillez entrer un numéro WhatsApp valide.');
            valid = false;
        }
        // Email optionnel : valider seulement s'il est rempli
        if (emailVal && !isValidEmail(emailVal)) {
            showError($('waitlist-email'), $('error-email'), 'L\'adresse e-mail semble invalide.');
            valid = false;
        }

        if (!valid) return;

        // État de chargement
        const btn = $('waitlist-submit');
        const origHTML = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '<span>Enregistrement...</span><div class="loader-spinner"></div>';

        let success = false;

        if (supabaseClient) {
            try {
                const { error } = await supabaseClient.from('waitlist').insert([{
                    first_name: firstNameVal,
                    last_name: lastNameVal,
                    whatsapp: whatsappVal,
                    email: emailVal || null,
                }]);
                if (error) {
                    const msg = error.code === '23505'
                        ? 'Ce numéro WhatsApp ou cet e-mail est déjà enregistré.'
                        : 'Erreur lors de l\'enregistrement. Veuillez réessayer.';
                    generalErrEl.textContent = msg;
                    generalErrEl.style.display = 'block';
                } else {
                    success = true;
                }
            } catch {
                generalErrEl.textContent = 'Erreur réseau. Vérifiez votre connexion.';
                generalErrEl.style.display = 'block';
            }
        } else {
            // Fallback LocalStorage
            await new Promise(r => setTimeout(r, 700));
            const list = JSON.parse(localStorage.getItem('cash_waitlist_v2') || '[]');
            const exists = list.some(i =>
                i.whatsapp === whatsappVal ||
                (emailVal && i.email && i.email.toLowerCase() === emailVal.toLowerCase())
            );
            if (exists) {
                generalErrEl.textContent = 'Ce numéro WhatsApp ou cet e-mail est déjà enregistré.';
                generalErrEl.style.display = 'block';
            } else {
                list.push({ first_name: firstNameVal, last_name: lastNameVal, whatsapp: whatsappVal, email: emailVal || null, created_at: new Date().toISOString() });
                localStorage.setItem('cash_waitlist_v2', JSON.stringify(list));
                success = true;
            }
        }

        if (!success) {
            btn.disabled = false;
            btn.innerHTML = origHTML;
            return;
        }

        // Succès
        $('success-user-name').textContent = firstNameVal;
        $('waitlist-form-container').classList.add('hidden');
        $('waitlist-success-container').classList.remove('hidden');
        triggerConfetti();
        updateWaitlistCounter();
    });
}

// ==========================================
// 4. CONFETTI 🎉
// ==========================================
const triggerConfetti = () => {
    const colors = ['#2ECC71', '#F5F5F0', '#1A1A1A', '#FF6B35', '#3498DB', '#9B59B6', '#E67E22'];
    const end = Date.now() + 2500;

    const burst = () => {
        if (Date.now() > end) return;
        for (let i = 0; i < 6; i++) {
            const el = document.createElement('div');
            el.style.cssText = `
                position:fixed; z-index:9999; pointer-events:none;
                width:${6 + Math.random() * 7}px; height:${5 + Math.random() * 9}px;
                background:${colors[Math.floor(Math.random() * colors.length)]};
                border-radius:${Math.random() > 0.5 ? '50%' : '2px'};
                left:${Math.random() * 100}vw; top:-12px;
                opacity:${0.6 + Math.random() * 0.4};
                transform:rotate(${Math.random() * 360}deg);
            `;
            document.body.appendChild(el);
            let top = -12, left = parseFloat(el.style.left), rot = Math.random() * 360;
            const speed = 2.5 + Math.random() * 3, drift = Math.random() * 1.5 - 0.75;
            const fall = () => {
                top += speed; left += drift; rot += 4;
                el.style.top = top + 'px';
                el.style.left = left + 'px';
                el.style.transform = `rotate(${rot}deg)`;
                top < window.innerHeight ? requestAnimationFrame(fall) : el.remove();
            };
            requestAnimationFrame(fall);
        }
        setTimeout(burst, 90);
    };
    burst();
};

// ==========================================
// 5. STYLES INJECTÉS DYNAMIQUEMENT
// ==========================================
const injectHelperStyles = () => {
    const s = document.createElement('style');
    s.textContent = `
        .loader-spinner {
            width:18px; height:18px;
            border:2px solid rgba(255,255,255,0.3);
            border-radius:50%;
            border-top-color:#fff;
            animation:spin 0.8s linear infinite;
            flex-shrink:0;
        }
        @keyframes spin { to { transform:rotate(360deg); } }
    `;
    document.head.appendChild(s);
};
