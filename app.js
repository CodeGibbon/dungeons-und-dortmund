import { firebaseConfig } from './firebase-config.js';
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore, collection, addDoc, doc, updateDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp, runTransaction,
  enableIndexedDbPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

try { enableIndexedDbPersistence(db); } catch (e) { /* mehrere Tabs offen - ignorieren */ }

const NAME_KEY = 'dundo_name';

const SKILL_DEFS = [
  { key: 'arcana', label: 'Arcana', attr: 'INT' },
  { key: 'examination', label: 'Examination', attr: 'INT' },
  { key: 'finesse', label: 'Finesse', attr: 'DEX' },
  { key: 'influence', label: 'Influence', attr: 'WIL' },
  { key: 'insight', label: 'Insight', attr: 'WIL' },
  { key: 'lore', label: 'Lore', attr: 'INT' },
  { key: 'might', label: 'Might', attr: 'STR' },
  { key: 'naturecraft', label: 'Naturecraft', attr: 'WIL' },
  { key: 'perception', label: 'Perception', attr: 'WIL' },
  { key: 'stealth', label: 'Stealth', attr: 'DEX' }
];

function defaultSkills() {
  const o = {};
  SKILL_DEFS.forEach(s => { o[s.key] = { base: 0, bonus: 0 }; });
  return o;
}

function defaultCharacter(name, ancestry, className) {
  return {
    name,
    ancestry: ancestry || '',
    className: className || '',
    level: 1,
    attributes: { str: 0, dex: 0, int: 0, wil: 0 },
    hp: { current: 10, max: 10, temp: 0 },
    armor: '',
    initiative: 0,
    size: '',
    speed: '',
    weight: '',
    hitDice: '',
    wounds: { max: 5, current: 0 },
    skills: defaultSkills(),
    currency: { copper: 0, silver: 0, gold: 0, platinum: 0 },
    weapons: [],
    items: [],
    questLog: [],
    createdBy: me,
    createdAt: serverTimestamp()
  };
}

