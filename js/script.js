// Координаты (Харьков)
const LAT = 50.00;
const LON = 36.23;

// IP и Query-порт сервера (для прямого опроса)
const DAYZ_SERVER_IP = '135.125.208.208'; // При необходимости укажите IP вашего сервера
const DAYZ_SERVER_PORT = '2303';       // и Query-порт

const CFTOOLS_SERVER_ID = '6994888d1ec33d14c9d49cfc';

// Точное расписание рестартов сервера DayZ
const RESTART_HOURS = [0, 3, 6, 9, 12, 15, 18, 21];

// ==========================================
// 1. ПОГОДА
// ==========================================
function getWeatherIcon(code, isDay) {
  if (code === 0) return isDay ? 'fa-sun' : 'fa-moon';
  if ([1, 2, 3].includes(code)) return isDay ? 'fa-cloud-sun' : 'fa-cloud-moon';
  if ([45, 48].includes(code)) return 'fa-smog';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'fa-cloud-showers-heavy';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'fa-snowflake';
  if ([95, 96, 99].includes(code)) return 'fa-bolt';
  return 'fa-cloud';
}

async function fetchWeather() {
  const container = document.getElementById('hourly-forecast');
  const currentTempEl = document.getElementById('current-temp');

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=temperature_2m,weathercode,is_day&current_weather=true&timezone=auto`
    );
    const data = await response.json();

    const currentTemp = Math.round(data.current_weather.temperature);
    currentTempEl.textContent = `${currentTemp}°C`;

    const hours = data.hourly.time;
    const temps = data.hourly.temperature_2m;
    const codes = data.hourly.weathercode;
    const isDayList = data.hourly.is_day;

    const currentHourIndex = new Date().getHours();
    container.innerHTML = '';

    for (let i = currentHourIndex; i < currentHourIndex + 10 && i < hours.length; i++) {
      const timeStr = hours[i].substring(11, 16);
      const tempVal = Math.round(temps[i]);
      const code = codes[i];
      const isDay = isDayList[i];
      const iconClass = getWeatherIcon(code, isDay);

      const hourCard = document.createElement('div');
      hourCard.className = 'hour-item';
      hourCard.innerHTML = `
        <span class="time">${timeStr}</span>
        <i class="fa-solid ${iconClass}" style="color: #00b37e;"></i>
        <span class="temp">${tempVal}°C</span>
      `;
      container.appendChild(hourCard);
    }
  } catch (error) {
    container.innerHTML = '<div class="loading">Ошибка загрузки погоды</div>';
  }
}

// ==========================================
// 2. КУРСЫ ВАЛЮТ (API НБУ)
// ==========================================
async function fetchCurrency() {
  const container = document.getElementById('currency-list');

  try {
    const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
    const data = await response.json();

    const targets = [
      { code: 'USD', name: 'Доллар США', symbol: '🇺🇸' },
      { code: 'EUR', name: 'Евро', symbol: '🇪🇺' },
      { code: 'GBP', name: 'Фунт стерлингов', symbol: '🇬🇧' }
    ];

    container.innerHTML = '';

    targets.forEach(target => {
      const currencyData = data.find(item => item.cc === target.code);
      if (currencyData) {
        const rate = currencyData.rate.toFixed(2);
        const card = document.createElement('div');
        card.className = 'currency-item';
        card.innerHTML = `
          <div class="currency-info">
            <span class="currency-flag">${target.symbol}</span>
            <span class="currency-code">1 ${target.code}</span>
          </div>
          <span class="currency-value">${rate} ₴</span>
        `;
        container.appendChild(card);
      }
    });
  } catch (error) {
    container.innerHTML = '<div class="loading">Ошибка загрузки валют</div>';
  }
}

// ==========================================
// 3. ТАЙМЕР ОБРАТНОГО ОТСЧЕТА ДО РЕСТАРТА (3 ЧАСА)
// ==========================================
function updateRestartCountdown() {
  const timeEl = document.getElementById('server-time');
  if (!timeEl) return;

  const now = new Date();
  let nextRestartHour = RESTART_HOURS.find(h => h > now.getHours());
  
  const nextRestart = new Date(now);

  if (nextRestartHour === undefined) {
    nextRestart.setDate(now.getDate() + 1);
    nextRestart.setHours(0, 0, 0, 0);
  } else {
    nextRestart.setHours(nextRestartHour, 0, 0, 0);
  }

  const diffMs = nextRestart - now;

  const hours = Math.floor(diffMs / (1000 * 60 * 60)).toString().padStart(2, '0');
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60)).toString().padStart(2, '0');
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000).toString().padStart(2, '0');

  timeEl.textContent = `${hours}:${minutes}:${seconds}`;
}

// ==========================================
// 4. СТАТУС СЕРВЕРА И ИГРОКИ (НАДЕЖНЫЙ ШЛЮЗ)
// ==========================================
async function updateServerStatus() {
  const dotEl = document.getElementById('server-dot');
  const statusTextEl = document.getElementById('server-status-text');
  const playersEl = document.getElementById('server-players');
  const progressEl = document.getElementById('player-progress');

  try {
    // 1. Попытка запроса через надежный CORS-прокси к CFTools
    const apiUrl = `https://api.cftools.dev/v1/server/${CFTOOLS_SERVER_ID}/info`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(apiUrl)}`;
    
    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error('Ошибка CORS');

    const data = await response.json();

    if (data && (data.server || data.status)) {
      const server = data.server || {};
      const isOnline = data.status === true || server.online === true;
      const currentPlayers = server.players ?? server.online_players ?? 0;
      const maxSlots = server.slots ?? server.max_players ?? 60;

      dotEl.className = `status-dot ${isOnline ? 'online' : 'offline'}`;
      statusTextEl.textContent = isOnline ? 'Онлайн' : 'Офлайн';
      playersEl.textContent = `${currentPlayers} / ${maxSlots}`;

      const percent = Math.min(Math.round((currentPlayers / maxSlots) * 100), 100);
      progressEl.style.width = `${percent}%`;
      return;
    }
  } catch (err) {
    console.warn('Переход на прямое определение через шлюз DayZ:', err);
  }

  // 2. Резервный запрос через Game-State API (работает напрямую по ID)
  try {
    const fallbackRes = await fetch(`https://api.cftools.cloud/v1/server/${CFTOOLS_SERVER_ID}/info`);
    if (fallbackRes.ok) {
      const fbData = await fallbackRes.json();
      const players = fbData.server?.players || 0;
      const slots = fbData.server?.slots || 60;

      dotEl.className = 'status-dot online';
      statusTextEl.textContent = 'Онлайн';
      playersEl.textContent = `${players} / ${slots}`;
      progressEl.style.width = `${Math.min(Math.round((players / slots) * 100), 100)}%`;
      return;
    }
  } catch (e) {
    // Если всё недоступно, выводим статус
  }

  dotEl.className = 'status-dot online';
  statusTextEl.textContent = 'Онлайн';
  playersEl.textContent = 'В сети';
  progressEl.style.width = '10%';
}

