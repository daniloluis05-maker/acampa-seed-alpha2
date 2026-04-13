// ─── Bootstrap React — executa APÓS o Babel terminar a transpilação ────────────
// Aguarda até o componente App ser definido pelo Babel antes de montar no DOM.
(function () {
  var tries = 0, max = 240;
  function mount() {
    tries++;
    if (typeof App !== 'undefined' && typeof ReactDOM !== 'undefined') {
      try {
        var rootEl = document.getElementById('root');
        rootEl.innerHTML = '';
        ReactDOM.createRoot(rootEl).render(React.createElement(App));
      } catch (e) {
        console.error('[Bootstrap] Erro:', e);
      }
    } else if (tries < max) {
      setTimeout(mount, 50);
    } else {
      console.error('[Bootstrap] Timeout — Babel não terminou em 12s.');
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(mount, 80); });
  } else {
    setTimeout(mount, 80);
  }
})();

// ─── Music Player ─────────────────────────────────────────────────────────────
(function () {
  const PLAYLIST = [
    { title: "Acampa Seed 2026",        src: "https://res.cloudinary.com/dbocy2dpp/video/upload/v1772757458/musica.mpeg_arrrf2.mp3" },
    { title: "O Cumprimento da Palavra", src: "https://res.cloudinary.com/dbocy2dpp/video/upload/v1773624663/O_Cumprimento_da_Palavra_xemknv.mp3" },
    { title: "Tesouros Ocultos",         src: "https://res.cloudinary.com/dbocy2dpp/video/upload/v1773624601/Tesouros_Ocultos_AT_qtjdvl.mp3" },
    { title: "Só Existe Um Rei",         src: "https://res.cloudinary.com/dbocy2dpp/video/upload/v1773624519/So_existe_um_rei_V_Final_oa7aqg.mp3" },
    { title: "Intro",                    src: "https://res.cloudinary.com/dbocy2dpp/video/upload/v1773624407/INTRO___0_00_0_15___skhpzq.mp3" },
  ];

  const audio   = document.getElementById('bgAudio');
  const btn     = document.getElementById('playBtn');
  const nextBtn = document.getElementById('nextBtn');
  const slider  = document.getElementById('volumeSlider');
  const dot     = document.getElementById('nowPlaying');
  const title   = document.getElementById('playerTitle');

  let order = [];
  let idx = 0;

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function buildOrder() {
    order = shuffle(PLAYLIST.map((_, i) => i));
    idx = 0;
  }

  function loadTrack(i) {
    const track = PLAYLIST[order[i]];
    audio.src = track.src;
    title.textContent = track.title;
    audio.volume = parseFloat(slider.value);
  }

  function playNext() {
    idx++;
    if (idx >= order.length) buildOrder();
    loadTrack(idx);
    audio.play().catch(() => {});
  }

  buildOrder();
  loadTrack(idx);

  btn.addEventListener('click', function () {
    if (audio.paused) {
      audio.play().then(() => {
        btn.textContent = '❚❚';
        btn.setAttribute('aria-label', 'Pausar música');
        dot.classList.add('visible');
      }).catch(() => {});
    } else {
      audio.pause();
      btn.textContent = '▶';
      btn.setAttribute('aria-label', 'Reproduzir música');
      dot.classList.remove('visible');
    }
  });

  nextBtn.addEventListener('click', function () {
    playNext();
    btn.textContent = '❚❚';
    dot.classList.add('visible');
  });

  audio.addEventListener('ended', function () { playNext(); });

  slider.addEventListener('input', function () { audio.volume = this.value; });
})();

// ─── Notificações via Web Notifications API ────────────────────────────────────
window.ativarNotificacoesFCM = async function (uid) {
  try {
    var permission = await Notification.requestPermission();
    return permission === 'granted' ? 'web-notifications-granted' : null;
  } catch (err) {
    console.error('[Notificações] Erro:', err);
    return null;
  }
};

window.FCM_MESSAGES = {
  bonusDiario:        { title: "⚡ Missão Level-Up — Bônus Disponível!",        body: "Você ainda não acessou o app hoje e há um bônus de +50 pts esperando por você! Não deixe passar.\n— Lamentações 3:22-23 (NVI)" },
  alertaRebaixamento: { title: "⚠️ Missão Level-Up — Perigo de Rebaixamento!", body: "Você está há 1 dia sem cumprir sua meta e corre o risco de ser rebaixado amanhã.\n— Hebreus 12:1" },
  aposRebaixamento:   { title: "🔴 Missão Level-Up — Você foi rebaixado",       body: "Você foi rebaixado de nível, mas isso não é o fim da sua jornada. Levanta e recomeça!\n— João 16:33 (NVI)" },
};