function generateId() {
  return (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
}

let me = localStorage.getItem(NAME_KEY) || '';
let storylineEntries = [];
let characters = [];
let activeSection = 'storyline';
let currentCharacterId = null;
let editingWeaponId = null;
let editingItemId = null;
let giveContext = null;

const el = (sel) => document.querySelector(sel);

/* ---------- Referenzen ---------- */

const onboarding = el('#onboarding');
const onboardingNameInput = el('#onboardingNameInput');
const onboardingSubmit = el('#onboardingSubmit');
const identityBtn = el('#identityBtn');
const identityLabel = el('#identityLabel');
const identityAvatar = el('#identityAvatar');

const sectionStoryline = el('#sectionStoryline');
const sectionCharacters = el('#sectionCharacters');
const storylineSection = el('#storylineSection');
const charactersSection = el('#charactersSection');

const storylineEmpty = el('#storylineEmpty');
const storylineList = el('#storylineList');

const charListView = el('#charListView');
const charListEmpty = el('#charListEmpty');
const charList = el('#charList');
const characterDetail = el('#characterDetail');
const backToList = el('#backToList');

const fab = el('#fab');
const modalBackdrop = el('#modalBackdrop');

const storylineModal = el('#storylineModal');
const storylineInput = el('#storylineInput');
const storylineAddBtn = el('#storylineAddBtn');
const storylineCancelBtn = el('#storylineCancelBtn');

const newCharacterModal = el('#newCharacterModal');
const newCharName = el('#newCharName');
const newCharAncestry = el('#newCharAncestry');
const newCharClass = el('#newCharClass');
const newCharAddBtn = el('#newCharAddBtn');
const newCharCancelBtn = el('#newCharCancelBtn');

// Sheet-Felder
const chName = el('#chName');
const chAncestry = el('#chAncestry');
const chClass = el('#chClass');
const levelValue = el('#levelValue');
const levelUp = el('#levelUp');
const levelDown = el('#levelDown');
const statStr = el('#statStr');
const statDex = el('#statDex');
const statInt = el('#statInt');
const statWil = el('#statWil');
const hpCurrent = el('#hpCurrent');
const hpMax = el('#hpMax');
const hpTemp = el('#hpTemp');
const initiative = el('#initiative');
const armor = el('#armor');
const hitDice = el('#hitDice');
const chSize = el('#chSize');
const chSpeed = el('#chSpeed');
const chWeight = el('#chWeight');
const woundsMax = el('#woundsMax');
const woundsPips = el('#woundsPips');
const skillsGrid = el('#skillsGrid');
const curCopper = el('#curCopper');
const curSilver = el('#curSilver');
const curGold = el('#curGold');
const curPlatinum = el('#curPlatinum');
const weaponsList = el('#weaponsList');
const weaponsEmpty = el('#weaponsEmpty');
const addWeaponBtn = el('#addWeaponBtn');
const itemsList = el('#itemsList');
const itemsEmpty = el('#itemsEmpty');
const addItemBtn = el('#addItemBtn');
const questLogInput = el('#questLogInput');
const addQuestLogBtn = el('#addQuestLogBtn');
const questLogEmpty = el('#questLogEmpty');
const questLogList = el('#questLogList');
const deleteCharacterBtn = el('#deleteCharacterBtn');

const weaponModal = el('#weaponModal');
const weaponModalTitle = el('#weaponModalTitle');
const weaponName = el('#weaponName');
const weaponHandedness = el('#weaponHandedness');
const weaponRange = el('#weaponRange');
const weaponDamageDice = el('#weaponDamageDice');
const weaponMagical = el('#weaponMagical');
const weaponDescription = el('#weaponDescription');
const weaponSaveBtn = el('#weaponSaveBtn');
const weaponCancelBtn = el('#weaponCancelBtn');
const weaponDeleteBtn = el('#weaponDeleteBtn');

const itemModal = el('#itemModal');
const itemModalTitle = el('#itemModalTitle');
const itemName = el('#itemName');
const itemQty = el('#itemQty');
const itemEffect = el('#itemEffect');
const itemSaveBtn = el('#itemSaveBtn');
const itemCancelBtn = el('#itemCancelBtn');
const itemDeleteBtn = el('#itemDeleteBtn');

const giveModal = el('#giveModal');
const giveModalTitle = el('#giveModalTitle');
const giveTargetSelect = el('#giveTargetSelect');
const giveQtyRow = el('#giveQtyRow');
const giveQty = el('#giveQty');
const giveConfirmBtn = el('#giveConfirmBtn');
const giveCancelBtn = el('#giveCancelBtn');

function initials(name) {
  return (name || '?').trim().slice(0, 1).toUpperCase();
}

function formatDateTime(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function getCurrentCharacter() {
  return characters.find(c => c.id === currentCharacterId) || null;
}

function charRef(id) {
  return doc(db, 'characters', id);
}

/* ---------- Onboarding / Identität ---------- */

function showOnboardingIfNeeded() {
  if (!me) {
    onboarding.classList.add('show');
  } else {
    updateIdentityChip();
  }
}

function updateIdentityChip() {
  identityLabel.textContent = me;
  identityAvatar.textContent = initials(me);
}

onboardingNameInput.addEventListener('input', () => {
  onboardingSubmit.disabled = onboardingNameInput.value.trim().length === 0;
});

onboardingNameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !onboardingSubmit.disabled) onboardingSubmit.click();
});

onboardingSubmit.addEventListener('click', () => {
  const name = onboardingNameInput.value.trim();
  if (!name) return;
  me = name;
  localStorage.setItem(NAME_KEY, me);
  onboarding.classList.remove('show');
  updateIdentityChip();
});

identityBtn.addEventListener('click', () => {
  onboardingNameInput.value = me;
  onboardingSubmit.disabled = me.trim().length === 0;
  onboarding.classList.add('show');
  setTimeout(() => onboardingNameInput.focus(), 50);
});

/* ---------- Navigation ---------- */

sectionStoryline.addEventListener('click', () => setSection('storyline'));
sectionCharacters.addEventListener('click', () => setSection('characters'));

function setSection(section) {
  activeSection = section;
  sectionStoryline.classList.toggle('active', section === 'storyline');
  sectionCharacters.classList.toggle('active', section === 'characters');
  storylineSection.classList.toggle('hidden', section !== 'storyline');
  charactersSection.classList.toggle('hidden', section !== 'characters');
  if (section === 'characters') {
    showCharList();
  } else {
    updateFabVisibility();
  }
}

function updateFabVisibility() {
  if (activeSection === 'storyline') {
    fab.classList.remove('hidden');
    fab.setAttribute('aria-label', 'Neuer Storyline-Eintrag');
  } else if (activeSection === 'characters' && characterDetail.classList.contains('hidden')) {
    fab.classList.remove('hidden');
    fab.setAttribute('aria-label', 'Neuer Charakter');
  } else {
    fab.classList.add('hidden');
  }
}

fab.addEventListener('click', () => {
  if (activeSection === 'storyline') openStorylineModal();
  else openNewCharacterModal();
});

modalBackdrop.addEventListener('click', () => {
  closeStorylineModal();
  closeNewCharacterModal();
  closeWeaponModal();
  closeItemModal();
  closeGiveModal();
});

/* ---------- Storyline ---------- */