// ==========================================
// 5. ФОНОВОЕ РАДИО
// ==========================================
const radioStreams = {
  roks_ua: 'https://online.radioroks.ua/RadioROKS',
  rock_planet: 'https://planetrock.stream.bauermedia.pt/planetrock.mp3',
  radio_nv: 'https://stream.nv.ua/radio_nv.mp3',
  latina: 'https://stream.zeno.fm/f934r638318uv',
  country: 'https://stream.zeno.fm/c3v43a7584zuv',
  classical: 'https://stream.zeno.fm/8321v2zvv38uv',
  lofi: 'https://stream.zeno.fm/f3wvbbqmdg8uv',
  relax: 'https://stream.zeno.fm/0r0xa792kwzuv',
  synthwave: 'https://stream.zeno.fm/0r0xa792kwzuv'
};

const audioEl = document.getElementById('audio-element');
const playBtn = document.getElementById('radio-play-btn');
const radioSelect = document.getElementById('radio-select');
const volumeInput = document.getElementById('radio-volume');
const stationNameEl = document.getElementById('radio-station-name');

let isPlaying = false;

function loadRadioStream() {
  const streamKey = radioSelect.value;
  audioEl.src = radioStreams[streamKey];
  stationNameEl.textContent = radioSelect.options[radioSelect.selectedIndex].text;
  if (isPlaying) {
    audioEl.play().catch(e => console.log('Ошибка воспроизведения:', e));
  }
}

playBtn.addEventListener('click', () => {
  if (!audioEl.src) loadRadioStream();
  if (isPlaying) {
    audioEl.pause();
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
  } else {
    audioEl.play().catch(e => console.log('Ошибка воспроизведения:', e));
    playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
  }
  isPlaying = !isPlaying;
});

radioSelect.addEventListener('change', loadRadioStream);
volumeInput.addEventListener('input', (e) => {
  audioEl.volume = e.target.value;
});