function openStorylineModal() {
  storylineInput.value = '';
  storylineAddBtn.disabled = true;
  storylineModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => storylineInput.focus(), 50);
}

function closeStorylineModal() {
  storylineModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
}

storylineInput.addEventListener('input', () => {
  storylineAddBtn.disabled = storylineInput.value.trim().length === 0;
});

storylineCancelBtn.addEventListener('click', closeStorylineModal);

storylineAddBtn.addEventListener('click', async () => {
  const text = storylineInput.value.trim();
  if (!text) return;
  storylineAddBtn.disabled = true;
  try {
    await addDoc(collection(db, 'storyline'), {
      text,
      author: me,
      createdAt: serverTimestamp()
    });
    closeStorylineModal();
  } finally {
    storylineAddBtn.disabled = false;
  }
});

async function removeStorylineEntry(entry) {
  if (!window.confirm('Diesen Eintrag wirklich löschen?')) return;
  await deleteDoc(doc(db, 'storyline', entry.id));
}

function renderStoryline() {
  storylineList.innerHTML = '';
  storylineEmpty.style.display = storylineEntries.length ? 'none' : 'block';
  storylineEmpty.textContent = 'Noch keine Einträge. Schreib rein, was letzte Session passiert ist!';

  storylineEntries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'storyline-entry';

    const text = document.createElement('div');
    text.className = 'storyline-text';
    text.textContent = entry.text;
    row.appendChild(text);

    const meta = document.createElement('div');
    meta.className = 'storyline-meta';
    const metaText = document.createElement('span');
    metaText.textContent = `${entry.author || '?'} · ${formatDateTime(entry.createdAt)}`;
    meta.appendChild(metaText);

    if (entry.author === me) {
      const del = document.createElement('button');
      del.className = 'delete-btn';
      del.innerHTML = '&times;';
      del.setAttribute('aria-label', 'Löschen');
      del.addEventListener('click', () => removeStorylineEntry(entry));
      meta.appendChild(del);
    }

    row.appendChild(meta);
    storylineList.appendChild(row);
  });
}

/* ---------- Charakterliste ---------- */

function showCharList() {
  charListView.classList.remove('hidden');
  characterDetail.classList.add('hidden');
  currentCharacterId = null;
  updateFabVisibility();
  renderCharList();
}

function showCharacterDetail(id) {
  currentCharacterId = id;
  charListView.classList.add('hidden');
  characterDetail.classList.remove('hidden');
  updateFabVisibility();
  renderCharacterSheet();
}

backToList.addEventListener('click', showCharList);

function currencyLabel(c) {
  const parts = [];
  if (c.platinum) parts.push(`${c.platinum}P`);
  if (c.gold) parts.push(`${c.gold}G`);
  if (c.silver) parts.push(`${c.silver}S`);
  if (c.copper) parts.push(`${c.copper}K`);
  return parts.length ? parts.join(' ') : '0G';
}

function renderCharList() {
  charList.innerHTML = '';
  charListEmpty.style.display = characters.length ? 'none' : 'block';
  charListEmpty.textContent = 'Noch keine Charaktere. Leg den ersten an!';

  characters.forEach(c => {
    const card = document.createElement('div');
    card.className = 'char-card';
    card.addEventListener('click', () => showCharacterDetail(c.id));

    const avatar = document.createElement('div');
    avatar.className = 'char-card-avatar';
    avatar.textContent = initials(c.name);
    card.appendChild(avatar);

    const info = document.createElement('div');
    info.className = 'char-card-info';

    const name = document.createElement('div');
    name.className = 'char-card-name';
    name.textContent = c.name || '(unbenannt)';
    info.appendChild(name);

    const sub = document.createElement('div');
    sub.className = 'char-card-sub';
    const parts = [];
    if (c.className) parts.push(c.className);
    if (c.ancestry) parts.push(c.ancestry);
    parts.push(`Lvl ${c.level || 1}`);
    parts.push(`${c.hp?.current ?? 0}/${c.hp?.max ?? 0} HP`);
    sub.textContent = parts.join(' · ');
    info.appendChild(sub);

    const hpBar = document.createElement('div');
    hpBar.className = 'char-card-hp';
    const hpFill = document.createElement('div');
    hpFill.className = 'char-card-hp-fill';
    const max = c.hp?.max || 1;
    const cur = Math.max(0, c.hp?.current ?? 0);
    hpFill.style.width = `${Math.min(100, (cur / max) * 100)}%`;
    hpBar.appendChild(hpFill);
    info.appendChild(hpBar);

    card.appendChild(info);

    const gold = document.createElement('div');
    gold.className = 'char-card-gold';
    gold.textContent = currencyLabel(c.currency || {});
    card.appendChild(gold);

    charList.appendChild(card);
  });
}

/* ---------- Neuer Charakter ---------- */

function openNewCharacterModal() {
  newCharName.value = '';
  newCharAncestry.value = '';
  newCharClass.value = '';
  newCharAddBtn.disabled = true;
  newCharacterModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => newCharName.focus(), 50);
}

function closeNewCharacterModal() {
  newCharacterModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
}

newCharName.addEventListener('input', () => {
  newCharAddBtn.disabled = newCharName.value.trim().length === 0;
});

newCharCancelBtn.addEventListener('click', closeNewCharacterModal);

newCharAddBtn.addEventListener('click', async () => {
  const name = newCharName.value.trim();
  if (!name) return;
  newCharAddBtn.disabled = true;
  try {
    const ref = await addDoc(collection(db, 'characters'), defaultCharacter(
      name, newCharAncestry.value.trim(), newCharClass.value.trim()
    ));
    closeNewCharacterModal();
    showCharacterDetail(ref.id);
  } finally {
    newCharAddBtn.disabled = false;
  }
});

deleteCharacterBtn.addEventListener('click', async () => {
  const c = getCurrentCharacter();
  if (!c) return;
  if (!window.confirm(`"${c.name}" wirklich unwiderruflich löschen?`)) return;
  await deleteDoc(charRef(c.id));
  showCharList();
});

/* ---------- Sheet: einfache Felder ---------- */

function bindField(inputEl, path, transform) {
  inputEl.addEventListener('change', () => {
    if (!currentCharacterId) return;
    let val = inputEl.value;
    if (transform) val = transform(val);
    updateDoc(charRef(currentCharacterId), { [path]: val });
  });
}

const asNumber = (v) => Number(v) || 0;
const asText = (v) => v.trim();

bindField(chName, 'name', asText);
bindField(chAncestry, 'ancestry', asText);
bindField(chClass, 'className', asText);
bindField(statStr, 'attributes.str', asNumber);
bindField(statDex, 'attributes.dex', asNumber);
bindField(statInt, 'attributes.int', asNumber);
bindField(statWil, 'attributes.wil', asNumber);
bindField(hpCurrent, 'hp.current', asNumber);
bindField(hpMax, 'hp.max', asNumber);
bindField(hpTemp, 'hp.temp', asNumber);
bindField(initiative, 'initiative', asNumber);
bindField(armor, 'armor', asText);
bindField(hitDice, 'hitDice', asText);
bindField(chSize, 'size', asText);
bindField(chSpeed, 'speed', asText);
bindField(chWeight, 'weight', asText);
bindField(curCopper, 'currency.copper', asNumber);
bindField(curSilver, 'currency.silver', asNumber);
bindField(curGold, 'currency.gold', asNumber);
bindField(curPlatinum, 'currency.platinum', asNumber);

bindField(woundsMax, 'wounds.max', (v) => Math.max(1, Number(v) || 1));

levelUp.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const newLevel = Math.min(20, (c.level || 1) + 1);
  updateDoc(charRef(c.id), { level: newLevel });
});

levelDown.addEventListener('click', () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const newLevel = Math.max(1, (c.level || 1) - 1);
  updateDoc(charRef(c.id), { level: newLevel });
});

/* ---------- Wounds ---------- */

function renderWoundsPips(c) {
  woundsPips.innerHTML = '';
  const max = c.wounds?.max || 5;
  const current = c.wounds?.current || 0;
  for (let i = 0; i < max; i++) {
    const pip = document.createElement('button');
    pip.type = 'button';
    pip.className = 'wound-pip' + (i < current ? ' filled' : '') + (i === max - 1 ? ' skull' : '');
    pip.textContent = i === max - 1 ? '💀' : '';
    pip.addEventListener('click', () => {
      const level = i + 1;
      const newCurrent = (current === level) ? level - 1 : level;
      updateDoc(charRef(c.id), { 'wounds.current': newCurrent });
    });
    woundsPips.appendChild(pip);
  }
}

/* ---------- Skills ---------- */