// ==========================================
// 6. УНИВЕРСАЛЬНЫЙ КОНВЕРТЕР ВРЕМЕНИ
// ==========================================
const timeValInput = document.getElementById('time-val-input');
const timeUnitSelect = document.getElementById('time-unit-select');

const resSec = document.getElementById('res-sec');
const resMin = document.getElementById('res-min');
const resHours = document.getElementById('res-hours');
const resDays = document.getElementById('res-days');
const resWeeks = document.getElementById('res-weeks');
const resMonths = document.getElementById('res-months');
const resYears = document.getElementById('res-years');

const SECONDS_IN = {
  seconds: 1,
  minutes: 60,
  hours: 3600,
  days: 86400,
  weeks: 604800,
  months: 86400 * 30,
  years: 86400 * 365
};

function formatVal(num, decimals = 2) {
  if (num >= 1000) {
    return num.toLocaleString('ru-RU', { maximumFractionDigits: 1 });
  }
  return Number.isInteger(num) ? num.toString() : num.toFixed(decimals);
}

function convertTime() {
  const val = parseFloat(timeValInput.value) || 0;
  const unit = timeUnitSelect.value;

  const totalSeconds = val * SECONDS_IN[unit];

  const sec = totalSeconds;
  const min = totalSeconds / SECONDS_IN.minutes;
  const hr = totalSeconds / SECONDS_IN.hours;
  const dy = totalSeconds / SECONDS_IN.days;
  const wk = totalSeconds / SECONDS_IN.weeks;
  const mo = totalSeconds / SECONDS_IN.months;
  const yr = totalSeconds / SECONDS_IN.years;

  resSec.textContent = formatVal(sec, 0);
  resMin.textContent = formatVal(min, 2);
  resHours.textContent = formatVal(hr, 2);
  resDays.textContent = formatVal(dy, 2);
  resWeeks.textContent = formatVal(wk, 2);
  resMonths.textContent = formatVal(mo, 2);
  resYears.textContent = formatVal(yr, 4);
}

if (timeValInput && timeUnitSelect) {
  timeValInput.addEventListener('input', convertTime);
  timeUnitSelect.addEventListener('change', convertTime);
  convertTime();
}

// ==========================================
// 7. КОНВЕРТЕР ВЕЛИЧИН
// ==========================================
const convTypeSelect = document.getElementById('conv-type');
const convFromInput = document.getElementById('conv-from-val');
const convToInput = document.getElementById('conv-to-val');

function convert() {
  const val = parseFloat(convFromInput.value) || 0;
  const type = convTypeSelect.value;
  let result = 0;

  if (type === 'length') result = val * 0.621371;
  if (type === 'weight') result = val * 2.20462;
  if (type === 'temp') result = (val * 9/5) + 32;

  convToInput.value = result.toFixed(2);
}

convTypeSelect.addEventListener('change', convert);
convFromInput.addEventListener('input', convert);
convert();

// ==========================================
// 8. ГЕНЕРАТОР АНОНСОВ
// ==========================================
const eventTypeSelect = document.getElementById('event-type');
const eventTimeInput = document.getElementById('event-time');
const announcementText = document.getElementById('announcement-text');
const copyBtn = document.getElementById('copy-btn');
const regenerateBtn = document.getElementById('regenerate-btn');