function renderSkillsGrid(c) {
  skillsGrid.innerHTML = '';
  SKILL_DEFS.forEach(def => {
    const s = c.skills?.[def.key] || { base: 0, bonus: 0 };
    const row = document.createElement('div');
    row.className = 'skill-row';

    const nameCell = document.createElement('div');
    const nameSpan = document.createElement('span');
    nameSpan.className = 'skill-name';
    nameSpan.textContent = def.label;
    const attrSpan = document.createElement('span');
    attrSpan.className = 'skill-attr';
    attrSpan.textContent = def.attr;
    nameCell.appendChild(nameSpan);
    nameCell.appendChild(attrSpan);
    row.appendChild(nameCell);

    const baseInput = document.createElement('input');
    baseInput.type = 'number';
    baseInput.value = s.base ?? 0;
    baseInput.addEventListener('change', () => {
      updateDoc(charRef(c.id), { [`skills.${def.key}.base`]: Number(baseInput.value) || 0 });
    });
    row.appendChild(baseInput);

    const bonusInput = document.createElement('input');
    bonusInput.type = 'number';
    bonusInput.value = s.bonus ?? 0;
    bonusInput.addEventListener('change', () => {
      updateDoc(charRef(c.id), { [`skills.${def.key}.bonus`]: Number(bonusInput.value) || 0 });
    });
    row.appendChild(bonusInput);

    const total = document.createElement('div');
    total.className = 'skill-total';
    const totalVal = (Number(s.base) || 0) + (Number(s.bonus) || 0);
    total.textContent = (totalVal >= 0 ? '+' : '') + totalVal;
    row.appendChild(total);

    skillsGrid.appendChild(row);
  });
}

/* ---------- Waffen ---------- */

addWeaponBtn.addEventListener('click', () => openWeaponModal(null));

function openWeaponModal(weapon) {
  editingWeaponId = weapon ? weapon.id : null;
  weaponModalTitle.textContent = weapon ? 'Waffe bearbeiten' : 'Neue Waffe';
  weaponName.value = weapon ? weapon.name : '';
  weaponHandedness.value = weapon ? weapon.handedness : 'einhand';
  weaponRange.value = weapon ? weapon.range : 'nahkampf';
  weaponDamageDice.value = weapon ? (weapon.damageDice || '') : '';
  weaponMagical.checked = weapon ? !!weapon.magical : false;
  weaponDescription.value = weapon ? (weapon.description || '') : '';
  weaponDeleteBtn.classList.toggle('hidden', !weapon);
  weaponSaveBtn.disabled = weaponName.value.trim().length === 0;
  weaponModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => weaponName.focus(), 50);
}

function closeWeaponModal() {
  weaponModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingWeaponId = null;
}

weaponName.addEventListener('input', () => {
  weaponSaveBtn.disabled = weaponName.value.trim().length === 0;
});

weaponCancelBtn.addEventListener('click', closeWeaponModal);

weaponSaveBtn.addEventListener('click', async () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = weaponName.value.trim();
  if (!name) return;
  const weapons = [...(c.weapons || [])];
  const entry = {
    id: editingWeaponId || generateId(),
    name,
    handedness: weaponHandedness.value,
    range: weaponRange.value,
    magical: weaponMagical.checked,
    damageDice: weaponDamageDice.value.trim(),
    description: weaponDescription.value.trim(),
    equipped: false,
    lastModifiedBy: me,
    lastModifiedAt: Date.now()
  };
  if (editingWeaponId) {
    const idx = weapons.findIndex(w => w.id === editingWeaponId);
    if (idx !== -1) entry.equipped = weapons[idx].equipped;
    if (idx !== -1) weapons[idx] = entry; else weapons.push(entry);
  } else {
    weapons.push(entry);
  }
  await updateDoc(charRef(c.id), { weapons });
  closeWeaponModal();
});

weaponDeleteBtn.addEventListener('click', async () => {
  const c = getCurrentCharacter();
  if (!c || !editingWeaponId) return;
  if (!window.confirm('Diese Waffe wirklich löschen?')) return;
  const weapons = (c.weapons || []).filter(w => w.id !== editingWeaponId);
  await updateDoc(charRef(c.id), { weapons });
  closeWeaponModal();
});

function toggleEquip(c, weaponId) {
  const weapons = [...(c.weapons || [])];
  const w = weapons.find(x => x.id === weaponId);
  if (!w) return;
  const equippedCount = weapons.filter(x => x.equipped).length;
  if (!w.equipped && equippedCount >= 2) {
    alert('Es können maximal 2 Waffen gleichzeitig angelegt sein.');
    return;
  }
  w.equipped = !w.equipped;
  w.lastModifiedBy = me;
  w.lastModifiedAt = Date.now();
  updateDoc(charRef(c.id), { weapons });
}

function weaponTags(w) {
  const parts = [
    w.handedness === 'zweihand' ? 'Zweihand' : 'Einhand',
    w.range === 'fernkampf' ? 'Fernkampf' : 'Nahkampf'
  ];
  if (w.magical) parts.push('Magisch');
  if (w.damageDice) parts.push(w.damageDice);
  return parts.join(' · ');
}

function renderWeaponsList(c) {
  const weapons = [...(c.weapons || [])].sort((a, b) => {
    if (!!b.equipped !== !!a.equipped) return b.equipped ? 1 : -1;
    return (a.name || '').localeCompare(b.name || '');
  });
  weaponsList.innerHTML = '';
  weaponsEmpty.style.display = weapons.length ? 'none' : 'block';

  weapons.forEach(w => {
    const row = document.createElement('div');
    row.className = 'item-row' + (w.equipped ? ' equipped' : '');

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const check = document.createElement('button');
    check.type = 'button';
    check.className = 'equip-checkbox' + (w.equipped ? ' checked' : '');
    check.setAttribute('aria-label', w.equipped ? 'Ablegen' : 'Anlegen');
    check.addEventListener('click', () => toggleEquip(c, w.id));
    top.appendChild(check);

    const nameWrap = document.createElement('div');
    nameWrap.style.flex = '1';
    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = w.name;
    nameWrap.appendChild(nameEl);
    const tags = document.createElement('div');
    tags.className = 'item-row-tags';
    tags.textContent = weaponTags(w);
    nameWrap.appendChild(tags);
    top.appendChild(nameWrap);

    row.appendChild(top);

    if (w.description) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = w.description;
      row.appendChild(desc);
    }

    if (w.lastModifiedBy) {
      const meta = document.createElement('div');
      meta.className = 'item-row-meta';
      meta.textContent = `Zuletzt geändert von ${w.lastModifiedBy}`;
      row.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openWeaponModal(w));
    actions.appendChild(editBtn);

    const giveBtn = document.createElement('button');
    giveBtn.className = 'give';
    giveBtn.textContent = 'Geben';
    giveBtn.addEventListener('click', () => openGiveModal('weapon', w));
    actions.appendChild(giveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Löschen';
    delBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${w.name}" wirklich löschen?`)) return;
      const weapons = (c.weapons || []).filter(x => x.id !== w.id);
      await updateDoc(charRef(c.id), { weapons });
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    weaponsList.appendChild(row);
  });
}

/* ---------- Gegenstände ---------- */

addItemBtn.addEventListener('click', () => openItemModal(null));

function openItemModal(item) {
  editingItemId = item ? item.id : null;
  itemModalTitle.textContent = item ? 'Gegenstand bearbeiten' : 'Neuer Gegenstand';
  itemName.value = item ? item.name : '';
  itemQty.value = item ? item.qty : 1;
  itemEffect.value = item ? (item.effect || '') : '';
  itemDeleteBtn.classList.toggle('hidden', !item);
  itemSaveBtn.disabled = itemName.value.trim().length === 0;
  itemModal.classList.add('show');
  modalBackdrop.classList.add('show');
  setTimeout(() => itemName.focus(), 50);
}

function closeItemModal() {
  itemModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  editingItemId = null;
}

itemName.addEventListener('input', () => {
  itemSaveBtn.disabled = itemName.value.trim().length === 0;
});

itemCancelBtn.addEventListener('click', closeItemModal);

itemSaveBtn.addEventListener('click', async () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const name = itemName.value.trim();
  if (!name) return;
  const items = [...(c.items || [])];
  const entry = {
    id: editingItemId || generateId(),
    name,
    qty: Math.max(1, parseInt(itemQty.value, 10) || 1),
    effect: itemEffect.value.trim(),
    lastModifiedBy: me,
    lastModifiedAt: Date.now()
  };
  if (editingItemId) {
    const idx = items.findIndex(i => i.id === editingItemId);
    if (idx !== -1) items[idx] = entry; else items.push(entry);
  } else {
    items.push(entry);
  }
  await updateDoc(charRef(c.id), { items });
  closeItemModal();
});

itemDeleteBtn.addEventListener('click', async () => {
  const c = getCurrentCharacter();
  if (!c || !editingItemId) return;
  if (!window.confirm('Diesen Gegenstand wirklich löschen?')) return;
  const items = (c.items || []).filter(i => i.id !== editingItemId);
  await updateDoc(charRef(c.id), { items });
  closeItemModal();
});