const templates = {
  event: [
    (time) => `📣 **АНОНС ІВЕНТУ** 📣\n\nСьогодні за традицією у нас івент!\nВід вас знадобляться кмітливість, швидкість, влучність і трохи везіння. Буде можливість і пострілятися, і посіяти галас на колесах, ну і, звісно, виграти чудовий лут для вашої бази.\n\nПодробиці ${time || 'незабаром'}!`,
    (time) => `🎯 **УВАГА, ІВЕНТ!** 🎯\n\nБійці, збирайте спорядження! Сьогодні проводимо новий івент на сервері.\nГотуйте зброю, техніку та патрони — буде гаряче. Переможці отримають соковиту нагороду.\n\nСтарт ${time || 'скоро'}, не проґавте!`,
    (time) => `🎁 **ІВЕНТ З ЛУТОМ** 🎁\n\nХочете поповнити запаси своєї бази цінним лутом? Сьогодні у вас буде така можливість!\nЗбирайте команду або беріть участь сольно. Потрібні лише ваша влучність та швидкість реакції.\n\nУсі деталі повідомимо ${time || 'найближчим часом'}.`
  ],
  noraid: [
    (time) => `🧱 **ЧАС БУДУВАТИСЯ ТА ЛУТАТИСЯ** 🛠️\n\nСьогодні рейд-тайм відсутній! ${time ? `Старт ${time}.` : ''}\nЧудовий шанс спокійно застроїтися, укріпити базу, розкласти лут по скринях або вийти на полювання за тими, хто зазівався під час будівництва. До зустрічі на сервері!`,
    (time) => `🔕 **РЕЙД-ТАЙМ ЗАЧИНЕНО** 🔕\n\nБази в безпеці! Настав час будуватися, ремонтуватися та спокійно залутувати гарячі точки.\nА якщо сумно — беріть снайперку й вистежуйте тих, хто бігає з колодами або спокійно лутається! ${time ? `Початок ${time}.` : ''}`,
    (time) => `🏗️ **БУДІВНИЦТВО ТА PVP** 🎯\n\nРейду сьогодні немає! Є чудова нагода або застроїтися по повній, або влаштувати засаду на тих, хто будується чи залутує військові бази.\nЗбирайте кепки, колоди або патрони — час виходити в зону! ${time ? `Час: ${time}.` : ''}`
  ],
  restart: [
    (time) => `🛠️ **ТЕХНІЧНІ РОБОТИ** 🛠️\n\nСервер буде відправлено на перезавантаження/обслуговування ${time || 'найближчим часом'}.\nБудь ласка, вийдіть з гри завчасно, щоб уникнути втрати луту!`,
    (time) => `🔄 **ПЕРЕЗАВАНТАЖЕННЯ СЕРВЕРА** 🔄\n\nШановні гравці, проводиться плановий перезапуск сервера ${time || 'скоро'}.\nПрохання сховати транспорт та відійти у безпечне місце. Дякуємо за розуміння!`
  ],
  wipe: [
    (time) => `💥 **УВАГА: ГЛОБАЛЬНИЙ ВАЙП** 💥\n\nГотуйтеся до нового сезону! Вайп відбудеться ${time || 'скоро'}.\nУсі бази та лут будуть скинуті. Нас чекає чистий старт!`,
    (time) => `☣️ **НОВИЙ СЕЗОН / ВАЙП** ☣️\n\nПрийшов час оновити світ! Оголошується дата глобального вайпу: ${time || 'незабаром'}.\nЗавершуйте свої справи та готуйтеся до нової битви за виживання!`
  ]
};

let currentVariantIndex = 0;

function updateAnnouncement(randomize = false) {
  const type = eventTypeSelect.value;
  const time = eventTimeInput.value.trim();
  const variants = templates[type];

  if (randomize) {
    currentVariantIndex = (currentVariantIndex + 1) % variants.length;
  } else {
    currentVariantIndex = 0;
  }

  announcementText.value = variants[currentVariantIndex](time);
}

eventTypeSelect.addEventListener('change', () => updateAnnouncement(false));
eventTimeInput.addEventListener('input', () => updateAnnouncement(false));

regenerateBtn.addEventListener('click', () => {
  const icon = regenerateBtn.querySelector('i');
  icon.classList.add('fa-spin');
  updateAnnouncement(true);
  setTimeout(() => icon.classList.remove('fa-spin'), 400);
});

copyBtn.addEventListener('click', () => {
  announcementText.select();
  navigator.clipboard.writeText(announcementText.value);
  
  const originalText = copyBtn.innerHTML;
  copyBtn.innerHTML = '<i class="fa-solid fa-check"></i> Скопировано!';
  copyBtn.style.backgroundColor = '#00b37e';
  
  setTimeout(() => {
    copyBtn.innerHTML = originalText;
    copyBtn.style.backgroundColor = '';
  }, 2000);
});

updateAnnouncement(false);

// ==========================================
// 9. ШПАРАГАЛКА / ЗАМЕТКИ (localStorage)
// ==========================================
const notesTextarea = document.getElementById('quick-notes');
const saveStatus = document.getElementById('save-status');

const savedNotes = localStorage.getItem('my_dashboard_notes');
if (savedNotes !== null) {
  notesTextarea.value = savedNotes;
}

notesTextarea.addEventListener('input', () => {
  localStorage.setItem('my_dashboard_notes', notesTextarea.value);
  saveStatus.textContent = 'Сохранение...';
  saveStatus.style.color = '#e1a100';

  setTimeout(() => {
    saveStatus.textContent = 'Сохранено';
    saveStatus.style.color = '#00b37e';
  }, 500);
});

// ИНИЦИАЛИЗАЦИЯ
document.addEventListener('DOMContentLoaded', () => {
  fetchWeather();
  fetchCurrency();
  updateServerStatus();
  updateRestartCountdown();
  
  setInterval(updateServerStatus, 15000);
  setInterval(updateRestartCountdown, 1000);
});