function renderItemsList(c) {
  const items = [...(c.items || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  itemsList.innerHTML = '';
  itemsEmpty.style.display = items.length ? 'none' : 'block';

  items.forEach(it => {
    const row = document.createElement('div');
    row.className = 'item-row';

    const top = document.createElement('div');
    top.className = 'item-row-top';

    const qtyBadge = document.createElement('div');
    qtyBadge.className = 'item-qty-badge';
    qtyBadge.textContent = `${it.qty}×`;
    top.appendChild(qtyBadge);

    const nameEl = document.createElement('div');
    nameEl.className = 'item-row-name';
    nameEl.textContent = it.name;
    top.appendChild(nameEl);

    row.appendChild(top);

    if (it.effect) {
      const desc = document.createElement('div');
      desc.className = 'item-row-desc';
      desc.textContent = it.effect;
      row.appendChild(desc);
    }

    if (it.lastModifiedBy) {
      const meta = document.createElement('div');
      meta.className = 'item-row-meta';
      meta.textContent = `Zuletzt geändert von ${it.lastModifiedBy}`;
      row.appendChild(meta);
    }

    const actions = document.createElement('div');
    actions.className = 'item-row-actions';

    const editBtn = document.createElement('button');
    editBtn.textContent = 'Bearbeiten';
    editBtn.addEventListener('click', () => openItemModal(it));
    actions.appendChild(editBtn);

    const giveBtn = document.createElement('button');
    giveBtn.className = 'give';
    giveBtn.textContent = 'Geben';
    giveBtn.addEventListener('click', () => openGiveModal('item', it));
    actions.appendChild(giveBtn);

    const delBtn = document.createElement('button');
    delBtn.className = 'danger';
    delBtn.textContent = 'Löschen';
    delBtn.addEventListener('click', async () => {
      if (!window.confirm(`"${it.name}" wirklich löschen?`)) return;
      const items = (c.items || []).filter(x => x.id !== it.id);
      await updateDoc(charRef(c.id), { items });
    });
    actions.appendChild(delBtn);

    row.appendChild(actions);
    itemsList.appendChild(row);
  });
}

/* ---------- Geben ---------- */

function openGiveModal(type, entry) {
  const c = getCurrentCharacter();
  if (!c) return;
  giveContext = { type, entryId: entry.id, sourceCharId: c.id, maxQty: entry.qty || 1 };
  giveModalTitle.textContent = `"${entry.name}" weitergeben`;

  giveTargetSelect.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = '-- Charakter wählen --';
  giveTargetSelect.appendChild(placeholder);
  characters.filter(other => other.id !== c.id).forEach(other => {
    const opt = document.createElement('option');
    opt.value = other.id;
    opt.textContent = other.name;
    giveTargetSelect.appendChild(opt);
  });

  giveQtyRow.classList.toggle('hidden', type !== 'item');
  if (type === 'item') {
    giveQty.max = giveContext.maxQty;
    giveQty.value = giveContext.maxQty;
  }

  giveConfirmBtn.disabled = true;
  giveModal.classList.add('show');
  modalBackdrop.classList.add('show');
}

function closeGiveModal() {
  giveModal.classList.remove('show');
  modalBackdrop.classList.remove('show');
  giveContext = null;
}

giveTargetSelect.addEventListener('change', () => {
  giveConfirmBtn.disabled = giveTargetSelect.value.length === 0;
});

giveCancelBtn.addEventListener('click', closeGiveModal);

giveConfirmBtn.addEventListener('click', async () => {
  if (!giveContext) return;
  const targetId = giveTargetSelect.value;
  if (!targetId) return;
  const { type, entryId, sourceCharId } = giveContext;
  const sourceRef = charRef(sourceCharId);
  const targetRef = charRef(targetId);

  giveConfirmBtn.disabled = true;
  try {
    await runTransaction(db, async (tx) => {
      const sourceSnap = await tx.get(sourceRef);
      const targetSnap = await tx.get(targetRef);
      if (!sourceSnap.exists() || !targetSnap.exists()) throw new Error('Charakter nicht mehr vorhanden');
      const sourceData = sourceSnap.data();
      const targetData = targetSnap.data();

      if (type === 'weapon') {
        const weapons = [...(sourceData.weapons || [])];
        const idx = weapons.findIndex(w => w.id === entryId);
        if (idx === -1) throw new Error('Waffe nicht mehr vorhanden');
        const [w] = weapons.splice(idx, 1);
        w.equipped = false;
        w.lastModifiedBy = me;
        w.lastModifiedAt = Date.now();
        const targetWeapons = [...(targetData.weapons || []), w];
        tx.update(sourceRef, { weapons });
        tx.update(targetRef, { weapons: targetWeapons });
      } else {
        const amount = Math.max(1, parseInt(giveQty.value, 10) || 1);
        const items = [...(sourceData.items || [])];
        const idx = items.findIndex(i => i.id === entryId);
        if (idx === -1) throw new Error('Gegenstand nicht mehr vorhanden');
        const srcItem = items[idx];
        const take = Math.min(amount, srcItem.qty);
        if (take <= 0) throw new Error('Ungültige Menge');
        if (take >= srcItem.qty) items.splice(idx, 1);
        else items[idx] = { ...srcItem, qty: srcItem.qty - take, lastModifiedBy: me, lastModifiedAt: Date.now() };

        const targetItems = [...(targetData.items || [])];
        const existingIdx = targetItems.findIndex(i => i.name.trim().toLowerCase() === srcItem.name.trim().toLowerCase());
        if (existingIdx !== -1) {
          targetItems[existingIdx] = {
            ...targetItems[existingIdx],
            qty: targetItems[existingIdx].qty + take,
            lastModifiedBy: me,
            lastModifiedAt: Date.now()
          };
        } else {
          targetItems.push({
            id: generateId(), name: srcItem.name, qty: take, effect: srcItem.effect,
            lastModifiedBy: me, lastModifiedAt: Date.now()
          });
        }
        tx.update(sourceRef, { items });
        tx.update(targetRef, { items: targetItems });
      }
    });
    closeGiveModal();
  } catch (e) {
    alert(e.message || 'Weitergeben fehlgeschlagen.');
  } finally {
    giveConfirmBtn.disabled = false;
  }
});

/* ---------- Quest-Log ---------- */

addQuestLogBtn.addEventListener('click', async () => {
  const c = getCurrentCharacter();
  if (!c) return;
  const text = questLogInput.value.trim();
  if (!text) return;
  const questLog = [...(c.questLog || []), {
    id: generateId(), text, author: me, timestamp: Date.now()
  }];
  await updateDoc(charRef(c.id), { questLog });
  questLogInput.value = '';
});

function renderQuestLog(c) {
  const entries = [...(c.questLog || [])].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  questLogList.innerHTML = '';
  questLogEmpty.style.display = entries.length ? 'none' : 'block';

  entries.forEach(entry => {
    const row = document.createElement('div');
    row.className = 'questlog-entry';

    const text = document.createElement('div');
    text.className = 'questlog-entry-text';
    text.textContent = entry.text;
    row.appendChild(text);

    const meta = document.createElement('div');
    meta.className = 'questlog-entry-meta';
    meta.textContent = `${entry.author || '?'} · ${formatDateTime(entry.timestamp)}`;
    row.appendChild(meta);

    questLogList.appendChild(row);
  });
}

/* ---------- Sheet: Gesamt-Render ---------- */

function setValueIfNotFocused(inputEl, value) {
  if (document.activeElement === inputEl) return;
  inputEl.value = value;
}

function renderCharacterSheet() {
  const c = getCurrentCharacter();
  if (!c) return;

  setValueIfNotFocused(chName, c.name || '');
  setValueIfNotFocused(chAncestry, c.ancestry || '');
  setValueIfNotFocused(chClass, c.className || '');
  levelValue.textContent = c.level || 1;
  setValueIfNotFocused(statStr, c.attributes?.str ?? 0);
  setValueIfNotFocused(statDex, c.attributes?.dex ?? 0);
  setValueIfNotFocused(statInt, c.attributes?.int ?? 0);
  setValueIfNotFocused(statWil, c.attributes?.wil ?? 0);
  setValueIfNotFocused(hpCurrent, c.hp?.current ?? 0);
  setValueIfNotFocused(hpMax, c.hp?.max ?? 0);
  setValueIfNotFocused(hpTemp, c.hp?.temp ?? 0);
  setValueIfNotFocused(initiative, c.initiative ?? 0);
  setValueIfNotFocused(armor, c.armor || '');
  setValueIfNotFocused(hitDice, c.hitDice || '');
  setValueIfNotFocused(chSize, c.size || '');
  setValueIfNotFocused(chSpeed, c.speed || '');
  setValueIfNotFocused(chWeight, c.weight || '');
  setValueIfNotFocused(woundsMax, c.wounds?.max ?? 5);
  setValueIfNotFocused(curCopper, c.currency?.copper ?? 0);
  setValueIfNotFocused(curSilver, c.currency?.silver ?? 0);
  setValueIfNotFocused(curGold, c.currency?.gold ?? 0);
  setValueIfNotFocused(curPlatinum, c.currency?.platinum ?? 0);

  renderWoundsPips(c);
  renderSkillsGrid(c);
  renderWeaponsList(c);
  renderItemsList(c);
  renderQuestLog(c);
}

/* ---------- Firestore-Listener ---------- */

onSnapshot(query(collection(db, 'storyline'), orderBy('createdAt', 'desc')), (snap) => {
  storylineEntries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  renderStoryline();
});

onSnapshot(query(collection(db, 'characters'), orderBy('name', 'asc')), (snap) => {
  characters = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  if (activeSection === 'characters') {
    if (currentCharacterId) {
      if (getCurrentCharacter()) {
        renderCharacterSheet();
      } else {
        showCharList();
      }
    } else {
      renderCharList();
    }
  }
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

updateFabVisibility();
showOnboardingIfNeeded();
